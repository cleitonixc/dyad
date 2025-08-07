import { UserSettings } from "../../lib/schemas";
import { validateEdit, EditValidation } from "../../utils/edit_validator";
import { getEditTemplate, EditType } from "../../prompts/edit_templates";
import * as path from "path";
import log from "electron-log";

const logger = log.scope("turbo_edits_processor");

export enum EditComplexity {
  SIMPLE = "simple", // Correções de texto, typos
  MODERATE = "moderate", // Refatoração de funções
  COMPLEX = "complex", // Mudanças arquiteturais
  MULTI_FILE = "multi_file", // Mudanças em múltiplos arquivos
}

export interface RetryPolicy {
  maxAttempts: number;
  backoffMultiplier: number;
  initialDelay: number;
}

export interface EditStrategy {
  modelSelection: "fast" | "balanced" | "powerful";
  promptTemplate: string;
  maxTokens: number;
  validationLevel: "basic" | "enhanced" | "strict";
  retryPolicy: RetryPolicy;
}

export interface EditAnalysis {
  complexity: EditComplexity;
  confidence: number;
  estimatedTokens: number;
  suggestedStrategy: EditStrategy;
  reasoning: string[];
}

export interface OptimizedEdit {
  strategy: EditStrategy;
  optimizedPrompt: string;
  expectedOutputFormat: string;
  validationRules: string[];
  processingHints: string[];
}

export interface TurboEditsConfig {
  complexityThreshold: "simple" | "moderate" | "all";
  modelStrategy: "fast" | "balanced" | "quality";
  enableValidation: boolean;
  maxRetries: number;
}

export class TurboEditsProcessor {
  private complexityAnalysisCache = new Map<string, EditAnalysis>();
  private strategyCache = new Map<string, EditStrategy>();

  constructor(private config: TurboEditsConfig) {}

  /**
   * Analisa e gera uma edição otimizada
   */
  async generateOptimizedEdit(
    prompt: string,
    filePath: string,
    fileContent: string,
    context?: string[],
  ): Promise<OptimizedEdit> {
    const startTime = Date.now();

    try {
      // 1. Estimar complexidade da edição
      const analysis = await this.estimateEditComplexity(
        prompt,
        filePath,
        fileContent,
      );

      // 2. Verificar se deve usar Turbo Edits baseado no threshold
      if (!this.shouldUseTurboEdits(analysis.complexity)) {
        throw new Error(
          `Complexidade ${analysis.complexity} abaixo do threshold ${this.config.complexityThreshold}`,
        );
      }

      // 3. Selecionar estratégia otimizada
      const strategy = this.selectOptimalStrategy(analysis, filePath);

      // 4. Gerar prompt otimizado
      const optimizedPrompt = await this.generateOptimizedPrompt(
        prompt,
        filePath,
        fileContent,
        strategy,
        context,
      );

      // 5. Definir regras de validação
      const validationRules = this.getValidationRules(
        strategy.validationLevel,
        filePath,
      );

      // 6. Adicionar dicas de processamento
      const processingHints = this.getProcessingHints(analysis, strategy);

      const processingTime = Date.now() - startTime;
      logger.info(
        `Edição otimizada gerada para ${path.basename(filePath)} em ${processingTime}ms - Complexidade: ${analysis.complexity}, Estratégia: ${strategy.modelSelection}`,
      );

      return {
        strategy,
        optimizedPrompt,
        expectedOutputFormat: this.getExpectedOutputFormat(strategy, filePath),
        validationRules,
        processingHints,
      };
    } catch (error) {
      logger.error("Erro ao gerar edição otimizada:", error);
      throw error;
    }
  }

  /**
   * Estima a complexidade de uma edição
   */
  async estimateEditComplexity(
    prompt: string,
    filePath: string,
    fileContent: string,
  ): Promise<EditAnalysis> {
    const cacheKey = `${prompt}:${filePath}:${fileContent.length}`;

    if (this.complexityAnalysisCache.has(cacheKey)) {
      return this.complexityAnalysisCache.get(cacheKey)!;
    }

    const analysis = await this.performComplexityAnalysis(
      prompt,
      filePath,
      fileContent,
    );
    this.complexityAnalysisCache.set(cacheKey, analysis);

    return analysis;
  }

  /**
   * Valida uma edição usando o sistema de validação
   */
  async validateEdit(
    originalContent: string,
    editedContent: string,
    filePath: string,
    strategy: EditStrategy,
  ): Promise<EditValidation> {
    return validateEdit(
      originalContent,
      editedContent,
      filePath,
      strategy.validationLevel,
    );
  }

  /**
   * Análise detalhada de complexidade
   */
  private async performComplexityAnalysis(
    prompt: string,
    filePath: string,
    fileContent: string,
  ): Promise<EditAnalysis> {
    const reasoning: string[] = [];
    let complexity = EditComplexity.SIMPLE;
    let confidence = 0.8;
    let estimatedTokens = 1000;

    const normalizedPrompt = prompt.toLowerCase();
    const fileExtension = path.extname(filePath);
    const fileSize = fileContent.length;
    const lineCount = fileContent.split("\n").length;

    // 1. Análise baseada em palavras-chave do prompt
    const complexityKeywords = {
      simple: ["fix", "correct", "typo", "update", "change text", "rename"],
      moderate: [
        "refactor",
        "optimize",
        "restructure",
        "add function",
        "modify logic",
      ],
      complex: [
        "architecture",
        "design pattern",
        "framework",
        "migrate",
        "rewrite",
      ],
      multiFile: [
        "multiple files",
        "across files",
        "project-wide",
        "global change",
      ],
    };

    // Verificar palavras-chave de complexidade
    for (const [level, keywords] of Object.entries(complexityKeywords)) {
      const matches = keywords.filter((keyword) =>
        normalizedPrompt.includes(keyword),
      );
      if (matches.length > 0) {
        reasoning.push(
          `Detectadas palavras-chave de ${level}: ${matches.join(", ")}`,
        );

        switch (level) {
          case "simple":
            if (complexity === EditComplexity.SIMPLE) confidence += 0.1;
            break;
          case "moderate":
            complexity = EditComplexity.MODERATE;
            confidence = 0.7;
            estimatedTokens = 2000;
            break;
          case "complex":
            complexity = EditComplexity.COMPLEX;
            confidence = 0.6;
            estimatedTokens = 4000;
            break;
          case "multiFile":
            complexity = EditComplexity.MULTI_FILE;
            confidence = 0.9;
            estimatedTokens = 8000;
            break;
        }
      }
    }

    // 2. Análise baseada no tamanho do arquivo
    if (fileSize > 50000) {
      reasoning.push("Arquivo grande (>50KB) - aumentando complexidade");
      if (complexity === EditComplexity.SIMPLE) {
        complexity = EditComplexity.MODERATE;
      }
      estimatedTokens += 1000;
    }

    if (lineCount > 1000) {
      reasoning.push(
        "Arquivo com muitas linhas (>1000) - aumentando complexidade",
      );
      estimatedTokens += 500;
    }

    // 3. Análise baseada no tipo de arquivo
    const complexFileTypes = [".tsx", ".jsx", ".vue", ".svelte"];
    if (complexFileTypes.includes(fileExtension)) {
      reasoning.push(
        "Arquivo de componente - pode requerer análise estrutural",
      );
      if (complexity === EditComplexity.SIMPLE) {
        complexity = EditComplexity.MODERATE;
      }
    }

    // 4. Análise de padrões estruturais no prompt
    const structuralPatterns = [
      /class\s+\w+/i,
      /interface\s+\w+/i,
      /function\s+\w+/i,
      /import.*from/i,
      /export.*{/i,
    ];

    const structuralMatches = structuralPatterns.filter((pattern) =>
      pattern.test(prompt),
    );
    if (structuralMatches.length > 2) {
      reasoning.push("Múltiplas referências estruturais detectadas");
      if (complexity === EditComplexity.SIMPLE) {
        complexity = EditComplexity.MODERATE;
      }
    }

    // 5. Análise de escopo da mudança
    if (prompt.length > 500) {
      reasoning.push(
        "Prompt longo (>500 chars) - mudança possivelmente complexa",
      );
      estimatedTokens += Math.floor(prompt.length / 2);
    }

    // Ajustar confiança baseada na quantidade de evidências
    if (reasoning.length < 2) {
      confidence -= 0.2;
      reasoning.push(
        "Poucas evidências para classificação - confiança reduzida",
      );
    }

    const suggestedStrategy = this.selectOptimalStrategy(
      { complexity, confidence, estimatedTokens } as EditAnalysis,
      filePath,
    );

    return {
      complexity,
      confidence: Math.max(0.1, Math.min(1.0, confidence)),
      estimatedTokens,
      suggestedStrategy,
      reasoning,
    };
  }

  /**
   * Seleciona a estratégia ótima para a edição
   */
  private selectOptimalStrategy(
    analysis: EditAnalysis,
    filePath: string,
  ): EditStrategy {
    const cacheKey = `${analysis.complexity}:${this.config.modelStrategy}:${path.extname(filePath)}`;

    if (this.strategyCache.has(cacheKey)) {
      return this.strategyCache.get(cacheKey)!;
    }

    let modelSelection: "fast" | "balanced" | "powerful";
    let maxTokens: number;
    let validationLevel: "basic" | "enhanced" | "strict";
    let retryPolicy: RetryPolicy;

    // Selecionar modelo baseado na complexidade e preferência do usuário
    switch (analysis.complexity) {
      case EditComplexity.SIMPLE:
        modelSelection =
          this.config.modelStrategy === "quality" ? "balanced" : "fast";
        maxTokens = 2000;
        validationLevel = "basic";
        retryPolicy = {
          maxAttempts: 2,
          backoffMultiplier: 1.5,
          initialDelay: 1000,
        };
        break;

      case EditComplexity.MODERATE:
        modelSelection =
          this.config.modelStrategy === "fast"
            ? "balanced"
            : this.config.modelStrategy === "quality"
              ? "powerful"
              : "balanced";
        maxTokens = 4000;
        validationLevel = "enhanced";
        retryPolicy = {
          maxAttempts: 3,
          backoffMultiplier: 2.0,
          initialDelay: 1500,
        };
        break;

      case EditComplexity.COMPLEX:
        modelSelection =
          this.config.modelStrategy === "fast" ? "balanced" : "powerful";
        maxTokens = 8000;
        validationLevel = "strict";
        retryPolicy = {
          maxAttempts: 3,
          backoffMultiplier: 2.5,
          initialDelay: 2000,
        };
        break;

      case EditComplexity.MULTI_FILE:
        modelSelection = "powerful";
        maxTokens = 12000;
        validationLevel = "strict";
        retryPolicy = {
          maxAttempts: 4,
          backoffMultiplier: 3.0,
          initialDelay: 3000,
        };
        break;

      default:
        modelSelection = "balanced";
        maxTokens = 4000;
        validationLevel = "enhanced";
        retryPolicy = {
          maxAttempts: 3,
          backoffMultiplier: 2.0,
          initialDelay: 1500,
        };
    }

    const strategy: EditStrategy = {
      modelSelection,
      promptTemplate: "", // Will be set by getEditTemplate
      maxTokens,
      validationLevel,
      retryPolicy,
    };

    this.strategyCache.set(cacheKey, strategy);
    return strategy;
  }

  /**
   * Gera prompt otimizado baseado na estratégia
   */
  private async generateOptimizedPrompt(
    originalPrompt: string,
    filePath: string,
    fileContent: string,
    strategy: EditStrategy,
    context?: string[],
  ): Promise<string> {
    const fileExtension = path.extname(filePath);
    const fileName = path.basename(filePath);

    // Determinar tipo de edição baseado no prompt
    const editType = this.determineEditType(originalPrompt, fileExtension);

    // Obter template otimizado
    const template = getEditTemplate(editType, strategy.modelSelection);

    // Construir contexto adicional se disponível
    const contextSection =
      context && context.length > 0
        ? `\n\nContexto adicional:\n${context.join("\n")}\n`
        : "";

    // Aplicar template
    const optimizedPrompt = template.template
      .replace("{{ORIGINAL_PROMPT}}", originalPrompt)
      .replace("{{FILE_NAME}}", fileName)
      .replace("{{FILE_EXTENSION}}", fileExtension)
      .replace("{{FILE_CONTENT}}", fileContent)
      .replace("{{CONTEXT}}", contextSection)
      .replace("{{MAX_TOKENS}}", strategy.maxTokens.toString())
      .replace("{{VALIDATION_LEVEL}}", strategy.validationLevel);

    return optimizedPrompt;
  }

  /**
   * Determina o tipo de edição baseado no prompt
   */
  private determineEditType(prompt: string, fileExtension: string): EditType {
    const normalizedPrompt = prompt.toLowerCase();

    // Mapeamento de palavras-chave para tipos de edição
    if (
      normalizedPrompt.includes("fix") ||
      normalizedPrompt.includes("correct") ||
      normalizedPrompt.includes("error")
    ) {
      return EditType.SYNTAX_FIX;
    }

    if (
      normalizedPrompt.includes("add") ||
      normalizedPrompt.includes("create") ||
      normalizedPrompt.includes("implement")
    ) {
      return EditType.ADD_FEATURE;
    }

    if (
      normalizedPrompt.includes("refactor") ||
      normalizedPrompt.includes("restructure") ||
      normalizedPrompt.includes("optimize")
    ) {
      return EditType.REFACTOR;
    }

    if (
      normalizedPrompt.includes("optimize") ||
      normalizedPrompt.includes("performance") ||
      normalizedPrompt.includes("improve")
    ) {
      return EditType.OPTIMIZE;
    }

    // Fallback baseado na extensão do arquivo
    if ([".ts", ".tsx", ".js", ".jsx"].includes(fileExtension)) {
      return EditType.ADD_FEATURE;
    }

    return EditType.SYNTAX_FIX;
  }

  /**
   * Obtém regras de validação baseadas no nível
   */
  private getValidationRules(
    level: "basic" | "enhanced" | "strict",
    filePath: string,
  ): string[] {
    const rules: string[] = [];
    const fileExtension = path.extname(filePath);

    // Regras básicas para todos os níveis
    rules.push("Manter sintaxe válida");
    rules.push("Preservar funcionalidade existente");

    if (level === "enhanced" || level === "strict") {
      rules.push("Verificar imports/exports");
      rules.push("Manter estilo de código consistente");

      if ([".ts", ".tsx"].includes(fileExtension)) {
        rules.push("Verificar tipos TypeScript");
      }
    }

    if (level === "strict") {
      rules.push("Executar verificações de linting");
      rules.push("Verificar breaking changes");
      rules.push("Validar testes relacionados");
    }

    return rules;
  }

  /**
   * Obtém dicas de processamento
   */
  private getProcessingHints(
    analysis: EditAnalysis,
    strategy: EditStrategy,
  ): string[] {
    const hints: string[] = [];

    hints.push(
      `Complexidade estimada: ${analysis.complexity} (confiança: ${Math.round(analysis.confidence * 100)}%)`,
    );
    hints.push(`Modelo recomendado: ${strategy.modelSelection}`);
    hints.push(`Tokens estimados: ${analysis.estimatedTokens}`);

    if (
      analysis.complexity === EditComplexity.COMPLEX ||
      analysis.complexity === EditComplexity.MULTI_FILE
    ) {
      hints.push(
        "Considere quebrar em edições menores se a resposta for muito longa",
      );
    }

    if (strategy.validationLevel === "strict") {
      hints.push(
        "Validação rigorosa será aplicada - seja preciso na implementação",
      );
    }

    return hints;
  }

  /**
   * Obtém formato de saída esperado
   */
  private getExpectedOutputFormat(
    strategy: EditStrategy,
    filePath: string,
  ): string {
    const fileExtension = path.extname(filePath);

    let format = "Código limpo e bem formatado";

    if ([".ts", ".tsx"].includes(fileExtension)) {
      format += " com tipos TypeScript corretos";
    }

    if (strategy.validationLevel === "strict") {
      format += " e comentários explicativos quando necessário";
    }

    return format;
  }

  /**
   * Verifica se deve usar Turbo Edits baseado no threshold
   */
  private shouldUseTurboEdits(complexity: EditComplexity): boolean {
    switch (this.config.complexityThreshold) {
      case "simple":
        return true; // Usa para todas as complexidades
      case "moderate":
        return complexity !== EditComplexity.SIMPLE;
      case "all":
        return (
          complexity === EditComplexity.COMPLEX ||
          complexity === EditComplexity.MULTI_FILE
        );
      default:
        return true;
    }
  }

  /**
   * Limpa caches quando necessário
   */
  clearCaches(): void {
    this.complexityAnalysisCache.clear();
    this.strategyCache.clear();
  }
}

/**
 * Factory function para criar TurboEditsProcessor baseado nas configurações do usuário
 */
export function createTurboEditsProcessor(
  settings: UserSettings,
): TurboEditsProcessor {
  const config: TurboEditsConfig = {
    complexityThreshold: settings.turboEditsComplexityThreshold || "moderate",
    modelStrategy: settings.turboEditsModelStrategy || "balanced",
    enableValidation: true,
    maxRetries: 3,
  };

  return new TurboEditsProcessor(config);
}
