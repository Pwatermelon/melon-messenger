import type { ReactNode } from "react";
import type { User } from "@melon/shared";

export type SystemMention = { userId: string; username: string };

function uniqueMentions(mentions: SystemMention[]): SystemMention[] {
  const seen = new Set<string>();
  const out: SystemMention[] = [];
  for (const m of mentions) {
    const key = m.userId.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    if (m.username.trim()) out.push(m);
  }
  return out;
}

function mentionsFromMembers(members: User[], content: string): SystemMention[] {
  const hits: SystemMention[] = [];
  for (const m of members) {
    if (m.username && content.includes(m.username)) {
      hits.push({ userId: m.id, username: m.username });
    }
  }
  return uniqueMentions(hits).sort((a, b) => b.username.length - a.username.length);
}

/** Render group system text with profile links on usernames. */
export function buildSystemMessageNodes(
  content: string,
  onOpenProfile: (userId: string) => void,
  opts?: { mentions?: SystemMention[]; members?: User[] }
): ReactNode {
  const mentions = uniqueMentions(
    opts?.mentions?.length ? opts.mentions : mentionsFromMembers(opts?.members ?? [], content)
  );
  if (mentions.length === 0) return content;

  type Segment = { kind: "text"; value: string } | { kind: "user"; mention: SystemMention };
  let segments: Segment[] = [{ kind: "text", value: content }];

  for (const mention of mentions) {
    const next: Segment[] = [];
    for (const seg of segments) {
      if (seg.kind === "user") {
        next.push(seg);
        continue;
      }
      let rest = seg.value;
      while (rest.length > 0) {
        const idx = rest.indexOf(mention.username);
        if (idx < 0) {
          next.push({ kind: "text", value: rest });
          break;
        }
        if (idx > 0) next.push({ kind: "text", value: rest.slice(0, idx) });
        next.push({ kind: "user", mention });
        rest = rest.slice(idx + mention.username.length);
      }
    }
    segments = next;
  }

  return segments.map((seg, i) =>
    seg.kind === "text" ? (
      <span key={i}>{seg.value}</span>
    ) : (
      <button
        key={`${seg.mention.userId}-${i}`}
        type="button"
        className="system-message-user-link"
        onClick={(e) => {
          e.stopPropagation();
          onOpenProfile(seg.mention.userId);
        }}
      >
        {seg.mention.username}
      </button>
    )
  );
}
