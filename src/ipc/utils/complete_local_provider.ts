import { LanguageModelV1 } from "@ai-sdk/provider";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { UserSettings } from "../../lib/schemas";
import { createSmartContextProcessor } from "../processors/smart_context_processor";
import { createTurboEditsProcessor } from "../processors/turbo_edits_processor";
import log from "electron-log";

const logger = log.scope("complete_local_provider");

export interface LocalProProviderSettings {
  apiKey?: string;
  baseURL?: string;
  headers?: Record<string, string>;
  queryParams?: Record<string, string>;
  originalProviderId: string;
  localOptions: {
    enableSmartContext?: boolean;
    enableTurboEdits?: boolean;
  };
  settings: UserSettings;
}

export interface LocalProProvider {
  model: (modelId: string, config?: any) => LanguageModelV1;
  isLocal: true;
  capabilities: {
    smartContext: boolean;
    turboEdits: boolean;
  };
}

/**
 * Cria um provider completamente local que substitui o Dyad Engine
 */
export function createCompleteLocalProvider(
  options: LocalProProviderSettings,
): LocalProProvider {
  const {
    apiKey,
    baseURL,
    headers,
    queryParams,
    originalProviderId,
    localOptions,
    settings,
  } = options;

  logger.info(
    `Criando Complete Local Provider - original: ${originalProviderId}, Smart Context: ${localOptions.enableSmartContext}, Turbo Edits: ${localOptions.enableTurboEdits}`,
  );

  // Criar provider base baseado no provider original
  const baseProvider = createBaseProvider(originalProviderId, {
    apiKey,
    baseURL,
    headers,
    queryParams,
  });

  // Validar se o baseProvider foi criado corretamente
  if (!baseProvider) {
    logger.error("createBaseProvider retornou null/undefined");
    throw new Error("Falha ao criar baseProvider");
  }

  logger.debug("BaseProvider criado em complete_local_provider:", {
    type: typeof baseProvider,
    keys: Object.keys(baseProvider),
    isFunction: typeof baseProvider === "function",
    hasModel:
      baseProvider &&
      "model" in baseProvider &&
      typeof baseProvider.model === "function",
  });

  // Inicializar processadores se habilitados
  const smartContextProcessor = localOptions.enableSmartContext
    ? createSmartContextProcessor(settings)
    : null;

  const turboEditsProcessor = localOptions.enableTurboEdits
    ? createTurboEditsProcessor(settings)
    : null;

  const capabilities = {
    smartContext: !!smartContextProcessor,
    turboEdits: !!turboEditsProcessor,
  };

  return {
    model: (modelId: string, config: any = {}): LanguageModelV1 => {
      logger.debug(`Criando modelo local: ${modelId}`);

      // Extrair arquivos da configuração se presentes
      const { files, ...restConfig } = config;

      // Criar modelo base com detecção automática do tipo de provider
      let model: LanguageModelV1;
      try {
        if (typeof baseProvider === "function") {
          // Se baseProvider é uma função, chamá-la diretamente
          logger.debug(`Chamando baseProvider como função para: ${modelId}`);
          model = baseProvider(modelId, restConfig);
        } else if (
          baseProvider &&
          "model" in baseProvider &&
          typeof baseProvider.model === "function"
        ) {
          // Se tem método .model(), usá-lo
          logger.debug(`Chamando baseProvider.model para: ${modelId}`);
          model = baseProvider.model(modelId, restConfig);
        } else {
          logger.error(
            "baseProvider não tem método válido em complete_local_provider:",
            {
              baseProviderType: typeof baseProvider,
              baseProviderKeys: baseProvider ? Object.keys(baseProvider) : [],
              isFunction: typeof baseProvider === "function",
              hasModel:
                baseProvider &&
                "model" in baseProvider &&
                typeof baseProvider.model === "function",
            },
          );
          throw new Error(
            `Complete Local Provider: não encontrado método para criar modelo`,
          );
        }
      } catch (error) {
        logger.error(
          "Erro ao criar modelo base em complete_local_provider:",
          error,
        );
        throw new Error(
          `Erro ao criar modelo base: ${(error as Error).message || error}`,
        );
      }

      // Aplicar wrappers locais
      if (smartContextProcessor && files) {
        model = wrapWithLocalSmartContext(
          model,
          smartContextProcessor,
          files,
          settings,
        );
      }

      if (turboEditsProcessor) {
        model = wrapWithLocalTurboEdits(model, turboEditsProcessor, settings);
      }

      return model;
    },
    isLocal: true,
    capabilities,
  };
}

/**
 * Cria provider base baseado no provider original
 */
function createBaseProvider(
  originalProviderId: string,
  options: {
    apiKey?: string;
    baseURL?: string;
    headers?: Record<string, string>;
    queryParams?: Record<string, string>;
  },
) {
  // Se não há API key, criar um provider mock que não faz chamadas externas
  if (!options.apiKey) {
    logger.info("Criando provider mock para funcionalidades puramente locais");
    return createMockProvider(`local-${originalProviderId}`);
  }

  // Para casos com API key, usar OpenAI compatible
  return createOpenAICompatible({
    name: `local-${originalProviderId}`,
    apiKey: options.apiKey,
    baseURL: options.baseURL || "http://localhost:8080",
    headers: options.headers,
  });
}

/**
 * Cria um provider mock que não faz chamadas externas
 * Usado para funcionalidades puramente locais
 */
function createMockProvider(name: string) {
  return {
    model: (modelId: string, _config?: any) => ({
      specificationVersion: "v1" as const,
      provider: name,
      modelId,
      defaultObjectGenerationMode: "tool" as const,

      async doGenerate() {
        throw new Error(
          "Provider mock não deve ser usado para geração - apenas para funcionalidades locais",
        );
      },

      async doStream() {
        throw new Error(
          "Provider mock não deve ser usado para streaming - apenas para funcionalidades locais",
        );
      },
    }),
  };
}

/**
 * Wrapper que adiciona Smart Context local ao modelo
 */
function wrapWithLocalSmartContext(
  baseModel: LanguageModelV1,
  _processor: any,
  _files: any[],
  _settings: UserSettings,
): LanguageModelV1 {
  return {
    ...baseModel,
    specificationVersion: "v1" as const,
    provider: baseModel.provider,
    modelId: baseModel.modelId,

    async doGenerate(options: any) {
      try {
        logger.debug("Aplicando Smart Context local no doGenerate");

        // O Smart Context já é aplicado no extractCodebase durante a preparação do prompt
        // Este wrapper mantém compatibilidade mas não precisa fazer processamento adicional
        // pois o contexto já foi otimizado anteriormente

        return baseModel.doGenerate(options);
      } catch (error) {
        logger.error("Erro no Smart Context local:", error);
        return baseModel.doGenerate(options);
      }
    },

    async doStream(options: any) {
      try {
        logger.debug("Aplicando Smart Context local no doStream");
        return baseModel.doStream(options);
      } catch (error) {
        logger.error("Erro no Smart Context local (stream):", error);
        return baseModel.doStream(options);
      }
    },
  };
}

/**
 * Wrapper que adiciona Turbo Edits local ao modelo
 */
function wrapWithLocalTurboEdits(
  baseModel: LanguageModelV1,
  _processor: any,
  _settings: UserSettings,
): LanguageModelV1 {
  return {
    ...baseModel,
    specificationVersion: "v1" as const,
    provider: baseModel.provider,
    modelId: baseModel.modelId,

    async doGenerate(options: any) {
      try {
        // Detectar se é uma operação de edição
        const isEditOperation = detectEditOperation(options);

        if (isEditOperation) {
          logger.debug(
            "Detectada operação de edição - aplicando Turbo Edits local",
          );

          const optimizedOptions = await applyTurboEditsOptimization(
            options,
            processor,
          );

          return baseModel.doGenerate(optimizedOptions);
        }

        return baseModel.doGenerate(options);
      } catch (error) {
        logger.error("Erro no Turbo Edits local:", error);
        return baseModel.doGenerate(options);
      }
    },

    async doStream(options: any) {
      try {
        const isEditOperation = detectEditOperation(options);

        if (isEditOperation) {
          logger.debug(
            "Detectada operação de edição (stream) - aplicando Turbo Edits local",
          );

          const optimizedOptions = await applyTurboEditsOptimization(
            options,
            processor,
          );

          return baseModel.doStream(optimizedOptions);
        }

        return baseModel.doStream(options);
      } catch (error) {
        logger.error("Erro no Turbo Edits local (stream):", error);
        return baseModel.doStream(options);
      }
    },
  };
}

/**
 * Detecta se a operação é uma edição de código
 */
function detectEditOperation(options: any): boolean {
  if (!options || !options.prompt) {
    return false;
  }

  // Analisar prompt para detectar operações de edição
  const promptText = extractPromptText(options.prompt);

  const editKeywords = [
    "edit",
    "modify",
    "change",
    "update",
    "fix",
    "correct",
    "refactor",
    "optimize",
    "improve",
    "add",
    "remove",
    "implement",
    "create function",
    "add method",
    "dyad-write",
    "dyad-edit", // Tags específicas do Dyad
  ];

  const fileKeywords = [
    ".ts",
    ".tsx",
    ".js",
    ".jsx",
    ".py",
    ".java",
    ".cpp",
    "file:",
    "in the file",
    "src/",
    "components/",
  ];

  const hasEditKeyword = editKeywords.some((keyword) =>
    promptText.toLowerCase().includes(keyword),
  );

  const hasFileReference = fileKeywords.some((keyword) =>
    promptText.toLowerCase().includes(keyword),
  );

  const hasCodeBlock = promptText.includes("```") || promptText.includes("`");

  return hasEditKeyword && (hasFileReference || hasCodeBlock);
}

/**
 * Extrai texto do prompt (pode ser string ou objeto)
 */
function extractPromptText(prompt: any): string {
  if (typeof prompt === "string") {
    return prompt;
  }

  if (Array.isArray(prompt)) {
    return prompt
      .map((p) => (typeof p === "string" ? p : p.content || ""))
      .join(" ");
  }

  if (prompt && typeof prompt === "object") {
    return prompt.content || prompt.text || "";
  }

  return "";
}

/**
 * Aplica otimizações do Turbo Edits às opções
 */
async function applyTurboEditsOptimization(
  options: any,
  processor: any,
): Promise<any> {
  try {
    const promptText = extractPromptText(options.prompt);

    // Extrair informações do prompt para análise
    const filePathMatch = promptText.match(
      /(?:file:|\/|\\)([^:\s\n]+\.[a-z]+)/i,
    );
    const filePath = filePathMatch ? filePathMatch[1] : "unknown.ts";

    // Extrair conteúdo do arquivo se presente
    const codeBlockMatch = promptText.match(/```[\w]*\n([\s\S]*?)\n```/);
    const fileContent = codeBlockMatch ? codeBlockMatch[1] : "";

    if (!fileContent) {
      logger.debug("Nenhum conteúdo de arquivo detectado para otimização");
      return options;
    }

    // Gerar edição otimizada
    const optimizedEdit = await processor.generateOptimizedEdit(
      promptText,
      filePath,
      fileContent,
    );

    // Aplicar prompt otimizado
    const optimizedOptions = {
      ...options,
      prompt:
        typeof options.prompt === "string"
          ? optimizedEdit.optimizedPrompt
          : updatePromptObject(options.prompt, optimizedEdit.optimizedPrompt),
      maxTokens: Math.min(
        options.maxTokens || 4000,
        optimizedEdit.strategy.maxTokens,
      ),
    };

    logger.info(
      `Turbo Edits aplicado - Estratégia: ${optimizedEdit.strategy.modelSelection}, Tokens: ${optimizedEdit.strategy.maxTokens}`,
    );

    return optimizedOptions;
  } catch (error) {
    logger.error("Erro ao aplicar otimização Turbo Edits:", error);
    return options;
  }
}

/**
 * Atualiza objeto de prompt com novo conteúdo
 */
function updatePromptObject(promptObj: any, newContent: string): any {
  if (Array.isArray(promptObj)) {
    return promptObj.map((p) =>
      typeof p === "string" ? newContent : { ...p, content: newContent },
    );
  }

  if (promptObj && typeof promptObj === "object") {
    return { ...promptObj, content: newContent };
  }

  return newContent;
}

/**
 * Verifica se devemos usar o provider local completo
 */
export function shouldUseCompleteLocalProvider(
  settings: UserSettings,
): boolean {
  // Usar provider local se pelo menos uma funcionalidade local estiver habilitada
  return !!settings.enableLocalSmartContext || !!settings.enableLocalTurboEdits;
}

/**
 * Factory function que decide entre provider local e externo
 */
export function createOptimalProvider(
  originalOptions: any,
  settings: UserSettings,
  _files?: any[],
): any {
  const useLocal = shouldUseCompleteLocalProvider(settings);

  if (useLocal) {
    logger.info("Usando Complete Local Provider (sem dependências externas)");

    return createCompleteLocalProvider({
      ...originalOptions,
      localOptions: {
        enableSmartContext: settings.enableLocalSmartContext,
        enableTurboEdits: settings.enableLocalTurboEdits,
      },
      settings,
    });
  }

  logger.info("Funcionalidades locais desabilitadas - usando provider externo");
  return null; // Indica que deve usar provider externo
}

/**
 * Cria provider baseado nas preferências do usuário
 */
export function createPreferredProvider(
  externalProviderFactory: () => any,
  localProviderOptions: LocalProProviderSettings,
): any {
  const { settings } = localProviderOptions;

  // Verificar se o usuário prefere funcionalidades locais
  const preferLocal = shouldUseCompleteLocalProvider(settings);

  if (preferLocal) {
    logger.info("Criando provider local preferencial");
    return createCompleteLocalProvider(localProviderOptions);
  }

  logger.info("Criando provider externo");
  return externalProviderFactory();
}

/**
 * Obtém informações sobre as capacidades do provider
 */
export function getProviderCapabilities(settings: UserSettings): {
  local: boolean;
  smartContext: boolean;
  turboEdits: boolean;
  hybrid: boolean;
} {
  const localSmartContext = settings.enableLocalSmartContext;
  const localTurboEdits = settings.enableLocalTurboEdits;

  return {
    local: !!localSmartContext || !!localTurboEdits,
    smartContext: !!localSmartContext,
    turboEdits: !!localTurboEdits,
    hybrid: false, // Sempre false, só funcionalidades locais
  };
}

/**
 * Estatísticas de uso do provider local
 */
export interface LocalProviderStats {
  totalRequests: number;
  editRequests: number;
  smartContextApplied: number;
  turboEditsApplied: number;
  averageProcessingTime: number;
  errorRate: number;
}

// Cache simples para estatísticas
const statsCache: LocalProviderStats = {
  totalRequests: 0,
  editRequests: 0,
  smartContextApplied: 0,
  turboEditsApplied: 0,
  averageProcessingTime: 0,
  errorRate: 0,
};

export function getLocalProviderStats(): LocalProviderStats {
  return { ...statsCache };
}

export function updateLocalProviderStats(
  update: Partial<LocalProviderStats>,
): void {
  Object.assign(statsCache, update);
}

export function resetLocalProviderStats(): void {
  Object.assign(statsCache, {
    totalRequests: 0,
    editRequests: 0,
    smartContextApplied: 0,
    turboEditsApplied: 0,
    averageProcessingTime: 0,
    errorRate: 0,
  });
}
