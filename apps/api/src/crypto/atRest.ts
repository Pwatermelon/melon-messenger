import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

const PREFIX = "enc:v1:";

function getKey(): Buffer | null {
  const raw = process.env.MESSAGE_AT_REST_KEY;
  if (!raw || !raw.trim()) return null;

  const s = raw.trim();
  // If it's valid base64, use it directly; otherwise hash the string to 32 bytes.
  if (/^[A-Za-z0-9+/]+=*$/.test(s) && s.length >= 32) {
    try {
      const buf = Buffer.from(s, "base64");
      if (buf.length >= 32) return buf.subarray(0, 32);
    } catch {
      // fallthrough
    }
  }
  return createHash("sha256").update(s, "utf8").digest();
}

export function encryptAtRest(plaintext: string): string {
  const key = getKey();
  if (!key) return plaintext;
  if (plaintext.startsWith(PREFIX)) return plaintext;

  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  const combined = Buffer.concat([iv, tag, ciphertext]);
  return `${PREFIX}${combined.toString("base64")}`;
}

export function decryptAtRest(value: string): string {
  const key = getKey();
  if (!key) return value;
  if (!value.startsWith(PREFIX)) return value;

  const b64 = value.slice(PREFIX.length);
  let combined: Buffer;
  try {
    combined = Buffer.from(b64, "base64");
  } catch {
    return value;
  }
  if (combined.length < 12 + 16 + 1) return value;

  const iv = combined.subarray(0, 12);
  const tag = combined.subarray(12, 28);
  const ciphertext = combined.subarray(28);
  try {
    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return plaintext.toString("utf8");
  } catch {
    // Key mismatch / corrupted data: don't crash the API.
    return value;
  }
}

