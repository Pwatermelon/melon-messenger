import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { getLegalStatus, type LegalStatus } from "../api";
import LegalUpdateModal from "./LegalUpdateModal";

export default function LegalGate({ children }: { children: React.ReactNode }) {
  const { user, token } = useAuth();
  const [status, setStatus] = useState<LegalStatus | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user || !token) {
      setStatus(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    getLegalStatus()
      .then((s) => {
        if (!cancelled) setStatus(s);
      })
      .catch(() => {
        if (!cancelled) setStatus(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [user, token]);

  const mustAccept = Boolean(user && token && status && !status.upToDate);
  const blocking = Boolean(user && token && (loading || mustAccept));

  return (
    <>
      <div className={blocking ? "legal-gate-blocked" : undefined}>{children}</div>
      {user && token && loading && (
        <div className="legal-update-overlay legal-update-overlay-loading" aria-busy="true">
          <div className="legal-update-modal legal-update-modal-compact">
            <p className="legal-update-lead">Проверка документов…</p>
          </div>
        </div>
      )}
      {mustAccept && status && (
        <LegalUpdateModal
          status={status}
          onAccepted={() => {
            getLegalStatus().then(setStatus).catch(() => {});
          }}
        />
      )}
    </>
  );
}
