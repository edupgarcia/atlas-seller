/*const url =
  (import.meta.env.VITE_SUPABASE_URL as string | undefined) ??
  "https://omvtqftgbkdthgfypjlx.supabase.co";

export const SUPABASE_URL = url;
export const AMAZON_AUTH_URL = `${url}/functions/v1/amazon-auth`;
*/

import { createClient } from "@supabase/supabase-js";

const url =
  (import.meta.env.VITE_SUPABASE_URL as string | undefined) ??
  "https://omvtqftgbkdthgfypjlx.supabase.co";

const anonKey =
  (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9tdnRxZnRnYmtkdGhnZnlwamx4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM0NDE4MzUsImV4cCI6MjA5OTAxNzgzNX0.tgQTuzsm806xLf4ewAIzDerdttypZM59EWfCBx64tj0";

export const supabase = createClient(url, anonKey);

export const SUPABASE_URL = url;

// A URL de autorização Amazon é gerada no servidor (ver amazon-oauth.server.ts),
// com state assinado. Não montar essa URL no navegador com seller_id.