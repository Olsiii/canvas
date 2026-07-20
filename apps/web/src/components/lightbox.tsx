import { useEffect } from "react";

interface LightboxImage {
  id: string;
  fileName: string;
}

// Full-res on demand: the grid only ever loads thumbnails (see
// BlurhashThumb); the original is fetched here for the first time, only
// once a user actually opens it.
export function Lightbox({
  images,
  index,
  onClose,
  onIndexChange,
}: {
  images: LightboxImage[];
  index: number;
  onClose: () => void;
  onIndexChange: (index: number) => void;
}) {
  const image = images[index];

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") onIndexChange((index + 1) % images.length);
      if (e.key === "ArrowLeft") onIndexChange((index - 1 + images.length) % images.length);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [index, images.length, onClose, onIndexChange]);

  if (!image) return null;

  return (
    <div
      data-testid="lightbox"
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80"
    >
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute top-4 right-4 text-2xl text-white hover:opacity-75"
      >
        ✕
      </button>

      {images.length > 1 && (
        <>
          <button
            type="button"
            aria-label="Previous image"
            onClick={() => onIndexChange((index - 1 + images.length) % images.length)}
            className="absolute left-4 text-3xl text-white hover:opacity-75"
          >
            ‹
          </button>
          <button
            type="button"
            aria-label="Next image"
            onClick={() => onIndexChange((index + 1) % images.length)}
            className="absolute right-4 text-3xl text-white hover:opacity-75"
          >
            ›
          </button>
        </>
      )}

      <img
        src={`/uploads/${image.id}`}
        alt={image.fileName}
        className="max-h-[90vh] max-w-[90vw] object-contain"
      />
    </div>
  );
}
