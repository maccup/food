import { Context, Next } from 'hono';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import { Env } from '../types';

const SESSION_COOKIE = '__session';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

async function hmacSign(value: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(value));
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

export async function createSession(c: Context<{ Bindings: Env }>): Promise<void> {
  const expiresAt = Date.now() + COOKIE_MAX_AGE * 1000;
  const payload = `authenticated.${expiresAt}`;
  const signature = await hmacSign(payload, c.env.PASSWORD);
  setCookie(c, SESSION_COOKIE, `${payload}.${signature}`, {
    httpOnly: true,
    secure: true,
    sameSite: 'Lax',
    maxAge: COOKIE_MAX_AGE,
    path: '/',
  });
}

export function destroySession(c: Context<{ Bindings: Env }>): void {
  deleteCookie(c, SESSION_COOKIE, { path: '/' });
}

export async function isAuthenticated(c: Context<{ Bindings: Env }>): Promise<boolean> {
  const cookie = getCookie(c, SESSION_COOKIE);
  if (!cookie) return false;

  const parts = cookie.split('.');
  if (parts.length !== 3) return false;

  const [value, expiresAt, signature] = parts;
  if (value !== 'authenticated') return false;

  const expiry = parseInt(expiresAt, 10);
  if (!expiry || Date.now() > expiry) return false;

  const expected = await hmacSign(`${value}.${expiresAt}`, c.env.PASSWORD);
  return timingSafeEqual(signature, expected);
}

export async function authMiddleware(c: Context<{ Bindings: Env }>, next: Next) {
  const path = new URL(c.req.url).pathname;

  // Allow access to login page and static assets
  if (path === '/login' || path.startsWith('/css/') || path.startsWith('/js/') || path.startsWith('/fonts/') || path.startsWith('/icons/')) {
    return next();
  }

  // API routes need auth cookie but return JSON 401 instead of redirect
  if (path.startsWith('/api/')) {
    if (!(await isAuthenticated(c))) {
      return c.json({ error: 'Unauthorized' }, 401);
    }
    return next();
  }

  if (!(await isAuthenticated(c))) {
    return c.redirect('/login');
  }

  return next();
}
