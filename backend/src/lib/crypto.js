const { createCipheriv, createDecipheriv, randomBytes } = require("crypto");

const ENCRYPTION_PREFIX = "enc:";
const ALGORITHM = "aes-256-gcm";

function getKey() {
  const hex = process.env.CPF_ENCRYPTION_KEY || "";
  if (!hex || hex.length !== 64) return null;
  return Buffer.from(hex, "hex");
}

function encrypt(plaintext) {
  const key = getKey();
  if (!key) return plaintext; // Fallback: plaintext when key not configured

  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${ENCRYPTION_PREFIX}${iv.toString("hex")}:${encrypted.toString("hex")}:${tag.toString("hex")}`;
}

function decrypt(value) {
  if (!value || !value.startsWith(ENCRYPTION_PREFIX)) return value ?? ""; // Plaintext passthrough

  const key = getKey();
  if (!key) return ""; // Cannot decrypt without key

  try {
    const parts = value.slice(ENCRYPTION_PREFIX.length).split(":");
    if (parts.length !== 3) return "";
    const [ivHex, encryptedHex, tagHex] = parts;
    const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(ivHex, "hex"));
    decipher.setAuthTag(Buffer.from(tagHex, "hex"));
    return decipher.update(Buffer.from(encryptedHex, "hex"), undefined, "utf8") + decipher.final("utf8");
  } catch {
    return ""; // Decryption failed — treat as missing
  }
}

function isEncrypted(value) {
  return typeof value === "string" && value.startsWith(ENCRYPTION_PREFIX);
}

module.exports = { encrypt, decrypt, isEncrypted };
