import { mkdir } from "fs/promises";
import { join } from "path";
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { UPLOAD_DIR } from "../routes/upload";

export interface MediaStorage {
  put(key: string, data: Uint8Array | Blob, contentType: string): Promise<void>;
  get(key: string): Promise<{ body: Uint8Array; contentType: string } | null>;
  delete(key: string): Promise<void>;
}

class LocalMediaStorage implements MediaStorage {
  async ensureDir() {
    await mkdir(UPLOAD_DIR, { recursive: true });
  }

  async put(key: string, data: Uint8Array | Blob, _contentType: string): Promise<void> {
    await this.ensureDir();
    await Bun.write(join(UPLOAD_DIR, key), data);
  }

  async get(key: string): Promise<{ body: Uint8Array; contentType: string } | null> {
    const path = join(UPLOAD_DIR, key);
    const file = Bun.file(path);
    if (!(await file.exists())) return null;
    const body = new Uint8Array(await file.arrayBuffer());
    return { body, contentType: file.type || "application/octet-stream" };
  }

  async delete(key: string): Promise<void> {
    try {
      const { unlink } = await import("fs/promises");
      await unlink(join(UPLOAD_DIR, key));
    } catch {}
  }
}

class S3MediaStorage implements MediaStorage {
  private client: S3Client;
  private bucket: string;

  constructor() {
    const endpoint = process.env.S3_ENDPOINT;
    const bucket = process.env.S3_BUCKET;
    const accessKey = process.env.S3_ACCESS_KEY;
    const secretKey = process.env.S3_SECRET_KEY;
    const region = process.env.S3_REGION ?? "ru-central1";
    if (!endpoint || !bucket || !accessKey || !secretKey) {
      throw new Error("S3 storage requires S3_ENDPOINT, S3_BUCKET, S3_ACCESS_KEY, S3_SECRET_KEY");
    }
    this.bucket = bucket;
    this.client = new S3Client({
      endpoint,
      region,
      credentials: { accessKeyId: accessKey, secretAccessKey: secretKey },
      forcePathStyle: true,
    });
  }

  async put(key: string, data: Uint8Array | Blob, contentType: string): Promise<void> {
    const body = data instanceof Blob ? new Uint8Array(await data.arrayBuffer()) : data;
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
        ACL: "private",
      })
    );
  }

  async get(key: string): Promise<{ body: Uint8Array; contentType: string } | null> {
    try {
      const res = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
      const bytes = res.Body ? new Uint8Array(await res.Body.transformToByteArray()) : new Uint8Array();
      return { body: bytes, contentType: res.ContentType || "application/octet-stream" };
    } catch (e: unknown) {
      const name = e && typeof e === "object" && "name" in e ? String((e as { name: string }).name) : "";
      if (name === "NoSuchKey" || name === "NotFound") return null;
      throw e;
    }
  }

  async delete(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }
}

let storage: MediaStorage | null = null;

export function getMediaStorage(): MediaStorage {
  if (storage) return storage;
  const mode = (process.env.MEDIA_STORAGE ?? "local").toLowerCase();
  storage = mode === "s3" ? new S3MediaStorage() : new LocalMediaStorage();
  return storage;
}

export function storageKeyFromPath(path: string): string {
  const clean = path.replace(/^\/+/, "");
  return clean.startsWith("uploads/") ? clean.slice("uploads/".length) : clean;
}

export function uploadsPathFromKey(key: string): string {
  return `/uploads/${key}`;
}
