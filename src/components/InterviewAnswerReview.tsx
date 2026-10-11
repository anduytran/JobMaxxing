import { useState } from "react";
import { RotateCcw, Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { transcriptEdits } from "@/lib/interview/transcript-edits";

export function InterviewAnswerReview({ original, onSend, onDiscard }: { original: string; onSend: (text: string) => void; onDiscard: () => void }) {
  const [edited, setEdited] = useState(original);
  const edits = transcriptEdits(original, edited);
  return (
    <div className="w-full max-w-2xl space-y-3 border-t pt-4">
      <div className="flex items-center justify-between gap-3"><h3 className="font-semibold">Review your answer</h3><span className={edits > 5 ? "text-sm text-destructive" : "text-sm text-muted-foreground"}>{edits} / 5 word corrections</span></div>
      <Textarea aria-label="Captured answer" value={edited} onChange={(event) => setEdited(event.target.value)} rows={4} />
      {edits > 5 && <p role="alert" className="text-sm text-destructive">Keep corrections to five words or fewer.</p>}
      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="ghost" size="icon" title="Reset corrections" aria-label="Reset corrections" onClick={() => setEdited(original)}><RotateCcw /></Button>
        <Button variant="outline" onClick={onDiscard}><X />Discard</Button>
        <Button onClick={() => onSend(edited.trim())} disabled={!edited.trim() || edits > 5}><Send />Send answer</Button>
      </div>
    </div>
  );
}