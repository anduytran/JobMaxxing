import { useMemo } from "react";

type Segment = { text: string; skill: boolean };

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const CACHE = new Map<string, RegExp | null>();

/** One regex for the whole skill list, longest-first so "React Native" wins over "React". */
function skillPattern(skills: string[]): RegExp | null {
  const clean = [...new Set(skills.map((s) => s.trim()).filter((s) => s.length >= 2))]
    .sort((a, b) => b.length - a.length);
  const key = clean.join("|");
  const hit = CACHE.get(key);
  if (hit !== undefined) return hit;
  const re = clean.length
    ? new RegExp(`(?<![\\w+#])(${clean.map(esc).join("|")})(?![\\w+#])`, "gi")
    : null;
  CACHE.set(key, re);
  return re;
}

function splitBySkills(text: string, skills: string[]): Segment[] {
  const re = skillPattern(skills);
  if (!re) return [{ text, skill: false }];
  const lookup = new Map(skills.map((s) => [s.toLowerCase(), s]));
  const out: Segment[] = [];
  let last = 0;
  for (const m of text.matchAll(re)) {
    const at = m.index ?? 0;
    const found = m[0];
    const known = lookup.get(found.toLowerCase());
    // Two-letter skills ("Go", "R") only count when the casing matches, so they
    // never light up ordinary words at the start of a sentence.
    if (!known || (known.length <= 2 && found !== known)) continue;
    if (at > last) out.push({ text: text.slice(last, at), skill: false });
    out.push({ text: found, skill: true });
    last = at + found.length;
  }
  if (last < text.length) out.push({ text: text.slice(last), skill: false });
  return out.length ? out : [{ text, skill: false }];
}

/** Renders text with any listed skill highlighted inline. */
export function SkillText({ text, skills, className }: { text: string; skills: string[]; className?: string }) {
  const parts = useMemo(() => splitBySkills(text, skills), [text, skills]);
  return (
    <span className={className}>
      {parts.map((p, i) =>
        p.skill ? (
          <mark key={i} className="rounded-[3px] bg-primary/15 px-1 font-semibold text-primary">{p.text}</mark>
        ) : (
          <span key={i}>{p.text}</span>
        ),
      )}
    </span>
  );
}
