import { redirect } from "@sveltejs/kit";
import { resolve } from "$app/paths";
import type { PageServerLoad } from "./$types";

/** Old dev entry — tools routes are the public homes now. */
export const load: PageServerLoad = async () => {
  redirect(308, resolve("/tools/abyss/summary"));
};
