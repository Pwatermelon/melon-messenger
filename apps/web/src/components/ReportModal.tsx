import { useEffect, useRef, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { submitReport, uploadFileWithProgress } from "../api";
import { compressImage } from "../utils/imageCompress";
import { isUploadWithinLimit, MAX_UPLOAD_MB, uploadTooLargeMessage } from "@melon/shared";

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

function isVideoFile(file: File): boolean {
  return file.type.startsWith("video/") || /\.(mp4|webm|mov|mkv|avi)$/i.test(file.name);
}

export default function ReportModal({ open, onClose }: Props) {
  const { token } = useAuth();
  const [category, setCategory] = useState("service");
  const [message, setMessage] = useState("");
  const [attachment, setAttachment] = useState<File | null>(null);
  const [attachmentPreview, setAttachmentPreview] = useState<string | null>(null);
  const [uploadPct, setUploadPct] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const previewRef = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      if (previewRef.current) {
        URL.revokeObjectURL(previewRef.current);
        previewRef.current = null;
      }
    };
  }, []);

  if (!open) return null;

  function clearAttachment() {
    if (previewRef.current) {
      URL.revokeObjectURL(previewRef.current);
      previewRef.current = null;
    }
    setAttachmentPreview(null);
    setAttachment(null);
  }

  function handleAttachmentPick(file: File | null) {
    clearAttachment();
    if (!file) return;
    if (!isUploadWithinLimit(file.size)) {
      setError(uploadTooLargeMessage());
      return;
    }
    setError("");
    setAttachment(file);
    const url = URL.createObjectURL(file);
    previewRef.current = url;
    setAttachmentPreview(url);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    setBusy(true);
    setError("");
    setUploadPct(null);
    try {
      let screenshotUrl: string | undefined;
      if (attachment) {
        if (!isUploadWithinLimit(attachment.size)) {
          throw new Error(uploadTooLargeMessage());
        }
        const toUpload =
          attachment.type.startsWith("image/") && !isVideoFile(attachment)
            ? await compressImage(attachment)
            : attachment;
        if (!isUploadWithinLimit(toUpload.size)) {
          throw new Error(uploadTooLargeMessage());
        }
        const uploaded = await uploadFileWithProgress(toUpload, (pct) => setUploadPct(pct), {
          purpose: "report",
        });
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
      clearAttachment();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось отправить");
    } finally {
      setBusy(false);
      setUploadPct(null);
    }
  }

  function handleClose() {
    setDone(false);
    setError("");
    clearAttachment();
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
            <p className="report-hint">
              Опишите, что пошло не так. Можно приложить скриншот или видео (до {MAX_UPLOAD_MB} МБ).
            </p>

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
              <span>Фото или видео (необязательно)</span>
              <input
                type="file"
                accept="image/*,video/*"
                disabled={busy}
                onChange={(e) => handleAttachmentPick(e.target.files?.[0] ?? null)}
              />
            </label>

            {attachment && attachmentPreview && (
              <div className="report-attachment-preview">
                {isVideoFile(attachment) ? (
                  <video src={attachmentPreview} controls playsInline className="report-attachment-video" />
                ) : (
                  <img src={attachmentPreview} alt="" className="report-attachment-image" />
                )}
                <button type="button" className="report-attachment-remove" onClick={clearAttachment} disabled={busy}>
                  Убрать
                </button>
              </div>
            )}

            {uploadPct != null && uploadPct < 100 && (
              <p className="report-upload-progress">Загрузка вложения: {uploadPct}%</p>
            )}

            {error && <p className="auth-error">{error}</p>}

            <button type="submit" className="report-submit-btn" disabled={busy || message.trim().length < 10}>
              {busy ? (uploadPct != null && uploadPct < 100 ? `Загрузка ${uploadPct}%…` : "Отправка…") : "Отправить"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
