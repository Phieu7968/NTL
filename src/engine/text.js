/** Tiện ích xử lý chuỗi dùng chung cho engine (chạy được cả trên Node lẫn trình duyệt). */

/** Bỏ dấu tiếng Việt + hạ chữ thường, để dò từ khoá kể cả khi người dùng gõ không dấu. */
export function normalize(text) {
  return String(text || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** Hash 32-bit ổn định (FNV-1a) để tạo seed từ ý tưởng. */
export function hashSeed(text) {
  let hash = 0x811c9dc5;
  const str = String(text || '');
  for (let i = 0; i < str.length; i += 1) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

/** PRNG mulberry32: cùng seed → cùng kết quả, nên kịch bản tái lập được. */
export function makeRng(seed) {
  let state = (seed >>> 0) || 1;
  return function rng() {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function pick(list, rng) {
  return list[Math.floor(rng() * list.length) % list.length];
}

export function titleCase(text) {
  return String(text || '')
    .split(' ')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/** Ghép các mảnh mô tả, bỏ mảnh rỗng, tránh dấu phẩy thừa trong prompt. */
export function joinParts(parts, separator = ', ') {
  return parts
    .map((part) => (part == null ? '' : String(part).trim()))
    .filter(Boolean)
    .join(separator);
}

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

/** Rút gọn ý tưởng thành một dòng ngắn để hiển thị trên thẻ dự án. */
export function shorten(text, max = 120) {
  const clean = String(text || '').replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max - 1).trimEnd()}…`;
}
