import { buildSignedState } from "./amazon-oauth.server";

/**
 * Início da autorização Temu. Mesmo modelo da Amazon: o seller vem só da
 * sessão, vai num state assinado (HMAC) e a função `temu-auth` confere.
 */
export async function buildTemuAuthUrl(): Promise<{ url: string }> {
  const { seller, payload, state } = await buildSignedState();
  const base =
    process.env.SUPABASE_URL ??
    process.env.VITE_SUPABASE_URL ??
    "https://omvtqftgbkdthgfypjlx.supabase.co";
  console.log("[temu-oauth] start", { sellerId: seller.id, nonce: payload.nonce.slice(0, 8) });
  return { url: `${base}/functions/v1/temu-auth/login?state=${encodeURIComponent(state)}` };
}
