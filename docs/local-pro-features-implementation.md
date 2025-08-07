# Plano de Implementação: Funcionalidades Pro Locais

## 📋 Visão Geral

Este documento detalha o plano para implementar as funcionalidades Pro do Dyad diretamente no projeto, removendo a dependência do Dyad Engine externo e tornando essas funcionalidades disponíveis localmente.

### 🎯 Objetivos

- [ ] **Privacidade Total**: Manter todos os dados locais sem envio para servidores externos
- [ ] **Remoção de Custos**: Eliminar necessidade de subscrição Pro
- [ ] **Performance Local**: Reduzir latência removendo chamadas de rede
- [ ] **Controle Granular**: Permitir configurações avançadas pelo usuário
- [ ] **Open Source**: Disponibilizar funcionalidades para toda a comunidade

---

## 🔍 Análise das Funcionalidades Atuais

### ✅ Funcionalidades Pro Identificadas

- [x] **Smart Context** (`enableProSmartFilesContextMode`)

  - Inclusão automática inteligente de arquivos relevantes
  - Otimização de contexto para bases de código grandes
  - Atualmente processado no `https://engine.dyad.sh/v1`

- [x] **Turbo/Lazy Edits** (`enableProLazyEditsMode`)

  - Edições de arquivo mais rápidas e econômicas
  - Usa modelos otimizados para atualizações completas de arquivo
  - Classificação automática de complexidade de edições

- [x] **Dyad Engine Integration**
  - Sistema atual envia arquivos via `dyad_options`
  - Processa funcionalidades no servidor externo
  - Requer chave API Pro

---

## 🏗️ Fase 1: Smart Context Local

### 📁 Estrutura de Arquivos

- [ ] **Criar `src/ipc/processors/smart_context_processor.ts`**

  - [ ] Interface `SmartContextProcessor`
  - [ ] Método `analyzeCodebaseForContext()`
  - [ ] Método `identifyRelatedFiles()`
  - [ ] Método `optimizeContextForTokens()`

- [ ] **Criar `src/utils/dependency_analyzer.ts`**

  - [ ] Função `buildDependencyGraph()`
  - [ ] Função `parseImportsExports()`
  - [ ] Cache de grafos de dependência

- [ ] **Criar `src/utils/semantic_analyzer.ts`**
  - [ ] Função `extractEntitiesFromPrompt()`
  - [ ] Função `findSemanticMatches()`
  - [ ] Sistema de scoring por relevância

### 🔧 Implementação Core

- [ ] **Análise de Dependências**

  ```typescript
  interface DependencyGraph {
    nodes: Map<string, FileNode>;
    edges: Map<string, string[]>;
    weights: Map<string, number>;
  }

  async function buildDependencyGraph(
    appPath: string,
  ): Promise<DependencyGraph>;
  ```

- [ ] **Análise Semântica**

  ```typescript
  interface SemanticMatch {
    filePath: string;
    relevanceScore: number;
    matchedEntities: string[];
    contextImportance: number;
  }

  async function findSemanticMatches(
    prompt: string,
    files: string[],
  ): Promise<SemanticMatch[]>;
  ```

- [ ] **Otimização de Contexto**

  ```typescript
  interface ContextOptimization {
    selectedFiles: string[];
    totalTokens: number;
    relevanceRatio: number;
  }

  async function optimizeContext(
    candidates: string[],
    maxTokens: number,
  ): Promise<ContextOptimization>;
  ```

### 🎛️ Configurações Avançadas

- [ ] **Adicionar ao `UserSettingsSchema`**

  ```typescript
  smartContextSensitivity: z.enum(["conservative", "balanced", "aggressive"]).optional(),
  smartContextMaxTokens: z.number().min(1000).max(50000).optional(),
  smartContextDependencyDepth: z.number().min(1).max(5).optional(),
  ```

- [ ] **Implementar Estratégias de Contexto**
  - [ ] **Conservative**: Apenas dependências diretas + arquivos mencionados
  - [ ] **Balanced**: Dependências até 2 níveis + análise semântica
  - [ ] **Aggressive**: Análise completa + arquivos relacionados por padrões

### 🔗 Integração com Sistema Existente

- [ ] **Modificar `src/utils/codebase.ts`**

  - [ ] Substituir lógica do `isSmartContextEnabled`
  - [ ] Integrar `SmartContextProcessor` no `extractCodebase()`
  - [ ] Manter compatibilidade com `smartContextAutoIncludes`

- [ ] **Atualizar `src/ipc/handlers/context_paths_handlers.ts`**
  - [ ] Usar processador local em vez de engine externo
  - [ ] Adicionar métricas de performance
  - [ ] Implementar cache de resultados

---

## ⚡ Fase 2: Turbo Edits Local

### 📁 Estrutura de Arquivos

- [ ] **Criar `src/ipc/processors/turbo_edits_processor.ts`**

  - [ ] Interface `TurboEditsProcessor`
  - [ ] Método `generateOptimizedEdit()`
  - [ ] Método `validateEdit()`
  - [ ] Método `estimateEditComplexity()`

- [ ] **Criar `src/prompts/edit_templates.ts`**

  - [ ] Templates para edições simples
  - [ ] Templates para refatoração
  - [ ] Templates para mudanças estruturais

- [ ] **Criar `src/utils/edit_validator.ts`**
  - [ ] Validação de sintaxe
  - [ ] Verificação de estrutura
  - [ ] Detecção de breaking changes

### 🎯 Sistema de Classificação

- [ ] **Implementar `EditComplexity` enum**

  ```typescript
  enum EditComplexity {
    SIMPLE = "simple", // Correções de texto, typos
    MODERATE = "moderate", // Refatoração de funções
    COMPLEX = "complex", // Mudanças arquiteturais
    MULTI_FILE = "multi_file", // Mudanças em múltiplos arquivos
  }
  ```

- [ ] **Implementar `EditStrategy` interface**
  ```typescript
  interface EditStrategy {
    modelSelection: "fast" | "balanced" | "powerful";
    promptTemplate: string;
    maxTokens: number;
    validationLevel: "basic" | "enhanced" | "strict";
    retryPolicy: RetryPolicy;
  }
  ```

### 🤖 Seleção de Modelo Inteligente

- [ ] **Criar sistema de roteamento de modelos**

  - [ ] Edições simples → Modelos rápidos/baratos
  - [ ] Edições complexas → Modelos mais poderosos
  - [ ] Fallback automático em caso de falha

- [ ] **Implementar templates otimizados**
  - [ ] Template para correções de sintaxe
  - [ ] Template para adição de funcionalidades
  - [ ] Template para refatoração
  - [ ] Template para otimização de código

### 🔍 Validação e Qualidade

- [ ] **Sistema de validação automática**

  ```typescript
  interface EditValidation {
    syntaxValid: boolean;
    structureIntact: boolean;
    potentialIssues: string[];
    confidence: number;
  }
  ```

- [ ] **Implementar métricas de qualidade**
  - [ ] Taxa de sucesso por tipo de edição
  - [ ] Tempo médio de processamento
  - [ ] Necessidade de retrabalho

---

## 🔄 Fase 3: Remoção de Dependências Externas

### 🗑️ Remover Integração com Dyad Engine

- [ ] **Substituir `src/ipc/utils/llm_engine_provider.ts`**

  - [ ] Criar `src/ipc/utils/local_pro_provider.ts`
  - [ ] Implementar wrapper para funcionalidades locais
  - [ ] Manter interface compatível

- [ ] **Modificar `src/ipc/utils/get_model_client.ts`**
  - [ ] Remover chamadas para `createDyadEngine()`
  - [ ] Usar `createLocalProProvider()` em vez disso
  - [ ] Manter lógica de fallback

### 🔧 Novo Provider Local

- [ ] **Implementar `createLocalProProvider()`**
  ```typescript
  export function createLocalProProvider(
    baseProvider: any,
    settings: UserSettings,
    files?: File[],
  ): ProEnhancedProvider {
    return {
      ...baseProvider,
      model: (modelId: string, config?: any) => {
        let enhancedModel = baseProvider.model(modelId, config);

        if (settings.enableLocalSmartContext) {
          enhancedModel = wrapWithSmartContext(enhancedModel, files);
        }

        if (settings.enableLocalTurboEdits) {
          enhancedModel = wrapWithTurboEdits(enhancedModel);
        }

        return enhancedModel;
      },
    };
  }
  ```

### 🎛️ Wrappers de Funcionalidade

- [ ] **Implementar `wrapWithSmartContext()`**

  - [ ] Interceptar prompts para adicionar contexto inteligente
  - [ ] Aplicar otimizações de token
  - [ ] Adicionar métricas de uso

- [ ] **Implementar `wrapWithTurboEdits()`**
  - [ ] Detectar intenção de edição em prompts
  - [ ] Aplicar templates otimizados
  - [ ] Usar seleção de modelo inteligente

---

## 🎨 Fase 4: Atualização da Interface

### 🔄 Modificar Componentes Existentes

- [ ] **Atualizar `src/components/ProModeSelector.tsx`**

  - [ ] Remover dependência de `enableDyadPro`
  - [ ] Atualizar tooltips para refletir implementação local
  - [ ] Adicionar configurações granulares
  - [ ] Remover links para subscrição

- [ ] **Modificar `src/components/ContextFilesPicker.tsx`**
  - [ ] Atualizar condicionais de `isSmartContextEnabled`
  - [ ] Adicionar indicadores de processamento local
  - [ ] Mostrar métricas de performance

### 🆕 Novos Componentes de Configuração

- [ ] **Criar `src/components/SmartContextSettings.tsx`**

  - [ ] Slider para sensibilidade
  - [ ] Configuração de profundidade de dependências
  - [ ] Preview de arquivos que serão incluídos

- [ ] **Criar `src/components/TurboEditsSettings.tsx`**
  - [ ] Seleção de threshold de complexidade
  - [ ] Configuração de estratégias de modelo
  - [ ] Métricas de performance

### 📊 Componentes de Monitoramento

- [ ] **Criar `src/components/ProFeaturesMonitor.tsx`**
  - [ ] Dashboard de uso das funcionalidades
  - [ ] Métricas de economia de tokens
  - [ ] Estatísticas de performance

---

## ⚙️ Fase 5: Configurações e Schemas

### 📋 Atualizar Schemas

- [ ] **Modificar `src/lib/schemas.ts`**

  ```typescript
  // Remover dependência de enableDyadPro
  enableLocalSmartContext: z.boolean().optional(),
  enableLocalTurboEdits: z.boolean().optional(),

  // Configurações granulares
  smartContextSensitivity: z.enum(["conservative", "balanced", "aggressive"]).optional(),
  smartContextMaxTokens: z.number().min(1000).max(50000).optional(),
  smartContextDependencyDepth: z.number().min(1).max(5).optional(),

  turboEditsComplexityThreshold: z.enum(["simple", "moderate", "all"]).optional(),
  turboEditsModelStrategy: z.enum(["fast", "balanced", "quality"]).optional(),
  ```

### 🔧 Configurações Padrão

- [ ] **Atualizar `src/main/settings.ts`**
  ```typescript
  const DEFAULT_SETTINGS: UserSettings = {
    // ... existing
    enableLocalSmartContext: true,
    enableLocalTurboEdits: true,
    smartContextSensitivity: "balanced",
    smartContextMaxTokens: 20000,
    smartContextDependencyDepth: 2,
    turboEditsComplexityThreshold: "moderate",
    turboEditsModelStrategy: "balanced",
  };
  ```

### 🔄 Migração de Configurações

- [ ] **Criar script de migração**
  - [ ] Converter `enableProSmartFilesContextMode` → `enableLocalSmartContext`
  - [ ] Converter `enableProLazyEditsMode` → `enableLocalTurboEdits`
  - [ ] Manter compatibilidade temporária

---

## 🧪 Fase 6: Testes e Validação

### 🔬 Testes Unitários

- [ ] **Testes para Smart Context**

  - [ ] `smart_context_processor.test.ts`
  - [ ] `dependency_analyzer.test.ts`
  - [ ] `semantic_analyzer.test.ts`

- [ ] **Testes para Turbo Edits**
  - [ ] `turbo_edits_processor.test.ts`
  - [ ] `edit_validator.test.ts`
  - [ ] `edit_templates.test.ts`

### 🔧 Testes de Integração

- [ ] **Testes E2E**
  - [ ] `local_pro_features.spec.ts`
  - [ ] Cenários de uso real
  - [ ] Comparação de performance

### 📊 Benchmarks

- [ ] **Métricas de Performance**
  - [ ] Tempo de processamento vs. engine externo
  - [ ] Qualidade das sugestões
  - [ ] Economia de tokens

---

## 📈 Fase 7: Otimização e Polimento

### ⚡ Otimizações de Performance

- [ ] **Cache Inteligente**

  - [ ] Cache de grafos de dependência
  - [ ] Cache de análise semântica
  - [ ] Invalidação automática

- [ ] **Processamento Assíncrono**
  - [ ] Background processing para análises pesadas
  - [ ] Indicadores de progresso
  - [ ] Cancelamento de operações

### 🔍 Monitoramento e Métricas

- [ ] **Sistema de Telemetria Local**
  - [ ] Coleta de métricas de uso
  - [ ] Analytics de performance
  - [ ] Detecção de problemas

### 📚 Documentação

- [ ] **Documentação Técnica**

  - [ ] Guia de arquitetura
  - [ ] API reference
  - [ ] Troubleshooting guide

- [ ] **Documentação do Usuário**
  - [ ] Guia de configuração
  - [ ] Melhores práticas
  - [ ] FAQ

---

## 🎯 Critérios de Sucesso

### ✅ Funcionalidade

- [ ] Smart Context funciona sem dependências externas
- [ ] Turbo Edits mantém qualidade comparável
- [ ] Interface é intuitiva e responsiva
- [ ] Migração é transparente para usuários

### 📊 Performance

- [ ] Tempo de resposta ≤ 500ms para Smart Context
- [ ] Tempo de resposta ≤ 200ms para classificação de edições
- [ ] Uso de memória ≤ 100MB adicional
- [ ] Cache hit rate ≥ 80%

### 🔒 Qualidade

- [ ] Taxa de sucesso ≥ 95% para funcionalidades
- [ ] Cobertura de testes ≥ 90%
- [ ] Zero vazamentos de memória
- [ ] Graceful degradation em casos de erro

---

## 🚀 Cronograma Estimado

### 📅 Timeline

- **Semana 1-2**: Fase 1 (Smart Context Local)
- **Semana 3-4**: Fase 2 (Turbo Edits Local)
- **Semana 5**: Fase 3 (Remoção de Dependências)
- **Semana 6**: Fase 4 (Atualização da Interface)
- **Semana 7**: Fase 5 (Configurações e Schemas)
- **Semana 8-9**: Fase 6 (Testes e Validação)
- **Semana 10**: Fase 7 (Otimização e Polimento)

### 🎯 Milestones

- [ ] **M1**: Smart Context básico funcionando
- [ ] **M2**: Turbo Edits classificando corretamente
- [ ] **M3**: Dependências externas removidas
- [ ] **M4**: Interface atualizada e configurável
- [ ] **M5**: Beta pronto para testes
- [ ] **M6**: Release candidate

---

## 🔄 Próximos Passos

### 🚀 Início Imediato

1. [ ] **Configurar estrutura de arquivos**
2. [ ] **Implementar interfaces básicas**
3. [ ] **Criar testes scaffolding**
4. [ ] **Começar com dependency analyzer**

### 🎯 Prioridades

1. **Alta**: Smart Context (maior impacto no usuário)
2. **Alta**: Remoção de dependências (independência)
3. **Média**: Turbo Edits (otimização)
4. **Média**: Interface avançada (usabilidade)
5. **Baixa**: Métricas e monitoramento (observabilidade)

---

## 💡 Benefícios Esperados

### 🔒 Para o Usuário

- **Privacidade Total**: Dados nunca saem da máquina
- **Custo Zero**: Sem necessidade de subscrição
- **Performance**: Menor latência, maior responsividade
- **Controle**: Configurações granulares
- **Transparência**: Código aberto e auditável

### 🏗️ Para o Projeto

- **Independência**: Sem dependências de serviços externos
- **Sustentabilidade**: Modelo de negócio mais simples
- **Comunidade**: Funcionalidades abertas para contribuições
- **Inovação**: Base para futuras funcionalidades avançadas
- **Competitividade**: Diferencial no mercado open-source

---

## ⚠️ Riscos e Mitigações

### 🚨 Riscos Identificados

- [ ] **Qualidade**: Implementação local pode ser inferior
  - **Mitigação**: Benchmarks rigorosos e iteração contínua
- [ ] **Performance**: Processamento local pode ser lento
  - **Mitigação**: Otimizações, cache e processamento assíncrono
- [ ] **Complexidade**: Aumento da complexidade do código
  - **Mitigação**: Arquitetura modular e documentação extensa
- [ ] **Manutenção**: Mais código para manter
  - **Mitigação**: Testes automatizados e CI/CD robusto

### 🛡️ Planos de Contingência

- [ ] **Fallback**: Manter compatibilidade com engine externo
- [ ] **Rollback**: Versioning cuidadoso para reversão
- [ ] **Suporte**: Documentação para troubleshooting
- [ ] **Monitoramento**: Alertas para problemas de performance

---

_Este documento é um plano vivo e será atualizado conforme o progresso da implementação._
