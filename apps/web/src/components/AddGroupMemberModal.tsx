import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import type { User } from "@melon/shared";
import { addGroupMembers, getContacts, searchUser } from "../api";
import { mediaUrl } from "../utils/mediaUrl";
import { userAvatarLetter, userDisplayName, userLoginTag } from "../utils/userDisplay";
import { useOverlayDismiss } from "../hooks/useOverlayDismiss";
import { IconPlus } from "./Icons";

type Props = {
  open: boolean;
  onClose: () => void;
  chatId: string;
  currentUserId: string;
  memberIds: string[];
  onMemberAdded: () => void | Promise<void>;
};

export default function AddGroupMemberModal({
  open,
  onClose,
  chatId,
  currentUserId,
  memberIds,
  onMemberAdded,
}: Props) {
  const overlayDismiss = useOverlayDismiss(onClose);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [addingContactId, setAddingContactId] = useState<string | null>(null);
  const [contacts, setContacts] = useState<User[]>([]);
  const [contactsLoading, setContactsLoading] = useState(false);

  const memberIdSet = useMemo(() => new Set(memberIds.map((id) => id.toLowerCase())), [memberIds]);

  const addableContacts = useMemo(
    () =>
      contacts.filter(
        (c) => c.id.toLowerCase() !== currentUserId.toLowerCase() && !memberIdSet.has(c.id.toLowerCase())
      ),
    [contacts, currentUserId, memberIdSet]
  );

  const reloadContacts = useCallback(() => {
    setContactsLoading(true);
    void getContacts()
      .then(setContacts)
      .catch(() => setContacts([]))
      .finally(() => setContactsLoading(false));
  }, []);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setError("");
      setAddingContactId(null);
      setContacts([]);
      return;
    }
    reloadContacts();
  }, [open, reloadContacts, chatId]);

  async function tryAddUserId(userId: string): Promise<boolean> {
    if (memberIdSet.has(userId.toLowerCase())) {
      setError("Уже в группе");
      return false;
    }
    setError("");
    try {
      await addGroupMembers(chatId, [userId]);
      await onMemberAdded();
      return true;
    } catch {
      setError("Не удалось добавить участника");
      return false;
    }
  }

  async function handleSearchAdd() {
    const q = query.trim();
    if (!q || busy) return;
    setBusy(true);
    try {
      const u = await searchUser(q);
      if (!u) {
        setError("Пользователь не найден");
        return;
      }
      const ok = await tryAddUserId(u.id);
      if (ok) {
        setQuery("");
        onClose();
      }
    } finally {
      setBusy(false);
    }
  }

  async function handlePickContact(userId: string) {
    if (addingContactId || busy) return;
    setAddingContactId(userId);
    try {
      const ok = await tryAddUserId(userId);
      if (ok) onClose();
    } finally {
      setAddingContactId(null);
    }
  }

  if (!open) return null;

  return createPortal(
    <div
      className="search-overlay modal-overlay-top add-group-member-overlay"
      onPointerDown={overlayDismiss.onOverlayPointerDown}
      onClick={overlayDismiss.onOverlayClick}
    >
      <div
        className="search-modal search-modal-wide add-group-member-modal"
        onPointerDown={overlayDismiss.onModalPointerDown}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Добавить участника"
      >
        <button type="button" className="modal-close" aria-label="Закрыть" onClick={onClose}>
          ×
        </button>
        <h3>Добавить участника</h3>
        <div className="add-group-member-body">
          <p className="search-hint add-group-member-hint">Найдите по логину или выберите из контактов</p>
          {error && <p className="search-error">{error}</p>}
          <div className="search-id-row add-group-member-search">
            <input
              type="text"
              placeholder="Логин или имя"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), void handleSearchAdd())}
              spellCheck={false}
              autoComplete="off"
              autoFocus
            />
            <button type="button" className="btn" disabled={busy || !query.trim()} onClick={() => void handleSearchAdd()}>
              Добавить
            </button>
          </div>
          <h4 className="add-group-member-contacts-title">Контакты</h4>
          {contactsLoading ? (
            <p className="search-hint">Загрузка контактов…</p>
          ) : addableContacts.length === 0 ? (
            <p className="search-hint">
              {contacts.length === 0
                ? "Контактов пока нет — добавьте людей через профиль"
                : "Все контакты уже в группе"}
            </p>
          ) : (
            <ul className="chat-info-add-contact-list add-group-member-contact-list">
              {addableContacts.map((c) => {
                const tag = userLoginTag(c);
                const isAdding = addingContactId === c.id;
                return (
                  <li key={c.id} className="chat-info-add-contact-row">
                    <div className="chat-info-add-contact-user">
                      <div className="chat-info-member-avatar">
                        {c.avatarUrl ? <img src={mediaUrl(c.avatarUrl)} alt="" /> : userAvatarLetter(c)}
                      </div>
                      <div className="chat-info-member-text">
                        <span className="chat-info-member-name">{userDisplayName(c)}</span>
                        {tag && <span className="chat-info-member-tag">{tag}</span>}
                      </div>
                    </div>
                    <button
                      type="button"
                      className="chat-info-add-contact-btn"
                      onClick={() => void handlePickContact(c.id)}
                      disabled={busy || isAdding || addingContactId !== null}
                      aria-label={`Добавить ${userDisplayName(c)}`}
                      title="Добавить в группу"
                    >
                      {isAdding ? "…" : <IconPlus size={18} />}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
