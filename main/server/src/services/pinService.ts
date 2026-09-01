import argon2 from "argon2";

export async function verifyPin(
  submittedPin: string,
  role: "user" | "admin"
): Promise<boolean> {
  const storedHash =
    role === "admin" ? process.env.ADMIN_PIN_HASH! : process.env.USER_PIN_HASH!;

  if (!storedHash) return false;

  try {
    return await argon2.verify(storedHash, submittedPin);
  } catch {
    return false;
  }
}

