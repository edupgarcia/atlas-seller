import { createServerFn } from "@tanstack/react-start";

// A origem do navegador entra assinada no state (ver mercadolivre-oauth.server.ts):
// é para ela que a janela do Mercado Livre devolve o aviso de "conectado".
export const startMercadoLivreAuthFn = createServerFn({ method: "POST" })
  .inputValidator((data: { origin?: string }) => data ?? {})
  .handler(async ({ data }) => {
    const { buildMercadoLivreAuthUrl } = await import("./mercadolivre-oauth.server");
    return buildMercadoLivreAuthUrl(data.origin);
  });
