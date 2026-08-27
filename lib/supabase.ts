import { createClient } from "@supabase/supabase-js";

// La URL y la publishable key son identificadores públicos por diseño de Supabase.
// Las variables de Vercel prevalecen; estos valores permiten que el preview funcione
// incluso antes de configurar el dominio/entorno definitivo. Nunca se usa service_role aquí.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://mzsymskdnuvkgnoekphd.supabase.co";
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "sb_publishable_LruFMAHSDCI58AQVRvB-_Q_GtcYYLML";

export const supabase = createClient(url, key, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});
