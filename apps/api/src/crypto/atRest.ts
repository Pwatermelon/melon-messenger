import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

const PREFIX_V1 = "enc:v1:";
const PREFIX_V2 = /^enc:v2:([^:]+):/;

type KeyRingState = {
  activeId: string;
  ring: Map<string, Buffer>;
};

let cachedRing: KeyRingState | null | undefined;

/** Только для тестов */
export function resetAtRestKeyCache(): void {
  cachedRing = undefined;
}

function deriveKey(raw: string): Buffer {
  const s = raw.trim();
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

function loadKeyRing(): KeyRingState | null {
  if (cachedRing !== undefined) return cachedRing;

  const ring = new Map<string, Buffer>();
  let activeId = process.env.MESSAGE_AT_REST_ACTIVE_KEY_ID?.trim() || "1";

  for (const [envKey, val] of Object.entries(process.env)) {
    if (!val?.trim()) continue;
    const m = envKey.match(/^MESSAGE_AT_REST_KEY_([A-Za-z0-9_-]+)$/);
    if (m) ring.set(m[1], deriveKey(val));
  }

  const single = process.env.MESSAGE_AT_REST_KEY?.trim();
  if (single) ring.set(activeId, deriveKey(single));

  if (ring.size === 0) {
    cachedRing = null;
    return null;
  }

  if (!ring.has(activeId)) {
    const ids = [...ring.keys()].sort();
    activeId = ids[ids.length - 1]!;
  }

  cachedRing = { ring, activeId };
  return cachedRing;
}

function decryptWithKey(combined: Buffer, key: Buffer): string | null {
  if (combined.length < 12 + 16 + 1) return null;
  const iv = combined.subarray(0, 12);
  const tag = combined.subarray(12, 28);
  const ciphertext = combined.subarray(28);
  try {
    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return plaintext.toString("utf8");
  } catch {
    return null;
  }
}

function parsePayload(value: string): { keyId: string | null; combined: Buffer } | null {
  const v2 = value.match(PREFIX_V2);
  if (v2) {
    const b64 = value.slice(v2[0].length);
    try {
      return { keyId: v2[1], combined: Buffer.from(b64, "base64") };
    } catch {
      return null;
    }
  }
  if (value.startsWith(PREFIX_V1)) {
    const b64 = value.slice(PREFIX_V1.length);
    try {
      return { keyId: null, combined: Buffer.from(b64, "base64") };
    } catch {
      return null;
    }
  }
  return null;
}

export function encryptAtRest(plaintext: string): string {
  const state = loadKeyRing();
  if (!state) return plaintext;
  if (plaintext.startsWith("enc:v")) return plaintext;

  const key = state.ring.get(state.activeId);
  if (!key) return plaintext;

  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  const combined = Buffer.concat([iv, tag, ciphertext]);
  return `enc:v2:${state.activeId}:${combined.toString("base64")}`;
}

export function decryptAtRest(value: string): string {
  const state = loadKeyRing();
  if (!state) return value;

  const parsed = parsePayload(value);
  if (!parsed) return value;

  if (parsed.keyId) {
    const key = state.ring.get(parsed.keyId);
    if (!key) return value;
    return decryptWithKey(parsed.combined, key) ?? value;
  }

  for (const key of state.ring.values()) {
    const plain = decryptWithKey(parsed.combined, key);
    if (plain !== null) return plain;
  }
  return value;
}

/** true, если запись зашифрована старым ключом или legacy enc:v1 */
export function needsReencryption(value: string | null | undefined): boolean {
  if (!value) return false;
  const state = loadKeyRing();
  if (!state) return false;
  if (!value.startsWith("enc:")) return true;

  const v2 = value.match(PREFIX_V2);
  if (!v2) return true;
  return v2[1] !== state.activeId;
}

export function reencryptAtRest(value: string | null | undefined): string | null {
  if (value == null || value === "") return value;
  const state = loadKeyRing();
  if (!state) return value;
  if (!needsReencryption(value)) return value;

  const plain = decryptAtRest(value);
  if (plain.startsWith("enc:")) return value;
  return encryptAtRest(plain);
}

export function getActiveAtRestKeyId(): string | null {
  return loadKeyRing()?.activeId ?? null;
}
