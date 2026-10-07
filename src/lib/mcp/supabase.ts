import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { ToolContext } from "@lovable.dev/mcp-js";
import { accessMessage, effectiveAccess } from "../access";

type RuntimeGlobals = typeof globalThis & {
  Deno?: { env?: { get?: (name: string) => string | undefined } };
  process?: { env?: Record<string, string | undefined> };
};

function runtimeEnv(name: string): string | undefined {
  const runtime = globalThis as RuntimeGlobals;
  return runtime.Deno?.env?.get?.(name) ?? runtime.process?.env?.[name];
}

function configuredEnv(names: readonly string[]): string | undefined {
  for (const name of names) {
    const value = runtimeEnv(name)?.trim();
    if (value) return value;
  }
  return undefined;
}

export const ATLAS_PROJECT_REF = "omvtqftgbkdthgfypjlx";

function projectUrl(): string {
  return (
    configuredEnv(["SUPABASE_URL", "VITE_SUPABASE_URL"]) ??
    `https://${ATLAS_PROJECT_REF}.supabase.co`
  );
}

/**
 * Atlas Seller uses its own `sellers` table (bcrypt) instead of Supabase Auth
 * row ownership, so there is no per-user RLS to ride on. Every MCP tool first
 * resolves the caller's verified OAuth email to a `sellers` row and then scopes
 * all queries to that seller's marketplace account.
 */
function admin(): SupabaseClient {
  const serviceKey = configuredEnv(["ATLAS_SUPABASE_SERVICE_ROLE"]);
  if (!serviceKey) throw new Error("ATLAS_SUPABASE_SERVICE_ROLE não configurada.");
  return createClient(projectUrl(), serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export type McpSeller = {
  id: number;
  name: string | null;
  email: string;
  marketplace_account_id: string | null;
};

export type McpSession = { supabase: SupabaseClient; seller: McpSeller };

/** Resolves the signed-in MCP caller to a seller row, or throws. */
export async function requireSeller(ctx: ToolContext): Promise<McpSession> {
  if (!ctx.isAuthenticated()) {
    throw new Error("Não autenticado. Conecte-se via OAuth para usar estas ferramentas.");
  }
  const email = ctx.getUserEmail()?.trim().toLowerCase();
  if (!email) {
    throw new Error("O token OAuth não traz um e-mail verificado.");
  }
  const supabase = admin();
  const { data, error } = await supabase
    .from("sellers")
    .select("id,name,email,marketplace_account_id")
    .eq("email", email)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) {
    throw new Error(
      `Nenhum seller cadastrado no Atlas Seller com o e-mail ${email}. Use a mesma conta do app.`,
    );
  }
  // Mesmo controle de acesso do app: sem acesso ativo/não expirado, nada de dados.
  const { data: acc } = await supabase
    .from("user_access")
    .select("status,expires_at")
    .eq("user_id", (data as { id: unknown }).id)
    .maybeSingle();
  const status = effectiveAccess(acc as { status: string; expires_at: string | null } | null);
  if (status !== "active") throw new Error(accessMessage(status));
  return { supabase, seller: data as McpSeller };
}

export type McpAccountSession = {
  supabase: SupabaseClient;
  seller: McpSeller;
  accountId: string;
};

/**
 * Same as `requireSeller`, but also demands a linked marketplace account.
 * Tools that read or write order data MUST use this: without an account id
 * there is no `account_id` filter and the query would span every seller.
 */
export async function requireSellerAccount(ctx: ToolContext): Promise<McpAccountSession> {
  const { supabase, seller } = await requireSeller(ctx);
  const accountId = seller.marketplace_account_id;
  if (!accountId) {
    throw new Error(
      "Este seller ainda não tem uma conta Amazon vinculada, então não há dados para consultar.",
    );
  }
  return { supabase, seller, accountId };
}

export function errorResult(message: string) {
  return { content: [{ type: "text" as const, text: message }], isError: true };
}

export function jsonResult(payload: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(payload, null, 2) }],
    structuredContent: payload as Record<string, unknown>,
  };
}
