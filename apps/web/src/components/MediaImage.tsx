import { useEffect, useState, type ReactNode } from "react";
import { resolveMediaBlobUrl } from "../utils/mediaImageCache";

type Props = {
  src: string;
  alt?: string;
  className?: string;
  /** Shown under the image until fully decoded */
  placeholder?: ReactNode;
  eager?: boolean;
  onLoad?: () => void;
  onError?: () => void;
};

export function MediaImage({
  src,
  alt = "",
  className = "",
  placeholder = null,
  eager = false,
  onLoad,
  onError,
}: Props) {
  const [resolvedSrc, setResolvedSrc] = useState<string | null>(src.startsWith("blob:") ? src : null);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoaded(false);
    setFailed(false);

    if (!src) {
      setResolvedSrc(null);
      return;
    }

    if (src.startsWith("blob:")) {
      setResolvedSrc(src);
      return;
    }

    setResolvedSrc(null);
    void resolveMediaBlobUrl(src).then((url) => {
      if (!cancelled) setResolvedSrc(url);
    });

    return () => {
      cancelled = true;
    };
  }, [src]);

  if (!src || failed) return placeholder ? <>{placeholder}</> : null;

  return (
    <span className={`media-image-shell${loaded ? " is-loaded" : ""}`}>
      {!loaded && placeholder}
      {resolvedSrc ? (
        <img
          src={resolvedSrc}
          alt={alt}
          className={`media-image${className ? ` ${className}` : ""}`}
          decoding="async"
          loading={eager ? "eager" : "lazy"}
          fetchPriority={eager ? "high" : "auto"}
          draggable={false}
          onLoad={() => {
            setLoaded(true);
            onLoad?.();
          }}
          onError={() => {
            setFailed(true);
            onError?.();
          }}
        />
      ) : null}
    </span>
  );
}
