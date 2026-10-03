import { createClient, type SupabaseClient } from "@supabase/supabase-js";
export const demoMode = process.env.NEXT_PUBLIC_DEMO_MODE === "true";
export const apiBase =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";
let client: SupabaseClient | undefined;
export function supabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Sign-in is not configured yet.");
  return (client ??= createClient(url, key));
}
export async function token() {
  if (demoMode) return localStorage.getItem("civicfix-demo-token");
  const { data, error } = await supabase().auth.getSession();
  if (error) throw error;
  return data.session?.access_token;
}
export async function api<T>(
  path: string,
  options: RequestInit = {},
  publicRequest = false,
): Promise<T> {
  const accessToken = publicRequest ? null : await token();
  if (!publicRequest && !accessToken) throw new Error("Sign in to continue.");
  const headers = new Headers(options.headers);
  if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);
  if (options.body && !(options.body instanceof FormData))
    headers.set("Content-Type", "application/json");
  const response = await fetch(apiBase + path, {
    ...options,
    headers,
    cache: "no-store",
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(
      body.error?.message ||
        body.detail ||
        `Request failed (${response.status}).`,
    );
  }
  return response.json();
}
export async function signOut() {
  if (demoMode) localStorage.removeItem("civicfix-demo-token");
  else await supabase().auth.signOut();
}
export type Me = {
  id: string;
  role: "resident" | "staff" | "manager" | "admin";
  display_name: string;
  department_id: string | null;
};
export type Category = { id: string; name: string; slug: string };
export type Incident = {
  id: string;
  reference_number: string;
  title: string;
  description: string;
  status: string;
  urgency: string;
  category_id: string;
  department_id: string | null;
  address_text: string | null;
  latitude: number | null;
  longitude: number | null;
  version: number;
  created_at: string;
};
export type IncidentPage = { items: Incident[]; next_cursor: string | null };
export function readable(value: string) {
  return value.replaceAll("_", " ");
}
