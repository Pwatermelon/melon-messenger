import { useCallback, useEffect, useMemo, useState } from "react";
import type { StickerItem, StickerPackDetail, StickerPackSummary } from "@melon/shared";
import { getStickerPack, getStickerPacksLibrary } from "../api";
import { EMOJI_GROUPS } from "../utils/emojiData";

type Props = {
  onPickEmoji: (emoji: string) => void;
  onPickSticker: (sticker: StickerItem, pack: StickerPackSummary) => void;
  onClose: () => void;
};

export default function ComposeEmojiStickerPanel({ onPickEmoji, onPickSticker, onClose }: Props) {
  const [tab, setTab] = useState<"emoji" | "stickers">("emoji");
  const [packs, setPacks] = useState<StickerPackSummary[]>([]);
  const [packsLoading, setPacksLoading] = useState(false);
  const [activePackId, setActivePackId] = useState<string | null>(null);
  const [packDetail, setPackDetail] = useState<StickerPackDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const loadLibrary = useCallback(() => {
    setPacksLoading(true);
    void getStickerPacksLibrary()
      .then(({ owned, installed }) => {
        const all = [...owned, ...installed.filter((p) => !owned.some((o) => o.id === p.id))];
        setPacks(all);
        if (all.length > 0) setActivePackId((cur) => cur ?? all[0]!.id);
      })
      .catch(() => setPacks([]))
      .finally(() => setPacksLoading(false));
  }, []);

  useEffect(() => {
    if (tab === "stickers") loadLibrary();
  }, [tab, loadLibrary]);

  useEffect(() => {
    if (!activePackId || tab !== "stickers") return;
    setDetailLoading(true);
    void getStickerPack(activePackId)
      .then(setPackDetail)
      .catch(() => setPackDetail(null))
      .finally(() => setDetailLoading(false));
  }, [activePackId, tab]);

  const activePack = useMemo(
    () => packs.find((p) => p.id === activePackId) ?? null,
    [packs, activePackId]
  );

  return (
    <div className="compose-emoji-panel">
      <div className="compose-emoji-panel-tabs">
        <button
          type="button"
          className={`compose-emoji-panel-tab${tab === "emoji" ? " is-active" : ""}`}
          onClick={() => setTab("emoji")}
        >
          Эмодзи
        </button>
        <button
          type="button"
          className={`compose-emoji-panel-tab${tab === "stickers" ? " is-active" : ""}`}
          onClick={() => setTab("stickers")}
        >
          Стикеры
        </button>
        <button type="button" className="compose-emoji-panel-close" onClick={onClose} aria-label="Закрыть">
          ×
        </button>
      </div>
      {tab === "emoji" ? (
        <div className="compose-emoji-scroll">
          {EMOJI_GROUPS.map((g) => (
            <div key={g.label} className="compose-emoji-group">
              <p className="compose-emoji-group-label">{g.label}</p>
              <div className="compose-emoji-grid">
                {g.emojis.map((e) => (
                  <button key={e} type="button" className="compose-emoji-btn" onClick={() => onPickEmoji(e)}>
                    {e}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <>
          {packsLoading ? (
            <p className="compose-emoji-hint">Загрузка…</p>
          ) : packs.length === 0 ? (
            <p className="compose-emoji-hint">
              Нет стикерпаков. Создайте или добавьте в настройках.
            </p>
          ) : (
            <>
              <div className="compose-sticker-pack-tabs">
                {packs.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className={`compose-sticker-pack-tab${p.id === activePackId ? " is-active" : ""}`}
                    title={p.title}
                    onClick={() => setActivePackId(p.id)}
                  >
                    {p.title.slice(0, 2)}
                  </button>
                ))}
              </div>
              {detailLoading ? (
                <p className="compose-emoji-hint">Загрузка…</p>
              ) : packDetail && activePack ? (
                <div className="compose-sticker-grid">
                  {packDetail.stickers.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      className="compose-sticker-btn"
                      title={s.emoji}
                      onClick={() => onPickSticker(s, activePack)}
                    >
                      <img src={s.imageUrl} alt={s.emoji} loading="lazy" />
                    </button>
                  ))}
                </div>
              ) : (
                <p className="compose-emoji-hint">Стикеров пока нет</p>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
