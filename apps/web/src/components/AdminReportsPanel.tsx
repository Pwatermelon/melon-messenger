import { useEffect, useState } from "react";
import { getAdminReports, resolveAdminReport, type AdminReport } from "../api";
import { mediaUrl } from "../utils/mediaUrl";

const CATEGORY_LABELS: Record<string, string> = {
  bug: "Баг",
  service: "Приложение",
  content: "Контент",
  account: "Аккаунт",
  other: "Другое",
};

type Props = {
  active?: boolean;
};

export default function AdminReportsPanel({ active = true }: Props) {
  const [filter, setFilter] = useState<"open" | "resolved" | "all">("open");
  const [reports, setReports] = useState<AdminReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (!active) return;
    void load();
  }, [active, filter]);

  async function load() {
    setLoading(true);
    setError("");
    try {
      setReports(await getAdminReports(filter === "all" ? undefined : filter));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка загрузки");
    } finally {
      setLoading(false);
    }
  }

  async function handleResolve(id: string) {
    const note = window.prompt("Комментарий администратора (необязательно):") ?? "";
    setBusyId(id);
    try {
      await resolveAdminReport(id, note.trim() || undefined);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось закрыть");
    } finally {
      setBusyId(null);
    }
  }

  const openCount = reports.filter((r) => r.status === "open").length;

  return (
    <div className="admin-reports">
      <div className="admin-reports-filters" role="tablist">
        {(["open", "resolved", "all"] as const).map((f) => (
          <button
            key={f}
            type="button"
            role="tab"
            aria-selected={filter === f}
            className={`admin-reports-filter${filter === f ? " active" : ""}`}
            onClick={() => setFilter(f)}
          >
            {f === "open" ? `Открытые (${filter === "open" ? openCount : "…"})` : f === "resolved" ? "Закрытые" : "Все"}
          </button>
        ))}
      </div>

      {error && <p className="admin-console-error">{error}</p>}
      {loading ? (
        <p className="admin-console-muted">Загрузка жалоб…</p>
      ) : reports.length === 0 ? (
        <p className="admin-console-muted">Жалоб нет</p>
      ) : (
        <ul className="admin-reports-list">
          {reports.map((r) => (
            <li key={r.id} className={`admin-report-row admin-report-${r.status}`}>
              <div className="admin-report-head">
                <span className={`admin-report-status admin-report-status-${r.status}`}>
                  {r.status === "open" ? "Открыта" : "Закрыта"}
                </span>
                <span className="admin-report-meta">
                  {CATEGORY_LABELS[r.category] ?? r.category} ·{" "}
                  {r.user.yandexLogin ?? r.user.username} · {new Date(r.createdAt).toLocaleString("ru-RU")}
                </span>
              </div>
              <p className="admin-report-message">{r.message}</p>
              {r.pageUrl && (
                <p className="admin-report-url">
                  <a href={r.pageUrl} target="_blank" rel="noopener noreferrer">
                    {r.pageUrl}
                  </a>
                </p>
              )}
              {r.screenshotUrl && (() => {
                const src = mediaUrl(r.screenshotUrl);
                const isVideo = /\.(mp4|webm|mov|mkv|avi)(\?|$)/i.test(r.screenshotUrl);
                return isVideo ? (
                  <div className="admin-report-media">
                    <video src={src} controls playsInline className="admin-report-video" preload="metadata" />
                    <a href={src} target="_blank" rel="noopener noreferrer" className="admin-report-screenshot-link">
                      Открыть видео
                    </a>
                  </div>
                ) : (
                  <a
                    href={src}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="admin-report-screenshot-link"
                  >
                    Открыть вложение
                  </a>
                );
              })()}
              {r.adminNote && <p className="admin-report-note">Заметка: {r.adminNote}</p>}
              {r.status === "open" && (
                <button
                  type="button"
                  className="admin-report-resolve-btn"
                  disabled={busyId === r.id}
                  onClick={() => void handleResolve(r.id)}
                >
                  {busyId === r.id ? "…" : "Отметить решённой"}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
