import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Mascot } from "@/components/AppShell";
import { MAX_NOTES, maxNote, nextMaxNote } from "@/lib/max-notes";

/**
 * Max's yellow sticky note: him on the left, the note on the right. Used on the
 * Career header (click cycles) and the Lock In screen (random every visit).
 */
export function MaxNote({ note, onCycle, className = "" }: { note: string; onCycle?: () => void; className?: string }) {
  const reducedMotion = useReducedMotion();
  const inner = (
    <>
      <Mascot className="h-11 w-11 shrink-0 drop-shadow-sm" />
      <span className="min-w-0">
        <span className="block text-[11px] font-semibold uppercase tracking-[0.18em] opacity-70">Notes from Max</span>
        <motion.span
          key={note}
          initial={reducedMotion ? false : { opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          className="block min-h-[5rem] text-[15px] leading-relaxed"
          aria-live="polite"
        >
          {note || "\u00A0"}
        </motion.span>
      </span>
    </>
  );
  // Squared up, like a real 3x3 note — a wide banner reads as a text strip.
  const cls = `sticky-note block w-[280px] px-5 py-4 text-left ${className}`;
  return onCycle ? (
    <button type="button" onClick={onCycle} aria-label="Another note from Max" title="Another note from Max" className={cls}>
      <span className="flex items-start gap-3">{inner}</span>
    </button>
  ) : (
    <div className={cls}>
      <span className="flex items-start gap-3">{inner}</span>
    </div>
  );
}

/** A different note every time the screen opens; clicking asks for another. */
export function useRandomMaxNote() {
  const [index, setIndex] = useState(-1);
  useEffect(() => { setIndex(Math.floor(Math.random() * MAX_NOTES.length)); }, []);
  return { note: maxNote(index), next: () => setIndex((c) => nextMaxNote(c)) };
}
