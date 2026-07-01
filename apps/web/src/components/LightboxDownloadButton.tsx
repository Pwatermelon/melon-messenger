import { IconDownload } from "./Icons";

type Props = {
  href: string;
  fileName?: string | null;
};

export function LightboxDownloadButton({ href, fileName }: Props) {
  if (!href) return null;
  return (
    <a
      href={href}
      download={fileName ?? undefined}
      className="lightbox-download-btn"
      onClick={(e) => e.stopPropagation()}
      aria-label="Скачать"
      title="Скачать"
    >
      <IconDownload size={20} />
    </a>
  );
}
