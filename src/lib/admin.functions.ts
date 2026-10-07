import { createServerFn } from "@tanstack/react-start";

// Todas as funções conferem no servidor: sessão + acesso ativo + papel admin.
export const listUsersFn = createServerFn({ method: "GET" }).handler(async () => {
  const { listUsersServer } = await import("./admin.server");
  return listUsersServer();
});

export const updateAccessFn = createServerFn({ method: "POST" })
  .inputValidator(
    (data: { user_id: string; status?: string; access_type?: string; plan_code?: string | null; expires_at?: string | null }) => {
      if (!data || typeof data.user_id !== "string") throw new Error("Dados inválidos");
      return data;
    },
  )
  .handler(async ({ data }) => {
    const { updateAccessServer } = await import("./admin.server");
    return updateAccessServer(data);
  });

export const grantAccessFn = createServerFn({ method: "POST" })
  .inputValidator((data: { name: string; email: string; password?: string; access_type: string; expires_at?: string | null }) => {
    if (!data || typeof data.email !== "string" || typeof data.access_type !== "string") throw new Error("Dados inválidos");
    return { ...data, name: String(data.name ?? "") };
  })
  .handler(async ({ data }) => {
    const { grantAccessServer } = await import("./admin.server");
    return grantAccessServer(data);
  });
