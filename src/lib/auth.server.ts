import { deleteCookie, getCookie, setCookie } from "@tanstack/react-start/server";
import { neonExecute, neonQuery } from "./neon.server";

// Server-only: password hashing (PBKDF2 via WebCrypto, works on Workers) and
// cookie sessions stored in Neon. Only a SHA-256 of the session token is stored.

export const SESSION_COOKIE = "devup_session";
const SESSION_DAYS = 30;
const ITERATIONS = 100_000; // workerd caps PBKDF2 at 100k

const enc = new TextEncoder();
const toHex = (b: ArrayBuffer | Uint8Array) =>
  Array.from(b instanceof Uint8Array ? b : new Uint8Array(b), (x) => x.toString(16).padStart(2, "0")).join("");
const fromHex = (h: string) => new Uint8Array(h.match(/../g)!.map((x) => parseInt(x, 16)));

async function pbkdf2(password: string, salt: Uint8Array, iterations: number) {
  const key = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: salt as BufferSource, iterations }, key, 256));
}

export async function hashPassword(password: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return `pbkdf2$${ITERATIONS}$${toHex(salt)}$${toHex(await pbkdf2(password, salt, ITERATIONS))}`;
}

export async function verifyPassword(password: string, stored: string) {
  const [alg, iter, salt, hash] = stored.split("$");
  if (alg !== "pbkdf2" || !iter || !salt || !hash) return false;
  const got = toHex(await pbkdf2(password, fromHex(salt), Number(iter)));
  let diff = got.length ^ hash.length;
  for (let i = 0; i < got.length && i < hash.length; i++) diff |= got.charCodeAt(i) ^ hash.charCodeAt(i);
  return diff === 0;
}

const sha256 = async (s: string) => toHex(await crypto.subtle.digest("SHA-256", enc.encode(s)));

const MAX_SESSIONS_PER_USER = 5;

export async function startSession(userId: string) {
  const token = toHex(crypto.getRandomValues(new Uint8Array(32)));
  const expires = new Date(Date.now() + SESSION_DAYS * 864e5);
  // One transaction: create the session, sweep expired sessions for everyone,
  // and keep only this user's newest sessions (older devices are signed out).
  await neonExecute([
    {
      query: "insert into public.devup_session (token_hash, user_id, expires_at) values ($1, $2, $3::timestamptz)",
      params: [await sha256(token), userId, expires.toISOString()],
    },
    { query: "delete from public.devup_session where expires_at <= now()" },
    {
      query: `delete from public.devup_session where user_id = $1::uuid and token_hash not in (
                select token_hash from public.devup_session where user_id = $1::uuid
                 order by expires_at desc limit $2)`,
      params: [userId, MAX_SESSIONS_PER_USER],
    },
  ]);
  clearLegacySessionCookies();
  setCookie(SESSION_COOKIE, token, {
    httpOnly: true, secure: true, sameSite: "none", partitioned: true, path: "/", expires,
  });
}

// Browsers key partitioned (CHIPS) cookies separately from plain ones, so a
// cookie set before partitioning was introduced survives next to the new one
// and can shadow it with a stale token. Clear every legacy variant whenever
// the session cookie is written or removed.
function clearLegacySessionCookies() {
  deleteCookie(SESSION_COOKIE, { path: "/" });
  deleteCookie(SESSION_COOKIE, { path: "/", secure: true, sameSite: "lax" });
  deleteCookie(SESSION_COOKIE, { path: "/", secure: true, sameSite: "strict" });
  deleteCookie(SESSION_COOKIE, { path: "/", secure: true, sameSite: "none" });
}

export async function endSession() {
  const token = getCookie(SESSION_COOKIE);
  clearLegacySessionCookies();
  deleteCookie(SESSION_COOKIE, { path: "/", secure: true, sameSite: "none", partitioned: true });
  if (token) await neonExecute("delete from public.devup_session where token_hash = $1", [await sha256(token)]);
}

export type SessionUser = { id: string; email: string };

/** Returns the signed-in user, or null. Every private handler calls this. */
export async function currentUser(): Promise<SessionUser | null> {
  const token = getCookie(SESSION_COOKIE);
  if (!token || !/^[0-9a-f]{64}$/.test(token)) return null;
  const { rows } = await neonQuery(
    `select u.id::text as id, u.email from public.devup_session s
       join public.devup_user u on u.id = s.user_id
      where s.token_hash = $1 and s.expires_at > now() limit 1`,
    [await sha256(token)],
  );
  const r = rows[0];
  return r ? { id: String(r["id"]), email: String(r["email"]) } : null;
}

export async function requireUser(): Promise<SessionUser> {
  const u = await currentUser();
  if (!u) throw new Error("Please sign in.");
  return u;
}
