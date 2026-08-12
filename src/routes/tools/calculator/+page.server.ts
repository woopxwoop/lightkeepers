import { redirect } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";

/** Legacy URL — renamed to `/tools/planner`. */
export const load: PageServerLoad = async () => {
  redirect(308, "/tools/planner");
};
