export type PeerActivityKind = "typing" | "voice" | "circle";

const KIND_LABEL: Record<PeerActivityKind, string> = {
  typing: "печатает…",
  voice: "записывает голосовое…",
  circle: "записывает кружок…",
};

export function formatPeerActivity(
  activities: Map<string, PeerActivityKind>,
  namesById: Map<string, string>,
  isGroup: boolean
): string | null {
  const entries = [...activities.entries()];
  if (!entries.length) return null;

  if (!isGroup && entries.length === 1) {
    return KIND_LABEL[entries[0]![1]];
  }

  const labels = entries.map(([userId, kind]) => {
    const name = namesById.get(userId) ?? "Кто-то";
    return `${name} ${KIND_LABEL[kind]}`;
  });
  if (labels.length === 1) return labels[0]!;
  if (labels.length === 2) return `${labels[0]} · ${labels[1]}`;
  return `${labels[0]} · ещё ${labels.length - 1}`;
}
