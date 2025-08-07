export enum EditType {
  SYNTAX_FIX = "syntax_fix",
  ADD_FEATURE = "add_feature",
  REFACTOR = "refactor",
  OPTIMIZE = "optimize",
}

export interface EditTemplate {
  type: EditType;
  modelType: "fast" | "balanced" | "powerful";
  template: string;
  instructions: string[];
  constraints: string[];
}

/**
 * Templates otimizados para diferentes tipos de edição
 */
const EDIT_TEMPLATES: Record<string, EditTemplate> = {
  // ===================== SYNTAX FIX TEMPLATES =====================
  syntax_fix_fast: {
    type: EditType.SYNTAX_FIX,
    modelType: "fast",
    template: `Fix the syntax error in this {{FILE_EXTENSION}} file:

File: {{FILE_NAME}}

{{ORIGINAL_PROMPT}}

Current code:
\`\`\`{{FILE_EXTENSION}}
{{FILE_CONTENT}}
\`\`\`

Instructions:
- Fix ONLY the syntax error mentioned
- Make minimal changes required
- Preserve all existing functionality
- Keep the same code style
- Return only the corrected code

{{CONTEXT}}`,
    instructions: [
      "Foco apenas na correção de sintaxe",
      "Mudanças mínimas necessárias",
      "Preservar funcionalidade existente",
    ],
    constraints: [
      "Máximo {{MAX_TOKENS}} tokens",
      "Não adicionar funcionalidades extras",
      "Manter estilo de código original",
    ],
  },

  syntax_fix_balanced: {
    type: EditType.SYNTAX_FIX,
    modelType: "balanced",
    template: `Fix the syntax error and improve code quality in this {{FILE_EXTENSION}} file:

File: {{FILE_NAME}}

{{ORIGINAL_PROMPT}}

Current code:
\`\`\`{{FILE_EXTENSION}}
{{FILE_CONTENT}}
\`\`\`

Tasks:
1. Fix the syntax error mentioned
2. Improve code readability if possible
3. Add basic comments if missing
4. Ensure consistent formatting

Guidelines:
- Primary focus: fix the error
- Secondary: minor improvements
- Preserve all functionality
- Follow best practices for {{FILE_EXTENSION}}

{{CONTEXT}}`,
    instructions: [
      "Correção de sintaxe com melhorias menores",
      "Adicionar comentários básicos se necessário",
      "Seguir melhores práticas",
    ],
    constraints: [
      "Máximo {{MAX_TOKENS}} tokens",
      "Foco principal na correção",
      "Melhorias secundárias apenas",
    ],
  },

  syntax_fix_powerful: {
    type: EditType.SYNTAX_FIX,
    modelType: "powerful",
    template: `Analyze and fix the syntax error with comprehensive code review:

File: {{FILE_NAME}} ({{FILE_EXTENSION}})

Request: {{ORIGINAL_PROMPT}}

Current code:
\`\`\`{{FILE_EXTENSION}}
{{FILE_CONTENT}}
\`\`\`

Comprehensive Analysis Required:
1. Identify and fix the primary syntax error
2. Detect any related issues or potential bugs
3. Improve code structure and readability
4. Add appropriate documentation
5. Ensure TypeScript compliance (if applicable)
6. Check for performance implications

Validation Level: {{VALIDATION_LEVEL}}

Please provide:
- Fixed code with explanatory comments
- Summary of changes made
- Any recommendations for further improvements

{{CONTEXT}}`,
    instructions: [
      "Análise completa do código",
      "Correção com melhorias estruturais",
      "Documentação adequada",
      "Recomendações adicionais",
    ],
    constraints: [
      "Máximo {{MAX_TOKENS}} tokens",
      "Análise abrangente necessária",
      "Incluir explicações das mudanças",
    ],
  },

  // ===================== ADD FEATURE TEMPLATES =====================
  add_feature_fast: {
    type: EditType.ADD_FEATURE,
    modelType: "fast",
    template: `Add the requested feature to this {{FILE_EXTENSION}} file:

File: {{FILE_NAME}}

{{ORIGINAL_PROMPT}}

Current code:
\`\`\`{{FILE_EXTENSION}}
{{FILE_CONTENT}}
\`\`\`

Requirements:
- Add only the specific feature requested
- Keep existing code unchanged unless necessary
- Use simple, straightforward implementation
- Maintain current code style

{{CONTEXT}}`,
    instructions: [
      "Implementação direta da funcionalidade",
      "Mudanças mínimas no código existente",
      "Abordagem simples e eficaz",
    ],
    constraints: [
      "Máximo {{MAX_TOKENS}} tokens",
      "Implementação básica apenas",
      "Não over-engineer a solução",
    ],
  },

  add_feature_balanced: {
    type: EditType.ADD_FEATURE,
    modelType: "balanced",
    template: `Implement the requested feature with good practices:

File: {{FILE_NAME}} ({{FILE_EXTENSION}})

Feature Request: {{ORIGINAL_PROMPT}}

Current code:
\`\`\`{{FILE_EXTENSION}}
{{FILE_CONTENT}}
\`\`\`

Implementation Guidelines:
1. Add the requested feature cleanly
2. Follow established patterns in the codebase
3. Add appropriate error handling
4. Include basic documentation
5. Ensure type safety (if TypeScript)
6. Consider edge cases

Quality Standards:
- Clean, readable code
- Consistent with existing style
- Proper separation of concerns
- Basic testing considerations

{{CONTEXT}}`,
    instructions: [
      "Implementação seguindo boas práticas",
      "Tratamento de erros apropriado",
      "Documentação básica",
      "Consideração de casos extremos",
    ],
    constraints: [
      "Máximo {{MAX_TOKENS}} tokens",
      "Qualidade balanceada com simplicidade",
      "Seguir padrões existentes",
    ],
  },

  add_feature_powerful: {
    type: EditType.ADD_FEATURE,
    modelType: "powerful",
    template: `Design and implement a robust solution for the requested feature:

File: {{FILE_NAME}} ({{FILE_EXTENSION}})

Feature Request: {{ORIGINAL_PROMPT}}

Current codebase:
\`\`\`{{FILE_EXTENSION}}
{{FILE_CONTENT}}
\`\`\`

Comprehensive Implementation Required:

Architecture Considerations:
- Analyze current code structure and patterns
- Design feature to integrate seamlessly
- Consider scalability and maintainability
- Plan for future extensibility

Implementation Requirements:
1. Robust feature implementation
2. Comprehensive error handling and validation
3. Detailed documentation and comments
4. Type safety and interface design
5. Performance optimization
6. Testing strategy considerations
7. Accessibility (if UI-related)

Code Quality Standards:
- SOLID principles compliance
- Design patterns where appropriate
- Clean architecture principles
- Comprehensive edge case handling

Validation Level: {{VALIDATION_LEVEL}}

Please provide:
- Complete implementation
- Architectural decisions explanation
- Usage examples
- Testing recommendations

{{CONTEXT}}`,
    instructions: [
      "Implementação robusta e escalável",
      "Análise arquitetural completa",
      "Documentação abrangente",
      "Considerações de teste e performance",
    ],
    constraints: [
      "Máximo {{MAX_TOKENS}} tokens",
      "Qualidade enterprise-level",
      "Explicações detalhadas necessárias",
    ],
  },

  // ===================== REFACTOR TEMPLATES =====================
  refactor_fast: {
    type: EditType.REFACTOR,
    modelType: "fast",
    template: `Refactor this {{FILE_EXTENSION}} code as requested:

File: {{FILE_NAME}}

{{ORIGINAL_PROMPT}}

Current code:
\`\`\`{{FILE_EXTENSION}}
{{FILE_CONTENT}}
\`\`\`

Refactoring Goals:
- Implement the specific refactoring requested
- Maintain exact same functionality
- Keep changes focused and minimal
- Preserve existing interfaces

{{CONTEXT}}`,
    instructions: [
      "Refatoração focada e específica",
      "Manter funcionalidade idêntica",
      "Mudanças mínimas necessárias",
    ],
    constraints: [
      "Máximo {{MAX_TOKENS}} tokens",
      "Não alterar comportamento externo",
      "Refatoração simples apenas",
    ],
  },

  refactor_balanced: {
    type: EditType.REFACTOR,
    modelType: "balanced",
    template: `Refactor the code to improve structure and maintainability:

File: {{FILE_NAME}} ({{FILE_EXTENSION}})

Refactoring Request: {{ORIGINAL_PROMPT}}

Current code:
\`\`\`{{FILE_EXTENSION}}
{{FILE_CONTENT}}
\`\`\`

Refactoring Objectives:
1. Implement requested structural changes
2. Improve code readability and organization
3. Reduce complexity and duplication
4. Enhance maintainability
5. Preserve all existing functionality
6. Update documentation accordingly

Quality Checks:
- Verify no breaking changes
- Maintain consistent naming conventions
- Improve separation of concerns
- Optimize for readability

{{CONTEXT}}`,
    instructions: [
      "Refatoração com foco em legibilidade",
      "Redução de complexidade",
      "Melhor separação de responsabilidades",
      "Preservação total de funcionalidade",
    ],
    constraints: [
      "Máximo {{MAX_TOKENS}} tokens",
      "Sem mudanças de comportamento",
      "Melhorias estruturais balanceadas",
    ],
  },

  refactor_powerful: {
    type: EditType.REFACTOR,
    modelType: "powerful",
    template: `Perform comprehensive refactoring with architectural improvements:

File: {{FILE_NAME}} ({{FILE_EXTENSION}})

Refactoring Scope: {{ORIGINAL_PROMPT}}

Current implementation:
\`\`\`{{FILE_EXTENSION}}
{{FILE_CONTENT}}
\`\`\`

Comprehensive Refactoring Analysis:

Code Quality Assessment:
- Analyze current architecture and design patterns
- Identify code smells and anti-patterns
- Evaluate performance bottlenecks
- Assess testability and maintainability

Refactoring Strategy:
1. Structural improvements and pattern implementation
2. Dependency management optimization
3. Performance and memory optimization
4. Enhanced error handling and robustness
5. Improved type safety and interfaces
6. Comprehensive documentation updates
7. Testing strategy improvements

Advanced Considerations:
- SOLID principles application
- Design pattern implementation
- Performance optimization
- Security considerations
- Accessibility improvements (if applicable)

Validation Level: {{VALIDATION_LEVEL}}

Deliverables:
- Refactored code with architectural improvements
- Detailed explanation of changes made
- Performance impact analysis
- Migration/deployment considerations
- Updated documentation

{{CONTEXT}}`,
    instructions: [
      "Refatoração arquitetural completa",
      "Aplicação de princípios SOLID",
      "Otimização de performance",
      "Análise de impacto detalhada",
    ],
    constraints: [
      "Máximo {{MAX_TOKENS}} tokens",
      "Melhorias arquiteturais profundas",
      "Documentação abrangente necessária",
    ],
  },

  // ===================== OPTIMIZE TEMPLATES =====================
  optimize_fast: {
    type: EditType.OPTIMIZE,
    modelType: "fast",
    template: `Optimize this {{FILE_EXTENSION}} code for better performance:

File: {{FILE_NAME}}

{{ORIGINAL_PROMPT}}

Current code:
\`\`\`{{FILE_EXTENSION}}
{{FILE_CONTENT}}
\`\`\`

Optimization Focus:
- Apply quick performance improvements
- Remove obvious inefficiencies
- Maintain same functionality
- Keep changes simple and safe

{{CONTEXT}}`,
    instructions: [
      "Otimizações simples e seguras",
      "Foco em melhorias óbvias",
      "Manter funcionalidade idêntica",
    ],
    constraints: [
      "Máximo {{MAX_TOKENS}} tokens",
      "Apenas otimizações de baixo risco",
      "Não alterar interfaces",
    ],
  },

  optimize_balanced: {
    type: EditType.OPTIMIZE,
    modelType: "balanced",
    template: `Optimize code performance with balanced improvements:

File: {{FILE_NAME}} ({{FILE_EXTENSION}})

Optimization Request: {{ORIGINAL_PROMPT}}

Current implementation:
\`\`\`{{FILE_EXTENSION}}
{{FILE_CONTENT}}
\`\`\`

Optimization Strategy:
1. Identify performance bottlenecks
2. Implement efficient algorithms/data structures
3. Reduce memory allocation overhead
4. Optimize loops and iterations
5. Improve caching strategies
6. Enhance resource management

Performance Goals:
- Faster execution time
- Lower memory usage
- Better scalability
- Maintained readability

Validation Requirements:
- Preserve exact functionality
- Maintain code clarity
- Add performance comments where helpful

{{CONTEXT}}`,
    instructions: [
      "Otimizações balanceadas entre performance e legibilidade",
      "Identificação e correção de gargalos",
      "Melhor uso de recursos",
      "Comentários sobre otimizações",
    ],
    constraints: [
      "Máximo {{MAX_TOKENS}} tokens",
      "Equilibrar performance e manutenibilidade",
      "Preservar funcionalidade completamente",
    ],
  },

  optimize_powerful: {
    type: EditType.OPTIMIZE,
    modelType: "powerful",
    template: `Perform comprehensive performance optimization analysis and implementation:

File: {{FILE_NAME}} ({{FILE_EXTENSION}})

Optimization Scope: {{ORIGINAL_PROMPT}}

Current codebase:
\`\`\`{{FILE_EXTENSION}}
{{FILE_CONTENT}}
\`\`\`

Comprehensive Performance Analysis:

Profiling and Assessment:
- Algorithm complexity analysis (Big O)
- Memory usage patterns evaluation
- I/O operation optimization opportunities
- Concurrency and parallelization potential
- Caching strategy assessment

Advanced Optimization Techniques:
1. Algorithm and data structure optimization
2. Memory management improvements
3. Lazy loading and on-demand computation
4. Efficient resource pooling
5. Performance monitoring integration
6. Bottleneck elimination strategies
7. Scalability enhancements

Implementation Standards:
- Micro-optimizations where beneficial
- Macro-architectural improvements
- Performance benchmarking considerations
- Resource cleanup and lifecycle management
- Error handling optimization

Validation Level: {{VALIDATION_LEVEL}}

Comprehensive Deliverables:
- Optimized implementation
- Performance impact analysis
- Benchmarking recommendations
- Monitoring and profiling suggestions
- Scalability assessment
- Maintenance considerations

{{CONTEXT}}`,
    instructions: [
      "Análise de performance abrangente",
      "Otimizações algorítmicas avançadas",
      "Melhorias arquiteturais",
      "Recomendações de benchmark e monitoramento",
    ],
    constraints: [
      "Máximo {{MAX_TOKENS}} tokens",
      "Otimizações enterprise-level",
      "Análise detalhada de impacto necessária",
    ],
  },
};

/**
 * Obtém o template de edição apropriado baseado no tipo e modelo
 */
export function getEditTemplate(
  editType: EditType,
  modelType: "fast" | "balanced" | "powerful",
): EditTemplate {
  const key = `${editType}_${modelType}`;
  const template = EDIT_TEMPLATES[key];

  if (!template) {
    // Fallback para template balanced se não encontrar
    const fallbackKey = `${editType}_balanced`;
    return (
      EDIT_TEMPLATES[fallbackKey] || EDIT_TEMPLATES["add_feature_balanced"]
    );
  }

  return template;
}

/**
 * Lista todos os tipos de edição disponíveis
 */
export function getAvailableEditTypes(): EditType[] {
  return Object.values(EditType);
}

/**
 * Obtém templates por tipo de modelo
 */
export function getTemplatesByModelType(
  modelType: "fast" | "balanced" | "powerful",
): EditTemplate[] {
  return Object.values(EDIT_TEMPLATES).filter(
    (template) => template.modelType === modelType,
  );
}

/**
 * Obtém templates por tipo de edição
 */
export function getTemplatesByEditType(editType: EditType): EditTemplate[] {
  return Object.values(EDIT_TEMPLATES).filter(
    (template) => template.type === editType,
  );
}

/**
 * Valida se uma combinação de tipo de edição e modelo está disponível
 */
export function isTemplateAvailable(
  editType: EditType,
  modelType: "fast" | "balanced" | "powerful",
): boolean {
  const key = `${editType}_${modelType}`;
  return key in EDIT_TEMPLATES;
}

/**
 * Obtém estatísticas dos templates disponíveis
 */
export function getTemplateStatistics(): {
  totalTemplates: number;
  templatesByType: Record<EditType, number>;
  templatesByModel: Record<string, number>;
} {
  const templates = Object.values(EDIT_TEMPLATES);

  const templatesByType = templates.reduce(
    (acc, template) => {
      acc[template.type] = (acc[template.type] || 0) + 1;
      return acc;
    },
    {} as Record<EditType, number>,
  );

  const templatesByModel = templates.reduce(
    (acc, template) => {
      acc[template.modelType] = (acc[template.modelType] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  return {
    totalTemplates: templates.length,
    templatesByType,
    templatesByModel,
  };
}
