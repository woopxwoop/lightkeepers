import { redirect } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";

/** Legacy URL — pages live under `/tools`. */
export const load: PageServerLoad = async ({ params }) => {
  redirect(308, `/tools/stygian/enemies/${params.id}`);
};
