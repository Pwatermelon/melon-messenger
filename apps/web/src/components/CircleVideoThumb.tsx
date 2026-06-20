import { useEffect, useRef } from "react";
import { attachVideoPreviewHandlers } from "../utils/videoPreview";

type Props = {
  src: string;
  poster?: string | null;
  className?: string;
};

export function CircleVideoThumb({ src, poster, className = "chat-info-circle-thumb" }: Props) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    return attachVideoPreviewHandlers(video);
  }, [src, poster]);

  return (
    <video
      ref={ref}
      src={src}
      poster={poster ?? undefined}
      muted
      playsInline
      preload={poster ? "none" : "auto"}
      className={className}
    />
  );
}
