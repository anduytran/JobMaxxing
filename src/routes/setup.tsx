import { createFileRoute, Link } from "@tanstack/react-router";
import { AnimatePresence, motion } from "framer-motion";
import { FileUp, Sparkle } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { useGame } from "@/lib/game";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/setup")({
  head: () => ({
    meta: [
      { title: "Resume Setup — DevUp" },
      { name: "description", content: "Upload your resume to generate your starting level and stats." },
      { property: "og:title", content: "Resume Setup — DevUp" },
      { property: "og:description", content: "Upload your resume to generate your starting level and stats." },
    ],
  }),
  component: Setup,
});

const LINES = [
  "> Initializing parser v2.4...", "> Extracting text...", "> Detected 2 pages, 612 words",
  "> Analyzing keywords...", "> Matched: React, TypeScript, Node.js, SQL", "> Scoring experience...",
  "> Generating baseline stats...", "> Done. Character created.",
];

function Setup() {
  const { completeQuest, quests } = useGame();
  const [file, setFile] = useState<string | null>(null);
  const [lines, setLines] = useState<string[]>([]);
  const [drag, setDrag] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const done = lines.length === LINES.length;

  useEffect(() => {
    if (!file) return;
    setLines([]);
    let i = 0;
    const t = setInterval(() => {
      i++;
      setLines(LINES.slice(0, i));
      if (i >= LINES.length) clearInterval(t);
    }, 450);
    return () => clearInterval(t);
  }, [file]);

  useEffect(() => {
    if (done && !quests.find((q) => q.id === "resume")?.done) completeQuest("resume");
  }, [done]); // eslint-disable-line react-hooks/exhaustive-deps

  const pick = (f?: File) => f && setFile(f.name);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Resume Setup</h1>
        <p className="text-muted-foreground">Drop your resume PDF to generate your character.</p>
      </div>
      {!file && (
        <div onClick={() => input.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
          onDrop={(e) => { e.preventDefault(); setDrag(false); pick(e.dataTransfer.files[0]); }}
          className={cn("panel grid cursor-pointer place-items-center border-2 border-dashed p-16 text-center transition", drag && "border-primary glow")}>
          <FileUp className="mb-4 h-12 w-12 text-primary" />
          <p className="font-display text-lg">Drag & drop your PDF here</p>
          <p className="text-sm text-muted-foreground">or click to browse</p>
          <input ref={input} type="file" accept="application/pdf" hidden onChange={(e) => pick(e.target.files?.[0])} />
        </div>
      )}
      {file && (
        <div className="panel overflow-hidden">
          <div className="border-b px-4 py-2 font-mono text-xs text-muted-foreground">scan://{file}</div>
          <div className="min-h-64 space-y-1 p-4 font-mono text-sm text-success">
            {lines.map((l, i) => <motion.div key={i} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}>{l}</motion.div>)}
            {!done && <span className="inline-block h-4 w-2 animate-pulse bg-success" />}
          </div>
        </div>
      )}
      <AnimatePresence>
        {done && (
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="panel glow p-8 text-center">
            <Sparkle className="mx-auto mb-2 h-8 w-8 text-accent" />
            <h2 className="text-2xl font-bold">Character Created!</h2>
            <p className="mt-2 text-muted-foreground">Starting Level <span className="font-bold text-primary">3: Contender</span> · Baseline <span className="font-bold text-success">2,350 XP</span> + 500 XP quest bonus</p>
            <div className="mt-6 flex justify-center gap-3">
              <Button asChild><Link to="/">View Dashboard</Link></Button>
              <Button variant="outline" onClick={() => setFile(null)}>Upload another</Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
