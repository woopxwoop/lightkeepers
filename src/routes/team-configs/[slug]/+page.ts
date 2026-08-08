import { redirect } from "@sveltejs/kit";
import type { PageLoad } from "./$types";

/** Old path — configs now live under /teams/configs/[slug]. */
export const load: PageLoad = ({ params }) => {
  redirect(308, `/teams/configs/${encodeURIComponent(params.slug)}`);
};
