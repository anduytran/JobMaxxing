import { useRef, useState } from "react";
import { ImageOff, ImagePlus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { AvatarFace } from "@/components/AppShell";
import { useGame } from "@/lib/game";

/** Profile photo picker: reads the file, downscales to a 256px square on a
 *  canvas, and hands the small data URL to the server (no file storage). */
export function AvatarPicker() {
  const { name, avatarUrl, setAvatar } = useGame();
  const fileRef = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);
  const initials = name.split(/\s+/).map((p) => p[0]).join("").slice(0, 2).toUpperCase() || "ME";

  const pick = async (file: File | undefined) => {
    if (!file) return;
    if (!/^image\/(png|jpeg|webp)$/.test(file.type)) { toast.error("Choose a PNG, JPG, or WebP image."); return; }
    setSaving(true);
    try {
      const bitmap = await createImageBitmap(file);
      const side = Math.min(bitmap.width, bitmap.height);
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 256;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("no canvas");
      ctx.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, 256, 256);
      bitmap.close();
      const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
      if (!(await setAvatar(dataUrl))) return;
      toast.success("Profile picture updated.");
    } catch {
      toast.error("Couldn't read that image. Try another one.");
    } finally {
      setSaving(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div className="flex items-center gap-4">
      <AvatarFace url={avatarUrl} initials={initials} className="h-16 w-16 text-lg" />
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" disabled={saving} onClick={() => fileRef.current?.click()}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
          {saving ? "Saving photo…" : avatarUrl ? "Change photo" : "Add profile photo"}
        </Button>
        {avatarUrl && (
          <Button variant="ghost" size="sm" disabled={saving} onClick={() => void setAvatar(null)}>
            <ImageOff className="h-4 w-4" />Remove photo
          </Button>
        )}
      </div>
      <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" aria-hidden="true"
        onChange={(e) => void pick(e.target.files?.[0])} />
    </div>
  );
}
