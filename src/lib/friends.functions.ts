import { createServerFn } from "@tanstack/react-start";
import { neonQuery } from "@/lib/neon.server";
import { requireUser } from "@/lib/auth.server";

// Direct friend system + interview invites (spec §7). Presence is derived:
// "in_interview" if the friend has a live peer session, "online" if they hold
// an unexpired app session, else "offline". No WebSocket server exists, so the
// invite banner polls listIncomingInvites.

export type FriendRow = {
  id: string;
  name: string;
  email: string;
  status: "online" | "in_interview" | "offline";
};

export type FriendRequest = { id: string; name: string; email: string; createdAt: string };

export type IncomingInvite = {
  id: string;
  senderName: string;
  roleTitle: string | null;
  code: string;
  createdAt: string;
  expiresAt: string;
};

const displayName = (email: string, name: string | null) =>
  (name ?? "").trim() || email.split("@")[0]!.replace(/[._-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

export const searchUsers = createServerFn({ method: "POST" })
  .inputValidator((i: { query: unknown }) => ({ query: String(i.query ?? "").trim().toLowerCase() }))
  .handler(async ({ data }) => {
    const me = await requireUser();
    if (data.query.length < 3) return { results: [] as { id: string; name: string; email: string }[] };
    const { rows } = await neonQuery(
      `select u.id::text as id, u.email, p.name from public.devup_user u
       left join public.devup_profile p on p.id = u.id::text
       where u.id::text <> $1 and (lower(u.email) like $2 or lower(coalesce(p.name, '')) like $2)
       limit 8`,
      [me.id, `%${data.query}%`],
    );
    return {
      results: rows.map((r) => ({ id: String(r["id"]), email: String(r["email"]), name: displayName(String(r["email"]), r["name"] as string | null) })),
    };
  });

export const sendFriendRequest = createServerFn({ method: "POST" })
  .inputValidator((i: { friendId: unknown }) => ({ friendId: String(i.friendId ?? "") }))
  .handler(async ({ data }) => {
    const me = await requireUser();
    if (!data.friendId || data.friendId === me.id) throw new Error("Pick someone else.");
    // Already friends or a request exists in either direction?
    const { rows: existing } = await neonQuery(
      `select id, status, user_id from public.devup_friendship
       where (user_id = $1 and friend_id = $2) or (user_id = $2 and friend_id = $1) limit 1`,
      [me.id, data.friendId],
    );
    if (existing.length) {
      const row = existing[0]!;
      if (row["status"] === "accepted") throw new Error("You're already friends.");
      // They already asked us — accept it instead of duplicating.
      if (row["user_id"] === data.friendId) {
        await neonQuery("update public.devup_friendship set status = 'accepted' where id = $1::uuid", [String(row["id"])]);
        return { ok: true, accepted: true };
      }
      throw new Error("Request already sent.");
    }
    await neonQuery("insert into public.devup_friendship (user_id, friend_id) values ($1, $2)", [me.id, data.friendId]);
    return { ok: true, accepted: false };
  });

export const respondFriendRequest = createServerFn({ method: "POST" })
  .inputValidator((i: { requestId: unknown; accept: unknown }) => ({ requestId: String(i.requestId ?? ""), accept: i.accept === true }))
  .handler(async ({ data }) => {
    const me = await requireUser();
    if (data.accept) {
      await neonQuery("update public.devup_friendship set status = 'accepted' where id = $1::uuid and friend_id = $2 and status = 'pending'", [data.requestId, me.id]);
    } else {
      await neonQuery("delete from public.devup_friendship where id = $1::uuid and friend_id = $2 and status = 'pending'", [data.requestId, me.id]);
    }
    return { ok: true };
  });

export const removeFriend = createServerFn({ method: "POST" })
  .inputValidator((i: { friendId: unknown }) => ({ friendId: String(i.friendId ?? "") }))
  .handler(async ({ data }) => {
    const me = await requireUser();
    await neonQuery(
      `delete from public.devup_friendship where status = 'accepted'
       and ((user_id = $1 and friend_id = $2) or (user_id = $2 and friend_id = $1))`,
      [me.id, data.friendId],
    );
    return { ok: true };
  });

export const listFriends = createServerFn({ method: "GET" }).handler(async () => {
  const me = await requireUser();
  const { rows: friends } = await neonQuery(
    `with pairs as (
       select friend_id as other_id from public.devup_friendship where user_id = $1 and status = 'accepted'
       union
       select user_id as other_id from public.devup_friendship where friend_id = $1 and status = 'accepted'
     )
     select u.id::text as id, u.email, p.name,
       exists(select 1 from public.devup_peer_session s
              where s.status = 'live' and (s.host_id::text = u.id::text or s.guest_id::text = u.id::text)) as in_interview,
       exists(select 1 from public.devup_session sess
              where sess.user_id = u.id and sess.expires_at > now()) as online
     from pairs join public.devup_user u on u.id::text = pairs.other_id
     left join public.devup_profile p on p.id = u.id::text
     order by u.email`,
    [me.id],
  );
  const { rows: requests } = await neonQuery(
    `select f.id::text as id, u.email, p.name, f.created_at from public.devup_friendship f
     join public.devup_user u on u.id::text = f.user_id
     left join public.devup_profile p on p.id = u.id::text
     where f.friend_id = $1 and f.status = 'pending' order by f.created_at desc`,
    [me.id],
  );
  return {
    friends: friends.map((r): FriendRow => ({
      id: String(r["id"]),
      email: String(r["email"]),
      name: displayName(String(r["email"]), r["name"] as string | null),
      status: r["in_interview"] ? "in_interview" : r["online"] ? "online" : "offline",
    })),
    requests: requests.map((r): FriendRequest => ({
      id: String(r["id"]),
      email: String(r["email"]),
      name: displayName(String(r["email"]), r["name"] as string | null),
      createdAt: String(r["created_at"]),
    })),
  };
});

export const sendInterviewInvite = createServerFn({ method: "POST" })
  .inputValidator((i: { friendId: unknown; code: unknown; roleTitle?: unknown }) => ({
    friendId: String(i.friendId ?? ""),
    code: String(i.code ?? "").trim().toUpperCase(),
    roleTitle: i.roleTitle ? String(i.roleTitle) : null,
  }))
  .handler(async ({ data }) => {
    const me = await requireUser();
    if (!/^[A-Z0-9]{6}$/.test(data.code)) throw new Error("Create a session first — invites carry its code.");
    // Must be friends.
    const { rows: fr } = await neonQuery(
      `select 1 from public.devup_friendship where status = 'accepted'
       and ((user_id = $1 and friend_id = $2) or (user_id = $2 and friend_id = $1)) limit 1`,
      [me.id, data.friendId],
    );
    if (!fr.length) throw new Error("You can only invite friends.");
    // The code must belong to a session I host that is still waiting.
    const { rows: sess } = await neonQuery(
      "select 1 from public.devup_peer_session where code = $1 and host_id::text = $2 and guest_id is null limit 1",
      [data.code, me.id],
    );
    if (!sess.length) throw new Error("That session is no longer waiting for a guest.");
    const { rows: prof } = await neonQuery("select name from public.devup_profile where id = $1", [me.id]);
    const name = displayName(me.email, (prof[0]?.["name"] as string | null) ?? null);
    // One pending invite per pair: replace any older one.
    await neonQuery(
      "update public.devup_interview_invite set status = 'expired' where sender_id = $1 and receiver_id = $2 and status = 'pending'",
      [me.id, data.friendId],
    );
    await neonQuery(
      "insert into public.devup_interview_invite (sender_id, sender_name, receiver_id, code, role_title) values ($1, $2, $3, $4, $5)",
      [me.id, name, data.friendId, data.code, data.roleTitle],
    );
    return { ok: true };
  });

export const listIncomingInvites = createServerFn({ method: "GET" }).handler(async () => {
  const me = await requireUser();
  await neonQuery("update public.devup_interview_invite set status = 'expired' where receiver_id = $1 and status = 'pending' and expires_at <= now()", [me.id]);
  const { rows } = await neonQuery(
    `select id::text as id, sender_name, role_title, code, created_at, expires_at
     from public.devup_interview_invite
     where receiver_id = $1 and status = 'pending' and expires_at > now()
     order by created_at desc limit 3`,
    [me.id],
  );
  return {
    invites: rows.map((r): IncomingInvite => ({
      id: String(r["id"]),
      senderName: String(r["sender_name"]),
      roleTitle: r["role_title"] ? String(r["role_title"]) : null,
      code: String(r["code"]),
      createdAt: String(r["created_at"]),
      expiresAt: String(r["expires_at"]),
    })),
  };
});

export const respondInvite = createServerFn({ method: "POST" })
  .inputValidator((i: { inviteId: unknown; accept: unknown }) => ({ inviteId: String(i.inviteId ?? ""), accept: i.accept === true }))
  .handler(async ({ data }) => {
    const me = await requireUser();
    const { rows } = await neonQuery(
      "select id::text as id, code, status, expires_at from public.devup_interview_invite where id = $1::uuid and receiver_id = $2 limit 1",
      [data.inviteId, me.id],
    );
    const inv = rows[0];
    if (!inv) throw new Error("That invite is gone.");
    if (inv["status"] !== "pending" || Date.parse(String(inv["expires_at"])) <= Date.now()) {
      throw new Error("That invite has expired.");
    }
    await neonQuery("update public.devup_interview_invite set status = $2 where id = $1::uuid", [data.inviteId, data.accept ? "accepted" : "declined"]);
    return { ok: true, code: data.accept ? String(inv["code"]) : null };
  });

export type ScheduledInterview = { id: string; withName: string; withId: string; at: string; note: string | null; status: string; mine: boolean };

async function areFriends(a: string, b: string) {
  const { rows } = await neonQuery(
    `select 1 from public.devup_friendship where status = 'accepted'
     and ((user_id = $1 and friend_id = $2) or (user_id = $2 and friend_id = $1)) limit 1`, [a, b]);
  return rows.length > 0;
}

export const scheduleInterview = createServerFn({ method: "POST" })
  .inputValidator((i: { friendId: unknown; at: unknown; note?: unknown }) => ({
    friendId: String(i.friendId ?? ""), at: String(i.at ?? ""), note: i.note ? String(i.note).slice(0, 200) : null,
  }))
  .handler(async ({ data }) => {
    const me = await requireUser();
    const when = new Date(data.at);
    if (Number.isNaN(when.getTime()) || when.getTime() < Date.now() - 60_000) throw new Error("Pick a time in the future.");
    if (!(await areFriends(me.id, data.friendId))) throw new Error("You can only schedule with friends.");
    await neonQuery("insert into public.devup_interview_schedule (sender_id, receiver_id, scheduled_at, note) values ($1, $2, $3::timestamptz, $4)",
      [me.id, data.friendId, when.toISOString(), data.note]);
    return { ok: true };
  });

export const listScheduledInterviews = createServerFn({ method: "GET" }).handler(async () => {
  const me = await requireUser();
  const { rows } = await neonQuery(
    `select s.id::text as sid, s.sender_id, s.receiver_id, s.scheduled_at, s.note, s.status, u.email, p.name
     from public.devup_interview_schedule s
     join public.devup_user u on u.id::text = case when s.sender_id = $1 then s.receiver_id else s.sender_id end
     left join public.devup_profile p on p.id = u.id::text
     where (s.sender_id = $1 or s.receiver_id = $1) and s.status <> 'cancelled' and s.scheduled_at > now() - interval '1 hour'
     order by s.scheduled_at limit 20`, [me.id]);
  return rows.map((r): ScheduledInterview => ({
    id: String(r["sid"]),
    withId: String(r["sender_id"]) === me.id ? String(r["receiver_id"]) : String(r["sender_id"]),
    withName: displayName(String(r["email"]), r["name"] as string | null),
    at: new Date(String(r["scheduled_at"])).toISOString(),
    note: (r["note"] as string | null) ?? null,
    status: String(r["status"]),
    mine: String(r["sender_id"]) === me.id,
  }));
});

export const respondScheduledInterview = createServerFn({ method: "POST" })
  .inputValidator((i: { id: unknown; action: unknown }) => ({
    id: String(i.id ?? ""), action: i.action === "accept" ? "accepted" : "cancelled",
  }))
  .handler(async ({ data }) => {
    const me = await requireUser();
    if (data.action === "accepted") {
      await neonQuery("update public.devup_interview_schedule set status = 'accepted' where id = $1::uuid and receiver_id = $2", [data.id, me.id]);
    } else {
      await neonQuery("update public.devup_interview_schedule set status = 'cancelled' where id = $1::uuid and (receiver_id = $2 or sender_id = $2)", [data.id, me.id]);
    }
    return { ok: true };
  });
