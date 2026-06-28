import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { submitReport, uploadFile } from "../api";
import { compressImage } from "../utils/imageCompress";

const CATEGORIES: Array<{ id: string; label: string }> = [
  { id: "bug", label: "Ошибка / баг" },
  { id: "service", label: "Работа приложения" },
  { id: "content", label: "Контент / сообщения" },
  { id: "account", label: "Аккаунт / доступ" },
  { id: "other", label: "Другое" },
];

type Props = {
  open: boolean;
  onClose: () => void;
};

export default function ReportModal({ open, onClose }: Props) {
  const { token } = useAuth();
  const [category, setCategory] = useState("service");
  const [message, setMessage] = useState("");
  const [screenshot, setScreenshot] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    setBusy(true);
    setError("");
    try {
      let screenshotUrl: string | undefined;
      if (screenshot) {
        const file = screenshot.type.startsWith("image/") ? await compressImage(screenshot) : screenshot;
        const uploaded = await uploadFile(file, { purpose: "report" });
        screenshotUrl = uploaded.url.startsWith("http")
          ? new URL(uploaded.url).pathname
          : uploaded.url;
      }
      await submitReport({
        message: message.trim(),
        category,
        pageUrl: window.location.href,
        screenshotUrl,
      });
      setDone(true);
      setMessage("");
      setScreenshot(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось отправить");
    } finally {
      setBusy(false);
    }
  }

  function handleClose() {
    setDone(false);
    setError("");
    onClose();
  }

  return (
    <div
      className="report-modal-overlay"
      onClick={(e) => e.target === e.currentTarget && handleClose()}
      role="dialog"
      aria-modal="true"
      aria-label="Сообщить о проблеме"
    >
      <div className="report-modal">
        <header className="report-modal-header">
          <h2>Сообщить о проблеме</h2>
          <button type="button" className="modal-close" onClick={handleClose} aria-label="Закрыть">
            ×
          </button>
        </header>

        {done ? (
          <div className="report-modal-body">
            <p className="report-success">Спасибо! Обращение принято администратором.</p>
            <button type="button" className="report-submit-btn" onClick={handleClose}>
              Закрыть
            </button>
          </div>
        ) : (
          <form className="report-modal-body" onSubmit={(e) => void handleSubmit(e)}>
            <p className="report-hint">Опишите, что пошло не так. Можно приложить скриншот.</p>

            <label className="report-field">
              <span>Категория</span>
              <select value={category} onChange={(e) => setCategory(e.target.value)} disabled={busy}>
                {CATEGORIES.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="report-field">
              <span>Описание</span>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={5}
                minLength={10}
                maxLength={4000}
                required
                disabled={busy}
                placeholder="Что произошло, что ожидали, шаги воспроизведения…"
              />
            </label>

            <label className="report-field">
              <span>Скриншот (необязательно)</span>
              <input
                type="file"
                accept="image/*"
                disabled={busy}
                onChange={(e) => setScreenshot(e.target.files?.[0] ?? null)}
              />
            </label>

            {error && <p className="auth-error">{error}</p>}

            <button type="submit" className="report-submit-btn" disabled={busy || message.trim().length < 10}>
              {busy ? "Отправка…" : "Отправить"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
