import { IconDownload } from "./Icons";
import { downloadMediaFile } from "../utils/mediaFetch";

type Props = {
  href: string;
  fileName?: string | null;
};

export function LightboxDownloadButton({ href, fileName }: Props) {
  if (!href) return null;
  return (
    <button
      type="button"
      className="lightbox-download-btn"
      onClick={(e) => {
        e.stopPropagation();
        void downloadMediaFile(href, fileName).catch((err) => console.error(err));
      }}
      aria-label="Скачать"
      title="Скачать"
    >
      <IconDownload size={20} />
    </button>
  );
}
