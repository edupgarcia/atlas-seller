import { defineTool } from "@lovable.dev/mcp-js";
import { errorResult, jsonResult, requireSeller } from "../supabase";

export default defineTool({
  name: "get_my_account",
  title: "Minha conta",
  description:
    "Retorna o perfil do seller autenticado no Atlas Seller e se a conta Amazon está conectada.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    try {
      const { seller } = await requireSeller(ctx);
      return jsonResult({
        seller_id: seller.id,
        name: seller.name,
        email: seller.email,
        amazon_connected: Boolean(seller.marketplace_account_id),
        marketplace_account_id: seller.marketplace_account_id,
      });
    } catch (e) {
      return errorResult(e instanceof Error ? e.message : String(e));
    }
  },
});
