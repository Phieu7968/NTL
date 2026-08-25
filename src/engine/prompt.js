/**
 * Prompt compiler - phần quan trọng nhất của app.
 *
 * Mỗi scene được biên dịch thành một prompt hoàn chỉnh cho Google Flow / Veo, gồm đủ:
 * nhân vật, sản phẩm, hành động, bối cảnh, camera angle, camera movement, ánh sáng,
 * chất liệu hình ảnh, phong cách cinematic, âm thanh, negative prompt.
 *
 * Toàn bộ phần "khoá" (nhân vật + sản phẩm + tông màu + ánh sáng) lấy trực tiếp từ
 * Project Bible, nên chỉnh một scene không bao giờ ảnh hưởng nhân vật/sản phẩm ở scene khác.
 */

import { joinParts } from './text.js';
import { MAX_CLIP_SECONDS } from './presets.js';
import { buildLogline, buildTimeline } from './synopsis.js';

const LANG_LABEL = {
  vi: 'Vietnamese',
  en: 'English',
  'vi-en': 'Vietnamese (with English subtitles)',
  none: '',
};

/** Các trường của scene mà người dùng được phép sửa mà không đụng tới bible. */
export const EDITABLE_SCENE_FIELDS = ['title', 'duration', 'action', 'shotLabel', 'angle', 'movement', 'voiceover', 'onScreenText', 'extraNotes'];

function subjectBlock(bible) {
  const lines = [];
  if (bible.character?.present) lines.push(`Subject: ${bible.character.lock}.`);
  if (bible.product?.present) lines.push(`Product (must stay identical): ${bible.product.lock}.`);
  if (!lines.length) lines.push('Subject: the environment itself is the subject, no people in frame.');
  return lines.join('\n');
}

function dialogueLine(bible, scene) {
  const label = LANG_LABEL[bible.languageId];
  if (!label || !scene.voiceover) return 'Dialogue: none, music and sound design only.';
  return `Dialogue (${label}, lip-synced): "${scene.voiceover}"`;
}

function continuityLine(bible) {
  const parts = [];
  if (bible.character?.present) parts.push(`${bible.character.id} keeps the exact same face, hair and outfit as every other scene`);
  if (bible.product?.present) parts.push('the product keeps the exact same shape, colour, label and proportions');
  parts.push(`same colour grade (${bible.palette})`);
  parts.push(`same lighting logic and same ${bible.lens} lens language`);
  return `Continuity: ${joinParts(parts, '; ')}.`;
}

/**
 * Biên dịch prompt cho một scene.
 * @param {object} bible Project Bible (nguồn duy nhất của nhân vật/sản phẩm)
 * @param {object} scene scene đã build (có thể đã được người dùng chỉnh sửa các trường editable)
 * @param {object} [opts] {total: số scene, includeHeader: bool}
 */
export function compilePrompt(bible, scene, opts = {}) {
  const total = opts.total || bible.options.sceneCount;
  const header = `Scene ${scene.number}/${total} - "${scene.title}" - ${scene.duration}s - ${bible.aspect}`;

  const body = [
    subjectBlock(bible),
    `Action: ${scene.action}.`,
    `Setting: ${bible.setting.description}, ${bible.setting.time}.`,
    `Camera: ${joinParts([scene.shotLabel, scene.angle, scene.movement, `${bible.lens} lens`, 'shallow depth of field'])}.`,
    `Lighting: ${bible.lighting}.`,
    `Look: ${joinParts([bible.style, bible.styleLook, `colour palette of ${bible.palette}`, bible.filmStock])}.`,
    `Audio: ${bible.audio}${scene.onScreenText ? `; on-screen text: "${scene.onScreenText}"` : ''}.`,
    dialogueLine(bible, scene),
    continuityLine(bible),
    scene.extraNotes ? `Extra notes: ${scene.extraNotes}.` : '',
    `Negative prompt: ${bible.negative}.`,
  ].filter(Boolean).join('\n');

  return opts.includeHeader === false ? body : `${header}\n\n${body}`;
}

/** Prompt gọn một đoạn - tiện dán vào các công cụ chỉ nhận một dòng. */
export function compileCompactPrompt(bible, scene) {
  return joinParts([
    `${scene.shotLabel}, ${scene.angle}`,
    bible.character?.present ? bible.character.lock : '',
    scene.action,
    `in ${bible.setting.description}`,
    scene.movement,
    bible.lighting,
    `${bible.style}, ${bible.styleLook}, ${bible.palette}`,
    bible.filmStock,
    `audio: ${bible.audio}`,
    `${bible.aspect} aspect ratio, ${scene.duration} seconds`,
  ]);
}

/** Biên dịch prompt cho toàn bộ scene, tôn trọng prompt người dùng đã tự sửa. */
export function compileAll(bible, scenes) {
  return scenes.map((scene) => ({
    ...scene,
    prompt: scene.customPrompt != null ? scene.customPrompt : compilePrompt(bible, scene, { total: scenes.length }),
    compact: compileCompactPrompt(bible, scene),
  }));
}

/** Cảnh báo kỹ thuật để hiển thị cho người dùng trước khi generate. */
export function promptWarnings(bible, scenes) {
  const warnings = [];
  const longOnes = scenes.filter((s) => s.duration > MAX_CLIP_SECONDS);
  if (longOnes.length) {
    warnings.push(
      `${longOnes.length} scene dài hơn ${MAX_CLIP_SECONDS}s (Google Flow tạo tốt nhất ở clip ngắn). `
      + 'Hãy tăng số cảnh hoặc giảm tổng thời lượng để mỗi cảnh gọn hơn.',
    );
  }
  if (bible.product?.present && !bible.product.brand) {
    warnings.push('Chưa có tên thương hiệu - prompt đang dùng placeholder [TÊN THƯƠNG HIỆU]. Thêm tên vào ô ý tưởng trong dấu ngoặc kép, ví dụ: "Elysia".');
  }
  return warnings;
}

/** Xuất toàn bộ dự án ra text để copy sang Google Flow một lần. */
export function exportProjectText(project) {
  const { bible, scenes } = project;
  const lines = [
    `# ${bible.title}`,
    '',
    `Ý tưởng: ${bible.idea}`,
    `Thể loại: ${bible.genre} | Phong cách: ${bible.style} | Tỷ lệ: ${bible.aspect} | Tổng: ${scenes.reduce((a, s) => a + s.duration, 0)}s | ${scenes.length} cảnh`,
    '',
    '## Kịch bản',
    buildLogline(bible, scenes),
    '',
    ...buildTimeline(scenes).map((item) => `- ${item.range} · Scene ${item.number} — ${item.title} (${item.shotVi})${item.voiceover ? ` — “${item.voiceover}”` : ''}`),
    '',
    '## Nhân vật & sản phẩm (giữ nguyên ở mọi cảnh)',
    bible.character?.present ? `- Nhân vật: ${bible.character.lock}` : '- Nhân vật: không có',
    bible.product?.present ? `- Sản phẩm: ${bible.product.lock}` : '- Sản phẩm: không có',
    `- Bối cảnh: ${bible.setting.lock}`,
    `- Tông màu: ${bible.palette}`,
    `- Ánh sáng: ${bible.lighting}`,
    `- Âm thanh: ${bible.audio}`,
    '',
    '## Prompt từng cảnh',
  ];
  scenes.forEach((scene) => {
    lines.push('', `### Scene ${scene.number} - ${scene.title} (${scene.duration}s)`, '', scene.prompt);
  });
  return lines.join('\n');
}
