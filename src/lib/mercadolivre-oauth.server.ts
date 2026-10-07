import { buildSignedState } from "./amazon-oauth.server";

/**
 * Início da autorização Mercado Livre. Mesmo modelo da Amazon: o seller vem só da
 * sessão, vai num state assinado (HMAC) e a função `ml-oauth-callback` confere.
 *
 * A origem do navegador (ex.: https://atlasseller.lovable.app) entra assinada no
 * state para sobreviver ao redirecionamento do Mercado Livre — assim a função sabe
 * para qual endereço devolver o aviso de "conectado" e fechar a janela.
 */
export async function buildMercadoLivreAuthUrl(
  origin?: string,
): Promise<{ url: string }> {
  const clean =
    typeof origin === "string" && /^https:\/\/[a-z0-9.-]+(:\d{1,5})?$/i.test(origin)
      ? origin.replace(/\/+$/, "")
      : undefined;
  const { seller, payload, state } = await buildSignedState(clean);
  const base =
    process.env.SUPABASE_URL ??
    process.env.VITE_SUPABASE_URL ??
    "https://omvtqftgbkdthgfypjlx.supabase.co";
  console.log("[ml-oauth] start", {
    sellerId: seller.id,
    nonce: payload.nonce.slice(0, 8),
    origin: clean ?? "padrão",
  });
  return { url: `${base}/functions/v1/ml-oauth-callback?state=${encodeURIComponent(state)}` };
}
