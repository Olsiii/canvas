import { decode } from "blurhash";
import { useEffect, useRef, useState } from "react";

const BLURHASH_CANVAS_SIZE = 32;

export function ImageVersionThumb({
  version,
  selected,
  onSelect,
}: {
  version: {
    id: string;
    blurhash: string | null;
  };
  selected?: boolean;
  onSelect?: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!version.blurhash || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const pixels = decode(version.blurhash, BLURHASH_CANVAS_SIZE, BLURHASH_CANVAS_SIZE);
    const imageData = ctx.createImageData(BLURHASH_CANVAS_SIZE, BLURHASH_CANVAS_SIZE);
    imageData.data.set(pixels);
    ctx.putImageData(imageData, 0, 0);
  }, [version.blurhash]);

  return (
    <button
      type="button"
      onClick={onSelect}
      data-testid={`image-version-${version.id}`}
      aria-label={selected ? "Current variant" : "Select this variant"}
      title={selected ? "Current variant" : "Select this variant"}
      aria-pressed={selected}
      className={`relative block h-28 w-28 overflow-hidden rounded-md border ${
        selected ? "border-primary ring-primary ring-2" : "border-border"
      }`}
    >
      {version.blurhash && (
        <canvas
          ref={canvasRef}
          width={BLURHASH_CANVAS_SIZE}
          height={BLURHASH_CANVAS_SIZE}
          className={`absolute inset-0 h-full w-full transition-opacity duration-200 ${
            loaded ? "opacity-0" : "opacity-100"
          }`}
        />
      )}
      <img
        src={`/image-versions/${version.id}/thumb`}
        alt="Generated variant"
        onLoad={() => setLoaded(true)}
        className="relative h-28 w-28 object-cover"
      />
    </button>
  );
}
