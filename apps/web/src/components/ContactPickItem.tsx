import type { User } from "@melon/shared";
import { mediaUrl } from "../utils/mediaUrl";
import { userAvatarLetter } from "../utils/userDisplay";
import { UserListLabel } from "./UserListLabel";

type Props = {
  user: User;
  selected?: boolean;
  disabled?: boolean;
  onClick: () => void;
  nameClassName?: string;
  tagClassName?: string;
};

export function ContactPickItem({
  user,
  selected = false,
  disabled = false,
  onClick,
  nameClassName = "dm-contact-name",
  tagClassName = "dm-contact-login",
}: Props) {
  return (
    <button
      type="button"
      className={`dm-contact-item${selected ? " dm-contact-item-selected" : ""}`}
      disabled={disabled}
      onClick={onClick}
    >
      <div className="chat-item-avatar">
        {user.avatarUrl ? (
          <img src={mediaUrl(user.avatarUrl)} alt="" className="chat-item-avatar-img" />
        ) : (
          <span className="chat-item-avatar-letter">{userAvatarLetter(user)}</span>
        )}
      </div>
      <div className="dm-contact-body">
        <UserListLabel user={user} nameClassName={nameClassName} tagClassName={tagClassName} />
      </div>
      {selected && <span className="dm-contact-check">✓</span>}
    </button>
  );
}
