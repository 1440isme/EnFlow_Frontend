/** Màu nổi bật, tương phản tốt trên nền sáng (pill/tag). */
const TAG_ACCENT_PALETTE = [
  '#2563eb',
  '#dc2626',
  '#16a34a',
  '#ca8a04',
  '#9333ea',
  '#0891b2',
  '#ea580c',
  '#4f46e5',
  '#db2777',
  '#0d9488',
  '#b45309',
  '#7c3aed',
  '#c026d3',
  '#047857',
  '#1d4ed8',
];

/** Chuẩn hoá `#rgb` / `#rrggbb` (và bỏ alpha nếu có) — dùng chung badge/tag/status. */
export function normalizeHexColor(c: string | null | undefined): string | null {
  if (c == null || typeof c !== 'string') return null;
  const s = c.trim().toLowerCase();
  if (!s) return null;
  const withHash = s.startsWith('#') ? s : `#${s}`;
  if (!/^#[0-9a-f]{3,8}$/.test(withHash)) return null;
  return withHash.length === 4
    ? `#${withHash[1]}${withHash[1]}${withHash[2]}${withHash[2]}${withHash[3]}${withHash[3]}`
    : withHash.slice(0, 7);
}

/**
 * Chọn màu từ palette sao cho ít trùng với tag workspace hiện có (đếm theo màu đã dùng).
 */
export function pickDistinctTagColor(existingColors: (string | null | undefined)[]): string {
  const usage = new Map<string, number>();
  for (const p of TAG_ACCENT_PALETTE) usage.set(p, 0);
  for (const c of existingColors) {
    const n = normalizeHexColor(c);
    if (n && usage.has(n)) usage.set(n, (usage.get(n) ?? 0) + 1);
  }
  let best = TAG_ACCENT_PALETTE[0];
  let bestCount = Infinity;
  for (const p of TAG_ACCENT_PALETTE) {
    const cnt = usage.get(p) ?? 0;
    if (cnt < bestCount) {
      bestCount = cnt;
      best = p;
    }
  }
  return best;
}

/** Chữ sáng/tối trên nền hex (độ sáng tương đối). */
export function contrastTextOnHex(hex: string): '#0f172a' | '#ffffff' {
  const h = hex.replace('#', '');
  if (h.length < 6) return '#0f172a';
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 148 ? '#0f172a' : '#ffffff';
}
