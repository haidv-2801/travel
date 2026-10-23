import { createClient } from "@/lib/supabase/server";

export type CurrentUser = { id: string; email: string; name: string };

/** The signed-in user (null when signed out). Verified with Supabase Auth on every call, never trusted from the cookie alone. */
export async function getCurrentUser(sb?: Awaited<ReturnType<typeof createClient>>): Promise<CurrentUser | null> {
  const client = sb ?? (await createClient());
  const { data } = await client.auth.getUser();
  if (!data.user) return null;
  const { data: p } = await client.from("profiles").select("id,email,name").eq("id", data.user.id).maybeSingle();
  return p ?? { id: data.user.id, email: data.user.email ?? "", name: (data.user.user_metadata?.name as string | undefined) ?? "" };
}
