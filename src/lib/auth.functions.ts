import { createServerFn } from "@tanstack/react-start";

export const loginSellerFn = createServerFn({ method: "POST" })
  .inputValidator((data: { email: string; password: string }) => {
    if (!data || typeof data.email !== "string" || typeof data.password !== "string") {
      throw new Error("Dados inválidos");
    }
    return { email: data.email, password: data.password };
  })
  // Credencial errada não é uma falha do servidor: devolvemos o motivo em vez de lançar erro.
  .handler(async ({ data }) => {
    const { verifyLogin } = await import("./auth.server");
    try {
      const seller = await verifyLogin(data.email, data.password);
      return { ok: true as const, seller };
    } catch (err) {
      return {
        ok: false as const,
        message: err instanceof Error ? err.message : "Não foi possível entrar.",
      };
    }
  });


export const registerSellerFn = createServerFn({ method: "POST" })
  .inputValidator((data: { name: string; email: string; password: string }) => {
    if (
      !data ||
      typeof data.name !== "string" ||
      typeof data.email !== "string" ||
      typeof data.password !== "string"
    ) {
      throw new Error("Dados inválidos");
    }
    return { name: data.name, email: data.email, password: data.password };
  })
  .handler(async ({ data }) => {
    const { createSeller } = await import("./auth.server");
    try {
      const seller = await createSeller(data.name, data.email, data.password);
      return { ok: true as const, seller };
    } catch (err) {
      return {
        ok: false as const,
        message: err instanceof Error ? err.message : "Não foi possível criar a conta.",
      };
    }
  });


// O id nunca vem do cliente: a sessão assinada define quem é atualizado.
export const updateSellerFn = createServerFn({ method: "POST" })
  .inputValidator((data: { name?: string; email?: string }) => data ?? {})
  .handler(async ({ data }) => {
    const { updateSeller } = await import("./auth.server");
    return updateSeller({ name: data.name, email: data.email });
  });

export const currentSellerFn = createServerFn({ method: "GET" }).handler(async () => {
  const { currentSeller } = await import("./auth.server");
  return currentSeller();
});

export const logoutSellerFn = createServerFn({ method: "POST" }).handler(async () => {
  const { logout } = await import("./auth.server");
  return logout();
});
