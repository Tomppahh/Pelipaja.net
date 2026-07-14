import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

// Convert the secret string to bytes that jose can use
if (!process.env.AUTH_SECRET) {
  throw new Error("AUTH_SECRET environment variable is required");
}
const secret = new TextEncoder().encode(process.env.AUTH_SECRET);

export interface SessionUser {
  id: string;
  steamId: string;
  displayName: string;
  avatarUrl: string;
  role: string;
}

// Creates a JWT and sets it as a cookie
export async function createSession(user: SessionUser): Promise<void> {
  const token = await new SignJWT({ user })
    .setProtectedHeader({ alg: "HS256" })  // signing algorithm
    .setExpirationTime("7d")               // token expires in 7 days
    .sign(secret);

  // Set the cookie
  const cookieStore = await cookies();
  cookieStore.set("session", token, {
    httpOnly: true,   // JS can't read this cookie only the server
    secure: process.env.NODE_ENV === "production",  // HTTPS only in prod
    sameSite: "lax",  // protection against CSRF attacks
    maxAge: 60 * 60 * 24 * 7,  // delete cookies after seven days
    path: "/",
  });
}

export async function getSession(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get("session")?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, secret);
    return payload.user as SessionUser;
  } catch {
    return null;
  }
}

export async function deleteSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete("session");
}