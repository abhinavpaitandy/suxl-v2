const PREFIX = "suxl-pilot-v1:";

/** Keys contain only a digest; image data and prompts are never stored in the key. */
export async function pilotCacheKey(input: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(input));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return PREFIX + Array.from(new Uint8Array(digest), (value) => value.toString(16).padStart(2, "0")).join("");
}

export function readPilotCache(key: string): unknown {
  try { const value = sessionStorage.getItem(key); return value ? JSON.parse(value) : undefined; }
  catch { return undefined; }
}

export function writePilotCache(key: string, value: unknown): boolean {
  try { sessionStorage.setItem(key, JSON.stringify(value)); return true; }
  catch { return false; }
}

export function removePilotCache(key: string) {
  try { sessionStorage.removeItem(key); } catch { /* Storage may be unavailable. */ }
}
