import { useState } from "react";
import { Link } from "react-router-dom";
import { acceptLegalDocuments, type LegalStatus } from "../api";

const DOC_META = {
  personal_data: {
    label: "Согласие на обработку персональных данных",
    href: "/legal/personal-data-consent",
  },
  terms: {
    label: "Пользовательское соглашение",
    href: "/legal/terms",
  },
  privacy: {
    label: "Политика конфиденциальности",
    href: "/legal/privacy",
  },
} as const;

type DocKey = keyof typeof DOC_META;

function outdatedDocs(status: LegalStatus): Array<{
  key: DocKey;
  label: string;
  href: string;
  isNew: boolean;
  version: string;
  previousVersion?: string;
}> {
  return (Object.keys(DOC_META) as DocKey[])
    .map((key) => {
      const current = status.current[key];
      const accepted = status.accepted[key];
      if (accepted?.version === current) return null;
      return {
        key,
        ...DOC_META[key],
        isNew: !accepted,
        version: current,
        previousVersion: accepted?.version,
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);
}

type Props = {
  status: LegalStatus;
  onAccepted: () => void;
};

export default function LegalUpdateModal({ status, onAccepted }: Props) {
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const docs = outdatedDocs(status);
  const allNew = docs.every((d) => d.isNew);

  async function handleAccept() {
    if (!confirmed || busy) return;
    setBusy(true);
    setError("");
    try {
      await acceptLegalDocuments(status.current);
      onAccepted();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось сохранить согласие");
      setBusy(false);
    }
  }

  return (
    <div className="legal-update-overlay" role="dialog" aria-modal="true" aria-label="Обновление документов">
      <div className="legal-update-modal">
        <h2>{allNew ? "Примите документы для продолжения" : "Обновлены юридические документы"}</h2>
        <p className="legal-update-lead">
          {allNew
            ? "Для использования Watermelon необходимо ознакомиться и принять актуальные версии документов."
            : "Мы обновили часть документов. Продолжить работу можно только после подтверждения новых версий."}
        </p>

        <ul className="legal-update-docs">
          {docs.map((doc) => (
            <li key={doc.key}>
              <Link to={doc.href}>{doc.label}</Link>
              <span className="legal-update-doc-meta">
                {doc.isNew
                  ? `версия ${doc.version}`
                  : `версия ${doc.previousVersion} → ${doc.version}`}
              </span>
            </li>
          ))}
        </ul>

        <label className="legal-update-check">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
            disabled={busy}
          />
          <span>
            Я ознакомился с документами, даю согласие на обработку персональных данных, принимаю
            пользовательское соглашение и политику конфиденциальности. Мне исполнилось 14 лет.
          </span>
        </label>

        {error && <p className="legal-update-error">{error}</p>}

        <button
          type="button"
          className="legal-update-submit"
          disabled={!confirmed || busy}
          onClick={() => void handleAccept()}
        >
          {busy ? "Сохранение…" : "Принять и продолжить"}
        </button>
      </div>
    </div>
  );
}
