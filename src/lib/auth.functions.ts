import { createServerFn } from "@tanstack/react-start";
import { neonUserError } from "./neon.server";

type AuthResult = { ok: true } | { ok: false; error: string };

const creds = (input: { email: unknown; password: unknown; name?: unknown }) => {
  const email = typeof input.email === "string" ? input.email.trim().toLowerCase() : "";
  const password = typeof input.password === "string" ? input.password : "";
  const name = typeof input.name === "string" ? input.name.trim().slice(0, 80) : "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) throw new Error("Enter a valid email.");
  if (password.length < 8 || password.length > 200) throw new Error("Password must be at least 8 characters.");
  return { email, password, name };
};

const fail = (err: unknown): AuthResult => {
  console.error(err);
  if ((err as { kind?: string })?.kind) return { ok: false, error: neonUserError(err).message };
  return { ok: false, error: "Something went wrong. Try again." };
};

export const signUp = createServerFn({ method: "POST" })
  .inputValidator(creds)
  .handler(async ({ data }): Promise<AuthResult> => {
    const { hashPassword, startSession } = await import("./auth.server");
    const { neonExecute } = await import("./neon.server");
    try {
      const hash = await hashPassword(data.password);
      // One transaction: user + profile + a copy of the starter quests.
      const { results } = await neonExecute<{ results: any[] }>([
        {
          query: `with u as (
                    insert into public.devup_user (email, password_hash) values ($1, $2)
                    on conflict (email) do nothing returning id::text as id)
                  insert into public.devup_profile (id, name, title, xp, roast)
                  select id, $3, 'Aspiring Developer', 0, false from u returning id`,
          params: [data.email, hash, data.name || data.email.split("@")[0]],
        },
        {
          query: `insert into public.devup_quest (user_id, id, title, xp, category, period, done, sort_order)
                  select p.id, q.id, q.title, q.xp, q.category, q.period, false, q.sort_order
                    from public.devup_quest q, public.devup_profile p
                   where q.user_id = 'default' and p.id = (select id from public.devup_user where email = $1)::text
                     and not exists (select 1 from public.devup_quest x where x.user_id = p.id)`,
          params: [data.email],
        },
      ]);
      const id = results[0]?.rows?.[0]?.id;
      if (!id) return { ok: false, error: "An account with that email already exists. Sign in instead." };
      await startSession(String(id));
      return { ok: true };
    } catch (err) {
      return fail(err);
    }
  });

export const signIn = createServerFn({ method: "POST" })
  .inputValidator(creds)
  .handler(async ({ data }): Promise<AuthResult> => {
    const { verifyPassword, startSession } = await import("./auth.server");
    const { neonQuery } = await import("./neon.server");
    try {
      const { rows } = await neonQuery(
        "select id::text as id, password_hash from public.devup_user where email = $1 limit 1",
        [data.email],
      );
      const r = rows[0];
      if (!r || !(await verifyPassword(data.password, String(r["password_hash"])))) {
        return { ok: false, error: "Wrong email or password." };
      }
      await startSession(String(r["id"]));
      return { ok: true };
    } catch (err) {
      return fail(err);
    }
  });

export const signOut = createServerFn({ method: "POST" }).handler(async (): Promise<AuthResult> => {
  const { endSession } = await import("./auth.server");
  try {
    await endSession();
    return { ok: true };
  } catch (err) {
    return fail(err);
  }
});
