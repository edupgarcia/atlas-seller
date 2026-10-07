// Regras de acesso compartilhadas (servidor e telas). A decisão final é sempre no servidor.
export type AccessStatus = "invited" | "active" | "suspended" | "expired";
export type EffectiveAccess = "active" | "invited" | "suspended" | "expired" | "none";

/** Expirado vence "active": se expires_at já passou, o acesso não vale. */
export function effectiveAccess(
  row: { status: string; expires_at: string | null } | null | undefined,
  now: Date = new Date(),
): EffectiveAccess {
  if (!row) return "none";
  if (row.status === "suspended") return "suspended";
  if (row.status === "expired") return "expired";
  if (row.expires_at && new Date(row.expires_at).getTime() <= now.getTime()) return "expired";
  if (row.status === "active") return "active";
  return "invited";
}

export function accessMessage(s: EffectiveAccess): string {
  if (s === "suspended") return "Seu acesso ao Atlas Seller está temporariamente suspenso.";
  if (s === "expired") return "Seu acesso ao Atlas Seller expirou.";
  return "Seu acesso ao Atlas Seller ainda não está liberado.";
}
