// Max's notes, shared by the Career header and the Lock In screen so he says the
// same kind of thing wherever he shows up.
export const MAX_NOTES = [
  "You don't have to have it all figured out. You just have to take the next step.",
  "A good interview is a conversation, not a performance. Take a breath. You've got this.",
  "That thing you think is 'just part of the job'? It might be your best resume story.",
  "Some days, one small step is plenty. Progress still counts.",
];

/** Pick a note at random, never the one that is already on screen. */
export function nextMaxNote(current: number) {
  if (MAX_NOTES.length < 2) return 0;
  let next = current;
  while (next === current) next = Math.floor(Math.random() * MAX_NOTES.length);
  return next;
}
