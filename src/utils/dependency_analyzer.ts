import * as fs from "fs/promises";
import * as path from "path";
import { glob } from "glob";

export interface FileNode {
  path: string;
  imports: string[];
  exports: string[];
  size: number;
  lastModified: Date;
}

export interface DependencyGraph {
  nodes: Map<string, FileNode>;
  edges: Map<string, string[]>; // file -> dependencies
  weights: Map<string, number>; // edge weight (frequency/importance)
}

export interface DependencyAnalysisOptions {
  includePatterns?: string[];
  excludePatterns?: string[];
  maxDepth?: number;
  followSymlinks?: boolean;
}

/**
 * Constrói um grafo de dependências para a base de código
 */
export async function buildDependencyGraph(
  appPath: string,
  options: DependencyAnalysisOptions = {},
): Promise<DependencyGraph> {
  const {
    includePatterns = ["**/*.{ts,tsx,js,jsx,py,java,cpp,c,cs}"],
    excludePatterns = [
      "**/node_modules/**",
      "**/dist/**",
      "**/build/**",
      "**/.git/**",
    ],
  } = options;

  const graph: DependencyGraph = {
    nodes: new Map(),
    edges: new Map(),
    weights: new Map(),
  };

  try {
    // Encontrar todos os arquivos relevantes
    const files = await findSourceFiles(
      appPath,
      includePatterns,
      excludePatterns,
    );

    // Processar cada arquivo para extrair imports/exports
    await Promise.all(
      files.map(async (filePath) => {
        try {
          const node = await analyzeFile(filePath, appPath);
          graph.nodes.set(filePath, node);
        } catch (error) {
          console.warn(`Erro ao analisar arquivo ${filePath}:`, error);
        }
      }),
    );

    // Construir edges do grafo
    buildGraphEdges(graph, appPath);

    // Calcular pesos das conexões
    calculateEdgeWeights(graph);

    return graph;
  } catch (error) {
    console.error("Erro ao construir grafo de dependências:", error);
    throw error;
  }
}

/**
 * Encontra arquivos de código-fonte no diretório
 */
async function findSourceFiles(
  appPath: string,
  includePatterns: string[],
  excludePatterns: string[],
): Promise<string[]> {
  const allFiles: string[] = [];

  for (const pattern of includePatterns) {
    try {
      const files = await glob(pattern, {
        cwd: appPath,
        absolute: true,
        ignore: excludePatterns,
        dot: false,
      });
      allFiles.push(...files);
    } catch (error) {
      console.warn(`Erro ao buscar arquivos com padrão ${pattern}:`, error);
    }
  }

  // Remover duplicatas e ordenar
  return Array.from(new Set(allFiles)).sort();
}

/**
 * Analisa um arquivo individual para extrair imports e exports
 */
async function analyzeFile(
  filePath: string,
  basePath: string,
): Promise<FileNode> {
  const content = await fs.readFile(filePath, "utf-8");
  const stats = await fs.stat(filePath);

  const imports = parseImportsExports(content, "import");
  const exports = parseImportsExports(content, "export");

  return {
    path: path.relative(basePath, filePath),
    imports,
    exports,
    size: stats.size,
    lastModified: stats.mtime,
  };
}

/**
 * Extrai imports e exports do conteúdo do arquivo
 */
export function parseImportsExports(
  content: string,
  type: "import" | "export",
): string[] {
  const results: string[] = [];

  if (type === "import") {
    // Padrões de import para diferentes linguagens
    const patterns = [
      // TypeScript/JavaScript ES6
      /import\s+(?:(?:\{[^}]*\}|\*\s+as\s+\w+|\w+)(?:\s*,\s*(?:\{[^}]*\}|\*\s+as\s+\w+|\w+))*\s+from\s+)?['"]([^'"]+)['"]/g,
      // TypeScript/JavaScript CommonJS
      /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
      // Python
      /(?:from\s+(\S+)\s+import|import\s+(\S+))/g,
      // Java
      /import\s+(?:static\s+)?([^;]+);/g,
      // C/C++
      /#include\s*[<"]([^>"]+)[>"]/g,
      // C#
      /using\s+([^;]+);/g,
    ];

    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        const importPath = match[1] || match[2];
        if (importPath && !importPath.startsWith(".")) {
          // Normalizar path relativo
          results.push(importPath.trim());
        } else if (importPath) {
          results.push(importPath.trim());
        }
      }
    }
  } else {
    // Padrões de export
    const patterns = [
      // TypeScript/JavaScript
      /export\s+(?:default\s+)?(?:class|function|const|let|var)\s+(\w+)/g,
      /export\s*\{([^}]+)\}/g,
      // Python
      /def\s+(\w+)\s*\(/g,
      /class\s+(\w+)\s*(?:\(|:)/g,
      // Java
      /public\s+(?:static\s+)?(?:class|interface|enum)\s+(\w+)/g,
      /public\s+(?:static\s+)?[^(]+\s+(\w+)\s*\(/g,
    ];

    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        if (match[1]) {
          if (match[1].includes(",")) {
            // Múltiplos exports em uma linha
            const exports = match[1].split(",").map((e) => e.trim());
            results.push(...exports);
          } else {
            results.push(match[1].trim());
          }
        }
      }
    }
  }

  return Array.from(new Set(results)); // Remover duplicatas
}

/**
 * Constrói as conexões (edges) do grafo
 */
function buildGraphEdges(graph: DependencyGraph, basePath: string): void {
  for (const [filePath, node] of Array.from(graph.nodes.entries())) {
    const dependencies: string[] = [];

    for (const importPath of node.imports) {
      // Resolver caminho relativo para absoluto
      const resolvedPath = resolveImportPath(
        importPath,
        filePath,
        basePath,
        graph.nodes,
      );

      if (resolvedPath && graph.nodes.has(resolvedPath)) {
        dependencies.push(resolvedPath);
      }
    }

    graph.edges.set(filePath, dependencies);
  }
}

/**
 * Resolve caminho de import para caminho absoluto
 */
function resolveImportPath(
  importPath: string,
  currentFile: string,
  basePath: string,
  nodes: Map<string, FileNode>,
): string | null {
  // Se é import relativo
  if (importPath.startsWith(".")) {
    const currentDir = path.dirname(path.join(basePath, currentFile));
    const resolvedPath = path.resolve(currentDir, importPath);
    const relativePath = path.relative(basePath, resolvedPath);

    // Tentar diferentes extensões
    const extensions = [
      ".ts",
      ".tsx",
      ".js",
      ".jsx",
      ".py",
      ".java",
      ".cpp",
      ".c",
      ".cs",
    ];

    for (const ext of extensions) {
      const pathWithExt = relativePath + ext;
      if (nodes.has(pathWithExt)) {
        return pathWithExt;
      }
    }

    // Tentar index files
    for (const ext of extensions) {
      const indexPath = path.join(relativePath, `index${ext}`);
      if (nodes.has(indexPath)) {
        return indexPath;
      }
    }
  }

  // Para imports absolutos ou de node_modules, não resolver por enquanto
  return null;
}

/**
 * Calcula pesos das conexões baseado em frequência e importância
 */
function calculateEdgeWeights(graph: DependencyGraph): void {
  // Contar frequência de cada dependência
  const dependencyCount = new Map<string, number>();

  for (const dependencies of Array.from(graph.edges.values())) {
    for (const dep of dependencies) {
      dependencyCount.set(dep, (dependencyCount.get(dep) || 0) + 1);
    }
  }

  // Calcular pesos normalizados
  const maxCount = Math.max(...Array.from(dependencyCount.values()), 1);

  for (const [file, dependencies] of Array.from(graph.edges.entries())) {
    for (const dep of dependencies) {
      const frequency = dependencyCount.get(dep) || 1;
      const weight = frequency / maxCount;

      const edgeKey = `${file}->${dep}`;
      graph.weights.set(edgeKey, weight);
    }
  }
}

/**
 * Encontra dependências transitivas até uma profundidade específica
 */
export function findTransitiveDependencies(
  graph: DependencyGraph,
  startFile: string,
  maxDepth = 3,
): string[] {
  const visited = new Set<string>();
  const queue: { file: string; depth: number }[] = [
    { file: startFile, depth: 0 },
  ];
  const dependencies: string[] = [];

  while (queue.length > 0) {
    const { file, depth } = queue.shift()!;

    if (visited.has(file) || depth > maxDepth) {
      continue;
    }

    visited.add(file);

    if (depth > 0) {
      dependencies.push(file);
    }

    const fileDependencies = graph.edges.get(file) || [];
    for (const dep of fileDependencies) {
      if (!visited.has(dep)) {
        queue.push({ file: dep, depth: depth + 1 });
      }
    }
  }

  return dependencies;
}

/**
 * Encontra arquivos que dependem de um arquivo específico (dependências reversas)
 */
export function findReverseDependencies(
  graph: DependencyGraph,
  targetFile: string,
): string[] {
  const reverseDeps: string[] = [];

  for (const [file, dependencies] of Array.from(graph.edges.entries())) {
    if (dependencies.includes(targetFile)) {
      reverseDeps.push(file);
    }
  }

  return reverseDeps;
}

/**
 * Analisa a complexidade do grafo de dependências
 */
export interface DependencyComplexity {
  totalFiles: number;
  totalDependencies: number;
  averageDependenciesPerFile: number;
  maxDependenciesInFile: number;
  circularDependencies: string[][];
  orphanFiles: string[];
}

export function analyzeDependencyComplexity(
  graph: DependencyGraph,
): DependencyComplexity {
  const totalFiles = graph.nodes.size;
  let totalDependencies = 0;
  let maxDependencies = 0;

  for (const dependencies of Array.from(graph.edges.values())) {
    totalDependencies += dependencies.length;
    maxDependencies = Math.max(maxDependencies, dependencies.length);
  }

  const averageDependencies =
    totalFiles > 0 ? totalDependencies / totalFiles : 0;

  // Encontrar arquivos órfãos (sem dependências e não são dependências de ninguém)
  const referencedFiles = new Set<string>();
  for (const dependencies of Array.from(graph.edges.values())) {
    dependencies.forEach((dep) => referencedFiles.add(dep));
  }

  const orphanFiles = Array.from(graph.nodes.keys()).filter((file) => {
    const hasDependencies = (graph.edges.get(file) || []).length > 0;
    const isReferenced = referencedFiles.has(file);
    return !hasDependencies && !isReferenced;
  });

  // Detectar dependências circulares (algoritmo simplificado)
  const circularDependencies = findCircularDependencies(graph);

  return {
    totalFiles,
    totalDependencies,
    averageDependenciesPerFile: averageDependencies,
    maxDependenciesInFile: maxDependencies,
    circularDependencies,
    orphanFiles,
  };
}

/**
 * Detecta dependências circulares no grafo
 */
function findCircularDependencies(graph: DependencyGraph): string[][] {
  const visited = new Set<string>();
  const recursionStack = new Set<string>();
  const cycles: string[][] = [];

  function dfs(node: string, path: string[]): void {
    if (recursionStack.has(node)) {
      // Encontrou ciclo
      const cycleStart = path.indexOf(node);
      if (cycleStart !== -1) {
        cycles.push(path.slice(cycleStart).concat(node));
      }
      return;
    }

    if (visited.has(node)) {
      return;
    }

    visited.add(node);
    recursionStack.add(node);

    const dependencies = graph.edges.get(node) || [];
    for (const dep of dependencies) {
      dfs(dep, [...path, node]);
    }

    recursionStack.delete(node);
  }

  for (const node of Array.from(graph.nodes.keys())) {
    if (!visited.has(node)) {
      dfs(node, []);
    }
  }

  return cycles;
}
