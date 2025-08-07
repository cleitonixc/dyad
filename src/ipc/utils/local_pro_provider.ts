import { UserSettings } from "../../lib/schemas";
import { createSmartContextProcessor } from "../processors/smart_context_processor";
import {
  createTurboEditsProcessor,
  EditComplexity,
} from "../processors/turbo_edits_processor";
import log from "electron-log";

const logger = log.scope("local_pro_provider");

export interface LocalProProvider {
  model: (modelId: string, config?: any) => any;
  isLocalProEnabled: boolean;
  capabilities: {
    smartContext: boolean;
    turboEdits: boolean;
  };
}

export interface LocalProOptions {
  enableSmartContext?: boolean;
  enableTurboEdits?: boolean;
  files?: any[];
}

/**
 * Cria um provider local que oferece funcionalidades Pro sem dependências externas
 */
export function createLocalProProvider(
  baseProvider: any,
  settings: UserSettings,
  options: LocalProOptions = {},
): LocalProProvider {
  // Debug logs para entender o baseProvider
  logger.debug("createLocalProProvider chamado com:", {
    baseProviderType: typeof baseProvider,
    baseProviderKeys: baseProvider ? Object.keys(baseProvider) : [],
    hasModelMethod: typeof baseProvider?.model === "function",
    settings: {
      enableLocalSmartContext: settings.enableLocalSmartContext,
      enableLocalTurboEdits: settings.enableLocalTurboEdits,
    },
    options,
  });

  const isSmartContextEnabled =
    (settings.enableLocalSmartContext ?? false) &&
    options.enableSmartContext !== false;
  const isTurboEditsEnabled =
    (settings.enableLocalTurboEdits ?? false) &&
    options.enableTurboEdits !== false;

  logger.info(
    `Local Pro Provider inicializado - Smart Context: ${isSmartContextEnabled}, Turbo Edits: ${isTurboEditsEnabled}`,
  );

  const capabilities = {
    smartContext: isSmartContextEnabled,
    turboEdits: isTurboEditsEnabled,
  };

  return {
    model: (modelId: string, config?: any) => {
      // Verificar se baseProvider tem método model
      if (!baseProvider) {
        logger.error("baseProvider é null ou undefined");
        throw new Error("Provider inválido: baseProvider é null ou undefined");
      }

      // O baseProvider pode ser uma função ou ter método .model() ou .chatModel()
      let enhancedModel;
      try {
        if (typeof baseProvider === "function") {
          // Se baseProvider é uma função, chamá-la diretamente
          logger.debug(`Chamando baseProvider como função para: ${modelId}`);
          enhancedModel = baseProvider(modelId, config);
        } else if (typeof baseProvider?.model === "function") {
          // Se tem método .model(), usá-lo
          logger.debug(`Chamando baseProvider.model para: ${modelId}`);
          enhancedModel = baseProvider.model(modelId, config);
        } else {
          logger.error("baseProvider não tem método válido:", {
            baseProviderType: typeof baseProvider,
            baseProviderKeys: baseProvider ? Object.keys(baseProvider) : [],
            isFunction: typeof baseProvider === "function",
            hasModel: typeof baseProvider?.model,
          });
          throw new Error(
            `Provider inválido: não encontrado método para criar modelo`,
          );
        }
      } catch (error) {
        logger.error("Erro ao criar modelo base:", error);
        throw new Error(
          `Erro ao criar modelo base: ${(error as Error).message || error}`,
        );
      }

      // Wrapper para Smart Context local
      if (isSmartContextEnabled) {
        enhancedModel = wrapWithLocalSmartContext(
          enhancedModel,
          settings,
          options.files,
        );
      }

      // Wrapper para Turbo Edits local
      if (isTurboEditsEnabled) {
        enhancedModel = wrapWithLocalTurboEdits(enhancedModel, settings);
      }

      return enhancedModel;
    },
    isLocalProEnabled: isSmartContextEnabled || isTurboEditsEnabled,
    capabilities,
  };
}

/**
 * Wrapper que adiciona Smart Context local ao modelo
 */
function wrapWithLocalSmartContext(
  baseModel: any,
  settings: UserSettings,
  files?: any[],
): any {
  createSmartContextProcessor(settings); // Preparar processador para uso futuro

  return {
    ...baseModel,

    // Interface LanguageModelV1
    async doGenerate(options: any) {
      try {
        // Se há arquivos e prompt disponível, aplicar Smart Context
        if (files && files.length > 0) {
          logger.debug("Aplicando Smart Context local no doGenerate");

          // O Smart Context já é aplicado no extractCodebase
          // Este wrapper mantém compatibilidade com a interface
        }

        return baseModel.doGenerate
          ? baseModel.doGenerate(options)
          : baseModel.generateText?.(options);
      } catch (error) {
        logger.error("Erro no Smart Context local:", error);
        // Fallback para modelo base
        return baseModel.doGenerate
          ? baseModel.doGenerate(options)
          : baseModel.generateText?.(options);
      }
    },

    async doStream(options: any) {
      try {
        if (files && files.length > 0) {
          logger.debug("Aplicando Smart Context local no doStream");
        }

        return baseModel.doStream
          ? baseModel.doStream(options)
          : baseModel.streamText?.(options);
      } catch (error) {
        logger.error("Erro no Smart Context local (stream):", error);
        return baseModel.doStream
          ? baseModel.doStream(options)
          : baseModel.streamText?.(options);
      }
    },

    // Manter compatibilidade com interface antiga se necessário
    generateText: async function (params: any) {
      const result = await this.doGenerate(params);
      return result.text || result;
    },

    generateObject: async function (params: any) {
      return baseModel.generateObject?.(params) || this.generateText(params);
    },
  };
}

/**
 * Wrapper que adiciona Turbo Edits local ao modelo
 */
function wrapWithLocalTurboEdits(baseModel: any, settings: UserSettings): any {
  const turboEditsProcessor = createTurboEditsProcessor(settings);

  return {
    ...baseModel,

    // Interface LanguageModelV1
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
            turboEditsProcessor,
          );

          return baseModel.doGenerate
            ? baseModel.doGenerate(optimizedOptions)
            : baseModel.generateText?.(optimizedOptions);
        }

        return baseModel.doGenerate
          ? baseModel.doGenerate(options)
          : baseModel.generateText?.(options);
      } catch (error) {
        logger.error("Erro no Turbo Edits local:", error);
        // Fallback para modelo base
        return baseModel.doGenerate
          ? baseModel.doGenerate(options)
          : baseModel.generateText?.(options);
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
            turboEditsProcessor,
          );

          return baseModel.doStream
            ? baseModel.doStream(optimizedOptions)
            : baseModel.streamText?.(optimizedOptions);
        }

        return baseModel.doStream
          ? baseModel.doStream(options)
          : baseModel.streamText?.(options);
      } catch (error) {
        logger.error("Erro no Turbo Edits local (stream):", error);
        return baseModel.doStream
          ? baseModel.doStream(options)
          : baseModel.streamText?.(options);
      }
    },

    // Manter compatibilidade com interface antiga se necessário
    generateText: async function (params: any) {
      const result = await this.doGenerate(params);
      return result.text || result;
    },

    generateObject: async function (params: any) {
      // Turbo Edits pode otimizar gerações de objeto também
      const isEditOperation = detectEditOperation(params);

      if (isEditOperation) {
        try {
          const optimizedParams = await applyTurboEditsOptimization(
            params,
            turboEditsProcessor,
          );

          return (
            baseModel.generateObject?.(optimizedParams) ||
            this.generateText(optimizedParams)
          );
        } catch (error) {
          logger.error("Erro no Turbo Edits local para generateObject:", error);
        }
      }

      return baseModel.generateObject?.(params) || this.generateText(params);
    },
  };
}

/**
 * Detecta se a operação é uma edição de código
 */
function detectEditOperation(params: any): boolean {
  if (!params || !params.prompt) {
    return false;
  }

  const prompt = (
    typeof params.prompt === "string"
      ? params.prompt
      : params.prompt.content || ""
  ).toLowerCase();

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
    prompt.includes(keyword),
  );
  const hasFileReference = fileKeywords.some((keyword) =>
    prompt.includes(keyword),
  );

  // Detectar também se há blocos de código no prompt
  const hasCodeBlock = prompt.includes("```") || prompt.includes("`");

  return hasEditKeyword && (hasFileReference || hasCodeBlock);
}

/**
 * Aplica otimizações do Turbo Edits aos parâmetros
 */
async function applyTurboEditsOptimization(
  params: any,
  turboEditsProcessor: any,
): Promise<any> {
  try {
    const prompt =
      typeof params.prompt === "string"
        ? params.prompt
        : params.prompt.content || "";

    // Extrair informações do prompt para análise
    const filePathMatch = prompt.match(/(?:file:|\/|\\)([^:\s\n]+\.[a-z]+)/i);
    const filePath = filePathMatch ? filePathMatch[1] : "unknown.ts";

    // Extrair conteúdo do arquivo se presente
    const codeBlockMatch = prompt.match(/```[\w]*\n([\s\S]*?)\n```/);
    const fileContent = codeBlockMatch ? codeBlockMatch[1] : "";

    if (!fileContent) {
      logger.debug("Nenhum conteúdo de arquivo detectado para otimização");
      return params;
    }

    // Gerar edição otimizada
    const optimizedEdit = await turboEditsProcessor.generateOptimizedEdit(
      prompt,
      filePath,
      fileContent,
    );

    // Aplicar prompt otimizado
    const optimizedParams = {
      ...params,
      prompt:
        typeof params.prompt === "string"
          ? optimizedEdit.optimizedPrompt
          : {
              ...params.prompt,
              content: optimizedEdit.optimizedPrompt,
            },
      maxTokens: Math.min(
        params.maxTokens || 4000,
        optimizedEdit.strategy.maxTokens,
      ),
      // Adicionar metadados para rastreamento
      metadata: {
        ...params.metadata,
        turboEditsStrategy: optimizedEdit.strategy.modelSelection,
        editComplexity: optimizedEdit.strategy.promptTemplate.includes(
          "COMPLEX",
        )
          ? "complex"
          : "moderate",
        optimizationApplied: true,
      },
    };

    logger.info(
      `Turbo Edits aplicado - Estratégia: ${optimizedEdit.strategy.modelSelection}, Tokens: ${optimizedEdit.strategy.maxTokens}`,
    );

    return optimizedParams;
  } catch (error) {
    logger.error("Erro ao aplicar otimização Turbo Edits:", error);
    return params; // Fallback para parâmetros originais
  }
}

/**
 * Verifica se o provider local deve ser usado em vez do externo
 */
export function shouldUseLocalProProvider(settings: UserSettings): boolean {
  return (
    (settings.enableLocalSmartContext ?? false) ||
    (settings.enableLocalTurboEdits ?? false)
  );
}

/**
 * Cria provider híbrido que usa local quando possível e externo como fallback
 */
export function createHybridProProvider(
  baseProvider: any,
  settings: UserSettings,
  options: LocalProOptions = {},
): any {
  logger.debug("createHybridProProvider chamado:", {
    baseProviderType: typeof baseProvider,
    baseProviderKeys: baseProvider ? Object.keys(baseProvider) : [],
    hasModelMethod: typeof baseProvider?.model === "function",
  });

  const useLocal = shouldUseLocalProProvider(settings);

  if (useLocal) {
    logger.info("Usando Local Pro Provider");
    try {
      return createLocalProProvider(baseProvider, settings, options);
    } catch (error) {
      logger.error(
        "Erro ao criar Local Pro Provider, usando provider externo como fallback:",
        error,
      );
      return baseProvider;
    }
  }

  logger.info("Usando provider externo (Dyad Engine)");
  return baseProvider;
}

/**
 * Obtém estatísticas de uso das funcionalidades locais
 */
export interface LocalProStats {
  smartContextUsage: {
    enabled: boolean;
    totalOptimizations: number;
    averageProcessingTime: number;
    tokensOptimized: number;
  };
  turboEditsUsage: {
    enabled: boolean;
    totalOptimizations: number;
    complexityBreakdown: Record<EditComplexity, number>;
    averageProcessingTime: number;
  };
}

// Cache para estatísticas (em uma implementação real, isso seria persistido)
const statsCache: LocalProStats = {
  smartContextUsage: {
    enabled: false,
    totalOptimizations: 0,
    averageProcessingTime: 0,
    tokensOptimized: 0,
  },
  turboEditsUsage: {
    enabled: false,
    totalOptimizations: 0,
    complexityBreakdown: {
      [EditComplexity.SIMPLE]: 0,
      [EditComplexity.MODERATE]: 0,
      [EditComplexity.COMPLEX]: 0,
      [EditComplexity.MULTI_FILE]: 0,
    },
    averageProcessingTime: 0,
  },
};

export function getLocalProStats(): LocalProStats {
  return { ...statsCache };
}

export function updateLocalProStats(
  type: "smartContext" | "turboEdits",
  update: Partial<
    LocalProStats["smartContextUsage"] | LocalProStats["turboEditsUsage"]
  >,
): void {
  if (type === "smartContext") {
    Object.assign(statsCache.smartContextUsage, update);
  } else {
    Object.assign(statsCache.turboEditsUsage, update);
  }
}

export function resetLocalProStats(): void {
  statsCache.smartContextUsage = {
    enabled: false,
    totalOptimizations: 0,
    averageProcessingTime: 0,
    tokensOptimized: 0,
  };

  statsCache.turboEditsUsage = {
    enabled: false,
    totalOptimizations: 0,
    complexityBreakdown: {
      [EditComplexity.SIMPLE]: 0,
      [EditComplexity.MODERATE]: 0,
      [EditComplexity.COMPLEX]: 0,
      [EditComplexity.MULTI_FILE]: 0,
    },
    averageProcessingTime: 0,
  };
}
