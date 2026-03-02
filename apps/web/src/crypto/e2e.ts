/**
 * E2E encryption: X25519 key exchange + AES-256-GCM for message content.
 * Private key in localStorage; public key on server.
 */

const KEY_STORAGE = "melon_private_key";
const PUB_STORAGE = "melon_public_key";

/** X25519 returns a key pair; DOM types declare it as CryptoKey */
function asKeyPair(
  key: CryptoKey
): { publicKey: CryptoKey; privateKey: CryptoKey } {
  return key as unknown as { publicKey: CryptoKey; privateKey: CryptoKey };
}

export async function generateKeyPair(): Promise<{ publicKey: string; privateKey: string }> {
  const raw = await crypto.subtle.generateKey(
    { name: "X25519", length: 256 },
    true,
    ["deriveBits", "deriveKey"]
  );
  const pair = asKeyPair(raw);
  const [pubBuf, privBuf] = await Promise.all([
    crypto.subtle.exportKey("raw", pair.publicKey),
    crypto.subtle.exportKey("pkcs8", pair.privateKey),
  ]);
  return {
    publicKey: btoa(String.fromCharCode(...new Uint8Array(pubBuf))),
    privateKey: btoa(String.fromCharCode(...new Uint8Array(privBuf))),
  };
}

export function getStoredKeys(): { publicKey: string; privateKey: string } | null {
  const pub = localStorage.getItem(PUB_STORAGE);
  const priv = localStorage.getItem(KEY_STORAGE);
  if (!pub || !priv) return null;
  return { publicKey: pub, privateKey: priv };
}

export function storeKeys(publicKey: string, privateKey: string): void {
  localStorage.setItem(PUB_STORAGE, publicKey);
  localStorage.setItem(KEY_STORAGE, privateKey);
}

function base64ToBuf(b: string): Uint8Array {
  return Uint8Array.from(atob(b), (c) => c.charCodeAt(0));
}

async function importPublicKey(rawBase64: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    base64ToBuf(rawBase64),
    { name: "X25519" },
    false,
    ["deriveBits"]
  );
}

async function importPrivateKey(pkcs8Base64: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "pkcs8",
    base64ToBuf(pkcs8Base64),
    { name: "X25519" },
    false,
    ["deriveBits"]
  );
}

/** Derive AES key from ECDH shared secret (HKDF). */
async function deriveAesKey(sharedSecret: ArrayBuffer): Promise<CryptoKey> {
  const key = await crypto.subtle.importKey(
    "raw",
    sharedSecret,
    { name: "HKDF" },
    false,
    ["deriveKey"]
  );
  return crypto.subtle.deriveKey(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: new TextEncoder().encode("melon-e2e-v1"),
      info: new TextEncoder().encode("aes-gcm"),
    },
    key,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

/** Encrypt plaintext; returns base64(iv + ciphertext). */
export async function encrypt(
  plaintext: string,
  theirPublicKeyBase64: string,
  myPrivateKeyBase64: string
): Promise<string> {
  const [theirPub, myPriv] = await Promise.all([
    importPublicKey(theirPublicKeyBase64),
    importPrivateKey(myPrivateKeyBase64),
  ]);
  const sharedSecret = await crypto.subtle.deriveBits(
    { name: "X25519", public: theirPub },
    myPriv,
    256
  );
  const aesKey = await deriveAesKey(sharedSecret);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    aesKey,
    encoded
  );
  const combined = new Uint8Array(iv.length + ciphertext.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(ciphertext), iv.length);
  return btoa(String.fromCharCode(...combined));
}

/** Decrypt base64(iv + ciphertext). */
export async function decrypt(
  ciphertextBase64: string,
  theirPublicKeyBase64: string,
  myPrivateKeyBase64: string
): Promise<string> {
  const [theirPub, myPriv] = await Promise.all([
    importPublicKey(theirPublicKeyBase64),
    importPrivateKey(myPrivateKeyBase64),
  ]);
  const sharedSecret = await crypto.subtle.deriveBits(
    { name: "X25519", public: theirPub },
    myPriv,
    256
  );
  const aesKey = await deriveAesKey(sharedSecret);
  const combined = base64ToBuf(ciphertextBase64);
  const iv = combined.slice(0, 12);
  const ciphertext = combined.slice(12);
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    aesKey,
    ciphertext
  );
  return new TextDecoder().decode(decrypted);
}
