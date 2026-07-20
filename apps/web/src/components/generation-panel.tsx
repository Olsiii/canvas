import {
  ASPECT_PRESETS,
  ASPECT_PRESET_LABELS,
  STYLE_PRESETS,
  STYLE_PRESET_LABELS,
  type AspectPreset,
  type StylePreset,
} from "@canvas/shared";
import { Button } from "@/components/ui/button";
import { ImageVersionThumb } from "@/components/image-version-thumb";
import { useImageAssetJob } from "@/hooks/use-image-asset-job";
import { trpc } from "@/lib/trpc";
import { useEffect, useState, type FormEvent } from "react";

export function GenerationPanel({
  workspaceId,
  taskId,
  onClose,
}: {
  workspaceId: string;
  taskId?: string;
  onClose?: () => void;
}) {
  const utils = trpc.useUtils();
  const brand = trpc.brandSettings.get.useQuery({ workspaceId });

  const [prompt, setPrompt] = useState("");
  const [size, setSize] = useState<AspectPreset>("square");
  const [style, setStyle] = useState<StylePreset | "">("");
  const [n, setN] = useState(2);
  const [useBrandPalette, setUseBrandPalette] = useState(false);
  const [assetId, setAssetId] = useState<string | null>(null);
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);
  const [editInstruction, setEditInstruction] = useState("");
  const [targetVersionCount, setTargetVersionCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const generate = trpc.imageAsset.generate.useMutation();
  const edit = trpc.imageAsset.edit.useMutation();
  const promote = trpc.imageAsset.promoteVersion.useMutation({
    onSuccess: () => {
      if (assetId) void utils.imageAsset.get.invalidate({ assetId });
    },
  });
  const attach = trpc.imageAsset.attachToTask.useMutation({
    onSuccess: () => {
      if (taskId) void utils.attachment.list.invalidate({ taskId });
    },
  });

  const { status: jobStatus, setStatus: setJobStatus } = useImageAssetJob(
    assetId ?? undefined,
    (event) => {
      if (event.status === "done" || event.status === "error") {
        if (assetId) void utils.imageAsset.get.invalidate({ assetId });
      }
    },
  );

  const asset = trpc.imageAsset.get.useQuery(
    { assetId: assetId ?? "" },
    {
      enabled: !!assetId,
      refetchInterval: (query) => {
        const data = query.state.data;
        if (!data) return 1000;
        if (jobStatus === "queued" || jobStatus === "generating") return 1000;
        if (targetVersionCount > 0 && data.versions.length < targetVersionCount) return 1000;
        return false;
      },
    },
  );

  const versions = asset.data?.versions ?? [];

  useEffect(() => {
    if (targetVersionCount > 0 && versions.length >= targetVersionCount) {
      if (jobStatus === "queued" || jobStatus === "generating" || jobStatus === "idle") {
        setJobStatus("done");
      }
    }
  }, [versions.length, targetVersionCount, jobStatus, setJobStatus]);

  useEffect(() => {
    const currentId = asset.data?.currentVersionId ?? null;
    const versionList = asset.data?.versions ?? [];
    if (!asset.data) return;
    // After a job finishes, follow the new current version (edit produces a child).
    if (jobStatus === "done" && currentId) {
      setSelectedVersionId(currentId);
      return;
    }
    if (selectedVersionId && versionList.some((v) => v.id === selectedVersionId)) return;
    setSelectedVersionId(currentId ?? versionList.at(-1)?.id ?? null);
  }, [asset.data, selectedVersionId, jobStatus]);

  async function handleGenerate(e: FormEvent) {
    e.preventDefault();
    const text = prompt.trim();
    if (!text || generate.isPending) return;
    setError(null);
    setAssetId(null);
    setSelectedVersionId(null);
    setTargetVersionCount(n);
    setJobStatus("queued");
    try {
      const created = await generate.mutateAsync({
        workspaceId,
        prompt: text,
        size,
        style: style || undefined,
        n,
        useBrandPalette,
      });
      setAssetId(created.id);
    } catch {
      setJobStatus("error");
      setError("Generation failed to start.");
    }
  }

  async function handleEdit(e: FormEvent) {
    e.preventDefault();
    const instruction = editInstruction.trim();
    if (!assetId || !selectedVersionId || !instruction || edit.isPending) return;
    setError(null);
    setTargetVersionCount(versions.length + 1);
    setJobStatus("queued");
    try {
      await edit.mutateAsync({
        assetId,
        parentVersionId: selectedVersionId,
        instruction,
      });
      setEditInstruction("");
    } catch {
      setJobStatus("error");
      setError("Edit failed to start.");
    }
  }

  const ready = versions.length > 0;
  const busy = jobStatus === "queued" || jobStatus === "generating" || generate.isPending || edit.isPending;
  const waiting =
    !!assetId &&
    (busy || (targetVersionCount > 0 && versions.length < targetVersionCount));

  const statusLabel =
    jobStatus === "queued"
      ? "Queued…"
      : jobStatus === "generating"
        ? "Generating…"
        : jobStatus === "done"
          ? "Done"
          : jobStatus === "error"
            ? "Error"
            : waiting
              ? `Working ${versions.length}/${Math.max(targetVersionCount, versions.length)}…`
              : null;

  return (
    <div data-testid="generation-panel" className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Generate image</h3>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground text-xs"
          >
            Close
          </button>
        )}
      </div>

      <form onSubmit={handleGenerate} className="space-y-3">
        <div>
          <label htmlFor="gen-prompt" className="mb-1 block text-xs font-medium">
            Prompt
          </label>
          <textarea
            id="gen-prompt"
            data-testid="generation-prompt"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={3}
            placeholder="Describe the image…"
            className="border-border focus-visible:ring-primary w-full resize-none rounded-md border bg-transparent px-3 py-2 text-sm outline-none focus-visible:ring-2"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="gen-size" className="mb-1 block text-xs font-medium">
              Aspect
            </label>
            <select
              id="gen-size"
              data-testid="generation-size"
              value={size}
              onChange={(e) => setSize(e.target.value as AspectPreset)}
              className="border-border bg-background h-8 w-full rounded border text-sm"
            >
              {ASPECT_PRESETS.map((p) => (
                <option key={p} value={p}>
                  {ASPECT_PRESET_LABELS[p]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="gen-style" className="mb-1 block text-xs font-medium">
              Style
            </label>
            <select
              id="gen-style"
              data-testid="generation-style"
              value={style}
              onChange={(e) => setStyle(e.target.value as StylePreset | "")}
              className="border-border bg-background h-8 w-full rounded border text-sm"
            >
              <option value="">Any</option>
              {STYLE_PRESETS.map((p) => (
                <option key={p} value={p}>
                  {STYLE_PRESET_LABELS[p]}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="gen-n" className="mb-1 block text-xs font-medium">
              Variants
            </label>
            <select
              id="gen-n"
              data-testid="generation-n"
              value={n}
              onChange={(e) => setN(Number(e.target.value))}
              className="border-border bg-background h-8 w-full rounded border text-sm"
            >
              {[1, 2, 3, 4].map((count) => (
                <option key={count} value={count}>
                  {count}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-end pb-1">
            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                data-testid="generation-use-brand"
                checked={useBrandPalette}
                onChange={(e) => setUseBrandPalette(e.target.checked)}
              />
              Use brand palette
              {(brand.data?.paletteJson?.length ?? 0) === 0 && (
                <span className="text-muted-foreground">(none set yet)</span>
              )}
            </label>
          </div>
        </div>

        <Button
          type="submit"
          size="sm"
          disabled={!prompt.trim() || generate.isPending}
          data-testid="generation-submit"
        >
          {generate.isPending ? "Starting…" : "Generate"}
        </Button>
      </form>

      {error && (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      )}

      {statusLabel && (
        <p
          data-testid="generation-job-status"
          data-status={jobStatus === "idle" && waiting ? "generating" : jobStatus}
          className="text-muted-foreground text-sm"
        >
          {statusLabel}
        </p>
      )}

      {ready && (
        <div className="space-y-3">
          <p className="text-xs font-medium">Versions — click to select &amp; promote</p>
          <div data-testid="generation-variants" className="flex flex-wrap gap-2">
            {versions.map((v) => (
              <ImageVersionThumb
                key={v.id}
                version={v}
                selected={selectedVersionId === v.id}
                onSelect={() => {
                  if (!assetId) return;
                  setSelectedVersionId(v.id);
                  promote.mutate({ assetId, versionId: v.id });
                }}
              />
            ))}
          </div>

          <form onSubmit={handleEdit} className="space-y-2 border-t border-border pt-3">
            <label htmlFor="gen-edit" className="mb-1 block text-xs font-medium">
              Edit selected version
            </label>
            <textarea
              id="gen-edit"
              data-testid="generation-edit-instruction"
              value={editInstruction}
              onChange={(e) => setEditInstruction(e.target.value)}
              rows={2}
              placeholder="Describe the change…"
              disabled={!selectedVersionId || edit.isPending}
              className="border-border focus-visible:ring-primary w-full resize-none rounded-md border bg-transparent px-3 py-2 text-sm outline-none focus-visible:ring-2 disabled:opacity-50"
            />
            <Button
              type="submit"
              size="sm"
              variant="outline"
              disabled={!selectedVersionId || !editInstruction.trim() || edit.isPending || busy}
              data-testid="generation-edit-submit"
            >
              {edit.isPending ? "Starting edit…" : "Apply edit"}
            </Button>
          </form>

          {taskId && asset.data?.currentVersionId && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              data-testid="generation-attach"
              disabled={attach.isPending || busy}
              onClick={() => {
                if (!assetId) return;
                attach.mutate({ assetId, taskId });
              }}
            >
              {attach.isSuccess ? "Attached to task" : "Attach current to task"}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
