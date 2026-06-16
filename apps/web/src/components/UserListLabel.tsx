import { userDisplayName, userLoginTag, type UserLabelSource } from "../utils/userDisplay";

type Props = {
  user: UserLabelSource;
  nameClassName?: string;
  tagClassName?: string;
};

export function UserListLabel({ user, nameClassName = "chat-item-name", tagClassName = "chat-item-login" }: Props) {
  const name = userDisplayName(user);
  const tag = userLoginTag(user);
  return (
    <>
      <p className={nameClassName}>{name}</p>
      {tag && <p className={tagClassName}>{tag}</p>}
    </>
  );
}
