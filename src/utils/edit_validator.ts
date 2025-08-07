import * as path from "path";
import { spawn } from "child_process";
// import { promisify } from "util"; // Unused for now
import log from "electron-log";

const logger = log.scope("edit_validator");

export interface EditValidation {
  syntaxValid: boolean;
  structureIntact: boolean;
  potentialIssues: string[];
  confidence: number;
  validationLevel: "basic" | "enhanced" | "strict";
  processingTime: number;
}

export interface ValidationRule {
  name: string;
  description: string;
  validator: (
    originalContent: string,
    editedContent: string,
    filePath: string,
  ) => Promise<ValidationResult>;
  weight: number; // 0-1, importance of this rule
}

export interface ValidationResult {
  passed: boolean;
  issues: string[];
  confidence: number;
}

/**
 * Valida uma edição baseado no nível de validação especificado
 */
export async function validateEdit(
  originalContent: string,
  editedContent: string,
  filePath: string,
  validationLevel: "basic" | "enhanced" | "strict" = "enhanced",
): Promise<EditValidation> {
  const startTime = Date.now();

  try {
    const rules = getValidationRules(validationLevel, filePath);
    const results = await Promise.all(
      rules.map(async (rule) => {
        try {
          const result = await rule.validator(
            originalContent,
            editedContent,
            filePath,
          );
          return { rule, result };
        } catch (error) {
          logger.warn(`Erro na validação ${rule.name}:`, error);
          return {
            rule,
            result: {
              passed: false,
              issues: [
                `Erro interno na validação: ${error instanceof Error ? error.message : String(error)}`,
              ],
              confidence: 0.1,
            },
          };
        }
      }),
    );

    // Agregar resultados
    const totalWeight = rules.reduce((sum, rule) => sum + rule.weight, 0);
    let weightedConfidence = 0;
    let passedRules = 0;
    const allIssues: string[] = [];

    for (const { rule, result } of results) {
      if (result.passed) {
        passedRules++;
      }
      weightedConfidence += result.confidence * rule.weight;
      allIssues.push(...result.issues);
    }

    const confidence = totalWeight > 0 ? weightedConfidence / totalWeight : 0;
    const syntaxValid = results.some(
      (r) => r.rule.name === "syntax" && r.result.passed,
    );
    const structureIntact = results.some(
      (r) => r.rule.name === "structure" && r.result.passed,
    );

    const processingTime = Date.now() - startTime;

    logger.info(
      `Validação concluída para ${path.basename(filePath)} em ${processingTime}ms - ${passedRules}/${rules.length} regras aprovadas`,
    );

    return {
      syntaxValid,
      structureIntact,
      potentialIssues: allIssues,
      confidence,
      validationLevel,
      processingTime,
    };
  } catch (error) {
    logger.error("Erro na validação de edição:", error);

    return {
      syntaxValid: false,
      structureIntact: false,
      potentialIssues: [
        `Erro na validação: ${error instanceof Error ? error.message : String(error)}`,
      ],
      confidence: 0.1,
      validationLevel,
      processingTime: Date.now() - startTime,
    };
  }
}

/**
 * Obtém regras de validação baseadas no nível e tipo de arquivo
 */
function getValidationRules(
  level: "basic" | "enhanced" | "strict",
  filePath: string,
): ValidationRule[] {
  const fileExtension = path.extname(filePath).toLowerCase();
  const rules: ValidationRule[] = [];

  // Regras básicas para todos os níveis
  rules.push(createSyntaxValidationRule(fileExtension));
  rules.push(createStructureValidationRule());
  rules.push(createLengthValidationRule());

  if (level === "enhanced" || level === "strict") {
    rules.push(createImportExportValidationRule(fileExtension));
    rules.push(createStyleConsistencyRule());

    if ([".ts", ".tsx"].includes(fileExtension)) {
      rules.push(createTypeScriptValidationRule());
    }

    if ([".js", ".jsx", ".ts", ".tsx"].includes(fileExtension)) {
      rules.push(createJavaScriptValidationRule());
    }
  }

  if (level === "strict") {
    rules.push(createSecurityValidationRule());
    rules.push(createPerformanceValidationRule());
    rules.push(createAccessibilityValidationRule(fileExtension));
  }

  return rules;
}

/**
 * Regra de validação de sintaxe
 */
function createSyntaxValidationRule(fileExtension: string): ValidationRule {
  return {
    name: "syntax",
    description: "Validação de sintaxe básica",
    weight: 1.0,
    validator: async (originalContent, editedContent, _filePath) => {
      const issues: string[] = [];
      let passed = true;

      try {
        // Verificações básicas de sintaxe por extensão
        switch (fileExtension) {
          case ".json":
            JSON.parse(editedContent);
            break;

          case ".js":
          case ".jsx":
          case ".ts":
          case ".tsx":
            await validateJavaScriptSyntax(editedContent, filePath);
            break;

          case ".py":
            await validatePythonSyntax(editedContent, filePath);
            break;

          default:
            // Para outros tipos, apenas verificações básicas
            if (editedContent.trim().length === 0) {
              issues.push("Arquivo resultante está vazio");
              passed = false;
            }
        }

        // Verificações comuns
        if (
          editedContent.includes("undefined") &&
          !originalContent.includes("undefined")
        ) {
          issues.push("Possível introdução de valores undefined");
        }

        if (
          editedContent.includes("null") &&
          !originalContent.includes("null")
        ) {
          issues.push("Possível introdução de valores null");
        }
      } catch (error) {
        passed = false;
        issues.push(
          `Erro de sintaxe: ${error instanceof Error ? error.message : String(error)}`,
        );
      }

      return {
        passed,
        issues,
        confidence: passed ? 0.9 : 0.1,
      };
    },
  };
}

/**
 * Regra de validação de estrutura
 */
function createStructureValidationRule(): ValidationRule {
  return {
    name: "structure",
    description: "Validação de integridade estrutural",
    weight: 0.8,
    validator: async (originalContent, editedContent) => {
      const issues: string[] = [];
      let passed = true;

      // Verificar se a estrutura básica foi mantida
      const originalBraces = countCharacters(originalContent, ["{", "}"]);
      const editedBraces = countCharacters(editedContent, ["{", "}"]);

      const editedParens = countCharacters(editedContent, ["(", ")"]);
      const editedBrackets = countCharacters(editedContent, ["[", "]"]);

      // Tolerância para pequenas diferenças estruturais
      const tolerance = 0.1;

      if (
        Math.abs(originalBraces["{"] - editedBraces["{"]) >
        originalBraces["{"] * tolerance
      ) {
        issues.push("Mudança significativa no número de chaves abertas");
        passed = false;
      }

      if (
        Math.abs(originalBraces["}"] - editedBraces["}"]) >
        originalBraces["}"] * tolerance
      ) {
        issues.push("Mudança significativa no número de chaves fechadas");
        passed = false;
      }

      // Verificar balanceamento
      if (editedBraces["{"] !== editedBraces["}"]) {
        issues.push("Chaves desbalanceadas no código editado");
        passed = false;
      }

      if (editedParens["("] !== editedParens[")"]) {
        issues.push("Parênteses desbalanceados no código editado");
        passed = false;
      }

      if (editedBrackets["["] !== editedBrackets["]"]) {
        issues.push("Colchetes desbalanceados no código editado");
        passed = false;
      }

      return {
        passed,
        issues,
        confidence: passed ? 0.8 : 0.3,
      };
    },
  };
}

/**
 * Regra de validação de tamanho
 */
function createLengthValidationRule(): ValidationRule {
  return {
    name: "length",
    description: "Validação de mudanças de tamanho",
    weight: 0.3,
    validator: async (originalContent, editedContent) => {
      const issues: string[] = [];
      let passed = true;

      const originalLines = originalContent.split("\n").length;
      const editedLines = editedContent.split("\n").length;
      const lineDiff = Math.abs(editedLines - originalLines);

      // Alertar se houver mudanças muito grandes
      if (lineDiff > originalLines * 2) {
        issues.push(
          `Mudança muito grande no tamanho: ${originalLines} → ${editedLines} linhas`,
        );
        // Não falha a validação, apenas alerta
      }

      if (editedContent.length < originalContent.length * 0.1) {
        issues.push("Arquivo resultante muito pequeno comparado ao original");
        passed = false;
      }

      return {
        passed,
        issues,
        confidence: 0.7,
      };
    },
  };
}

/**
 * Regra de validação de imports/exports
 */
function createImportExportValidationRule(
  fileExtension: string,
): ValidationRule {
  return {
    name: "imports",
    description: "Validação de imports e exports",
    weight: 0.6,
    validator: async (originalContent, editedContent) => {
      if (![".js", ".jsx", ".ts", ".tsx"].includes(fileExtension)) {
        return { passed: true, issues: [], confidence: 1.0 };
      }

      const issues: string[] = [];
      let passed = true;

      const originalImports = extractImports(originalContent);
      const editedImports = extractImports(editedContent);

      // Verificar se imports importantes foram removidos
      for (const originalImport of originalImports) {
        if (!editedImports.some((edited) => edited.includes(originalImport))) {
          issues.push(`Import possivelmente removido: ${originalImport}`);
        }
      }

      // Verificar sintaxe de imports
      const invalidImports = editedContent.match(
        /import\s+.*from\s+[^'"][^'"]*$/gm,
      );

      if (invalidImports) {
        issues.push("Imports com sintaxe inválida detectados");
        passed = false;
      }

      return {
        passed,
        issues,
        confidence: passed ? 0.8 : 0.4,
      };
    },
  };
}

/**
 * Regra de validação de consistência de estilo
 */
function createStyleConsistencyRule(): ValidationRule {
  return {
    name: "style",
    description: "Validação de consistência de estilo",
    weight: 0.4,
    validator: async (originalContent, editedContent) => {
      const issues: string[] = [];

      // Verificar consistência de indentação
      const originalIndentation = detectIndentation(originalContent);
      const editedIndentation = detectIndentation(editedContent);

      if (originalIndentation.type !== editedIndentation.type) {
        issues.push(
          `Tipo de indentação mudou: ${originalIndentation.type} → ${editedIndentation.type}`,
        );
      }

      if (Math.abs(originalIndentation.size - editedIndentation.size) > 1) {
        issues.push(
          `Tamanho de indentação mudou: ${originalIndentation.size} → ${editedIndentation.size}`,
        );
      }

      // Verificar consistência de aspas
      const originalQuotes = analyzeQuoteUsage(originalContent);
      const editedQuotes = analyzeQuoteUsage(editedContent);

      if (originalQuotes.primary !== editedQuotes.primary) {
        issues.push(
          `Estilo de aspas mudou: ${originalQuotes.primary} → ${editedQuotes.primary}`,
        );
      }

      return {
        passed: true, // Estilo não falha validação, apenas alerta
        issues,
        confidence: 0.6,
      };
    },
  };
}

/**
 * Regra específica para TypeScript
 */
function createTypeScriptValidationRule(): ValidationRule {
  return {
    name: "typescript",
    description: "Validação específica do TypeScript",
    weight: 0.7,
    validator: async (originalContent, editedContent, _filePath) => {
      const issues: string[] = [];
      let passed = true;

      try {
        // Verificar se tipos foram mantidos
        const originalTypes = extractTypeAnnotations(originalContent);
        const editedTypes = extractTypeAnnotations(editedContent);

        // Alertar se muitos tipos foram removidos
        if (editedTypes.length < originalTypes.length * 0.8) {
          issues.push("Muitas anotações de tipo foram removidas");
        }

        // Verificar sintaxe TypeScript básica
        if (
          editedContent.includes(": any") &&
          !originalContent.includes(": any")
        ) {
          issues.push(
            "Tipo 'any' foi introduzido - considere tipos mais específicos",
          );
        }

        // Verificar interfaces e tipos
        const interfaceRegex = /interface\s+\w+\s*{[^}]*}/g;
        const originalInterfaces = originalContent.match(interfaceRegex) || [];
        const editedInterfaces = editedContent.match(interfaceRegex) || [];

        if (editedInterfaces.length < originalInterfaces.length) {
          issues.push("Interfaces podem ter sido removidas ou corrompidas");
        }
      } catch (error) {
        passed = false;
        issues.push(
          `Erro na validação TypeScript: ${error instanceof Error ? error.message : String(error)}`,
        );
      }

      return {
        passed,
        issues,
        confidence: passed ? 0.8 : 0.3,
      };
    },
  };
}

/**
 * Regra específica para JavaScript
 */
function createJavaScriptValidationRule(): ValidationRule {
  return {
    name: "javascript",
    description: "Validação específica do JavaScript",
    weight: 0.6,
    validator: async (originalContent, editedContent) => {
      const issues: string[] = [];
      const passed = true;

      // Verificar uso de const/let vs var
      const varUsage = (editedContent.match(/\bvar\s+/g) || []).length;
      const constLetUsage = (editedContent.match(/\b(const|let)\s+/g) || [])
        .length;

      if (varUsage > 0 && constLetUsage === 0) {
        issues.push("Considere usar 'const' ou 'let' em vez de 'var'");
      }

      // Verificar funções arrow vs function (informativo apenas)

      // Sem issues, apenas informativo

      // Verificar console.log não removido acidentalmente em produção
      if (
        editedContent.includes("console.log") &&
        !originalContent.includes("console.log")
      ) {
        issues.push("Console.log adicionado - remover antes da produção");
      }

      return {
        passed,
        issues,
        confidence: 0.7,
      };
    },
  };
}

/**
 * Regra de validação de segurança
 */
function createSecurityValidationRule(): ValidationRule {
  return {
    name: "security",
    description: "Validação de segurança básica",
    weight: 0.9,
    validator: async (originalContent, editedContent) => {
      const issues: string[] = [];
      let passed = true;

      const securityPatterns = [
        {
          pattern: /eval\s*\(/,
          message: "Uso de eval() detectado - risco de segurança",
        },
        {
          pattern: /innerHTML\s*=/,
          message: "Uso de innerHTML - considere textContent ou createElement",
        },
        {
          pattern: /document\.write/,
          message: "Uso de document.write - método obsoleto e inseguro",
        },
        {
          pattern: /\.html\s*\(/,
          message: "Uso de .html() - verifique se o conteúdo é sanitizado",
        },
      ];

      for (const { pattern, message } of securityPatterns) {
        if (pattern.test(editedContent) && !pattern.test(originalContent)) {
          issues.push(message);
          passed = false;
        }
      }

      return {
        passed,
        issues,
        confidence: passed ? 0.9 : 0.2,
      };
    },
  };
}

/**
 * Regra de validação de performance
 */
function createPerformanceValidationRule(): ValidationRule {
  return {
    name: "performance",
    description: "Validação de performance básica",
    weight: 0.5,
    validator: async (originalContent, editedContent) => {
      const issues: string[] = [];

      // Verificar loops aninhados profundos
      const nestedLoops = (editedContent.match(/for\s*\([^}]*for\s*\(/g) || [])
        .length;
      if (nestedLoops > 2) {
        issues.push(
          "Loops aninhados profundos detectados - considere otimização",
        );
      }

      // Verificar uso de += em strings grandes
      if (editedContent.includes("+=") && editedContent.includes("string")) {
        issues.push(
          "Concatenação de string com += - considere array.join() para performance",
        );
      }

      return {
        passed: true, // Performance não falha validação
        issues,
        confidence: 0.6,
      };
    },
  };
}

/**
 * Regra de validação de acessibilidade
 */
function createAccessibilityValidationRule(
  fileExtension: string,
): ValidationRule {
  return {
    name: "accessibility",
    description: "Validação de acessibilidade",
    weight: 0.4,
    validator: async (originalContent, editedContent) => {
      if (![".tsx", ".jsx", ".html"].includes(fileExtension)) {
        return { passed: true, issues: [], confidence: 1.0 };
      }

      const issues: string[] = [];

      // Verificar atributos alt em imagens
      const imgTags = editedContent.match(/<img[^>]*>/g) || [];
      for (const img of imgTags) {
        if (!img.includes("alt=")) {
          issues.push(
            "Tag img sem atributo alt - importante para acessibilidade",
          );
        }
      }

      // Verificar labels para inputs
      const inputTags = editedContent.match(/<input[^>]*>/g) || [];
      for (const input of inputTags) {
        if (
          !input.includes("aria-label") &&
          !editedContent.includes("<label")
        ) {
          issues.push(
            "Input sem label associado - importante para acessibilidade",
          );
        }
      }

      return {
        passed: true, // Acessibilidade não falha validação
        issues,
        confidence: 0.7,
      };
    },
  };
}

// ============= FUNÇÕES AUXILIARES =============

/**
 * Valida sintaxe JavaScript/TypeScript usando node
 */
async function validateJavaScriptSyntax(
  content: string,
  filePath: string,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const isTypeScript = filePath.endsWith(".ts") || filePath.endsWith(".tsx");

    // Para JavaScript, usar node --check
    // Para TypeScript, precisaria do compilador TypeScript (pode ser implementado depois)
    if (!isTypeScript) {
      const child = spawn("node", ["--check"], {
        stdio: ["pipe", "pipe", "pipe"],
      });

      child.stdin.write(content);
      child.stdin.end();

      let stderr = "";
      child.stderr.on("data", (data) => {
        stderr += data.toString();
      });

      child.on("close", (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(stderr || "Erro de sintaxe JavaScript"));
        }
      });

      child.on("error", () => {
        // Se node não estiver disponível, não falha a validação
        resolve();
      });
    } else {
      // Para TypeScript, fazer validação básica
      resolve();
    }
  });
}

/**
 * Valida sintaxe Python
 */
async function validatePythonSyntax(
  content: string,
  _filePath: string,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn("python", ["-m", "py_compile", "-"], {
      stdio: ["pipe", "pipe", "pipe"],
    });

    child.stdin.write(content);
    child.stdin.end();

    let stderr = "";
    child.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    child.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(stderr || "Erro de sintaxe Python"));
      }
    });

    child.on("error", () => {
      // Se python não estiver disponível, não falha a validação
      resolve();
    });
  });
}

/**
 * Conta caracteres específicos
 */
function countCharacters(
  content: string,
  chars: string[],
): Record<string, number> {
  const counts: Record<string, number> = {};

  for (const char of chars) {
    counts[char] = (content.match(new RegExp(`\\${char}`, "g")) || []).length;
  }

  return counts;
}

/**
 * Extrai imports do código
 */
function extractImports(content: string): string[] {
  const importRegex = /import\s+.*\s+from\s+['"][^'"]*['"]/g;
  return content.match(importRegex) || [];
}

/**
 * Detecta tipo e tamanho de indentação
 */
function detectIndentation(content: string): {
  type: "spaces" | "tabs";
  size: number;
} {
  const lines = content.split("\n");
  let spacesCount = 0;
  let tabsCount = 0;
  let sizeSum = 0;
  let sizeCount = 0;

  for (const line of lines) {
    if (line.startsWith(" ")) {
      spacesCount++;
      const match = line.match(/^( +)/);
      if (match) {
        sizeSum += match[1].length;
        sizeCount++;
      }
    } else if (line.startsWith("\t")) {
      tabsCount++;
      sizeSum += 4; // Considerar tab como 4 espaços
      sizeCount++;
    }
  }

  return {
    type: tabsCount > spacesCount ? "tabs" : "spaces",
    size: sizeCount > 0 ? Math.round(sizeSum / sizeCount) : 2,
  };
}

/**
 * Analisa uso de aspas
 */
function analyzeQuoteUsage(content: string): {
  primary: "single" | "double";
  ratio: number;
} {
  const singleQuotes = (content.match(/'/g) || []).length;
  const doubleQuotes = (content.match(/"/g) || []).length;

  const total = singleQuotes + doubleQuotes;
  const ratio = total > 0 ? singleQuotes / total : 0.5;

  return {
    primary: singleQuotes > doubleQuotes ? "single" : "double",
    ratio,
  };
}

/**
 * Extrai anotações de tipo do TypeScript
 */
function extractTypeAnnotations(content: string): string[] {
  const typeRegex = /:\s*[A-Za-z][A-Za-z0-9<>[\]|&\s]*/g;
  return content.match(typeRegex) || [];
}
