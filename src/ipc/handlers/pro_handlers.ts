import log from "electron-log";
import { createLoggedHandler } from "./safe_handle";
import { UserBudgetInfo } from "../ipc_types";

const logger = log.scope("pro_handlers");
const handle = createLoggedHandler(logger);

export function registerProHandlers() {
  // Para funcionalidades apenas locais, não precisamos buscar orçamento externo
  handle("get-user-budget", async (): Promise<UserBudgetInfo | null> => {
    logger.debug(
      "Orçamento de usuário não aplicável para funcionalidades locais",
    );
    return null;
  });
}
