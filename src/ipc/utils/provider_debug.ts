import log from "electron-log";

const logger = log.scope("provider_debug");

/**
 * Wrapper para debug de providers que ajuda a identificar problemas de estrutura
 */
export function debugProvider(provider: any, name: string = "unknown"): any {
  if (!provider) {
    logger.error(`Provider ${name} é null/undefined`);
    return provider;
  }

  logger.debug(`Provider ${name} debug:`, {
    type: typeof provider,
    isFunction: typeof provider === "function",
    keys: typeof provider === "object" ? Object.keys(provider) : [],
    hasModel: typeof provider?.model,
    hasChatModel: typeof provider?.chatModel,
    constructor: provider?.constructor?.name,
  });

  // Se o provider é um objeto, verificar os métodos disponíveis
  if (typeof provider === "object" && provider !== null) {
    const methods = Object.getOwnPropertyNames(provider).filter(
      (key) => typeof provider[key] === "function",
    );

    if (methods.length > 0) {
      logger.debug(`Provider ${name} métodos disponíveis:`, methods);
    }
  }

  // Criar um proxy para interceptar chamadas e detectar problemas
  return new Proxy(provider, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver);

      if (prop === "model" && typeof value !== "function") {
        logger.error(
          `ERRO: Tentativa de acessar '${String(prop)}' em provider ${name}, mas não é uma função!`,
          {
            propType: typeof value,
            propValue: value,
            availableProps: Object.keys(target),
          },
        );
      }

      return value;
    },
    apply(target, thisArg, argumentsList) {
      logger.debug(
        `Provider ${name} sendo chamado como função com args:`,
        argumentsList,
      );
      return Reflect.apply(target, thisArg, argumentsList);
    },
  });
}

/**
 * Adiciona debug automático a providers
 */
export function wrapProviderWithDebug(provider: any, name: string): any {
  const debuggedProvider = debugProvider(provider, name);

  // Se o provider tem métodos, envolvê-los também
  if (typeof provider === "object" && provider?.model) {
    const originalModel = provider.model;
    debuggedProvider.model = function (...args: any[]) {
      logger.debug(`${name}.model() chamado com:`, args);
      try {
        const result = originalModel.apply(this, args);
        logger.debug(`${name}.model() retornou:`, typeof result);
        return result;
      } catch (error) {
        logger.error(`Erro em ${name}.model():`, error);
        throw error;
      }
    };
  }

  return debuggedProvider;
}
