import { EMOJI_GROUPS } from "../utils/emojiData";

type Props = {
  onPick: (emoji: string) => void;
  onClose: () => void;
  title?: string;
};

export function EmojiPickerGrid({ onPick }: { onPick: (emoji: string) => void }) {
  return (
    <div className="compose-emoji-scroll">
      {EMOJI_GROUPS.map((g) => (
        <div key={g.label} className="compose-emoji-group">
          <p className="compose-emoji-group-label">{g.label}</p>
          <div className="compose-emoji-grid">
            {g.emojis.map((e) => (
              <button key={e} type="button" className="compose-emoji-btn" onClick={() => onPick(e)}>
                {e}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function EmojiPickerPanel({ onPick, onClose, title = "Эмодзи" }: Props) {
  return (
    <div className="compose-emoji-panel sticker-pack-emoji-picker">
      <div className="compose-emoji-panel-tabs">
        <span className="compose-emoji-panel-tab is-active">{title}</span>
        <button type="button" className="compose-emoji-panel-close" onClick={onClose} aria-label="Закрыть">
          ×
        </button>
      </div>
      <EmojiPickerGrid onPick={onPick} />
    </div>
  );
}
