import { redirect } from "@sveltejs/kit";
import { resolve } from "$app/paths";
import type { PageServerLoad } from "./$types";

/** Renamed to /tools/abyss/summary. */
export const load: PageServerLoad = async () => {
  redirect(308, resolve("/tools/abyss/summary"));
};
