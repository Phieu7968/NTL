/**
 * Tuỳ chọn: nối thẳng tới Gemini API (Google AI Studio) để
 *  1) nhờ AI viết kịch bản sâu hơn engine offline, và
 *  2) render video bằng Veo ngay trong app.
 *
 * Không bắt buộc - app chạy đầy đủ khi không có API key, chỉ khác là kịch bản do
 * engine offline sinh và video tạo thủ công qua Google Flow.
 * API key chỉ nằm trong localStorage của trình duyệt, không gửi đi đâu ngoài Google.
 */

const BASE = 'https://generativelanguage.googleapis.com/v1beta';

export const TEXT_MODELS = ['gemini-2.5-flash', 'gemini-2.5-pro'];
export const VIDEO_MODELS = [
  'veo-3.0-generate-001',
  'veo-3.0-fast-generate-001',
  'veo-3.1-generate-preview',
  'veo-2.0-generate-001',
];

async function callJson(url, apiKey, body, method = 'POST') {
  const res = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch (err) { data = { raw: text }; }
  if (!res.ok) {
    const message = data?.error?.message || `HTTP ${res.status}`;
    throw new Error(message);
  }
  return data;
}

/**
 * Nhờ Gemini viết nội dung từng cảnh (hành động + lời thoại) bám theo Project Bible.
 * Prompt cuối cùng vẫn do engine biên dịch, nên nhân vật/sản phẩm không bao giờ lệch.
 */
export async function generateSceneContent(apiKey, bible, scenes, model = TEXT_MODELS[0]) {
  const brief = {
    idea: bible.idea,
    genre: bible.genre,
    style: bible.style,
    mood: bible.mood,
    aspect: bible.aspect,
    language: bible.language,
    character: bible.character?.present ? bible.character.lock : 'no character',
    product: bible.product?.present ? bible.product.lock : 'no product',
    setting: bible.setting.description,
    scenes: scenes.map((s) => ({ number: s.number, title: s.title, purpose: s.purpose, duration: s.duration })),
  };

  const instruction = [
    'You are a commercial film director writing a shooting script for an AI video generator.',
    'For each scene, write:',
    '- "action": one vivid English sentence describing exactly what happens on screen. Reuse the exact character and product wording given in the brief so every scene stays consistent.',
    `- "voiceover": one short line of dialogue or narration in ${bible.language}. Empty string if the brief says no dialogue.`,
    '- "title": a short Vietnamese scene title (max 6 words).',
    'Return JSON only.',
    '',
    `BRIEF: ${JSON.stringify(brief)}`,
  ].join('\n');

  const data = await callJson(`${BASE}/models/${model}:generateContent`, apiKey, {
    contents: [{ role: 'user', parts: [{ text: instruction }] }],
    generationConfig: {
      temperature: 0.9,
      responseMimeType: 'application/json',
      responseSchema: {
        type: 'OBJECT',
        properties: {
          scenes: {
            type: 'ARRAY',
            items: {
              type: 'OBJECT',
              properties: {
                number: { type: 'INTEGER' },
                title: { type: 'STRING' },
                action: { type: 'STRING' },
                voiceover: { type: 'STRING' },
              },
              required: ['number', 'action'],
            },
          },
        },
        required: ['scenes'],
      },
    },
  });

  const raw = data?.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') || '';
  let parsed = null;
  try { parsed = JSON.parse(raw); } catch (err) { throw new Error('Gemini trả về dữ liệu không đọc được.'); }
  return Array.isArray(parsed?.scenes) ? parsed.scenes : [];
}

/** Lấy URI video từ operation - Veo đã đổi shape vài lần nên dò nhiều đường. */
function extractVideoUri(op) {
  const r = op?.response || {};
  const candidates = [
    r.generateVideoResponse?.generatedSamples?.[0]?.video?.uri,
    r.generateVideoResponse?.generatedSamples?.[0]?.video?.videoUri,
    r.generatedVideos?.[0]?.video?.uri,
    r.videos?.[0]?.uri,
    r.predictions?.[0]?.videoUri,
    r.predictions?.[0]?.video?.uri,
  ];
  return candidates.find(Boolean) || null;
}

/** Một vài phiên bản trả video base64 thay vì URI. */
function extractInlineVideo(op) {
  const r = op?.response || {};
  return r.predictions?.[0]?.bytesBase64Encoded
    || r.generateVideoResponse?.generatedSamples?.[0]?.video?.bytesBase64Encoded
    || null;
}

function base64ToBlob(base64, type = 'video/mp4') {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type });
}

/**
 * Tạo video cho một prompt bằng Veo.
 * @returns {Promise<Blob>}
 */
export async function generateVideo(apiKey, prompt, opts = {}) {
  const model = opts.model || VIDEO_MODELS[0];
  const onProgress = opts.onProgress || (() => {});
  const parameters = { aspectRatio: opts.aspect || '16:9' };
  if (opts.negativePrompt) parameters.negativePrompt = opts.negativePrompt;
  if (opts.personGeneration) parameters.personGeneration = opts.personGeneration;
  if (opts.durationSeconds) parameters.durationSeconds = opts.durationSeconds;

  onProgress('Đang gửi yêu cầu tới Veo…');
  const start = await callJson(`${BASE}/models/${model}:predictLongRunning`, apiKey, {
    instances: [{ prompt }],
    parameters,
  });

  const opName = start?.name;
  if (!opName) throw new Error('Veo không trả về operation name.');

  const deadline = Date.now() + (opts.timeoutMs || 10 * 60 * 1000);
  let op = start;
  let tick = 0;
  while (!op.done) {
    if (Date.now() > deadline) throw new Error('Quá thời gian chờ Veo render (10 phút).');
    if (opts.signal?.aborted) throw new Error('Đã huỷ.');
    tick += 1;
    onProgress(`Veo đang render… (${tick * 10}s)`);
    await new Promise((resolve) => setTimeout(resolve, 10000));
    op = await callJson(`${BASE}/${opName}`, apiKey, null, 'GET');
  }
  if (op.error) throw new Error(op.error.message || 'Veo báo lỗi khi render.');

  const inline = extractInlineVideo(op);
  if (inline) return base64ToBlob(inline);

  const uri = extractVideoUri(op);
  if (!uri) throw new Error('Không tìm thấy đường dẫn video trong kết quả trả về.');

  onProgress('Đang tải video về…');
  const fileRes = await fetch(uri.includes('alt=media') ? uri : `${uri}${uri.includes('?') ? '&' : '?'}alt=media`, {
    headers: { 'x-goog-api-key': apiKey },
  });
  if (!fileRes.ok) throw new Error(`Không tải được video (HTTP ${fileRes.status}).`);
  return await fileRes.blob();
}
