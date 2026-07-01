/** Apple-style emoji PNGs (emoji-datasource-apple, consistent across platforms). */
const EMOJI_CDN = "https://cdn.jsdelivr.net/npm/emoji-datasource-apple@15.1.1/img/apple/64";

export function emojiToUnified(emoji: string): string {
  const points: string[] = [];
  let i = 0;
  while (i < emoji.length) {
    const cp = emoji.codePointAt(i)!;
    points.push(cp.toString(16));
    i += cp > 0xffff ? 2 : 1;
  }
  return points.join("-").toLowerCase();
}

export function appleEmojiUrl(emoji: string): string {
  return `${EMOJI_CDN}/${emojiToUnified(emoji)}.png`;
}
