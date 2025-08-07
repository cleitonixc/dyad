import { LanguageModelV1 } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { createGoogleGenerativeAI as createGoogle } from "@ai-sdk/google";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { createOllama } from "ollama-ai-provider";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import type { LargeLanguageModel, UserSettings } from "../../lib/schemas";
import { getEnvVar } from "./read_env";
import log from "electron-log";
import { getLanguageModelProviders } from "../shared/language_model_helpers";
import { LanguageModelProvider } from "../ipc_types";
import { createDyadEngine } from "./llm_engine_provider";
import {
  createHybridProProvider,
  shouldUseLocalProProvider,
} from "./local_pro_provider";
import { getProviderCapabilities } from "./complete_local_provider";
import { wrapProviderWithDebug } from "./provider_debug";

import { LM_STUDIO_BASE_URL } from "./lm_studio_utils";

const dyadEngineUrl = process.env.DYAD_ENGINE_URL;
const dyadGatewayUrl = process.env.DYAD_GATEWAY_URL;

const AUTO_MODELS = [
  {
    provider: "google",
    name: "gemini-2.5-flash",
  },
  {
    provider: "anthropic",
    name: "claude-sonnet-4-20250514",
  },
  {
    provider: "openai",
    name: "gpt-4.1",
  },
];

export interface ModelClient {
  model: LanguageModelV1;
  builtinProviderId?: string;
}

interface UserProviderResult {
  provider: any;
  modelName: string;
}

/**
 * Garante que um modelo tem a interface LanguageModelV1 completa
 */
function ensureLanguageModelV1Interface(model: any): LanguageModelV1 {
  // Se o modelo já tem a interface completa, retorná-lo
  if (
    model &&
    typeof model.doStream === "function" &&
    typeof model.doGenerate === "function"
  ) {
    return model as LanguageModelV1;
  }

  // Se não tem, criar um wrapper que implementa a interface
  logger.warn(
    "Modelo não tem interface LanguageModelV1 completa, criando wrapper",
  );

  return {
    specificationVersion: "v1" as const,
    provider: model?.provider || "unknown",
    modelId: model?.modelId || "unknown",
    defaultObjectGenerationMode: "tool" as const,

    async doGenerate(options: any) {
      // Tentar usar generateText se disponível
      if (typeof model?.generateText === "function") {
        const result = await model.generateText(options);
        return {
          text: result.text || result,
          finishReason: "stop" as const,
          usage: { promptTokens: 0, completionTokens: 0 },
          rawCall: { rawPrompt: options, rawSettings: {} },
          warnings: undefined,
          logprobs: undefined,
          request: { body: JSON.stringify(options) },
          response: { headers: {}, body: "" },
        };
      }

      throw new Error("Modelo não suporta geração de texto");
    },

    async doStream(options: any) {
      // Tentar usar streamText se disponível
      if (typeof model?.streamText === "function") {
        return await model.streamText(options);
      }

      // Se não tem streaming, simular com doGenerate
      const result = await this.doGenerate(options);
      return {
        stream: (async function* () {
          yield { type: "text-delta" as const, textDelta: result.text };
          yield {
            type: "finish" as const,
            finishReason: result.finishReason,
            usage: result.usage,
          };
        })(),
      };
    },
  } as LanguageModelV1;
}

/**
 * Cria um provider baseado nas configurações do usuário (OpenAI, Anthropic, etc.)
 * sem depender de APIs do Dyad Pro
 */
async function createUserProvider(
  model: LargeLanguageModel,
  settings: UserSettings,
  _files?: any[],
): Promise<UserProviderResult | null> {
  logger.debug(
    `createUserProvider chamado para modelo: ${model.name}, provider: ${model.provider}`,
  );
  logger.debug(`Configurações do provider:`, {
    providerSettings: Object.keys(settings.providerSettings || {}),
    hasProviderConfig: !!settings.providerSettings[model.provider],
    hasApiKey: !!settings.providerSettings[model.provider]?.apiKey?.value,
  });

  const allProviders = await getLanguageModelProviders();
  logger.debug(`Total de providers carregados: ${allProviders.length}`);
  logger.debug(
    `Providers disponíveis:`,
    allProviders.map((p) => ({
      id: p.id,
      name: p.name,
      apiBaseUrl: p.apiBaseUrl || "N/A",
    })),
  );

  const providerConfig = allProviders.find((p) => p.id === model.provider);

  if (!providerConfig) {
    logger.error(
      `Configuração não encontrada para provider ${model.provider}. Providers disponíveis: ${allProviders.map((p) => p.id).join(", ")}`,
    );
    throw new Error(
      `Provider "${model.provider}" não encontrado. Providers disponíveis: ${allProviders.map((p) => p.id).join(", ")}`,
    );
  }

  logger.debug(`Provider config encontrado:`, {
    id: providerConfig.id,
    name: providerConfig.name,
    apiBaseUrl: providerConfig.apiBaseUrl,
    hasApiBaseUrl: !!providerConfig.apiBaseUrl,
  });

  // Obter API key do usuário para o provider
  const userApiKey = settings.providerSettings[model.provider]?.apiKey?.value;
  if (!userApiKey) {
    logger.error(
      `Nenhuma API key encontrada para provider ${model.provider}. Configurações disponíveis: ${Object.keys(settings.providerSettings || {}).join(", ")}`,
    );
    throw new Error(
      `API key não configurada para o provider "${model.provider}". Configure uma API key válida nas configurações.`,
    );
  }

  let provider;
  let modelName = model.name.split(":free")[0];

  // Para a maioria dos providers, removemos o prefixo se já estiver presente
  // Mas o OpenRouter precisa manter o prefixo para identificar corretamente os modelos
  const prefix = providerConfig.gatewayPrefix || "";
  if (
    prefix &&
    modelName.startsWith(prefix) &&
    model.provider !== "openrouter"
  ) {
    modelName = modelName.substring(prefix.length);
  }

  logger.debug(`Nome do modelo após limpeza: ${modelName}`);

  // Criar provider baseado no tipo
  try {
    switch (model.provider) {
      case "openai":
        const { createOpenAI } = await import("@ai-sdk/openai");
        provider = createOpenAI({
          apiKey: userApiKey,
        });
        break;

      case "anthropic":
        const { createAnthropic } = await import("@ai-sdk/anthropic");
        provider = createAnthropic({
          apiKey: userApiKey,
        });
        break;

      case "google":
        const { createGoogleGenerativeAI } = await import("@ai-sdk/google");
        provider = createGoogleGenerativeAI({
          apiKey: userApiKey,
        });
        break;

      case "openrouter":
        const { createOpenRouter } = await import(
          "@openrouter/ai-sdk-provider"
        );
        provider = createOpenRouter({
          apiKey: userApiKey,
        });
        break;

      default:
        // Para outros providers, usar OpenAI compatible
        const baseURL = providerConfig.apiBaseUrl?.trim();

        if (!baseURL) {
          throw new Error(
            `API Base URL não encontrada para o provider ${model.provider}. Configure uma URL válida nas configurações.`,
          );
        }

        // Validar se a URL é válida
        try {
          new URL(baseURL);
        } catch {
          throw new Error(
            `URL inválida para o provider ${model.provider}: "${baseURL}". Configure uma URL válida nas configurações.`,
          );
        }

        provider = createOpenAICompatible({
          name: model.provider,
          apiKey: userApiKey,
          baseURL: baseURL,
        });
        break;
    }
  } catch (error) {
    logger.error(`Erro ao criar provider ${model.provider}:`, error);
    throw new Error(
      `Falha ao criar provider "${model.provider}": ${(error as Error).message}`,
    );
  }

  logger.info(
    `Provider do usuário criado: ${model.provider} com modelo ${modelName}`,
  );

  // O provider do AI SDK é uma função que retorna um LanguageModelV1
  // Precisamos estruturá-lo corretamente para o createHybridProProvider

  // Para providers built-in (openai, anthropic, google), usar apenas o modelName limpo
  // Para OpenRouter, manter o prefixo original se já estiver presente
  // Para custom providers, aplicar o gatewayPrefix se necessário
  let finalModelName = modelName;
  if (!["openai", "anthropic", "google"].includes(model.provider)) {
    // Para OpenRouter, usar o modelName tal como está (já contém o prefixo se necessário)
    if (model.provider === "openrouter") {
      finalModelName = modelName;
    } else {
      // Para custom providers, aplicar o gatewayPrefix
      finalModelName = `${providerConfig.gatewayPrefix || ""}${modelName}`;
    }
  }

  logger.debug(`Nome final do modelo: ${finalModelName}`);

  return {
    provider: provider, // Manter o provider como função do AI SDK
    modelName: finalModelName,
  };
}

interface File {
  path: string;
  content: string;
}

const logger = log.scope("getModelClient");

/**
 * Diagnostica problemas comuns de configuração de API
 */
function diagnoseApiConfiguration(
  model: LargeLanguageModel,
  settings: UserSettings,
): string[] {
  const issues: string[] = [];

  if (!settings.providerSettings) {
    issues.push("Nenhuma configuração de provider encontrada");
    return issues;
  }

  const providerConfig = settings.providerSettings[model.provider];
  if (!providerConfig) {
    issues.push(
      `Configuração não encontrada para o provider "${model.provider}"`,
    );
    issues.push(
      `Providers configurados: ${Object.keys(settings.providerSettings).join(", ") || "nenhum"}`,
    );
    return issues;
  }

  if (!providerConfig.apiKey) {
    issues.push(`API key não configurada para o provider "${model.provider}"`);
  } else if (!providerConfig.apiKey.value) {
    issues.push(`API key está vazia para o provider "${model.provider}"`);
  }

  return issues;
}
export async function getModelClient(
  model: LargeLanguageModel,
  settings: UserSettings,
  files?: File[],
): Promise<{
  modelClient: ModelClient;
  isEngineEnabled?: boolean;
}> {
  const allProviders = await getLanguageModelProviders();

  const dyadApiKey = settings.providerSettings?.auto?.apiKey?.value;

  // --- Handle specific provider ---
  const providerConfig = allProviders.find((p) => p.id === model.provider);

  if (!providerConfig) {
    throw new Error(`Configuration not found for provider: ${model.provider}`);
  }

  // Handle Pro features (local or external)
  const capabilities = getProviderCapabilities(settings);

  // Use funcionalidades locais sempre que disponíveis
  if (capabilities.local) {
    logger.info("🏠 Usando funcionalidades Pro locais com provider do usuário");

    // Para funcionalidades locais, usar o provider escolhido pelo usuário (OpenAI, Anthropic, etc.)
    // mas aplicar as funcionalidades Pro localmente
    // Isso permite usar Smart Context e Turbo Edits sem depender de APIs do Dyad

    // Criar provider do usuário normal e depois aplicar funcionalidades locais
    const userProvider = await createUserProvider(model, settings, files);

    if (!userProvider) {
      const issues = diagnoseApiConfiguration(model, settings);
      const diagnosis =
        issues.length > 0
          ? `\n\nDiagnóstico:\n${issues.map((issue) => `• ${issue}`).join("\n")}`
          : "";
      throw new Error(
        `Não foi possível criar provider do usuário. Verifique as configurações de API.${diagnosis}`,
      );
    }

    // Debug: verificar estrutura do provider do usuário
    logger.debug("Provider do usuário:", {
      providerType: typeof userProvider.provider,
      providerKeys:
        typeof userProvider.provider === "object"
          ? Object.keys(userProvider.provider)
          : [],
      modelName: userProvider.modelName,
      isFunction: typeof userProvider.provider === "function",
    });

    // Aplicar funcionalidades Pro locais sobre o provider do usuário
    const enhancedProvider = createHybridProProvider(
      userProvider.provider,
      settings,
      {
        enableSmartContext: settings.enableLocalSmartContext,
        enableTurboEdits: settings.enableLocalTurboEdits,
        files,
      },
    );

    // Criar o modelo e garantir que tem a interface LanguageModelV1 completa
    const rawModel = enhancedProvider.model(userProvider.modelName);
    const finalModel = ensureLanguageModelV1Interface(rawModel);

    return {
      modelClient: {
        model: finalModel,
      },
      isEngineEnabled: false, // Não estamos usando engine externo
    };
  }

  // Sistema externo não é mais usado - apenas funcionalidades locais
  // Bloco comentado - funcionalidades externas desabilitadas
  // if (false) {
  // Check if the selected provider supports Dyad Pro (has a gateway prefix) OR
  // we're using local engine.
  // IMPORTANT: some providers like OpenAI have an empty string gateway prefix,
  // so we do a nullish and not a truthy check here.
  if (providerConfig?.gatewayPrefix != null || dyadEngineUrl) {
    const isEngineEnabled = false; // Sem funcionalidades externas

    // Check if we should use hybrid local Pro features
    const useLocalPro = shouldUseLocalProProvider(settings);

    let provider;

    if (useLocalPro) {
      // Use local Pro provider with hybrid fallback
      const baseProvider = isEngineEnabled
        ? wrapProviderWithDebug(
            createDyadEngine({
              apiKey: dyadApiKey,
              baseURL: dyadEngineUrl ?? "https://engine.dyad.sh/v1",
              originalProviderId: model.provider,
              dyadOptions: {
                enableLazyEdits: false, // Disabled in favor of local Turbo Edits
                enableSmartFilesContext: false, // Disabled in favor of local Smart Context
              },
              settings,
            }),
            "DyadEngine",
          )
        : wrapProviderWithDebug(
            createOpenAICompatible({
              name: "dyad-gateway",
              apiKey: dyadApiKey,
              baseURL: dyadGatewayUrl ?? "https://llm-gateway.dyad.sh/v1",
            }),
            "DyadGateway",
          );

      provider = createHybridProProvider(baseProvider, settings, {
        enableSmartContext: settings.enableLocalSmartContext,
        enableTurboEdits: settings.enableLocalTurboEdits,
        files,
      });
    } else {
      // Use external Dyad Engine as before
      provider = isEngineEnabled
        ? createDyadEngine({
            apiKey: dyadApiKey,
            baseURL: dyadEngineUrl ?? "https://engine.dyad.sh/v1",
            originalProviderId: model.provider,
            dyadOptions: {
              enableLazyEdits: false, // Funcionalidades externas desabilitadas
              enableSmartFilesContext: false, // Funcionalidades externas desabilitadas
            },
            settings,
          })
        : createOpenAICompatible({
            name: "dyad-gateway",
            apiKey: dyadApiKey,
            baseURL: dyadGatewayUrl ?? "https://llm-gateway.dyad.sh/v1",
          });
    }

    logger.info(
      `\x1b[1;97;44m Using Dyad Pro API key for model: ${model.name}. engine_enabled=${isEngineEnabled}, hybrid_local=${useLocalPro} \x1b[0m`,
    );

    if (useLocalPro) {
      logger.info(
        `\x1b[1;30;45m Using Hybrid Local Pro Features: Smart Context=${settings.enableLocalSmartContext}, Turbo Edits=${settings.enableLocalTurboEdits} \x1b[0m`,
      );
    }

    if (isEngineEnabled) {
      logger.info(
        `\x1b[1;30;42m Using Dyad Pro engine: ${dyadEngineUrl ?? "<prod>"} \x1b[0m`,
      );
    } else {
      logger.info(
        `\x1b[1;30;43m Using Dyad Pro gateway: ${dyadGatewayUrl ?? "<prod>"} \x1b[0m`,
      );
    }
    // Do not use free variant (for openrouter).
    const modelName = model.name.split(":free")[0];
    const autoModelClient = {
      model: provider(
        `${providerConfig?.gatewayPrefix || ""}${modelName}`,
        isEngineEnabled
          ? {
              files,
            }
          : undefined,
      ),
      builtinProviderId: model.provider,
    };

    return {
      modelClient: autoModelClient,
      isEngineEnabled,
    };
  } else {
    logger.warn(
      `Dyad Pro enabled, but provider ${model.provider} does not have a gateway prefix defined. Falling back to direct provider connection.`,
    );
    // Fall through to regular provider logic if gateway prefix is missing
  }
  // }
  // Handle 'auto' provider by trying each model in AUTO_MODELS until one works
  if (model.provider === "auto") {
    for (const autoModel of AUTO_MODELS) {
      const providerInfo = allProviders.find(
        (p) => p.id === autoModel.provider,
      );
      const envVarName = providerInfo?.envVarName;

      const apiKey =
        settings.providerSettings?.[autoModel.provider]?.apiKey?.value ||
        (envVarName ? getEnvVar(envVarName) : undefined);

      if (apiKey) {
        logger.log(
          `Using provider: ${autoModel.provider} model: ${autoModel.name}`,
        );
        // Recursively call with the specific model found
        return await getModelClient(
          {
            provider: autoModel.provider,
            name: autoModel.name,
          },
          settings,
          files,
        );
      }
    }
    // If no models have API keys, throw an error
    throw new Error(
      "No API keys available for any model supported by the 'auto' provider.",
    );
  }
  return getRegularModelClient(model, settings, providerConfig);
}

function getRegularModelClient(
  model: LargeLanguageModel,
  settings: UserSettings,
  providerConfig: LanguageModelProvider,
) {
  // Get API key for the specific provider
  const apiKey =
    settings.providerSettings?.[model.provider]?.apiKey?.value ||
    (providerConfig.envVarName
      ? getEnvVar(providerConfig.envVarName)
      : undefined);

  const providerId = providerConfig.id;
  // Create client based on provider ID or type
  switch (providerId) {
    case "openai": {
      const provider = createOpenAI({ apiKey });
      return {
        modelClient: {
          model: provider(model.name),
          builtinProviderId: providerId,
        },
        backupModelClients: [],
      };
    }
    case "anthropic": {
      const provider = createAnthropic({ apiKey });
      return {
        modelClient: {
          model: provider(model.name),
          builtinProviderId: providerId,
        },
        backupModelClients: [],
      };
    }
    case "google": {
      const provider = createGoogle({ apiKey });
      return {
        modelClient: {
          model: provider(model.name),
          builtinProviderId: providerId,
        },
        backupModelClients: [],
      };
    }
    case "openrouter": {
      const provider = createOpenRouter({ apiKey });
      return {
        modelClient: {
          model: provider(model.name),
          builtinProviderId: providerId,
        },
        backupModelClients: [],
      };
    }
    case "ollama": {
      // Ollama typically runs locally and doesn't require an API key in the same way
      const ollamaHost = process.env.OLLAMA_HOST || "http://localhost:11434";

      logger.debug(`Usando Ollama baseURL: ${ollamaHost}`);

      // Validar URL do Ollama
      try {
        new URL(ollamaHost);
      } catch {
        logger.error(`URL inválida para Ollama: "${ollamaHost}"`);
        throw new Error(
          `URL inválida para Ollama: "${ollamaHost}". Configure OLLAMA_HOST com uma URL válida.`,
        );
      }

      const provider = createOllama({
        baseURL: ollamaHost,
      });
      return {
        modelClient: {
          model: provider(model.name),
        },
        backupModelClients: [],
      };
    }
    case "lmstudio": {
      // LM Studio uses OpenAI compatible API
      const baseURL = providerConfig.apiBaseUrl || LM_STUDIO_BASE_URL + "/v1";

      logger.debug(`Usando LM Studio baseURL: ${baseURL}`);

      // Validar URL do LM Studio
      try {
        new URL(baseURL);
      } catch {
        logger.error(`URL inválida para LM Studio: "${baseURL}"`);
        throw new Error(
          `URL inválida para LM Studio: "${baseURL}". Configure uma URL válida nas configurações.`,
        );
      }

      const provider = createOpenAICompatible({
        name: "lmstudio",
        baseURL,
      });
      return {
        modelClient: {
          model: provider(model.name),
        },
        backupModelClients: [],
      };
    }
    default: {
      // Handle custom providers
      if (providerConfig.type === "custom") {
        if (!providerConfig.apiBaseUrl) {
          throw new Error(
            `Custom provider ${model.provider} is missing the API Base URL.`,
          );
        }

        logger.debug(
          `Usando Custom provider baseURL: ${providerConfig.apiBaseUrl}`,
        );

        // Validar URL do custom provider
        try {
          new URL(providerConfig.apiBaseUrl);
        } catch {
          logger.error(
            `URL inválida para custom provider ${model.provider}: "${providerConfig.apiBaseUrl}"`,
          );
          throw new Error(
            `URL inválida para custom provider ${model.provider}: "${providerConfig.apiBaseUrl}". Configure uma URL válida nas configurações.`,
          );
        }

        // Assume custom providers are OpenAI compatible for now
        const provider = createOpenAICompatible({
          name: providerConfig.id,
          baseURL: providerConfig.apiBaseUrl,
          apiKey,
        });
        return {
          modelClient: {
            model: provider(model.name),
          },
          backupModelClients: [],
        };
      }
      // If it's not a known ID and not type 'custom', it's unsupported
      throw new Error(`Unsupported model provider: ${model.provider}`);
    }
  }
}
