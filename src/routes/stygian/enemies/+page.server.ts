import { redirect } from "@sveltejs/kit";
import { resolve } from "$app/paths";
import type { PageServerLoad } from "./$types";

/** Legacy URL — pages live under `/tools`. */
export const load: PageServerLoad = async () => {
  redirect(308, resolve("/tools/stygian/enemies"));
};
