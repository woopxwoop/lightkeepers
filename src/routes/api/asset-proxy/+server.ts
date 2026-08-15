/**
 * Same-origin proxy for CDN assets so html-to-image can embed them.
 * GET /api/asset-proxy?u=https://api.lightkeepers.moe/...
 */
import { error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

const ALLOWED_HOSTS = new Set(["api.lightkeepers.moe"]);

export const GET: RequestHandler = async ({ url }) => {
  const raw = url.searchParams.get("u");
  if (!raw) error(400, "Missing u");

  let target: URL;
  try {
    target = new URL(raw);
  } catch {
    error(400, "Invalid u");
  }

  if (target.protocol !== "https:" || !ALLOWED_HOSTS.has(target.hostname)) {
    error(400, "Host not allowed");
  }

  const upstream = await fetch(target.href, {
    headers: { Accept: "image/*,*/*" },
  });
  if (!upstream.ok) {
    error(upstream.status === 404 ? 404 : 502, "Upstream fetch failed");
  }

  const contentType = upstream.headers.get("content-type") ?? "image/webp";
  const body = await upstream.arrayBuffer();

  return new Response(body, {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=86400",
    },
  });
};
