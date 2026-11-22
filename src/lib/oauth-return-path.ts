export function oauthReturnPath(value: unknown): string {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) {
    return "/";
  }

  const hasUnsafeCharacters = Array.from(value).some((char) => {
    const code = char.charCodeAt(0);
    return char === "\\" || code <= 31 || code === 127;
  });
  if (hasUnsafeCharacters) return "/";

  const origin = "https://app.invalid";
  try {
    const target = new URL(value, origin);
    if (target.origin !== origin || target.pathname.startsWith("//")) return "/";
    return target.pathname + target.search + target.hash;
  } catch {
    return "/";
  }
}
