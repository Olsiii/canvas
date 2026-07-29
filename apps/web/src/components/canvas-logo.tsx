import { cn } from "@/lib/utils";

/** Brand mark — the circular Canvas emblem on a black square. */
export function CanvasLogo({
  className,
  size = 72,
  alt = "Canvas",
}: {
  className?: string;
  size?: number;
  alt?: string;
}) {
  return (
    <img
      src="/canvas-logo.png"
      alt={alt}
      width={size}
      height={size}
      className={cn("bg-black shrink-0 rounded-lg object-contain", className)}
      decoding="async"
    />
  );
}
