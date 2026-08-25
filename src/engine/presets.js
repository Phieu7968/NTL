/**
 * Presets: các lựa chọn cố định cho form nhập ý tưởng.
 * Mọi id đều ổn định để lưu vào localStorage và dùng lại giữa các phiên.
 */

export const GENRES = [
  { id: 'ad', vi: 'Quảng cáo sản phẩm', en: 'Product commercial' },
  { id: 'brand', vi: 'Phim thương hiệu', en: 'Brand film' },
  { id: 'review', vi: 'Review / Giới thiệu sản phẩm', en: 'Product review' },
  { id: 'story', vi: 'Phim ngắn / Kể chuyện', en: 'Short story film' },
  { id: 'tutorial', vi: 'Hướng dẫn / Tutorial', en: 'How-to tutorial' },
  { id: 'travel', vi: 'Du lịch / Phong cảnh', en: 'Travel montage' },
  { id: 'music', vi: 'Music video', en: 'Music video' },
  { id: 'social', vi: 'Video ngắn mạng xã hội', en: 'Short-form social video' },
  { id: 'realestate', vi: 'Bất động sản / Không gian', en: 'Real-estate walkthrough' },
  { id: 'food', vi: 'Ẩm thực / Đồ ăn', en: 'Food & beverage film' },
];

export const STYLES = [
  { id: 'cinematic', vi: 'Cinematic sang trọng', en: 'luxury cinematic', look: 'shallow depth of field, anamorphic flares, rich contrast, filmic grain' },
  { id: 'minimal', vi: 'Tối giản / Minimalist', en: 'clean minimalist', look: 'negative space, soft gradients, calm composition, muted palette' },
  { id: 'documentary', vi: 'Tài liệu / Chân thực', en: 'natural documentary', look: 'handheld realism, available light, candid framing, true-to-life colours' },
  { id: 'vibrant', vi: 'Trẻ trung / Rực rỡ', en: 'vibrant youthful', look: 'punchy saturated colours, energetic cuts, playful framing' },
  { id: 'moody', vi: 'Trầm / Nghệ thuật', en: 'moody artistic', look: 'low-key lighting, deep shadows, teal and amber grade, atmospheric haze' },
  { id: 'anime', vi: 'Hoạt hình Anime', en: 'anime animation', look: '2D anime cel shading, expressive linework, painterly backgrounds' },
  { id: '3d', vi: '3D / CGI', en: '3D CGI render', look: 'physically based rendering, ray-traced reflections, subsurface scattering' },
  { id: 'retro', vi: 'Retro / Vintage', en: 'retro vintage', look: '16mm film emulation, halation, faded warm grade, subtle gate weave' },
];

export const ASPECTS = [
  { id: '16:9', vi: '16:9 – Ngang (YouTube, TV)', w: 16, h: 9 },
  { id: '9:16', vi: '9:16 – Dọc (TikTok, Reels, Shorts)', w: 9, h: 16 },
  { id: '1:1', vi: '1:1 – Vuông (Feed mạng xã hội)', w: 1, h: 1 },
  { id: '4:5', vi: '4:5 – Dọc nhẹ (Instagram)', w: 4, h: 5 },
  { id: '21:9', vi: '21:9 – Điện ảnh siêu rộng', w: 21, h: 9 },
];

export const LANGUAGES = [
  { id: 'vi', vi: 'Tiếng Việt', label: 'Vietnamese' },
  { id: 'en', vi: 'Tiếng Anh', label: 'English' },
  { id: 'vi-en', vi: 'Song ngữ Việt – Anh', label: 'Vietnamese with English subtitles' },
  { id: 'none', vi: 'Không lời thoại (chỉ hình + nhạc)', label: 'no dialogue, music and sound design only' },
];

export const DURATIONS = [15, 20, 30, 45, 60, 90];
export const SCENE_COUNTS = [3, 4, 5, 6, 7, 8, 10, 12];

/** Veo / Google Flow tạo tốt nhất ở các clip ngắn; dài hơn mốc này thì nên tách cảnh. */
export const MAX_CLIP_SECONDS = 8;

export const DEFAULT_OPTIONS = {
  genre: 'ad',
  style: 'cinematic',
  duration: 30,
  aspect: '16:9',
  sceneCount: 5,
  language: 'vi',
};

export function findPreset(list, id) {
  return list.find((item) => item.id === id) || list[0];
}
