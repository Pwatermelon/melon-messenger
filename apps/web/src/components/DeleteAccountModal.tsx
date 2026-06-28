import { useEffect, useState } from "react";
import { deleteAccount } from "../api";
import { useOverlayDismiss } from "../hooks/useOverlayDismiss";

const CONFIRM_PHRASE = "УДАЛИТЬ";
const COUNTDOWN_SEC = 10;

type Props = {
  open: boolean;
  onClose: () => void;
  onDeleted: () => void;
};

export default function DeleteAccountModal({ open, onClose, onDeleted }: Props) {
  const overlayDismiss = useOverlayDismiss(onClose);
  const [step, setStep] = useState<"warning" | "confirm">("warning");
  const [acknowledged, setAcknowledged] = useState(false);
  const [phrase, setPhrase] = useState("");
  const [countdown, setCountdown] = useState(COUNTDOWN_SEC);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) {
      setStep("warning");
      setAcknowledged(false);
      setPhrase("");
      setCountdown(COUNTDOWN_SEC);
      setError("");
      setBusy(false);
    }
  }, [open]);

  useEffect(() => {
    if (!open || step !== "confirm") return;
    setCountdown(COUNTDOWN_SEC);
    const timer = window.setInterval(() => {
      setCountdown((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [open, step]);

  if (!open) return null;

  const phraseOk = phrase.trim() === CONFIRM_PHRASE;
  const canDelete = phraseOk && countdown === 0 && !busy;

  async function handleDelete() {
    if (!canDelete) return;
    setBusy(true);
    setError("");
    try {
      await deleteAccount(CONFIRM_PHRASE);
      onDeleted();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось удалить аккаунт");
      setBusy(false);
    }
  }

  function handleClose() {
    if (busy) return;
    onClose();
  }

  return (
    <div
      className="delete-account-overlay"
      onPointerDown={overlayDismiss.onOverlayPointerDown}
      onClick={(e) => overlayDismiss.onOverlayClick(e)}
      role="dialog"
      aria-modal="true"
      aria-label="Удаление аккаунта"
    >
      <div className="delete-account-modal" onPointerDown={overlayDismiss.onModalPointerDown}>
        <header className="delete-account-header">
          <h2>Удаление аккаунта</h2>
          <button
            type="button"
            className="modal-close"
            onClick={handleClose}
            disabled={busy}
            aria-label="Закрыть"
          >
            ×
          </button>
        </header>

        <div className="delete-account-body">
          {step === "warning" ? (
            <>
              <p className="delete-account-lead">
                Это действие необратимо. Будут удалены:
              </p>
              <ul className="delete-account-list">
                <li>профиль, аватар, обложка и фото;</li>
                <li>личные переписки (диалоги удаляются полностью);</li>
                <li>ваши сообщения в групповых чатах;</li>
                <li>контакты, папки, стикерпаки и подписки на уведомления;</li>
                <li>история платежей и согласий в сервисе.</li>
              </ul>
              <p className="delete-account-note">
                После удаления восстановить данные нельзя. При следующей авторизации через Яндекс ID создастся
                новый профиль.
              </p>
              <label className="delete-account-check">
                <input
                  type="checkbox"
                  checked={acknowledged}
                  onChange={(e) => setAcknowledged(e.target.checked)}
                />
                <span>Я понимаю, что данные нельзя восстановить</span>
              </label>
              <div className="delete-account-actions">
                <button type="button" className="delete-account-cancel" onClick={handleClose}>
                  Отмена
                </button>
                <button
                  type="button"
                  className="delete-account-next"
                  disabled={!acknowledged}
                  onClick={() => setStep("confirm")}
                >
                  Продолжить
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="delete-account-lead">
                Введите <strong>{CONFIRM_PHRASE}</strong> и подождите {COUNTDOWN_SEC} секунд перед удалением.
              </p>
              <label className="delete-account-field">
                <span>Подтверждение</span>
                <input
                  type="text"
                  value={phrase}
                  onChange={(e) => setPhrase(e.target.value)}
                  placeholder={CONFIRM_PHRASE}
                  autoComplete="off"
                  spellCheck={false}
                  disabled={busy}
                />
              </label>
              {error && <p className="delete-account-error">{error}</p>}
              <div className="delete-account-actions">
                <button
                  type="button"
                  className="delete-account-cancel"
                  onClick={() => setStep("warning")}
                  disabled={busy}
                >
                  Назад
                </button>
                <button
                  type="button"
                  className="delete-account-danger"
                  disabled={!canDelete}
                  onClick={() => void handleDelete()}
                >
                  {busy
                    ? "Удаление…"
                    : countdown > 0
                      ? `Удалить (${countdown})`
                      : "Удалить аккаунт"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
