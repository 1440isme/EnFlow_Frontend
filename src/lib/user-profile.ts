import { getAccessToken } from '@/lib/auth-token';

const PROFILE_KEY = 'enflow_user_profile';

export type UserProfile = {
  fullName: string;
  email: string;
};

function pickString(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const part = token.split('.')[1];
    if (!part) return null;
    const base64 = part.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
    const json = atob(padded);
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function readStored(): UserProfile | null {
  const raw = localStorage.getItem(PROFILE_KEY);
  if (!raw) return null;
  try {
    const p = JSON.parse(raw) as Partial<UserProfile>;
    if (typeof p.fullName === 'string' && typeof p.email === 'string') {
      return { fullName: p.fullName, email: p.email };
    }
  } catch {
    /* ignore */
  }
  return null;
}

export function saveUserProfile(profile: UserProfile): void {
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('enflow-profile-changed'));
  }
}

export function clearUserProfile(): void {
  localStorage.removeItem(PROFILE_KEY);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('enflow-profile-changed'));
  }
}

/** Sau đăng nhập: gộp claim JWT với hồ sơ đã lưu (đăng ký / chỉnh sửa). */
export function syncProfileFromJwtToken(token: string): void {
  const c = decodeJwtPayload(token);
  if (!c) return;
  const prev = readStored();
  const sub = pickString(c.sub);
  const emailFromJwt =
    pickString(c.email) || (sub.includes('@') ? sub : '') || prev?.email || '';
  const nameFromJwt =
    pickString(c.fullName) ||
    pickString(c.name) ||
    (!sub.includes('@') && sub ? sub : '') ||
    prev?.fullName ||
    'Người dùng';
  saveUserProfile({
    fullName: nameFromJwt || 'Người dùng',
    email: emailFromJwt,
  });
}

export function getUserProfile(): UserProfile {
  const stored = readStored();
  if (stored) return stored;
  const token = getAccessToken();
  if (token) {
    const c = decodeJwtPayload(token);
    if (c) {
      const sub = pickString(c.sub);
      return {
        fullName:
          pickString(c.fullName) ||
          pickString(c.name) ||
          (!sub.includes('@') && sub ? sub : 'Người dùng'),
        email: pickString(c.email) || (sub.includes('@') ? sub : ''),
      };
    }
  }
  return { fullName: 'Người dùng', email: '' };
}

export function profileInitials(profile: UserProfile): string {
  const { fullName, email } = profile;
  const name = fullName.trim();
  if (name.length >= 2) {
    const parts = name.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      const a = parts[0][0];
      const b = parts[parts.length - 1][0];
      return (a + b).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  }
  if (email.length >= 2) return email.slice(0, 2).toUpperCase();
  return '?';
}
