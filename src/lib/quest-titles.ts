const SHORT_TITLES: Record<string, string> = {
  "Solve 2 LeetCode Easy problems": "Solve Two Easy LeetCode Problems",
  "Solve 1 LeetCode Medium problem": "Solve One Medium LeetCode Problem",
  "Attempt 1 LeetCode Hard problem": "Attempt One Hard LeetCode Problem",
  "Re-solve a problem you missed last week": "Retry Last Week’s Missed Problem",
  "Run a behavioral mock interview": "Practice Your Behavioral Mock Interview",
  "Write 1 STAR story from your experience": "Write Your Next STAR Story",
  "Prepare 3 questions to ask an interviewer": "Prepare Three Smart Interview Questions",
  "Rewrite one resume bullet with a metric": "Add Metrics to One Bullet",
  "Update your LinkedIn About section": "Refresh Your LinkedIn About Section",
  "Add a project to your portfolio": "Showcase Your Next Portfolio Project",
  "Apply to 3 roles": "Apply to Three Matched Roles",
  "Research one target company": "Research Your Next Target Company",
  "Follow up on an application": "Follow Up on Your Application",
  "Message someone in your target field": "Meet Someone in Your Field",
  "Book a coffee chat": "Book Your Next Coffee Chat",
};

/** Presentation-only copy; the full saved quest remains unchanged. */
export function featuredQuestTitle(title: string): string {
  const known = SHORT_TITLES[title];
  if (known) return known;
  if (/^Study one core skill for /i.test(title)) return "Build Your Next Core Skill";
  if (/^Read 3 .* job postings/i.test(title)) return "Explore Three Target Job Postings";
  if (/^Build a small project/i.test(title)) return "Build Your Next Role Project";
  if (/^Do a mock interview for/i.test(title)) return "Practice Your Target Role Interview";
  const words = title.trim().replace(/[.!:;]+$/u, "").split(/\s+/u);
  if (words.length <= 5) return words.join(" ");
  const compact = title.replace(/\b(?:one of|in order to|from your experience|last week)\b/gi, "").trim().split(/\s+/u);
  const shortened = compact.slice(0, 5);
  while (shortened.length > 4 && /^(?:a|an|the|to|for|with|and|of|in|your)$/i.test(shortened[shortened.length - 1] ?? "")) shortened.pop();
  return shortened.join(" ");
}

/** Presentation-only: always returns the display title as two lines, balanced by length. */
export function questTitleLines(title: string): [string, string] {
  const words = featuredQuestTitle(title).split(/\s+/u).filter(Boolean);
  if (words.length < 2) return [words[0] ?? "", ""];
  let split = 1;
  let best = Number.POSITIVE_INFINITY;
  for (let i = 1; i < words.length; i++) {
    const diff = Math.abs(words.slice(0, i).join(" ").length - words.slice(i).join(" ").length);
    if (diff < best) { best = diff; split = i; }
  }
  return [words.slice(0, split).join(" "), words.slice(split).join(" ")];
}