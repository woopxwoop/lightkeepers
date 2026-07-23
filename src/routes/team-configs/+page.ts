import { redirect } from "@sveltejs/kit";
import type { PageLoad } from "./$types";

/** Index removed — configs are reached from /teams/[slug]. */
export const load: PageLoad = () => {
  redirect(308, "/teams");
};
