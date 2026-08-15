import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const VERSION = "v1";

function encryptionKey() {
  const encoded = process.env.PEVIER_ENCRYPTION_KEY?.trim();
  if (!encoded) throw new Error("PEVIER_ENCRYPTION_KEY is not configured.");

  const key = Buffer.from(encoded, "base64");
  if (key.length !== 32) throw new Error("PEVIER_ENCRYPTION_KEY must be a base64-encoded 32-byte key.");
  return key;
}

export function encryptSecret(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv.toString("base64url"), tag.toString("base64url"), ciphertext.toString("base64url")].join(".");
}

export function decryptSecret(value: string) {
  const [version, ivValue, tagValue, ciphertextValue] = value.split(".");
  if (version !== VERSION || !ivValue || !tagValue || !ciphertextValue) throw new Error("Encrypted secret has an unsupported format.");

  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(ivValue, "base64url"));
  decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertextValue, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

