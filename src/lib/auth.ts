import { SignJWT, jwtVerify } from 'jose';
import { AUTH_SECRET, AUTH_COOKIE_NAME } from './constants';

const secret = new TextEncoder().encode(AUTH_SECRET);

export async function createToken(): Promise<string> {
  return new SignJWT({ role: 'admin' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(secret);
}

export async function verifyToken(token: string): Promise<boolean> {
  try {
    await jwtVerify(token, secret);
    return true;
  } catch {
    return false;
  }
}

export { AUTH_COOKIE_NAME };
