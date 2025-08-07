import * as fs from "fs/promises";
import * as path from "path";

export interface SemanticMatch {
  filePath: string;
  relevanceScore: number;
  matchedEntities: string[];
  contextImportance: number;
  matchType: "direct" | "semantic" | "structural";
}

export interface EntityExtraction {
  entities: string[];
  keywords: string[];
  fileTypes: string[];
  concepts: string[];
}

/**
 * Extrai entidades e conceitos de um prompt
 */
export function extractEntitiesFromPrompt(prompt: string): EntityExtraction {
  const entities: string[] = [];
  const keywords: string[] = [];
  const fileTypes: string[] = [];
  const concepts: string[] = [];

  // Normalizar prompt
  const normalizedPrompt = prompt.toLowerCase();

  // 1. Extrair nomes de arquivos/funções/classes (padrões comuns)
  const entityPatterns = [
    // Nomes de arquivos
    /(\w+\.(?:ts|tsx|js|jsx|py|java|cpp|c|cs|json|md))/gi,
    // Nomes de funções/classes (CamelCase, snake_case)
    /\b([A-Z][a-zA-Z0-9]*(?:[A-Z][a-zA-Z0-9]*)*)\b/g,
    /\b([a-z][a-zA-Z0-9]*(?:[A-Z][a-zA-Z0-9]*)*)\b/g,
    /\b([a-z_][a-z0-9_]*)\b/g,
  ];

  for (const pattern of entityPatterns) {
    let match;
    while ((match = pattern.exec(prompt)) !== null) {
      const entity = match[1];
      if (entity && entity.length > 2) {
        entities.push(entity);
      }
    }
  }

  // 2. Extrair extensões de arquivo mencionadas
  const fileTypePatterns = [
    /\.([a-z]{2,4})\b/gi,
    /\b(typescript|javascript|python|java|cpp|react|vue|angular)\b/gi,
  ];

  for (const pattern of fileTypePatterns) {
    let match;
    while ((match = pattern.exec(normalizedPrompt)) !== null) {
      fileTypes.push(match[1]);
    }
  }

  // 3. Extrair conceitos e ações técnicas
  const technicalConcepts = [
    "component",
    "service",
    "controller",
    "model",
    "view",
    "handler",
    "processor",
    "utility",
    "helper",
    "config",
    "setting",
    "test",
    "spec",
    "mock",
    "auth",
    "authentication",
    "authorization",
    "login",
    "user",
    "session",
    "api",
    "endpoint",
    "route",
    "middleware",
    "database",
    "query",
    "style",
    "css",
    "scss",
    "theme",
    "layout",
    "ui",
    "interface",
    "hook",
    "context",
    "provider",
    "store",
    "state",
    "action",
    "reducer",
    "import",
    "export",
    "module",
    "package",
    "dependency",
    "library",
  ];

  const actionWords = [
    "create",
    "build",
    "make",
    "generate",
    "add",
    "implement",
    "develop",
    "update",
    "modify",
    "change",
    "edit",
    "fix",
    "refactor",
    "optimize",
    "delete",
    "remove",
    "clean",
    "move",
    "rename",
    "copy",
    "test",
    "validate",
    "check",
    "verify",
    "debug",
    "trace",
  ];

  const allConcepts = [...technicalConcepts, ...actionWords];

  for (const concept of allConcepts) {
    if (normalizedPrompt.includes(concept)) {
      concepts.push(concept);
    }
  }

  // 4. Extrair palavras-chave importantes
  const words = normalizedPrompt
    .split(/\s+/)
    .filter((word) => word.length > 3)
    .filter(
      (word) => !/^(the|and|or|but|for|with|from|to|in|on|at|by)$/.test(word),
    );

  keywords.push(...words);

  return {
    entities: Array.from(new Set(entities)),
    keywords: Array.from(new Set(keywords)),
    fileTypes: Array.from(new Set(fileTypes)),
    concepts: Array.from(new Set(concepts)),
  };
}

/**
 * Encontra matches semânticos entre prompt e arquivos
 */
export async function findSemanticMatches(
  prompt: string,
  files: string[],
): Promise<SemanticMatch[]> {
  const extraction = extractEntitiesFromPrompt(prompt);
  const matches: SemanticMatch[] = [];

  await Promise.all(
    files.map(async (filePath) => {
      try {
        const match = await analyzeFileRelevance(filePath, extraction, prompt);
        if (match.relevanceScore > 0) {
          matches.push(match);
        }
      } catch (error) {
        console.warn(
          `Erro ao analisar relevância do arquivo ${filePath}:`,
          error,
        );
      }
    }),
  );

  // Ordenar por relevância
  return matches.sort((a, b) => b.relevanceScore - a.relevanceScore);
}

/**
 * Analisa a relevância de um arquivo específico
 */
async function analyzeFileRelevance(
  filePath: string,
  extraction: EntityExtraction,
  originalPrompt: string,
): Promise<SemanticMatch> {
  let content = "";

  try {
    content = await fs.readFile(filePath, "utf-8");
  } catch {
    // Se não conseguir ler o arquivo, usar apenas informações do nome
  }

  const fileName = path.basename(filePath);
  const fileExtension = path.extname(filePath).slice(1);
  const normalizedContent = content.toLowerCase();
  const normalizedFileName = fileName.toLowerCase();
  const normalizedPrompt = originalPrompt.toLowerCase();

  let relevanceScore = 0;
  const matchedEntities: string[] = [];
  let matchType: "direct" | "semantic" | "structural" = "structural";

  // 1. Score por matches diretos no nome do arquivo
  for (const entity of extraction.entities) {
    const normalizedEntity = entity.toLowerCase();

    if (normalizedFileName.includes(normalizedEntity)) {
      relevanceScore += 2.0;
      matchedEntities.push(entity);
      matchType = "direct";
    }

    if (normalizedContent.includes(normalizedEntity)) {
      relevanceScore += 1.0;
      matchedEntities.push(entity);
      if (matchType === "structural") matchType = "semantic";
    }
  }

  // 2. Score por tipo de arquivo
  for (const fileType of extraction.fileTypes) {
    if (fileExtension === fileType || fileName.includes(fileType)) {
      relevanceScore += 0.5;
    }
  }

  // 3. Score por conceitos técnicos
  for (const concept of extraction.concepts) {
    if (normalizedFileName.includes(concept)) {
      relevanceScore += 1.5;
      matchedEntities.push(concept);
    }

    if (normalizedContent.includes(concept)) {
      relevanceScore += 0.8;
      matchedEntities.push(concept);
    }
  }

  // 4. Score por palavras-chave
  for (const keyword of extraction.keywords) {
    if (normalizedFileName.includes(keyword)) {
      relevanceScore += 0.3;
    }

    if (normalizedContent.includes(keyword)) {
      relevanceScore += 0.2;
    }
  }

  // 5. Bonus por padrões estruturais
  relevanceScore += calculateStructuralScore(filePath, extraction);

  // 6. Bonus por proximidade de texto (similaridade)
  if (content) {
    const similarity = calculateTextSimilarity(
      normalizedPrompt,
      normalizedContent,
    );
    relevanceScore += similarity * 0.5;
  }

  // 7. Penalty por arquivos muito grandes ou muito pequenos
  if (content) {
    const sizeKB = content.length / 1024;
    if (sizeKB > 100) {
      relevanceScore *= 0.8; // Penalizar arquivos muito grandes
    } else if (sizeKB < 0.5) {
      relevanceScore *= 0.9; // Penalizar arquivos muito pequenos
    }
  }

  // Calcular importância contextual
  const contextImportance = calculateContextImportance(filePath, extraction);

  return {
    filePath,
    relevanceScore: Math.min(relevanceScore, 10), // Cap em 10
    matchedEntities: Array.from(new Set(matchedEntities)),
    contextImportance,
    matchType,
  };
}

/**
 * Calcula score baseado em padrões estruturais
 */
function calculateStructuralScore(
  filePath: string,
  _extraction: EntityExtraction,
): number {
  let score = 0;
  const fileName = path.basename(filePath);
  const dirName = path.dirname(filePath);

  // Bonus por estruturas comuns de projeto
  const structuralPatterns = {
    // Arquivos principais
    index: 1.5,
    main: 1.5,
    app: 1.2,

    // Componentes
    component: 1.0,
    widget: 1.0,

    // Serviços e utilitários
    service: 1.0,
    util: 0.8,
    helper: 0.8,

    // Configuração
    config: 0.8,
    setting: 0.8,

    // Testes
    test: 0.5,
    spec: 0.5,
    mock: 0.3,
  };

  for (const [pattern, bonus] of Object.entries(structuralPatterns)) {
    if (
      fileName.toLowerCase().includes(pattern) ||
      dirName.toLowerCase().includes(pattern)
    ) {
      score += bonus;
    }
  }

  // Bonus por diretórios importantes
  const importantDirs = [
    "src",
    "components",
    "pages",
    "services",
    "utils",
    "lib",
  ];
  for (const dir of importantDirs) {
    if (dirName.includes(dir)) {
      score += 0.3;
    }
  }

  return score;
}

/**
 * Calcula importância contextual do arquivo
 */
function calculateContextImportance(
  filePath: string,
  _extraction: EntityExtraction,
): number {
  let importance = 0.5; // Base score

  const fileName = path.basename(filePath);
  const fileExtension = path.extname(filePath).slice(1);

  // Importância por tipo de arquivo
  const fileTypeImportance: Record<string, number> = {
    ts: 1.0,
    tsx: 1.0,
    js: 0.9,
    jsx: 0.9,
    py: 0.9,
    java: 0.8,
    cpp: 0.8,
    json: 0.7,
    md: 0.4,
  };

  importance *= fileTypeImportance[fileExtension] || 0.5;

  // Importância por nome do arquivo
  if (fileName.toLowerCase().includes("index")) importance += 0.3;
  if (fileName.toLowerCase().includes("main")) importance += 0.3;
  if (fileName.toLowerCase().includes("app")) importance += 0.2;

  return Math.min(importance, 1.0);
}

/**
 * Calcula similaridade de texto simples
 */
function calculateTextSimilarity(text1: string, text2: string): number {
  if (!text1 || !text2) return 0;

  const words1 = new Set(text1.split(/\s+/).filter((w) => w.length > 3));
  const words2 = new Set(text2.split(/\s+/).filter((w) => w.length > 3));

  if (words1.size === 0 || words2.size === 0) return 0;

  const intersection = new Set(Array.from(words1).filter((w) => words2.has(w)));
  const union = new Set([...Array.from(words1), ...Array.from(words2)]);

  return intersection.size / union.size; // Jaccard similarity
}

/**
 * Filtra matches por threshold de relevância
 */
export function filterByRelevance(
  matches: SemanticMatch[],
  threshold: number = 0.5,
): SemanticMatch[] {
  return matches.filter((match) => match.relevanceScore >= threshold);
}

/**
 * Agrupa matches por tipo
 */
export function groupMatchesByType(
  matches: SemanticMatch[],
): Record<string, SemanticMatch[]> {
  const groups: Record<string, SemanticMatch[]> = {
    direct: [],
    semantic: [],
    structural: [],
  };

  for (const match of matches) {
    groups[match.matchType].push(match);
  }

  return groups;
}

/**
 * Calcula estatísticas dos matches
 */
export interface MatchStatistics {
  totalMatches: number;
  averageRelevance: number;
  maxRelevance: number;
  minRelevance: number;
  byType: Record<string, number>;
}

export function calculateMatchStatistics(
  matches: SemanticMatch[],
): MatchStatistics {
  if (matches.length === 0) {
    return {
      totalMatches: 0,
      averageRelevance: 0,
      maxRelevance: 0,
      minRelevance: 0,
      byType: {},
    };
  }

  const relevances = matches.map((m) => m.relevanceScore);
  const byType: Record<string, number> = {};

  for (const match of matches) {
    byType[match.matchType] = (byType[match.matchType] || 0) + 1;
  }

  return {
    totalMatches: matches.length,
    averageRelevance: relevances.reduce((a, b) => a + b, 0) / relevances.length,
    maxRelevance: Math.max(...relevances),
    minRelevance: Math.min(...relevances),
    byType,
  };
}
