import bcrypt from "bcryptjs";
import { adminClient, requireAdmin } from "./session.server";
import { effectiveAccess } from "./access";

const STATUSES = ["invited", "active", "suspended", "expired"] as const;
const TYPES = ["beta", "licensed"] as const;

export type AdminUserRow = {
  user_id: string;
  name: string | null;
  email: string;
  status: string;
  effective: string;
  access_type: string;
  plan: string | null;
  plan_code: string | null;
  created_at: string | null;
  activated_at: string | null;
  expires_at: string | null;
  last_login_at: string | null;
  last_seen_at: string | null;
  is_admin: boolean;
};

export async function listUsersServer(): Promise<{ users: AdminUserRow[]; plans: { code: string; name: string }[] }> {
  await requireAdmin();
  const db = adminClient();
  const [sellers, access, roles, plans] = await Promise.all([
    db.from("sellers").select("id,name,email"),
    db.from("user_access").select("*"),
    db.from("user_roles").select("user_id,role").eq("role", "admin"),
    db.from("plans").select("id,code,name").order("created_at"),
  ]);
  for (const r of [sellers, access, roles, plans]) if (r.error) throw new Error(r.error.message);
  const planById = new Map((plans.data ?? []).map((p) => [p.id as string, p]));
  const accBy = new Map((access.data ?? []).map((a) => [a.user_id as string, a]));
  const admins = new Set((roles.data ?? []).map((r) => r.user_id as string));
  const users = (sellers.data ?? []).map((s) => {
    const a = accBy.get(s.id as string);
    const p = a?.plan_id ? planById.get(a.plan_id) : undefined;
    return {
      user_id: s.id as string,
      name: s.name as string | null,
      email: s.email as string,
      status: a?.status ?? "sem acesso",
      effective: effectiveAccess(a ?? null),
      access_type: a?.access_type ?? "-",
      plan: (p?.name as string) ?? null,
      plan_code: (p?.code as string) ?? null,
      created_at: a?.created_at ?? null,
      activated_at: a?.activated_at ?? null,
      expires_at: a?.expires_at ?? null,
      last_login_at: a?.last_login_at ?? null,
      last_seen_at: a?.last_seen_at ?? null,
      is_admin: admins.has(s.id as string),
    };
  });
  users.sort((x, y) => x.email.localeCompare(y.email));
  return { users, plans: (plans.data ?? []).map((p) => ({ code: p.code as string, name: p.name as string })) };
}

export type AccessPatch = {
  user_id: string;
  status?: string;
  access_type?: string;
  plan_code?: string | null;
  expires_at?: string | null;
};

export async function updateAccessServer(patch: AccessPatch) {
  const admin = await requireAdmin();
  const db = adminClient();
  const clean: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.status !== undefined) {
    if (!STATUSES.includes(patch.status as never)) throw new Error("Status inválido");
    clean.status = patch.status;
  }
  if (patch.access_type !== undefined) {
    if (!TYPES.includes(patch.access_type as never)) throw new Error("Tipo de acesso inválido");
    clean.access_type = patch.access_type;
  }
  if (patch.expires_at !== undefined) {
    if (patch.expires_at && isNaN(new Date(patch.expires_at).getTime())) throw new Error("Data inválida");
    clean.expires_at = patch.expires_at || null;
  }
  if (patch.plan_code !== undefined) {
    if (patch.plan_code) {
      const { data: plan } = await db.from("plans").select("id").eq("code", patch.plan_code).maybeSingle();
      if (!plan) throw new Error("Plano inválido");
      clean.plan_id = plan.id;
    } else clean.plan_id = null;
  }
  if (patch.user_id === admin.id && (clean.status === "suspended" || clean.status === "expired")) {
    throw new Error("Você não pode suspender o próprio acesso.");
  }

  const { data: old } = await db.from("user_access").select("*").eq("user_id", patch.user_id).maybeSingle();
  if (clean.status === "active" && !old?.activated_at) clean.activated_at = new Date().toISOString();

  const res = old
    ? await db.from("user_access").update(clean).eq("user_id", patch.user_id)
    : await db.from("user_access").insert({ user_id: patch.user_id, ...clean });
  if (res.error) throw new Error(res.error.message);

  await db.from("access_audit").insert({
    user_id: patch.user_id,
    changed_by: admin.id,
    action: "update_access",
    old_value: old ? { status: old.status, access_type: old.access_type, plan_id: old.plan_id, expires_at: old.expires_at } : null,
    new_value: clean,
  });
  return { ok: true as const };
}

export async function grantAccessServer(input: {
  name: string;
  email: string;
  password?: string;
  access_type: string;
  expires_at?: string | null;
}) {
  const admin = await requireAdmin();
  const db = adminClient();
  const email = input.email.trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error("E-mail inválido");

  const { data: rows } = await db.from("sellers").select("id").ilike("email", email).limit(1);
  let userId = rows?.[0]?.id as string | undefined;
  let created = false;
  if (!userId) {
    const pwd = input.password ?? "";
    if (pwd.length < 12) throw new Error("Defina uma senha inicial com pelo menos 12 caracteres.");
    const hash = await bcrypt.hash(pwd, 10);
    const { data, error } = await db
      .from("sellers")
      .insert({ name: input.name.trim() || null, email, password: hash })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    userId = data.id as string;
    created = true;
  }
  const { data: beta } = await db.from("plans").select("code").eq("code", "beta").maybeSingle();
  await updateAccessServer({
    user_id: userId,
    status: "active",
    access_type: input.access_type,
    expires_at: input.expires_at ?? null,
    plan_code: input.access_type === "beta" && beta ? "beta" : undefined,
  });
  await db.from("access_audit").insert({ user_id: userId, changed_by: admin.id, action: created ? "create_user" : "grant_access" });
  return { ok: true as const, created };
}
