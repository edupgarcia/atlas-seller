import { createClient } from "@supabase/supabase-js";
import {
  getSession,
  updateSession,
  clearSession,
} from "@tanstack/react-start/server";

export type SessionData = {
  sellerId?: string;
};

function sessionConfig() {
  const password = process.env.ATLAS_SESSION_SECRET ?? "";

  if (!password || password.length < 32) {
    throw new Error(
      "ATLAS_SESSION_SECRET não configurada (mínimo 32 caracteres).",
    );
  }

  return {
    password,
    name: "atlas_session",
    maxAge: 60 * 60 * 24 * 30,
    cookie: {
      httpOnly: true,
      sameSite: "lax" as const,
      secure: true,
      path: "/",
    },
  };
}

let warnedAboutKeyRole = false;

/**
 * Avisa uma vez quando o segredo não contém a chave service_role.
 * A RLS pode esconder dados protegidos.
 */
function warnIfNotServiceRole(key: string) {
  if (warnedAboutKeyRole || !key.startsWith("eyJ")) return;

  try {
    const payload = JSON.parse(
      atob(key.split(".")[1] ?? ""),
    ) as { role?: string };

    if (payload.role && payload.role !== "service_role") {
      warnedAboutKeyRole = true;

      console.warn(
        `[atlas] ATLAS_SUPABASE_SERVICE_ROLE contém uma chave "${payload.role}", não "service_role". As consultas protegidas pela RLS podem retornar vazio.`,
      );
    }
  } catch {
    // Chave em formato novo (sb_secret_...) — sem claims para inspecionar.
  }
}

export function adminClient() {
  const url =
    process.env.SUPABASE_URL ??
    process.env.VITE_SUPABASE_URL ??
    "https://omvtqftgbkdthgfypjlx.supabase.co";

  const serviceKey =
    process.env.ATLAS_SUPABASE_SERVICE_ROLE ?? "";

  if (!serviceKey) {
    throw new Error(
      "ATLAS_SUPABASE_SERVICE_ROLE não configurada.",
    );
  }

  warnIfNotServiceRole(serviceKey);

  return createClient(url, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export async function startSession(sellerId: string) {
  await updateSession<SessionData>(sessionConfig(), {
    sellerId,
  });
}

export async function endSession() {
  await clearSession(sessionConfig());
}

export type SessionSeller = {
  id: string;
  name: string | null;
  email: string;
  marketplace_account_id: string | null;
};

export type AccessInfo = {
  status: "active" | "invited" | "suspended" | "expired" | "none";
  is_admin: boolean;
  access_type: string | null;
  expires_at: string | null;
};

/**
 * Lê a sessão assinada e carrega o seller.
 *
 * IMPORTANTE:
 * Esta função identifica o seller, mas não é o porteiro.
 * A verificação de status acontece em getAccessInfo()
 * e requireSessionSeller().
 */
export async function requireSessionIdentity(): Promise<SessionSeller> {
  const session = await getSession<SessionData>(
    sessionConfig(),
  );

  const sellerId = session.data?.sellerId;

  if (!sellerId) {
    throw new Error("Não autenticado");
  }

  const supabase = adminClient();

  const { data, error } = await supabase
    .from("sellers")
    .select("id,name,email,marketplace_account_id")
    .eq("id", sellerId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    throw new Error("Não autenticado");
  }

  return data as SessionSeller;
}

/**
 * Lê o status de acesso diretamente da tabela sellers.
 *
 * REGRA:
 *   sellers.status = 1 → active
 *   sellers.status = 0 → none
 *
 * Não depende de user_access nem user_roles.
 */
export async function getAccessInfo(
  sellerId: string,
): Promise<AccessInfo> {
  const supabase = adminClient();

  const { data, error } = await supabase
    .from("sellers")
    .select("status")
    .eq("id", sellerId)
    .maybeSingle();

  if (error) {
    console.error("[access] sellers:", error.message);

    // Falha fechada:
    // se não conseguimos verificar o status,
    // não concedemos acesso.
    return {
      status: "none",
      is_admin: false,
      access_type: null,
      expires_at: null,
    };
  }

  if (!data) {
    return {
      status: "none",
      is_admin: false,
      access_type: null,
      expires_at: null,
    };
  }

  const status = Number(data.status) === 1
    ? "active"
    : "none";

  return {
    status,
    is_admin: false,
    access_type: null,
    expires_at: null,
  };
}

/**
 * Sessão válida + seller.status = 1.
 *
 * Toda leitura/escrita protegida do Atlas deve passar por aqui.
 */
export async function requireSessionSeller(): Promise<SessionSeller> {
  const seller = await requireSessionIdentity();
  const access = await getAccessInfo(seller.id);

  if (access.status !== "active") {
    throw new Error(
      "ACESSO_NEGADO: Seu acesso ao Atlas Seller está inativo. Entre em contato com o administrador.",
    );
  }

  return seller;
}

/**
 * No modelo atual, não existe tabela de usuários/papéis administrativos.
 *
 * Por enquanto, o controle de acesso é exclusivamente:
 * sellers.status = 1 → acesso ativo.
 *
 * Mantemos a função para compatibilidade com o restante do projeto.
 */
export async function requireAdmin(): Promise<SessionSeller> {
  const seller = await requireSessionIdentity();
  const access = await getAccessInfo(seller.id);

  if (access.status !== "active") {
    throw new Error(
      "ACESSO_NEGADO: Seu acesso ao Atlas Seller está inativo.",
    );
  }

  return seller;
}