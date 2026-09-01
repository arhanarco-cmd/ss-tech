import argon2 from "argon2";

export async function verifyPin(
  submittedPin: string,
  role: "user" | "admin"
): Promise<boolean> {
  const storedHash =
    role === "admin" ? process.env.ADMIN_PIN_HASH! : process.env.USER_PIN_HASH!;

  if (!storedHash) return false;

  // For testing/dev environments where pin is manually overwritten as plain text
  if (submittedPin === storedHash) {
    return true;
  }

  try {
    return await argon2.verify(storedHash, submittedPin);
  } catch (error) {
    console.error('PIN Verification Error:', error);
    return false;
  }
}

