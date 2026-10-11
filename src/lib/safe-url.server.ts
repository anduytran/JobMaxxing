// Blocks server-side fetches of private, loopback, link-local and metadata hosts so
// a pasted "job link" can't make the server reach its own network.
const PRIVATE_V4 = [/^0\./, /^10\./, /^127\./, /^169\.254\./, /^172\.(1[6-9]|2\d|3[01])\./, /^192\.168\./, /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./, /^22[4-9]\./, /^2[3-5]\d\./];

export function assertPublicUrl(raw: string): string {
  let u: URL;
  try { u = new URL(raw); } catch { throw new Error("That job link doesn't look valid."); }
  if (u.protocol !== "http:" && u.protocol !== "https:") throw new Error("That job link doesn't look valid.");
  if (u.username || u.password) throw new Error("That job link doesn't look valid.");
  if (u.port && u.port !== "80" && u.port !== "443") throw new Error("That job link doesn't look valid.");
  const host = u.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  const blocked =
    host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal") ||
    !host.includes(".") && !host.includes(":") ||
    /^\d+$/.test(host) || /^0x/i.test(host) ||
    (/^\d+\.\d+\.\d+\.\d+$/.test(host) && PRIVATE_V4.some((r) => r.test(host))) ||
    (host.includes(":") && (host === "::" || host === "::1" || /^(fc|fd|fe8|fe9|fea|feb)/.test(host) || host.startsWith("::ffff:")));
  if (blocked) throw new Error("That link points somewhere private. Paste a public job posting link.");
  return u.toString();
}
