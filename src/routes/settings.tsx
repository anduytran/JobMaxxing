import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useGame } from "@/lib/game";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings — JobMaxxing" },
      { name: "description", content: "Edit your JobMaxxing profile and preferences." },
      { property: "og:title", content: "Settings — JobMaxxing" },
      { property: "og:description", content: "Edit your JobMaxxing profile and preferences." },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const g = useGame();
  const [name, setName] = useState(g.name);
  const [title, setTitle] = useState(g.title);
  const d = g.details;
  const [saving, setSaving] = useState<"" | "profile" | "details">("");
  const [skills, setSkills] = useState(d.skills.join(", "));
  const [student, setStudent] = useState(d.student);
  const [prefs, setPrefs] = useState(d.jobPrefs);
  const saveDetails = async () => {
    setSaving("details");
    const ok = await g.saveDetails({
      skills: skills.split(",").map((s) => s.trim()).filter(Boolean), student, jobPrefs: prefs,
    });
    setSaving("");
    if (ok) toast.success("Details saved");
  };
  const field = <T extends Record<string, string | undefined>>(obj: T, set: (v: T) => void, key: keyof T & string, label: string) => (
    <div className="space-y-2" key={key}><Label htmlFor={key}>{label}</Label>
      <Input id={key} value={obj[key] ?? ""} onChange={(e) => set({ ...obj, [key]: e.target.value })} /></div>
  );
  return (
    <div className="mx-auto max-w-xl space-y-6">
      <h1 className="text-4xl font-bold md:text-5xl">Settings</h1>
      <div className="panel space-y-4 p-6">
        <div className="space-y-2"><Label htmlFor="n">Name</Label><Input id="n" value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div className="space-y-2"><Label htmlFor="t">Current title</Label><Input id="t" value={title} onChange={(e) => setTitle(e.target.value)} /></div>
        <Button disabled={!!saving} onClick={async () => { setSaving("profile"); const ok = await g.setProfile(name, title); setSaving(""); if (ok) toast.success("Profile saved"); }}>
          {saving === "profile" && <Loader2 className="animate-spin" />}{saving === "profile" ? "Saving…" : "Save profile"}</Button>
      </div>
      <div className="panel space-y-4 p-6">
        <div className="font-semibold">Your skills</div>
        <div className="space-y-2"><Label htmlFor="sk">Skills (comma separated)</Label>
          <Input id="sk" value={skills} onChange={(e) => setSkills(e.target.value)} placeholder="React, TypeScript, Scala, Golang" /></div>
        <div className="font-semibold">Student information</div>
        <div className="grid gap-4 sm:grid-cols-2">
          {field(student, setStudent, "school", "School")}{field(student, setStudent, "degree", "Degree")}
          {field(student, setStudent, "major", "Major")}{field(student, setStudent, "gradYear", "Graduation year")}
        </div>
        <div className="font-semibold">Job preferences</div>
        <div className="grid gap-4 sm:grid-cols-2">
          {field(prefs, setPrefs, "roles", "Target roles")}{field(prefs, setPrefs, "locations", "Locations")}
          {field(prefs, setPrefs, "workMode", "Remote / hybrid / onsite")}{field(prefs, setPrefs, "salary", "Salary range")}
        </div>
        <div className="text-sm text-muted-foreground">Current resume: {d.resume ? d.resume.fileName : "none uploaded yet"} · signed in as {g.email}</div>
        <Button disabled={!!saving} onClick={saveDetails}>{saving === "details" && <Loader2 className="animate-spin" />}{saving === "details" ? "Saving…" : "Save details"}</Button>
      </div>
      <div className="panel flex items-center justify-between p-6">
        <div><div className="font-semibold">Roast Mode</div><div className="text-sm text-muted-foreground">Aggressive interviewer, red-hot theme.</div></div>
        <Switch checked={g.roast} onCheckedChange={g.setRoast} />
      </div>
    </div>
  );
}
