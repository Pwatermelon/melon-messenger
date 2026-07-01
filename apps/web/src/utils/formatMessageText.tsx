import emojiRegex from "emoji-regex";
import { Fragment, type ReactNode } from "react";
import { AppleEmoji } from "../components/AppleEmoji";

const URL_RE = /(?:https?:\/\/|www\.)[^\s<]+/gi;

function trimTrailingPunctuation(url: string): { href: string; trailing: string } {
  let href = url;
  let trailing = "";
  while (href.length > 0 && /[.,;:!?)\]}>]$/.test(href)) {
    trailing = href.slice(-1) + trailing;
    href = href.slice(0, -1);
  }
  return { href, trailing };
}

function toHref(url: string): string {
  return url.startsWith("www.") ? `https://${url}` : url;
}

function emojifyPlainText(text: string, keyPrefix: string): ReactNode[] {
  const re = emojiRegex();
  const parts: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let emojiIndex = 0;

  while ((match = re.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    const glyph = match[0];
    parts.push(<AppleEmoji key={`${keyPrefix}-e${emojiIndex++}`} emoji={glyph} />);
    lastIndex = match.index + glyph.length;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length ? parts : [text];
}

/** Message text with Apple-style emoji images and clickable links. */
export function formatMessageText(text: string): ReactNode {
  const nodes: ReactNode[] = [];
  let lastIndex = 0;
  const re = new RegExp(URL_RE.source, "gi");
  let match: RegExpExecArray | null;
  let segment = 0;

  while ((match = re.exec(text)) !== null) {
    const raw = match[0];
    if (match.index > lastIndex) {
      nodes.push(...emojifyPlainText(text.slice(lastIndex, match.index), `t${segment++}`));
    }
    const { href, trailing } = trimTrailingPunctuation(raw);
    if (href) {
      nodes.push(
        <a
          key={`${match.index}-${href}`}
          href={toHref(href)}
          target="_blank"
          rel="noopener noreferrer"
          className="message-link"
        >
          {href}
        </a>
      );
    } else {
      nodes.push(...emojifyPlainText(raw, `u${segment++}`));
    }
    if (trailing) nodes.push(...emojifyPlainText(trailing, `p${segment++}`));
    lastIndex = match.index + raw.length;
  }

  if (lastIndex < text.length) {
    nodes.push(...emojifyPlainText(text.slice(lastIndex), `tail`));
  }

  if (nodes.length === 0) return emojifyPlainText(text, "all");
  return <>{nodes.map((node, i) => <Fragment key={i}>{node}</Fragment>)}</>;
}

/** Short preview lines (chat list, search) with Apple emoji. */
export function formatPreviewText(text: string): ReactNode {
  const parts = emojifyPlainText(text, "preview");
  if (parts.length === 1 && typeof parts[0] === "string") return parts[0];
  return <>{parts.map((node, i) => <Fragment key={i}>{node}</Fragment>)}</>;
}
