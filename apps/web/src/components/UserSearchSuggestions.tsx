import type { User } from "@melon/shared";
import { mediaUrl } from "../utils/mediaUrl";
import { userAvatarLetter, userDisplayName, userLoginTag } from "../utils/userDisplay";

type Props = {
  users: User[];
  loading?: boolean;
  onPick: (user: User) => void;
  className?: string;
  emptyText?: string;
};

export default function UserSearchSuggestions({
  users,
  loading = false,
  onPick,
  className,
  emptyText,
}: Props) {
  if (!loading && users.length === 0 && !emptyText) return null;

  return (
    <div className={`user-search-suggestions${className ? ` ${className}` : ""}`} role="listbox">
      {loading && users.length === 0 ? (
        <p className="user-search-suggestions-hint">Поиск…</p>
      ) : users.length === 0 ? (
        emptyText ? <p className="user-search-suggestions-hint">{emptyText}</p> : null
      ) : (
        <ul className="user-search-suggestions-list">
          {users.map((u) => {
            const tag = userLoginTag(u);
            return (
              <li key={u.id}>
                <button type="button" className="user-search-suggestion" onClick={() => onPick(u)}>
                  <span className="user-search-suggestion-avatar">
                    {u.avatarUrl ? (
                      <img src={mediaUrl(u.avatarUrl)} alt="" />
                    ) : (
                      userAvatarLetter(u)
                    )}
                  </span>
                  <span className="user-search-suggestion-text">
                    <span className="user-search-suggestion-name">{userDisplayName(u)}</span>
                    {tag ? <span className="user-search-suggestion-tag">{tag}</span> : null}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
