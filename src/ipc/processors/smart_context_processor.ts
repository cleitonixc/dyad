import {
  buildDependencyGraph,
  DependencyGraph,
} from "../../utils/dependency_analyzer";
import {
  findSemanticMatches,
  SemanticMatch,
} from "../../utils/semantic_analyzer";
import { UserSettings } from "../../lib/schemas";
import * as path from "path";

export interface ContextOptimization {
  selectedFiles: string[];
  totalTokens: number;
  relevanceRatio: number;
  processingTime: number;
}

export interface SmartContextConfig {
  sensitivity: "conservative" | "balanced" | "aggressive";
  maxTokens: number;
  dependencyDepth: number;
}

export class SmartContextProcessor {
  private dependencyCache = new Map<string, DependencyGraph>();
  private semanticCache = new Map<string, SemanticMatch[]>();

  constructor(private config: SmartContextConfig) {}

  /**
   * Analisa a base de código para identificar contexto inteligente
   */
  async analyzeCodebaseForContext(
    prompt: string,
    appPath: string,
    availableFiles: string[],
  ): Promise<ContextOptimization> {
    const startTime = Date.now();

    try {
      // 1. Construir ou recuperar grafo de dependências
      const dependencyGraph = await this.getOrBuildDependencyGraph(appPath);

      // 2. Encontrar matches semânticos no prompt
      const semanticMatches = await this.findSemanticMatches(
        prompt,
        availableFiles,
      );

      // 3. Identificar arquivos relacionados
      const relatedFiles = await this.identifyRelatedFiles(
        semanticMatches,
        dependencyGraph,
        availableFiles,
      );

      // 4. Otimizar contexto para tokens
      const optimization = await this.optimizeContextForTokens(
        relatedFiles,
        this.config.maxTokens,
      );

      const processingTime = Date.now() - startTime;

      return {
        ...optimization,
        processingTime,
      };
    } catch (error) {
      console.error("Erro na análise de contexto inteligente:", error);

      // Fallback: retorna estratégia conservativa
      return this.getConservativeFallback(
        availableFiles,
        Date.now() - startTime,
      );
    }
  }

  /**
   * Identifica arquivos relacionados com base em análise semântica e dependências
   */
  async identifyRelatedFiles(
    semanticMatches: SemanticMatch[],
    dependencyGraph: DependencyGraph,
    availableFiles: string[],
  ): Promise<string[]> {
    const relatedFiles = new Set<string>();

    // Adicionar arquivos com matches semânticos diretos
    for (const match of semanticMatches) {
      if (match.relevanceScore > this.getSemanticThreshold()) {
        relatedFiles.add(match.filePath);
      }
    }

    // Adicionar dependências baseadas na configuração
    for (const file of Array.from(relatedFiles)) {
      const dependencies = this.getDependenciesAtDepth(
        file,
        dependencyGraph,
        this.config.dependencyDepth,
      );
      dependencies.forEach((dep) => relatedFiles.add(dep));
    }

    // Filtrar apenas arquivos disponíveis
    return Array.from(relatedFiles).filter((file) =>
      availableFiles.includes(file),
    );
  }

  /**
   * Otimiza contexto para respeitar limite de tokens
   */
  async optimizeContextForTokens(
    candidateFiles: string[],
    maxTokens: number,
  ): Promise<Omit<ContextOptimization, "processingTime">> {
    if (candidateFiles.length === 0) {
      return {
        selectedFiles: [],
        totalTokens: 0,
        relevanceRatio: 0,
      };
    }

    // Estimar tokens por arquivo (aproximação)
    const fileTokenEstimates = await Promise.all(
      candidateFiles.map(async (file) => ({
        file,
        tokens: await this.estimateFileTokens(file),
        relevance: await this.calculateFileRelevance(file),
      })),
    );

    // Ordenar por relevância/token ratio
    fileTokenEstimates.sort((a, b) => {
      const ratioA = a.relevance / Math.max(a.tokens, 1);
      const ratioB = b.relevance / Math.max(b.tokens, 1);
      return ratioB - ratioA;
    });

    // Selecionar arquivos respeitando limite de tokens
    const selectedFiles: string[] = [];
    let totalTokens = 0;
    let totalRelevance = 0;
    let maxPossibleRelevance = 0;

    for (const estimate of fileTokenEstimates) {
      maxPossibleRelevance += estimate.relevance;

      if (totalTokens + estimate.tokens <= maxTokens) {
        selectedFiles.push(estimate.file);
        totalTokens += estimate.tokens;
        totalRelevance += estimate.relevance;
      }
    }

    const relevanceRatio =
      maxPossibleRelevance > 0 ? totalRelevance / maxPossibleRelevance : 0;

    return {
      selectedFiles,
      totalTokens,
      relevanceRatio,
    };
  }

  /**
   * Obtém ou constrói grafo de dependências (com cache)
   */
  private async getOrBuildDependencyGraph(
    appPath: string,
  ): Promise<DependencyGraph> {
    const cacheKey = appPath;

    if (this.dependencyCache.has(cacheKey)) {
      return this.dependencyCache.get(cacheKey)!;
    }

    const graph = await buildDependencyGraph(appPath);
    this.dependencyCache.set(cacheKey, graph);

    return graph;
  }

  /**
   * Encontra matches semânticos (com cache)
   */
  private async findSemanticMatches(
    prompt: string,
    files: string[],
  ): Promise<SemanticMatch[]> {
    const cacheKey = `${prompt}:${files.join(",")}`;

    if (this.semanticCache.has(cacheKey)) {
      return this.semanticCache.get(cacheKey)!;
    }

    const matches = await findSemanticMatches(prompt, files);
    this.semanticCache.set(cacheKey, matches);

    return matches;
  }

  /**
   * Obtém dependências até uma profundidade específica
   */
  private getDependenciesAtDepth(
    file: string,
    graph: DependencyGraph,
    maxDepth: number,
  ): string[] {
    const visited = new Set<string>();
    const queue: { file: string; depth: number }[] = [{ file, depth: 0 }];
    const dependencies: string[] = [];

    while (queue.length > 0) {
      const { file: currentFile, depth } = queue.shift()!;

      if (visited.has(currentFile) || depth > maxDepth) {
        continue;
      }

      visited.add(currentFile);

      if (depth > 0) {
        dependencies.push(currentFile);
      }

      const fileDeps = graph.edges.get(currentFile) || [];
      for (const dep of fileDeps) {
        if (!visited.has(dep)) {
          queue.push({ file: dep, depth: depth + 1 });
        }
      }
    }

    return dependencies;
  }

  /**
   * Obtém threshold semântico baseado na sensibilidade
   */
  private getSemanticThreshold(): number {
    switch (this.config.sensitivity) {
      case "conservative":
        return 0.8;
      case "balanced":
        return 0.6;
      case "aggressive":
        return 0.4;
      default:
        return 0.6;
    }
  }

  /**
   * Estima tokens de um arquivo
   */
  private async estimateFileTokens(filePath: string): Promise<number> {
    try {
      const fs = await import("fs/promises");
      const content = await fs.readFile(filePath, "utf-8");

      // Estimativa aproximada: 1 token ≈ 4 caracteres
      return Math.ceil(content.length / 4);
    } catch {
      return 1000; // Fallback conservativo
    }
  }

  /**
   * Calcula relevância de um arquivo
   */
  private async calculateFileRelevance(filePath: string): Promise<number> {
    // Baseado em extensão, tamanho, e outras heurísticas
    const ext = path.extname(filePath).toLowerCase();

    const extensionScore = this.getExtensionScore(ext);
    const sizeScore = await this.getSizeScore(filePath);

    return extensionScore * sizeScore;
  }

  /**
   * Score baseado na extensão do arquivo
   */
  private getExtensionScore(ext: string): number {
    const scores: Record<string, number> = {
      ".ts": 1.0,
      ".tsx": 1.0,
      ".js": 0.9,
      ".jsx": 0.9,
      ".py": 0.9,
      ".java": 0.8,
      ".cpp": 0.8,
      ".c": 0.8,
      ".cs": 0.8,
      ".json": 0.7,
      ".md": 0.5,
      ".txt": 0.3,
    };

    return scores[ext] || 0.5;
  }

  /**
   * Score baseado no tamanho do arquivo
   */
  private async getSizeScore(filePath: string): Promise<number> {
    try {
      const fs = await import("fs/promises");
      const stats = await fs.stat(filePath);
      const sizeKB = stats.size / 1024;

      // Arquivos muito pequenos ou muito grandes têm score menor
      if (sizeKB < 1) return 0.3;
      if (sizeKB > 100) return 0.5;

      return 1.0;
    } catch {
      return 0.5;
    }
  }

  /**
   * Estratégia conservativa para fallback
   */
  private getConservativeFallback(
    availableFiles: string[],
    processingTime: number,
  ): ContextOptimization {
    // Seleciona apenas arquivos principais (package.json, index, etc.)
    const mainFiles = availableFiles
      .filter((file) => {
        const basename = path.basename(file).toLowerCase();
        return (
          basename.includes("index") ||
          basename.includes("main") ||
          basename.includes("app") ||
          basename === "package.json"
        );
      })
      .slice(0, 5);

    return {
      selectedFiles: mainFiles,
      totalTokens: mainFiles.length * 500, // Estimativa conservativa
      relevanceRatio: 0.5,
      processingTime,
    };
  }

  /**
   * Limpa caches quando necessário
   */
  clearCaches(): void {
    this.dependencyCache.clear();
    this.semanticCache.clear();
  }
}

/**
 * Factory function para criar SmartContextProcessor baseado nas configurações do usuário
 */
export function createSmartContextProcessor(
  settings: UserSettings,
): SmartContextProcessor {
  const config: SmartContextConfig = {
    sensitivity: settings.smartContextSensitivity || "balanced",
    maxTokens: settings.smartContextMaxTokens || 20000,
    dependencyDepth: settings.smartContextDependencyDepth || 2,
  };

  return new SmartContextProcessor(config);
}
