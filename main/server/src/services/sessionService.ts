import jwt from "jsonwebtoken";
import { v4 as uuidv4 } from "uuid";
import crypto from "crypto";

const EXPIRY_MAP: Record<"user" | "admin", jwt.SignOptions["expiresIn"]> = {
  user: "4h",
  admin: "1h",
};

export interface SessionPayload {
  sub: string;
  role: "user" | "admin";
  iat?: number;
  exp?: number;
  jti: string;
}

// In-memory fallback keys for local development
let fallbackKeys: { privateKey: string; publicKey: string } | null = null;

function getKeys() {
  let privateKey = process.env.JWT_PRIVATE_KEY?.replace(/\\n/g, "\n") || "";
  let publicKey = process.env.JWT_PUBLIC_KEY?.replace(/\\n/g, "\n") || "";

  // Check if keys are placeholder strings or empty
  if (!privateKey.includes("BEGIN") || !publicKey.includes("BEGIN")) {
    if (!fallbackKeys) {
      console.warn("[sessionService] Valid RSA PEM keys not found in .env. Generating temporary in-memory RSA keypair.");
      const { privateKey: priv, publicKey: pub } = crypto.generateKeyPairSync("rsa", {
        modulusLength: 2048,
        publicKeyEncoding: { type: "spki", format: "pem" },
        privateKeyEncoding: { type: "pkcs8", format: "pem" },
      });
      fallbackKeys = { privateKey: priv, publicKey: pub };
    }
    return fallbackKeys;
  }

  return { privateKey, publicKey };
}

export function issueSession(clientIp: string, role: "user" | "admin"): string {
  const { privateKey } = getKeys();
  return jwt.sign(
    { sub: clientIp, role, jti: uuidv4() },
    privateKey,
    { algorithm: "RS256", expiresIn: EXPIRY_MAP[role] }
  );
}

export function verifySession(token: string): SessionPayload {
  const { publicKey } = getKeys();
  return jwt.verify(token, publicKey, {
    algorithms: ["RS256"],
  }) as SessionPayload;
}