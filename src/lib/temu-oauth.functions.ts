import { createServerFn } from "@tanstack/react-start";

export const startTemuAuthFn = createServerFn({ method: "POST" }).handler(async () => {
  const { buildTemuAuthUrl } = await import("./temu-oauth.server");
  return buildTemuAuthUrl();
});
