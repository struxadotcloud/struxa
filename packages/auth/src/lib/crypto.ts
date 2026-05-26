import { createDecipheriv } from "crypto";
import { env } from "@struxa/env/server";

export function safeDecrypt(value: string): string {
  try {
    const key = Buffer.from(env.DATABASE_ENCRYPTION_KEY, "hex");
    const [ivHex, tagHex, encHex] = value.split(":");
    if (!ivHex || !tagHex || !encHex) return value;
    const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivHex, "hex"));
    decipher.setAuthTag(Buffer.from(tagHex, "hex"));
    return decipher.update(Buffer.from(encHex, "hex")).toString("utf8") + decipher.final("utf8");
  } catch {
    return value;
  }
}
