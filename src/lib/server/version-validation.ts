import { serverDb } from "$lib/server/supabaseServer";

/** Whether an Abyss version exists in the database-supported domain. */
export async function isSupportedAbyssVersion(
  version: number,
): Promise<boolean> {
  const { data, error } = await serverDb
    .from("abyss_versions")
    .select("version_number")
    .eq("version_number", version)
    .maybeSingle();
  if (error) throw error;
  return data !== null;
}

/** Whether a Stygian version exists in the database-supported domain. */
export async function isSupportedStygianVersion(
  version: number,
): Promise<boolean> {
  const { data, error } = await serverDb
    .from("stygian_versions")
    .select("version_number")
    .eq("version_number", version)
    .maybeSingle();
  if (error) throw error;
  return data !== null;
}
