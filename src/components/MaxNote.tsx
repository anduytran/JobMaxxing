import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Mascot } from "@/components/AppShell";
import { MAX_NOTES, nextMaxNote } from "@/lib/max-notes";

/**
 * Max's note card: him on the left, the note on the right. Used on the Career
 * header (click cycles) and the Lock In screen (random every visit).
 */
export function MaxNote({ note, onCycle, className = "" }: { note: string; onCycle?: () => void; className?: string }) {
  const reducedMotion = useReducedMotion();
  const inner = (
    <>
      <Mascot className="h-11 w-11 shrink-0" />
      <span className="min-w-0">
        <span className="block text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Notes from Max</span>
        <motion.span
          key={note}
          initial={reducedMotion ? false : { opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          className="block min-h-[3rem] text-base text-muted-foreground"
          aria-live="polite"
        >
          {note || "\u00A0"}
        </motion.span>
      </span>
    </>
  );
  const cls = `flex max-w-xl items-start gap-3 rounded-2xl border bg-hero/60 px-4 py-3 text-left transition-shadow hover:shadow-md ${className}`;
  return onCycle ? (
    <button type="button" onClick={onCycle} aria-label="Another note from Max" title="Another note from Max" className={cls}>
      {inner}
    </button>
  ) : (
    <div className={cls}>{inner}</div>
  );
}

/** A different note every time the screen opens; clicking asks for another. */
export function useRandomMaxNote() {
  const [index, setIndex] = useState(-1);
  useEffect(() => { setIndex(Math.floor(Math.random() * MAX_NOTES.length)); }, []);
  return { note: index < 0 ? "" : MAX_NOTES[index], next: () => setIndex((c) => nextMaxNote(c)) };
}
