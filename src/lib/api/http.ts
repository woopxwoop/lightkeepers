/** Tiny client helper for JSON POSTs to our own `/api/*` routes. */

export async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(`${url} returned ${res.status}`);
  }

  return res.json() as Promise<T>;
}
