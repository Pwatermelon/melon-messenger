import { useEffect, useState } from "react";
import { getAdminLegalAcceptances, type AdminLegalAcceptance } from "../api";

const DOC_LABELS: Record<string, string> = {
  personal_data: "Согласие ПДн",
  terms: "Оферта",
  privacy: "Политика",
};

type Props = {
  active?: boolean;
};

export default function AdminLegalPanel({ active = true }: Props) {
  const [rows, setRows] = useState<AdminLegalAcceptance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!active) return;
    void load();
  }, [active]);

  async function load() {
    setLoading(true);
    setError("");
    try {
      setRows(await getAdminLegalAcceptances());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка загрузки");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="admin-legal">
      <p className="admin-console-muted">
        Журнал принятия юридических документов (аудит 152-ФЗ). Каждый вход фиксирует batch из трёх записей.
      </p>
      {error && <p className="admin-console-error">{error}</p>}
      {loading ? (
        <p className="admin-console-muted">Загрузка…</p>
      ) : rows.length === 0 ? (
        <p className="admin-console-muted">Записей пока нет</p>
      ) : (
        <ul className="admin-legal-list">
          {rows.map((r) => (
            <li key={r.id} className="admin-legal-row">
              <div className="admin-legal-head">
                <strong>{DOC_LABELS[r.documentType] ?? r.documentType}</strong>
                <span className="admin-legal-meta">v{r.documentVersion}</span>
              </div>
              <div className="admin-legal-user">
                {r.user.yandexLogin ?? r.user.username} · batch {r.batchId.slice(0, 8)}…
              </div>
              <div className="admin-legal-meta">
                {new Date(r.acceptedAt).toLocaleString("ru-RU")}
                {r.ipAddress ? ` · IP ${r.ipAddress}` : ""}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
