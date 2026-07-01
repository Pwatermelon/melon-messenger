import type { User } from "@melon/shared";
import { UserAvatar } from "./UserAvatar";
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
        <UserAvatar path={user.avatarUrl} name={userAvatarLetter(user)} imgClassName="chat-item-avatar-img" />
      </div>
      <div className="dm-contact-body">
        <UserListLabel user={user} nameClassName={nameClassName} tagClassName={tagClassName} />
      </div>
      {selected && <span className="dm-contact-check">✓</span>}
    </button>
  );
}
