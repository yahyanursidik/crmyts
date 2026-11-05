import crypto from "node:crypto";
import { getServerEnv } from "../../config/env";
export function createBazaarAccess(applicationId: string, bazaarId: string) {
  const payload = Buffer.from(
    JSON.stringify({ applicationId, bazaarId, kind: "bazaar_access" }),
  ).toString("base64url");
  return (
    "bazaar-access." +
    payload +
    "." +
    crypto
      .createHmac("sha256", getServerEnv().AUTH_SECRET)
      .update("bazaar-access." + payload)
      .digest("base64url")
  );
}
export function readBazaarAccess(headers: Record<string, string | undefined>) {
  const token = (headers.authorization || headers.Authorization || "").replace(
    /^Bearer\s+/i,
    "",
  );
  const [prefix, payload, signature, ...extra] = token.split(".");
  if (prefix !== "bazaar-access" || !payload || !signature || extra.length)
    return null;
  const expected = crypto
    .createHmac("sha256", getServerEnv().AUTH_SECRET)
    .update(prefix + "." + payload)
    .digest("base64url");
  if (
    signature.length !== expected.length ||
    !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
  )
    return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return data.kind === "bazaar_access" &&
      typeof data.applicationId === "string" &&
      typeof data.bazaarId === "string"
      ? (data as { applicationId: string; bazaarId: string })
      : null;
  } catch {
    return null;
  }
}
