import { useState } from "react";

const PLACEHOLDER_IMAGE =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='520'%3E%3Crect width='400' height='520' fill='%232f1b1e'/%3E%3C/svg%3E";

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
  const [failed, setFailed] = useState(false);
  const showBottle = src !== null && !failed;

  return (
    <div className={`bg-surface-raised overflow-hidden ${className}`}>
      <img
        src={showBottle ? src : PLACEHOLDER_IMAGE}
        alt={alt}
        loading={eager ? "eager" : "lazy"}
        decoding="async"
        width={600}
        height={900}
        onError={() => setFailed(true)}
        className={
          showBottle
            ? "w-full h-full object-contain p-3 drop-shadow-[0_8px_12px_rgba(0,0,0,0.35)]"
            : "w-full h-full object-cover"
        }
      />
    </div>
  );
}
