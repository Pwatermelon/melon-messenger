import { MediaImage } from "./MediaImage";

type Props = {
  path?: string | null;
  name: string;
  imgClassName?: string;
  eager?: boolean;
};

export function UserAvatar({ path, name, imgClassName = "", eager = false }: Props) {
  const letter = (name.trim().slice(0, 1) || "?").toUpperCase();
  const fallback = <span className="chat-item-avatar-letter user-avatar-fallback">{letter}</span>;

  if (!path) return fallback;

  return <MediaImage src={path} alt="" className={imgClassName} placeholder={fallback} eager={eager} />;
}
