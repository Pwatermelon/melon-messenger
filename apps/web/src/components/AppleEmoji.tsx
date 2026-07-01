import { useState } from "react";
import { appleEmojiUrl } from "../utils/appleEmoji";

type Props = {
  emoji: string;
  size?: number;
  className?: string;
  title?: string;
};

export function AppleEmoji({ emoji, size = 20, className = "", title }: Props) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <span className={`apple-emoji-fallback ${className}`.trim()} title={title} aria-hidden>
        {emoji}
      </span>
    );
  }

  return (
    <img
      src={appleEmojiUrl(emoji)}
      alt={title ?? emoji}
      className={`apple-emoji ${className}`.trim()}
      width={size}
      height={size}
      draggable={false}
      decoding="async"
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}
