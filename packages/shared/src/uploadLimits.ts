/** Максимальный размер одного загружаемого файла (чат, профиль, жалобы). */
export const MAX_UPLOAD_BYTES = 500 * 1024 * 1024;

export const MAX_UPLOAD_MB = MAX_UPLOAD_BYTES / (1024 * 1024);

/** In-memory blob cache: только мелкие превью (аватары, обложки). */
export const MAX_BLOB_CACHE_BYTES = 64 * 1024 * 1024;

/** Файлы больше этого не кладём в RAM — грузятся напрямую по URL. */
export const MAX_BLOB_CACHE_ITEM_BYTES = 3 * 1024 * 1024;

export function isUploadWithinLimit(sizeBytes: number): boolean {
  return sizeBytes > 0 && sizeBytes <= MAX_UPLOAD_BYTES;
}

export function uploadTooLargeMessage(): string {
  return `Файл слишком большой (макс. ${MAX_UPLOAD_MB} МБ)`;
}
