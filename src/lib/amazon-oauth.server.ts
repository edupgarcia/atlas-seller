import { createHmac, randomUUID } from "node:crypto";
import { requireSessionSeller } from "./session.server";

/**
 * Início do OAuth Amazon amarrado à sessão do Atlas.
 *
 * O seller_id NUNCA vem do navegador: ele é lido do cookie de sessão assinado
 * e colocado num `state` assinado (HMAC-SHA256) e com validade curta. A função
 * `amazon-auth` precisa verificar essa assinatura antes de vincular a conta
 * Amazon — assim ninguém consegue forjar o state e vincular a conta a outro seller.
 *
 * Formato: base64url(JSON payload) + "." + base64url(HMAC(payload))
 */
const STATE_TTL_SECONDS = 15 * 60;

function stateSecret(): string {
  // Preferimos a chave dedicada. Se o ambiente (ex.: deploy externo) só tiver a
  // chave de sessão, usamos ela como alternativa — o importante é que o app e a
  // função `amazon-auth` compartilhem exatamente o mesmo valor.
  const dedicated = process.env.ATLAS_OAUTH_STATE_SECRET ?? "";
  const fallback = process.env.ATLAS_SESSION_SECRET ?? "";
  const secret = dedicated.length >= 32 ? dedicated : fallback;
  if (secret.length < 32) {
    throw new Error(
      "ATLAS_OAUTH_STATE_SECRET (ou ATLAS_SESSION_SECRET) não configurada (mínimo 32 caracteres).",
    );
  }
  if (dedicated.length < 32) {
    console.warn(
      "[amazon-oauth] ATLAS_OAUTH_STATE_SECRET ausente neste ambiente; usando ATLAS_SESSION_SECRET para assinar o state.",
    );
  }
  return secret;
}


function b64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url");
}

/** Gera o state assinado (compartilhado entre Amazon, Temu e Mercado Livre). */
export async function buildSignedState(origin?: string) {
  const seller = await requireSessionSeller();
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    seller_id: String(seller.id),
    nonce: randomUUID(),
    iat: now,
    exp: now + STATE_TTL_SECONDS,
    // origem que deve receber o aviso quando a autorização terminar (só o ML usa).
    ...(origin ? { origin } : {}),
  };
  const body = b64url(JSON.stringify(payload));
  const sig = b64url(createHmac("sha256", stateSecret()).update(body).digest());
  const state = `${body}.${sig}`;
  return { seller, payload, state };
}

export async function buildAmazonAuthUrl(): Promise<{ url: string }> {
  const { seller, payload, state } = await buildSignedState();

  const base =
    process.env.SUPABASE_URL ??
    process.env.VITE_SUPABASE_URL ??
    "https://omvtqftgbkdthgfypjlx.supabase.co";

  // Log temporário e seguro: apenas identificadores, nunca o state completo.
  console.log("[amazon-oauth] start", {
    sellerId: seller.id,
    currentMarketplaceAccountId: seller.marketplace_account_id,
    nonce: payload.nonce.slice(0, 8),
    exp: payload.exp,
  });

  return {
    url: `${base}/functions/v1/amazon-auth/login?state=${encodeURIComponent(state)}`,
  };
}
