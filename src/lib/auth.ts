import {
  currentSellerFn,
  loginSellerFn,
  logoutSellerFn,
  registerSellerFn,
  updateSellerFn,
} from "./auth.functions";

export type Seller = {
  id: string;
  name: string | null;
  email: string;
  marketplace_account_id: string | null;
  // preenchido pelo servidor em refreshSeller(); só para exibição — a segurança é no servidor
  access?: { status: "active" | "invited" | "suspended" | "expired" | "none"; is_admin: boolean; access_type: string | null; expires_at: string | null };
};

const STORAGE_KEY = "atlas_seller_session";

/**
 * Cache local apenas para exibição (nome/e-mail). A autorização real acontece
 * no sernpm install -g --allow-scripts=@anthropic-ai/claude-codeidor, via cookie de sessão assinado e httpOnly.
 */
export function getStoredSeller(): Seller | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Seller) : null;
  } catch {
    return null;
  }
}

export function storeSeller(s: Seller | null) {
  if (typeof window === "undefined") return;
  if (s) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  else window.localStorage.removeItem(STORAGE_KEY);
  window.dispatchEvent(new Event("atlas-auth-change"));
}

export async function loginSeller(email: string, password: string): Promise<Seller> {
  const res = (await loginSellerFn({ data: { email, password } })) as
    | { ok: true; seller: Seller }
    | { ok: false; message: string };
  if (!res.ok) throw new Error(res.message);
  storeSeller(res.seller);
  return res.seller;
}

export async function registerSeller(
  name: string,
  email: string,
  password: string,
): Promise<Seller> {
  const res = (await registerSellerFn({ data: { name, email, password } })) as
    | { ok: true; seller: Seller }
    | { ok: false; message: string };
  if (!res.ok) throw new Error(res.message);
  storeSeller(res.seller);
  return res.seller;
}


export async function logoutSeller() {
  storeSeller(null);
  try {
    await logoutSellerFn();
  } catch {
    /* sessão já expirada */
  }
}

export async function refreshSeller(): Promise<Seller | null> {
  const seller = (await currentSellerFn()) as Seller | null;
  storeSeller(seller);
  return seller;
}

export async function updateSellerProfile(patch: {
  name?: string;
  email?: string;
}): Promise<Seller> {
  const seller = (await updateSellerFn({ data: patch })) as Seller;
  storeSeller(seller);
  return seller;
}
