import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useGame } from "@/lib/game";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings — DevUp" },
      { name: "description", content: "Edit your DevUp profile and preferences." },
      { property: "og:title", content: "Settings — DevUp" },
      { property: "og:description", content: "Edit your DevUp profile and preferences." },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const g = useGame();
  const [name, setName] = useState(g.name);
  const [title, setTitle] = useState(g.title);
  return (
    <div className="mx-auto max-w-xl space-y-6">
      <h1 className="text-3xl font-bold">Settings</h1>
      <div className="panel space-y-4 p-6">
        <div className="space-y-2"><Label htmlFor="n">Name</Label><Input id="n" value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div className="space-y-2"><Label htmlFor="t">Current title</Label><Input id="t" value={title} onChange={(e) => setTitle(e.target.value)} /></div>
        <Button onClick={() => { g.setProfile(name, title); toast.success("Profile saved"); }}>Save profile</Button>
      </div>
      <div className="panel flex items-center justify-between p-6">
        <div><div className="font-semibold">Roast Mode</div><div className="text-sm text-muted-foreground">Aggressive interviewer, red-hot theme.</div></div>
        <Switch checked={g.roast} onCheckedChange={g.setRoast} />
      </div>
    </div>
  );
}
