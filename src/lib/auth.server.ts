import bcrypt from "bcryptjs";

import {
  adminClient,
  requireSessionSeller,
  requireSessionIdentity,
  getAccessInfo,
  startSession,
  endSession,
  type AccessInfo,
} from "./session.server";

const admin = adminClient;

// Regras de senha conforme política Amazon SP-API
const PASSWORD_RULES = [
  {
    test: (p: string) => p.length >= 12,
    message: "Mínimo 12 caracteres",
  },
  {
    test: (p: string) => /[A-Z]/.test(p),
    message: "Pelo menos uma letra maiúscula",
  },
  {
    test: (p: string) => /[a-z]/.test(p),
    message: "Pelo menos uma letra minúscula",
  },
  {
    test: (p: string) => /\d/.test(p),
    message: "Pelo menos um número",
  },
  {
    test: (p: string) =>
      /[!@#$%^&*(),.?":{}|<>\_\\\-+=\[\];'`~]/.test(p),
    message: "Pelo menos um caractere especial",
  },
];

function validatePassword(password: string): void {
  for (const rule of PASSWORD_RULES) {
    if (!rule.test(password)) {
      throw new Error(`Senha inválida: ${rule.message}`);
    }
  }
}

export type SellerRecord = {
  id: string;
  name: string | null;
  email: string;
  marketplace_account_id: string | null;
};

export async function verifyLogin(
  email: string,
  password: string,
): Promise<SellerRecord> {
  const supabase = admin();
  const normalized = email.trim().toLowerCase();

  // Busca o seller pelo e-mail.
  // O status é lido para decidir se a conta está ativa.
  const { data: rows, error } = await supabase
    .from("sellers")
    .select(
      "id,name,email,password,marketplace_account_id,status",
    )
    .ilike("email", normalized)
    .limit(1);

  if (error) {
    throw new Error(error.message);
  }

  const data = rows?.[0] as
    | {
        id: string;
        name: string | null;
        email: string;
        password: string | null;
        marketplace_account_id: string | null;
        status: number | null;
      }
    | undefined;

  if (!data) {
    throw new Error(
      "E-mail não encontrado. Verifique o e-mail ou crie uma conta.",
    );
  }

  // Status 1 = ativo / Status 0 = inativo
  if (data.status !== 1) {
    throw new Error(
      "Seu acesso ao Atlas Seller está inativo. Entre em contato com o administrador.",
    );
  }

  // bcryptjs entende $2a/$2b/$2y;
  // normaliza o prefixo $2y por segurança.
  const hash = (data.password ?? "").replace(/^\$2y\$/, "$2a$");

  if (!hash) {
    throw new Error(
      "Esta conta ainda não tem senha definida. Cadastre-se novamente ou peça ajuda.",
    );
  }

  const ok = await bcrypt.compare(password, hash);

  if (!ok) {
    throw new Error("Senha incorreta.");
  }

  // Só cria a sessão depois de validar:
  // 1. existência do seller
  // 2. status ativo
  // 3. senha correta
  await startSession(String(data.id));

  return {
    id: data.id,
    name: data.name,
    email: data.email,
    marketplace_account_id: data.marketplace_account_id,
  };
}

export async function createSeller(
  name: string,
  email: string,
  password: string,
): Promise<SellerRecord> {
  validatePassword(password);

  const normalized = email.trim().toLowerCase();
  const supabase = admin();

  const { data: existing } = await supabase
    .from("sellers")
    .select("id")
    .eq("email", normalized)
    .maybeSingle();

  if (existing) {
    throw new Error("E-mail já cadastrado");
  }

  const hash = await bcrypt.hash(password, 10);

  const { data, error } = await supabase
    .from("sellers")
    .insert({
      name,
      email: normalized,
      password: hash,
      status: 1,
    })
    .select("id,name,email,marketplace_account_id")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  // Contas criadas pelo formulário permanecem ativas,
  // seguindo a regra atual: status 1 = ativo.
  await startSession(String(data.id));

  return data as SellerRecord;
}

/**
 * Atualiza somente o perfil do seller autenticado.
 * A autorização é verificada pela sessão + sellers.status.
 */
export async function updateSeller(patch: {
  name?: string;
  email?: string;
}): Promise<SellerRecord> {
  const current = await requireSessionSeller();
  const supabase = admin();

  const clean: { name?: string; email?: string } = {};

  if (typeof patch.name === "string") {
    clean.name = patch.name;
  }

  if (typeof patch.email === "string") {
    clean.email = patch.email.trim().toLowerCase();
  }

  const { data, error } = await supabase
    .from("sellers")
    .update(clean)
    .eq("id", current.id)
    .select("id,name,email,marketplace_account_id")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data as SellerRecord;
}

/**
 * Sessão atual + situação do acesso baseada em sellers.status.
 *
 * status = 1 → active
 * status = 0 → none
 */
export async function currentSeller(): Promise<
  (SellerRecord & { access: AccessInfo }) | null
> {
  let seller: SellerRecord;

  try {
    seller = await requireSessionIdentity();
  } catch {
    return null;
  }

  const access = await getAccessInfo(seller.id);

  return {
    ...seller,
    access,
  };
}

export async function logout(): Promise<{ ok: true }> {
  await endSession();
  return { ok: true };
}