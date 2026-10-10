import { useRouter } from "@tanstack/react-router";
import { FileSearch, Loader2, Mic, Radar, Trophy } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signIn, signUp } from "@/lib/auth.functions";
import wave from "@/assets/max/max-wave.svg";

const FEATURES = [
  { icon: FileSearch, title: "Resume Lab", text: "An AI recruiter grades your resume, rewrites weak bullets and checks it against applicant tracking systems." },
  { icon: Mic, title: "AI mock interviews", text: "Practice out loud for a real job description and get scored on every answer." },
  { icon: Radar, title: "Job Radar", text: "Roles matched to your resume and the dealbreakers you set." },
  { icon: Trophy, title: "XP & quests", text: "Every fix, scan and interview levels you up." },
];

/** Signed-out landing page: what JobMaxxing does, plus sign in / sign up. */
export function AuthScreen() {
  const router = useRouter();
  const [mode, setMode] = useState<"in" | "up">("up");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const fn = mode === "in" ? signIn : signUp;
      const res = await fn({ data: { email, password, name } });
      if (!res.ok) return void toast.error(res.error);
      if (mode === "up") {
        // Optional onboarding step: upload a resume (skippable) right after sign-up.
        await router.navigate({ to: "/setup", search: { welcome: "1" } });
      }
      await router.invalidate();
      toast.success(mode === "in" ? "Signed in" : "Account created");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <span className="font-display text-2xl font-bold tracking-wider">JOB<span className="text-primary">MAXXING</span></span>
        <Button variant="ghost" onClick={() => setMode(mode === "in" ? "up" : "in")}>
          {mode === "in" ? "Create an account" : "Sign in"}
        </Button>
      </header>
      <main className="page-arrival mx-auto grid max-w-6xl items-center gap-10 px-6 pb-16 pt-6 lg:grid-cols-[1.2fr_1fr]">
        <section>
          <img src={wave} alt="Max, the JobMaxxing briefcase, waving" className="mascot-personality h-28 w-28" />
          <h1 className="mt-4 text-4xl font-bold leading-tight md:text-6xl">Level up your career, one quest at a time.</h1>
          <p className="mt-4 max-w-xl text-lg text-muted-foreground">
            Upload your resume, practice interviews with an AI recruiter, and find roles that actually fit — earning XP for every step.
          </p>
          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            {FEATURES.map((f) => (
              <div key={f.title} className="panel p-4">
                <f.icon className="h-5 w-5 text-primary" />
                <p className="mt-2 font-semibold">{f.title}</p>
                <p className="text-sm text-muted-foreground">{f.text}</p>
              </div>
            ))}
          </div>
        </section>
        <form onSubmit={submit} className="panel w-full space-y-4 p-6">
          <h2 className="font-display text-xl">{mode === "in" ? "Good to see you again." : "Your next chapter starts here."}</h2>
          <p className="text-sm text-muted-foreground">
            {mode === "in" ? "Pick up where you left off." : "Sign-ups are invite-only for now. You can add your resume right after."}
          </p>
          {mode === "up" && (
            <div className="space-y-2"><Label htmlFor="name">Name</Label><Input id="name" value={name} onChange={(e) => setName(e.target.value)} /></div>
          )}
          <div className="space-y-2"><Label htmlFor="email">Email</Label><Input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></div>
          <div className="space-y-2"><Label htmlFor="pw">Password</Label><Input id="pw" type="password" autoComplete={mode === "in" ? "current-password" : "new-password"} minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} required /></div>
          <Button type="submit" className="w-full" disabled={busy}>{busy && <Loader2 className="animate-spin" />}{mode === "in" ? "Sign in" : "Sign up"}</Button>
          <Button variant="ghost" type="button" className="w-full text-sm text-muted-foreground hover:text-foreground" onClick={() => setMode(mode === "in" ? "up" : "in")}>
            {mode === "in" ? "New here? Create an account" : "Have an account? Sign in"}
          </Button>
        </form>
      </main>
    </div>
  );
}
