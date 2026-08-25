/**
 * AI Video Studio - lớp giao diện.
 *
 * Luồng: Ý tưởng → Kịch bản → Danh sách Scene → Prompt → Generate → Preview → Regenerate.
 * Toàn bộ logic kịch bản/prompt nằm trong src/engine (thuần, test được bằng Node);
 * file này chỉ lo DOM, sự kiện và lưu trữ.
 */

import { GENRES, STYLES, ASPECTS, LANGUAGES, DURATIONS, SCENE_COUNTS, DEFAULT_OPTIONS } from './engine/presets.js';
import { exportProjectText } from './engine/prompt.js';
import { buildLogline, buildTimeline } from './engine/synopsis.js';
import * as P from './engine/project.js';
import * as store from './storage.js';
import { copyText, openFlow, flowSteps, FLOW_URL } from './providers/flow.js';
import { generateVideo, generateSceneContent, TEXT_MODELS, VIDEO_MODELS } from './providers/gemini.js';

const EXAMPLES = [
  'Tạo video quảng cáo một chai nước hoa dành cho nữ, phong cách sang trọng, cinematic',
  'Tạo video quảng cáo một cô gái Việt Nam giới thiệu sản phẩm thời trang trong quán cà phê hiện đại',
  'Video giới thiệu quán cà phê mới mở ở Đà Nẵng, ấm áp, gần gũi',
  'Review nhanh một chiếc đồng hồ nam cao cấp, quay trong studio tối',
];

const $ = (sel) => document.querySelector(sel);
const el = {
  idea: $('#idea'),
  examples: $('#examples'),
  options: $('#options'),
  ideaHint: $('#idea-hint'),
  useAi: $('#use-ai'),
  overview: $('#overview-card'),
  logline: $('#logline'),
  timeline: $('#timeline'),
  title: $('#project-title'),
  projectIdea: $('#project-idea'),
  meta: $('#project-meta'),
  warnings: $('#project-warnings'),
  biblePanel: $('#bible-panel'),
  bibleFields: $('#bible-fields'),
  scenesCard: $('#scenes-card'),
  sceneList: $('#scene-list'),
  progressBar: $('#progress-bar'),
  progressText: $('#progress-text'),
  toast: $('#toast'),
  flowModal: $('#flow-modal'),
  flowTitle: $('#flow-title'),
  flowSteps: $('#flow-steps'),
  flowPrompt: $('#flow-prompt'),
  flowFile: $('#flow-file'),
  flowUrl: $('#flow-url'),
  settingsModal: $('#settings-modal'),
  confirmModal: $('#confirm-modal'),
  confirmText: $('#confirm-text'),
  exportModal: $('#export-modal'),
  exportText: $('#export-text'),
  apiKey: $('#api-key'),
  videoMode: $('#video-mode'),
  textModel: $('#text-model'),
  videoModel: $('#video-model'),
};

let project = null;
let settings = { apiKey: '', videoMode: 'flow', textModel: TEXT_MODELS[0], videoModel: VIDEO_MODELS[0] };
let flowSceneIndex = null;
const objectUrls = new Map(); // sceneId -> objectURL đang sống, revoke khi thay video
let busy = false;

/* ------------------------------------------------------------------ tiện ích */

function toast(message, isError = false) {
  el.toast.textContent = message;
  el.toast.classList.toggle('err', Boolean(isError));
  el.toast.classList.add('show');
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => el.toast.classList.remove('show'), isError ? 5200 : 2600);
}

/**
 * Hộp thoại xác nhận trong trang, thay cho window.confirm.
 * Hộp thoại hệ thống bị chặn khi app chạy trong khung nhúng, khi đó window.confirm
 * trả về false ngay lập tức và người dùng bấm nút mà không có gì xảy ra.
 */
let pendingConfirm = null;

function askConfirm(message) {
  return new Promise((resolve) => {
    el.confirmText.textContent = message;
    pendingConfirm = resolve;
    el.confirmModal.showModal();
  });
}

function settleConfirm(answer) {
  const resolve = pendingConfirm;
  pendingConfirm = null;
  if (el.confirmModal.open) el.confirmModal.close();
  if (resolve) resolve(answer);
}

function setProject(next, { save = true } = {}) {
  project = next;
  if (save && project) store.saveProject(stripRuntime(project));
  render();
}

/** Bỏ objectURL (chỉ sống trong phiên hiện tại) trước khi lưu xuống localStorage. */
function stripRuntime(p) {
  return {
    ...p,
    scenes: p.scenes.map((scene) => (
      scene.video ? { ...scene, video: { ...scene.video, url: scene.video.kind === 'idb' ? null : scene.video.url } } : scene
    )),
  };
}

function currentOptions() {
  const read = (id, fallback) => {
    const node = document.getElementById(id);
    return node ? node.value : fallback;
  };
  return {
    genre: read('opt-genre', DEFAULT_OPTIONS.genre),
    style: read('opt-style', DEFAULT_OPTIONS.style),
    duration: Number(read('opt-duration', DEFAULT_OPTIONS.duration)),
    aspect: read('opt-aspect', DEFAULT_OPTIONS.aspect),
    sceneCount: Number(read('opt-sceneCount', DEFAULT_OPTIONS.sceneCount)),
    language: read('opt-language', DEFAULT_OPTIONS.language),
  };
}

function escapeHtml(text) {
  return String(text == null ? '' : text)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/* ------------------------------------------------------------------ form ý tưởng */

function renderIdeaForm() {
  el.examples.innerHTML = EXAMPLES
    .map((text) => `<button type="button" class="chip" data-action="use-example" data-text="${escapeHtml(text)}">${escapeHtml(text)}</button>`)
    .join('');

  const select = (id, label, items, value, render) => `
    <label class="field">
      <span>${label}</span>
      <select id="opt-${id}">
        ${items.map((item) => {
          const v = render.value(item);
          return `<option value="${escapeHtml(v)}"${String(v) === String(value) ? ' selected' : ''}>${escapeHtml(render.label(item))}</option>`;
        }).join('')}
      </select>
    </label>`;

  const o = project ? project.options : DEFAULT_OPTIONS;
  el.options.innerHTML = [
    select('genre', 'Thể loại video', GENRES, o.genre, { value: (i) => i.id, label: (i) => i.vi }),
    select('style', 'Phong cách', STYLES, o.style, { value: (i) => i.id, label: (i) => i.vi }),
    select('duration', 'Thời lượng', DURATIONS, o.duration, { value: (i) => i, label: (i) => `${i} giây` }),
    select('aspect', 'Tỷ lệ khung hình', ASPECTS, o.aspect, { value: (i) => i.id, label: (i) => i.vi }),
    select('sceneCount', 'Số lượng cảnh', SCENE_COUNTS, o.sceneCount, { value: (i) => i, label: (i) => `${i} cảnh` }),
    select('language', 'Ngôn ngữ', LANGUAGES, o.language, { value: (i) => i.id, label: (i) => i.vi }),
  ].join('');
}

/* ------------------------------------------------------------------ render dự án */

function render() {
  if (!project) {
    el.overview.classList.add('hidden');
    el.scenesCard.classList.add('hidden');
    // Dọn luôn DOM cũ, đừng chỉ ẩn đi: reset xong mà thẻ cảnh còn nằm đó là bẩn.
    el.sceneList.innerHTML = '';
    el.timeline.innerHTML = '';
    el.logline.textContent = '';
    return;
  }
  el.overview.classList.remove('hidden');
  el.scenesCard.classList.remove('hidden');

  const b = project.bible;
  el.title.textContent = b.title || 'Kịch bản video';
  el.projectIdea.textContent = project.idea;

  const total = P.totalDuration(project);
  const chips = [
    ['Thể loại', b.genreVi || b.genre],
    ['Phong cách', b.styleVi || b.style],
    ['Tỷ lệ', b.aspect],
    ['Thời lượng', `${total}s`],
    ['Số cảnh', String(project.scenes.length)],
    ['Ngôn ngữ', b.languageVi || b.language || 'không lời'],
    ['Tông màu', b.paletteVi || b.palette],
  ];
  el.meta.innerHTML = chips.map(([k, v]) => `<span class="meta-chip">${escapeHtml(k)}: <strong>${escapeHtml(v)}</strong></span>`).join('');
  el.warnings.innerHTML = (project.warnings || []).map((w) => `<div class="warning">⚠️ ${escapeHtml(w)}</div>`).join('');

  renderSynopsis();
  renderBibleFields();
  renderScenes();

  const pr = P.progress(project);
  el.progressBar.style.width = `${pr.percent}%`;
  el.progressText.textContent = pr.done === 0
    ? 'Chưa có cảnh nào được tạo video. Bấm Generate ở từng cảnh hoặc "Generate All Scenes".'
    : `Đã có video cho ${pr.done}/${pr.total} cảnh (${pr.percent}%).`;
}

function renderSynopsis() {
  el.logline.textContent = buildLogline(project.bible, project.scenes);
  el.timeline.innerHTML = buildTimeline(project.scenes).map((item) => `
    <li>
      <span class="tl-time">${escapeHtml(item.range)}</span>
      <span class="tl-shot">${escapeHtml(item.shotVi)}</span>
      <span>
        <a href="#${item.id}">${item.hasVideo ? '<span class="tl-done">●</span> ' : ''}Scene ${item.number}: ${escapeHtml(item.title)}</a>
        ${item.voiceover ? `<span class="tl-vo"> — “${escapeHtml(item.voiceover)}”</span>` : ''}
      </span>
    </li>`).join('');
}

function bibleField(id, label, value, rows = 2) {
  return `<label class="field">
    <span>${escapeHtml(label)}</span>
    <textarea data-bible="${id}" rows="${rows}">${escapeHtml(value || '')}</textarea>
  </label>`;
}

function renderBibleFields() {
  const b = project.bible;
  const fields = [];
  if (b.character?.present) fields.push(bibleField('character.lock', '🧍 Nhân vật (khoá)', b.character.lock, 3));
  if (b.product?.present) fields.push(bibleField('product.lock', '📦 Sản phẩm (khoá)', b.product.lock, 3));
  fields.push(bibleField('setting.description', '🏙️ Bối cảnh', b.setting.description, 3));
  fields.push(bibleField('lighting', '💡 Ánh sáng', b.lighting, 2));
  fields.push(bibleField('palette', '🎨 Tông màu', b.palette, 2));
  fields.push(bibleField('audio', '🔊 Âm thanh', b.audio, 2));
  fields.push(bibleField('negative', '🚫 Negative prompt', b.negative, 3));
  el.bibleFields.innerHTML = fields.join('');
}

function statusBadge(scene) {
  if (scene.status === P.SCENE_STATUS.GENERATING) return '<span class="badge live">⏳ Đang tạo…</span>';
  if (scene.status === P.SCENE_STATUS.QUEUED) return '<span class="badge">🕒 Trong hàng đợi</span>';
  if (scene.status === P.SCENE_STATUS.ERROR) return `<span class="badge err">⚠️ ${escapeHtml(scene.error || 'Lỗi')}</span>`;
  if (scene.video) return '<span class="badge ok">✅ Đã có video</span>';
  return '<span class="badge">⬜ Chưa tạo</span>';
}

function sceneCard(scene, index) {
  const videoUrl = scene.video ? (objectUrls.get(scene.id) || scene.video.url) : null;
  const cls = scene.status === P.SCENE_STATUS.GENERATING ? 'is-generating'
    : scene.status === P.SCENE_STATUS.ERROR ? 'is-error'
    : scene.video ? 'is-done' : '';

  return `
  <article class="scene ${cls}" data-index="${index}" id="${scene.id}">
    <div class="scene-head">
      <div>
        <div class="scene-no">Scene ${scene.number}</div>
        <h3 class="scene-title">${escapeHtml(scene.title)}</h3>
      </div>
      <div class="scene-badges">
        <span class="badge">${scene.duration}s</span>
        ${scene.overLimit ? '<span class="badge warn">Dài hơn 8s</span>' : ''}
        ${scene.customPrompt != null ? '<span class="badge warn">✍️ Prompt tự sửa</span>' : ''}
        ${scene.stale ? '<span class="badge warn">Prompt đã đổi sau khi tạo video</span>' : ''}
        ${statusBadge(scene)}
      </div>
    </div>

    <div class="scene-body">
      <div class="scene-fields">
        <label class="field">
          <span>Nội dung / hành động trong cảnh</span>
          <textarea data-field="action" rows="3">${escapeHtml(scene.action)}</textarea>
        </label>
        <div class="scene-row">
          <label class="field"><span>Góc máy</span><input type="text" data-field="angle" value="${escapeHtml(scene.angle)}" /></label>
          <label class="field"><span>Chuyển động máy</span><input type="text" data-field="movement" value="${escapeHtml(scene.movement)}" /></label>
        </div>
        <div class="scene-row">
          <label class="field"><span>Cỡ cảnh</span><input type="text" data-field="shotLabel" value="${escapeHtml(scene.shotLabel)}" /></label>
          <label class="field"><span>Thời lượng (giây)</span><input type="number" min="1" max="60" data-field="duration" value="${scene.duration}" /></label>
        </div>
        <label class="field">
          <span>Lời thoại / voice-over</span>
          <input type="text" data-field="voiceover" value="${escapeHtml(scene.voiceover)}" />
        </label>
      </div>

      <div>
        <div class="prompt-box">
          <div class="prompt-label">
            <span>Prompt gửi cho Google Flow</span>
            ${scene.customPrompt != null ? '<button class="btn small" type="button" data-action="reset-prompt">↩︎ Về prompt gốc</button>' : ''}
          </div>
          <textarea data-field="prompt" spellcheck="false">${escapeHtml(scene.prompt)}</textarea>
        </div>

        <div class="video-wrap">
          ${videoUrl
            ? `<video src="${escapeHtml(videoUrl)}" controls playsinline preload="metadata"></video>
               <div class="video-meta">
                 <span>${escapeHtml(scene.video.name || 'Video cảnh này')}</span>
                 <button class="btn small" type="button" data-action="clear-video">Xoá video</button>
               </div>`
            : '<div class="placeholder">Chưa có video cho cảnh này.<br />Bấm <strong>Generate</strong> để bắt đầu.</div>'}
        </div>
      </div>
    </div>

    <div class="scene-actions">
      <button class="btn" type="button" data-action="copy-prompt">📋 Copy prompt</button>
      <button class="btn primary" type="button" data-action="generate-scene">🎬 Generate Scene ${scene.number}</button>
      <button class="btn" type="button" data-action="preview-scene"${scene.video ? '' : ' disabled title="Cảnh này chưa có video"'}>▶️ Preview</button>
      <button class="btn" type="button" data-action="regenerate-scene">🔁 Regenerate prompt</button>
      <label class="btn small file-btn">📁 Gắn video
        <input type="file" accept="video/*" data-action="upload-video" hidden />
      </label>
    </div>
  </article>`;
}

/** Giữ nguyên ô đang gõ khi render lại (tránh mất con trỏ giữa chừng). */
function captureFocus() {
  const node = document.activeElement;
  const scene = node?.closest?.('.scene');
  if (!scene || !node.dataset.field) return null;
  return {
    index: scene.dataset.index,
    field: node.dataset.field,
    start: node.selectionStart,
    end: node.selectionEnd,
  };
}

function restoreFocus(snapshot) {
  if (!snapshot) return;
  const node = el.sceneList.querySelector(`.scene[data-index="${snapshot.index}"] [data-field="${snapshot.field}"]`);
  if (!node) return;
  node.focus();
  try { node.setSelectionRange(snapshot.start, snapshot.end); } catch (err) { /* input number không hỗ trợ */ }
}

function renderScenes() {
  const snapshot = captureFocus();
  el.sceneList.innerHTML = project.scenes.map(sceneCard).join('');
  restoreFocus(snapshot);
}

/* ------------------------------------------------------------------ video & storage */

async function hydrateVideos() {
  if (!project) return;
  for (const scene of project.scenes) {
    if (scene.video?.kind === 'idb' && !objectUrls.has(scene.id)) {
      try {
        const blob = await store.getVideo(scene.video.key);
        if (blob) objectUrls.set(scene.id, URL.createObjectURL(blob));
      } catch (err) {
        console.warn('Không đọc được video đã lưu:', err);
      }
    }
  }
  render();
}

async function attachBlob(index, blob, name) {
  const scene = project.scenes[index];
  const key = `${project.id}:${scene.id}`;
  try {
    await store.putVideo(key, blob);
  } catch (err) {
    toast('Không lưu được video vào bộ nhớ trình duyệt, video chỉ xem được trong phiên này.', true);
  }
  const old = objectUrls.get(scene.id);
  if (old) URL.revokeObjectURL(old);
  objectUrls.set(scene.id, URL.createObjectURL(blob));
  setProject(P.attachVideo(project, index, {
    kind: 'idb', key, name: name || 'video.mp4', size: blob.size, createdAt: new Date().toISOString(),
  }));
}

function attachUrl(index, url) {
  setProject(P.attachVideo(project, index, { kind: 'url', url, name: url.split('/').pop() || 'video' }));
}

/* ------------------------------------------------------------------ tạo dự án */

async function createProjectFromForm() {
  const idea = el.idea.value.trim();
  if (idea.length < 8) {
    el.ideaHint.textContent = 'Hãy mô tả ý tưởng dài hơn một chút (ít nhất 8 ký tự) để app hiểu bạn muốn gì.';
    el.idea.focus();
    return;
  }
  el.ideaHint.textContent = '';
  let next = P.createProject(idea, currentOptions());

  if (el.useAi.checked) {
    if (!settings.apiKey) {
      toast('Chưa có Gemini API key - app dùng engine offline để viết kịch bản.', true);
    } else {
      try {
        toast('Gemini đang viết kịch bản…');
        const aiScenes = await generateSceneContent(settings.apiKey, next.bible, next.scenes, settings.textModel);
        aiScenes.forEach((item) => {
          const index = (Number(item.number) || 0) - 1;
          if (index < 0 || index >= next.scenes.length) return;
          const patch = {};
          if (item.action) patch.action = item.action;
          if (item.title) patch.title = item.title;
          if (typeof item.voiceover === 'string') patch.voiceover = item.voiceover;
          next = P.updateScene(next, index, patch);
        });
        // AI chỉ viết nội dung, phần khoá nhân vật/sản phẩm vẫn do bible quyết định.
        next.scenes = next.scenes.map((s) => ({ ...s, stale: false }));
        toast('Gemini đã viết xong kịch bản.');
      } catch (err) {
        toast(`Gemini lỗi: ${err.message}. Đã dùng kịch bản offline.`, true);
      }
    }
  }

  objectUrls.forEach((url) => URL.revokeObjectURL(url));
  objectUrls.clear();
  setProject(next);
  el.scenesCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/* ------------------------------------------------------------------ generate video */

function openFlowModal(index) {
  flowSceneIndex = index;
  const scene = project.scenes[index];
  el.flowTitle.textContent = `Scene ${scene.number}: ${scene.title}`;
  el.flowSteps.innerHTML = flowSteps(scene, project.bible).map((s) => `<li>${escapeHtml(s)}</li>`).join('');
  el.flowPrompt.value = scene.prompt;
  el.flowUrl.value = '';
  el.flowModal.showModal();
  copyText(scene.prompt).then((ok) => { if (ok) toast('Đã copy prompt vào clipboard.'); });
}

async function generateScene(index, { silent = false } = {}) {
  const scene = project.scenes[index];
  if (settings.videoMode !== 'api' || !settings.apiKey) {
    openFlowModal(index);
    return false;
  }
  setProject(P.setSceneStatus(project, index, P.SCENE_STATUS.GENERATING), { save: false });
  try {
    const blob = await generateVideo(settings.apiKey, scene.prompt, {
      model: settings.videoModel,
      aspect: project.bible.aspect,
      negativePrompt: project.bible.negative,
      durationSeconds: scene.duration,
      onProgress: (message) => { if (!silent) toast(`Scene ${scene.number}: ${message}`); },
    });
    await attachBlob(index, blob, `scene-${scene.number}.mp4`);
    if (!silent) toast(`Scene ${scene.number} đã tạo xong.`);
    return true;
  } catch (err) {
    setProject(P.setSceneStatus(project, index, P.SCENE_STATUS.ERROR, err.message));
    if (!silent) toast(`Scene ${scene.number} lỗi: ${err.message}`, true);
    return false;
  }
}

async function generateAll() {
  if (settings.videoMode !== 'api' || !settings.apiKey) {
    // Chế độ Flow: dồn toàn bộ prompt vào clipboard và mở Flow một lần.
    const all = project.scenes.map((s) => `--- SCENE ${s.number} (${s.duration}s) ---\n${s.prompt}`).join('\n\n');
    const ok = await copyText(all);
    toast(ok
      ? `Đã copy prompt của ${project.scenes.length} cảnh. Mở Google Flow và dán lần lượt từng cảnh.`
      : 'Không copy được, bạn hãy copy thủ công từng cảnh.', !ok);
    if (ok && !openFlow()) {
      toast('Đã copy prompt. Trình duyệt chặn mở tab mới, bạn tự mở labs.google/fx/tools/flow nhé.', true);
    }
    return;
  }
  if (busy) return;
  busy = true;
  setProject({ ...project, scenes: project.scenes.map((s) => (s.video ? s : { ...s, status: P.SCENE_STATUS.QUEUED })) }, { save: false });
  for (let i = 0; i < project.scenes.length; i += 1) {
    if (project.scenes[i].video) continue;
    toast(`Đang tạo scene ${i + 1}/${project.scenes.length}…`);
    // eslint-disable-next-line no-await-in-loop
    await generateScene(i, { silent: true });
  }
  busy = false;
  toast('Đã chạy xong toàn bộ hàng đợi.');
}

/* ------------------------------------------------------------------ xuất & reset */

function download(filename, text, type = 'text/markdown;charset=utf-8') {
  try {
    const blob = new Blob([text], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return true;
  } catch (err) {
    return false;
  }
}

async function resetProject() {
  if (!project) {
    el.idea.value = '';
    toast('Chưa có dự án nào để reset.');
    return;
  }
  const ok = await askConfirm('Xoá toàn bộ dự án hiện tại (kịch bản, prompt, video đã gắn) và bắt đầu lại?');
  if (!ok) return;
  objectUrls.forEach((url) => URL.revokeObjectURL(url));
  objectUrls.clear();
  await store.clearVideos();
  store.clearProject();
  project = null;
  el.idea.value = '';
  el.ideaHint.textContent = '';
  renderIdeaForm();
  render();
  window.scrollTo({ top: 0, behavior: 'smooth' });
  toast('Đã reset dự án.');
}

/* ------------------------------------------------------------------ settings */

function loadSettingsIntoForm() {
  el.apiKey.value = settings.apiKey || '';
  el.videoMode.value = settings.videoMode || 'flow';
  el.textModel.value = settings.textModel || TEXT_MODELS[0];
  el.videoModel.value = settings.videoModel || VIDEO_MODELS[0];
  document.getElementById('text-models').innerHTML = TEXT_MODELS.map((m) => `<option value="${m}"></option>`).join('');
  document.getElementById('video-models').innerHTML = VIDEO_MODELS.map((m) => `<option value="${m}"></option>`).join('');
}

function saveSettingsFromForm() {
  settings = {
    apiKey: el.apiKey.value.trim(),
    videoMode: el.videoMode.value,
    textModel: el.textModel.value.trim() || TEXT_MODELS[0],
    videoModel: el.videoModel.value.trim() || VIDEO_MODELS[0],
  };
  store.saveSettings(settings);
  el.settingsModal.close();
  toast('Đã lưu cài đặt.');
}

/* ------------------------------------------------------------------ sự kiện */

function sceneIndexFrom(node) {
  const card = node.closest('.scene');
  return card ? Number(card.dataset.index) : -1;
}

function bindEvents() {
  document.addEventListener('click', async (event) => {
    const trigger = event.target.closest('[data-action]');
    if (!trigger) return;
    const action = trigger.dataset.action;
    const index = sceneIndexFrom(trigger);

    switch (action) {
      case 'use-example':
        el.idea.value = trigger.dataset.text;
        el.idea.focus();
        break;
      case 'create':
        await createProjectFromForm();
        break;
      case 'reset-project':
        await resetProject();
        break;
      case 'export':
        if (!project) { toast('Chưa có dự án để xuất.', true); break; }
        el.exportText.value = exportProjectText(project);
        el.exportModal.showModal();
        break;
      case 'export-copy': {
        const ok = await copyText(el.exportText.value);
        toast(ok ? 'Đã copy toàn bộ kịch bản.' : 'Không copy được, bạn hãy bôi đen rồi copy tay.', !ok);
        break;
      }
      case 'export-download':
        if (download(`kich-ban-${project.id}.md`, el.exportText.value)) toast('Đã tải file kịch bản .md');
        else toast('Trình duyệt chặn tải file ở đây. Hãy dùng nút Copy.', true);
        break;
      case 'confirm-yes':
        settleConfirm(true);
        break;
      case 'confirm-no':
        settleConfirm(false);
        break;
      case 'open-settings':
        loadSettingsIntoForm();
        el.settingsModal.showModal();
        break;
      case 'save-settings':
        saveSettingsFromForm();
        break;
      case 'apply-bible':
        applyBibleEdits();
        break;
      case 'copy-prompt': {
        const ok = await copyText(project.scenes[index].prompt);
        toast(ok ? `Đã copy prompt scene ${index + 1}.` : 'Không copy được.', !ok);
        break;
      }
      case 'copy-all': {
        const all = project.scenes.map((s) => `--- SCENE ${s.number} (${s.duration}s) ---\n${s.prompt}`).join('\n\n');
        const ok = await copyText(all);
        toast(ok ? 'Đã copy toàn bộ prompt.' : 'Không copy được.', !ok);
        break;
      }
      case 'generate-scene':
        await generateScene(index);
        break;
      case 'generate-all':
        await generateAll();
        break;
      case 'preview-scene': {
        const video = el.sceneList.querySelector(`.scene[data-index="${index}"] video`);
        if (!video) { toast('Cảnh này chưa có video để xem.', true); break; }
        video.scrollIntoView({ behavior: 'smooth', block: 'center' });
        video.play().catch(() => { /* trình duyệt chặn autoplay thì người dùng bấm play */ });
        break;
      }
      case 'regenerate-scene':
        setProject(P.regenerateScene(project, index));
        toast(`Đã tạo lại prompt cho scene ${index + 1}. Các cảnh khác giữ nguyên.`);
        break;
      case 'reset-prompt':
        setProject(P.resetScenePrompt(project, index));
        toast('Đã khôi phục prompt gốc của cảnh này.');
        break;
      case 'clear-video': {
        const scene = project.scenes[index];
        const url = objectUrls.get(scene.id);
        if (url) { URL.revokeObjectURL(url); objectUrls.delete(scene.id); }
        if (scene.video?.kind === 'idb') await store.deleteVideo(scene.video.key);
        setProject(P.clearVideo(project, index));
        break;
      }
      case 'rebuild': {
        const ok = await askConfirm('Dựng lại toàn bộ kịch bản theo ý tưởng và tuỳ chọn hiện tại? Prompt bạn đã tự sửa sẽ mất.');
        if (!ok) break;
        setProject(P.rebuildProject(project, { idea: el.idea.value.trim() || project.idea, options: currentOptions() }, { keepVideos: true }));
        toast('Đã dựng lại kịch bản.');
        break;
      }
      case 'flow-copy': {
        const ok = await copyText(el.flowPrompt.value);
        toast(ok ? 'Đã copy prompt.' : 'Không copy được.', !ok);
        break;
      }
      case 'flow-open':
        if (!openFlow()) {
          await copyText(FLOW_URL);
          toast('Trình duyệt chặn mở tab mới. Đã copy link Google Flow, bạn dán vào thanh địa chỉ nhé.', true);
        }
        break;
      case 'flow-url': {
        const url = el.flowUrl.value.trim();
        if (!url) { toast('Hãy dán link video trước.', true); break; }
        attachUrl(flowSceneIndex, url);
        el.flowModal.close();
        toast(`Đã gắn video cho scene ${flowSceneIndex + 1}.`);
        break;
      }
      default:
        break;
    }
  });

  // Sửa trực tiếp các trường của một scene: chỉ scene đó thay đổi.
  el.sceneList.addEventListener('change', (event) => {
    const node = event.target;
    const field = node.dataset.field;
    if (!field) return;
    const index = sceneIndexFrom(node);
    if (index < 0) return;

    if (field === 'prompt') {
      setProject(P.setScenePrompt(project, index, node.value));
      toast(`Đã lưu prompt riêng cho scene ${index + 1}. Nhân vật và sản phẩm ở các cảnh khác không đổi.`);
      return;
    }
    setProject(P.updateScene(project, index, { [field]: node.value }));
  });

  el.sceneList.addEventListener('change', async (event) => {
    if (event.target.dataset.action !== 'upload-video') return;
    const file = event.target.files?.[0];
    const index = sceneIndexFrom(event.target);
    if (!file || index < 0) return;
    await attachBlob(index, file, file.name);
    toast(`Đã gắn video cho scene ${index + 1}.`);
  });

  el.flowFile.addEventListener('change', async (event) => {
    const file = event.target.files?.[0];
    if (!file || flowSceneIndex == null) return;
    await attachBlob(flowSceneIndex, file, file.name);
    el.flowModal.close();
    toast(`Đã gắn video cho scene ${flowSceneIndex + 1}.`);
    event.target.value = '';
  });

  el.confirmModal.addEventListener('close', () => settleConfirm(false));

  window.addEventListener('beforeunload', () => {
    objectUrls.forEach((url) => URL.revokeObjectURL(url));
  });
}

function applyBibleEdits() {
  const patch = { character: {}, product: {}, setting: {} };
  el.bibleFields.querySelectorAll('[data-bible]').forEach((node) => {
    const path = node.dataset.bible;
    const value = node.value.trim();
    if (path === 'character.lock') patch.character.lock = value;
    else if (path === 'product.lock') patch.product.lock = value;
    else if (path === 'setting.description') patch.setting.description = value;
    else patch[path] = value;
  });
  if (patch.palette && patch.palette !== project.bible.palette) patch.paletteVi = patch.palette;
  setProject(P.updateBible(project, patch));
  toast('Đã đồng bộ nhân vật, sản phẩm và tông màu sang tất cả các cảnh.');
}

/* ------------------------------------------------------------------ khởi động */

/**
 * Khi app chạy trong khung nhúng, trình duyệt không cho trang tự tải file về.
 * Ẩn nút tải đi thay vì để người dùng bấm vào chỗ không có gì xảy ra.
 */
function hideUnsupportedControls() {
  let embedded = false;
  try { embedded = window.self !== window.top; } catch (err) { embedded = true; }
  if (!embedded) return;
  document.querySelectorAll('[data-action="export-download"]').forEach((node) => node.classList.add('hidden'));
  const hint = document.querySelector('#export-modal .hint');
  if (hint) hint.textContent = 'Bôi đen rồi copy, hoặc bấm nút Copy tất cả bên dưới.';
}

async function init() {
  settings = { ...settings, ...store.loadSettings() };
  const saved = store.loadProject();
  renderIdeaForm();
  bindEvents();
  hideUnsupportedControls();

  if (saved) {
    project = saved;
    el.idea.value = saved.idea;
    renderIdeaForm();
    render();
    await hydrateVideos();
    toast('Đã mở lại dự án lần trước.');
  }
}

init();
