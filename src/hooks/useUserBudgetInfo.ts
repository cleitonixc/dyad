export function useUserBudgetInfo() {
  // Para funcionalidades locais, não há limitações de orçamento
  // Retornamos sempre null para indicar que o orçamento não se aplica
  return {
    userBudget: null,
    isLoadingUserBudget: false,
    userBudgetError: null,
    isFetchingUserBudget: false,
    refetchUserBudget: () => Promise.resolve(null),
  };
}
