import { useState } from "react";

const PLACEHOLDER_IMAGE =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='520'%3E%3Crect width='400' height='520' fill='none'/%3E%3C/svg%3E";

export function WineImage({
  src,
  alt,
  className = "",
  eager = false,
}: {
  src: string | null;
  alt: string;
  className?: string;
  eager?: boolean;
}) {
  // Tracks *which* src last failed, rather than a plain boolean, so a new src
  // (e.g. navigating from one wine's detail page to another's) isn't stuck
  // showing the placeholder from a previous image's error.
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const showBottle = !!src && failedSrc !== src;

  return (
    <div className={`bg-image-panel overflow-hidden ${className}`}>
      <img
        src={showBottle ? src : PLACEHOLDER_IMAGE}
        alt={alt}
        loading={eager ? "eager" : "lazy"}
        decoding="async"
        width={600}
        height={900}
        onError={() => setFailedSrc(src)}
        className={
          showBottle
            ? "w-full h-full object-contain p-3 drop-shadow-[0_8px_12px_rgba(0,0,0,0.35)]"
            : "w-full h-full object-cover"
        }
      />
    </div>
  );
}
