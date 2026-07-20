import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { useEffect, useRef, useState, type FormEvent } from "react";

export function BrandSettingsPanel({ workspaceId }: { workspaceId: string }) {
  const utils = trpc.useUtils();
  const brand = trpc.brandSettings.get.useQuery({ workspaceId });
  const upsert = trpc.brandSettings.upsert.useMutation({
    onSuccess: (row) => {
      void utils.brandSettings.get.invalidate({ workspaceId });
      setPaletteText((row.paletteJson ?? []).join(", "));
      setTone(row.tone ?? "");
      setGuidelines(row.guidelines ?? "");
    },
  });

  const [paletteText, setPaletteText] = useState("");
  const [tone, setTone] = useState("");
  const [guidelines, setGuidelines] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const hydrated = useRef(false);

  // Hydrate once from the server. Re-running on every refetch would wipe
  // in-progress edits (TanStack Query refetches on focus by default).
  useEffect(() => {
    if (!brand.data || hydrated.current) return;
    setPaletteText((brand.data.paletteJson ?? []).join(", "));
    setTone(brand.data.tone ?? "");
    setGuidelines(brand.data.guidelines ?? "");
    hydrated.current = true;
  }, [brand.data]);

  useEffect(() => {
    hydrated.current = false;
  }, [workspaceId]);

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    setMessage(null);
    const palette = paletteText
      .split(/[,\s]+/)
      .map((c) => c.trim())
      .filter(Boolean);
    try {
      await upsert.mutateAsync({
        workspaceId,
        palette,
        tone: tone.trim() || null,
        guidelines: guidelines.trim() || null,
      });
      setMessage("Brand settings saved.");
    } catch {
      setMessage("Could not save — check hex colors look like #RRGGBB and you are an admin.");
    }
  }

  return (
    <section data-testid="brand-settings-panel" className="space-y-3">
      <h2 className="text-sm font-semibold">Brand settings</h2>
      <p className="text-muted-foreground text-xs">
        Palette hex colors feed image generation when “Use brand palette” is checked. Admins only.
      </p>
      <form onSubmit={handleSave} className="space-y-2">
        <div>
          <label htmlFor="brand-palette" className="mb-1 block text-xs font-medium">
            Palette (comma-separated #RRGGBB)
          </label>
          <Input
            id="brand-palette"
            data-testid="brand-palette-input"
            value={paletteText}
            onChange={(e) => setPaletteText(e.target.value)}
            placeholder="#112233, #AABBCC"
          />
        </div>
        <div>
          <label htmlFor="brand-tone" className="mb-1 block text-xs font-medium">
            Tone
          </label>
          <Input
            id="brand-tone"
            value={tone}
            onChange={(e) => setTone(e.target.value)}
            placeholder="Bold, playful…"
          />
        </div>
        <div>
          <label htmlFor="brand-guidelines" className="mb-1 block text-xs font-medium">
            Guidelines
          </label>
          <textarea
            id="brand-guidelines"
            value={guidelines}
            onChange={(e) => setGuidelines(e.target.value)}
            rows={2}
            className="border-border focus-visible:ring-primary w-full resize-none rounded-md border bg-transparent px-3 py-2 text-sm outline-none focus-visible:ring-2"
          />
        </div>
        <Button type="submit" size="sm" disabled={upsert.isPending}>
          Save brand
        </Button>
        {message && <p className="text-muted-foreground text-xs">{message}</p>}
      </form>
    </section>
  );
}
