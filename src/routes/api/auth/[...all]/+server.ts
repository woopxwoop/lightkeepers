import { getAuth } from "$lib/server/auth";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = ({ request }) => getAuth().handler(request);
export const POST: RequestHandler = ({ request }) => getAuth().handler(request);
