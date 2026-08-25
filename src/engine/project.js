/**
 * Project state - toàn bộ logic thao tác dự án, viết thuần tuý (không đụng DOM)
 * để test được bằng Node.
 *
 * Nguyên tắc quan trọng: mọi hàm đều trả về project MỚI và chỉ thay đổi đúng
 * scene được yêu cầu. Nhân vật/sản phẩm nằm trong bible nên sửa hay regenerate
 * một scene không bao giờ làm lệch các scene còn lại.
 */

import { buildBible, patchBible } from './bible.js';
import { buildScenes } from './script.js';
import { compilePrompt, compileCompactPrompt, compileAll, promptWarnings, EDITABLE_SCENE_FIELDS } from './prompt.js';
import { DEFAULT_OPTIONS } from './presets.js';
import { hashSeed } from './text.js';

export const SCENE_STATUS = {
  IDLE: 'idle',
  QUEUED: 'queued',
  GENERATING: 'generating',
  DONE: 'done',
  ERROR: 'error',
};

function now() {
  return new Date().toISOString();
}

function newId() {
  return `p_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function decorate(scene) {
  return {
    customPrompt: null,
    extraNotes: '',
    status: SCENE_STATUS.IDLE,
    video: null,
    stale: false,
    error: '',
    ...scene,
  };
}

/** Tạo dự án mới từ ý tưởng + tuỳ chọn. */
export function createProject(idea, options = {}) {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const bible = buildBible(idea, opts);
  const scenes = compileAll(bible, buildScenes(bible)).map(decorate);
  return {
    id: newId(),
    createdAt: now(),
    updatedAt: now(),
    idea: String(idea || '').trim(),
    options: opts,
    bible,
    scenes,
    warnings: promptWarnings(bible, scenes),
  };
}

function touch(project, scenes, bible) {
  const nextScenes = scenes || project.scenes;
  const nextBible = bible || project.bible;
  return {
    ...project,
    bible: nextBible,
    scenes: nextScenes,
    warnings: promptWarnings(nextBible, nextScenes),
    updatedAt: now(),
  };
}

function recompile(bible, scene, total) {
  if (scene.customPrompt != null) {
    return { ...scene, prompt: scene.customPrompt, compact: compileCompactPrompt(bible, scene) };
  }
  return {
    ...scene,
    prompt: compilePrompt(bible, scene, { total }),
    compact: compileCompactPrompt(bible, scene),
  };
}

/** Sửa các trường của một scene (thời lượng, hành động, camera, lời thoại...). */
export function updateScene(project, index, patch) {
  const scenes = project.scenes.map((scene, i) => {
    if (i !== index) return scene; // các scene khác giữ nguyên tuyệt đối
    const allowed = {};
    for (const key of EDITABLE_SCENE_FIELDS) {
      if (Object.prototype.hasOwnProperty.call(patch, key)) allowed[key] = patch[key];
    }
    if (allowed.duration != null) allowed.duration = Math.max(1, Math.round(Number(allowed.duration) || scene.duration));
    const merged = { ...scene, ...allowed, stale: scene.video ? true : false };
    return recompile(project.bible, merged, project.scenes.length);
  });
  return touch(project, scenes);
}

/** Người dùng tự viết lại prompt của một scene. Không đụng tới bible và scene khác. */
export function setScenePrompt(project, index, text) {
  const scenes = project.scenes.map((scene, i) => (
    i === index
      ? { ...scene, customPrompt: String(text), prompt: String(text), stale: scene.video ? true : false }
      : scene
  ));
  return touch(project, scenes);
}

/** Bỏ bản prompt tự viết, quay lại prompt do app sinh ra cho riêng scene đó. */
export function resetScenePrompt(project, index) {
  const scenes = project.scenes.map((scene, i) => (
    i === index ? recompile(project.bible, { ...scene, customPrompt: null }, project.scenes.length) : scene
  ));
  return touch(project, scenes);
}

/**
 * Tạo lại nội dung MỘT scene với một biến thể mới (góc máy, chuyển động, hành động khác)
 * trong khi nhân vật, sản phẩm, bối cảnh và các scene khác giữ nguyên.
 */
export function regenerateScene(project, index) {
  const variantSeeds = {};
  const salt = hashSeed(`${project.id}:${index}:${Date.now()}:${Math.random()}`);
  variantSeeds[index] = salt;
  const fresh = buildScenes(project.bible, { variantSeeds })[index];
  if (!fresh) return project;

  const scenes = project.scenes.map((scene, i) => {
    if (i !== index) return scene;
    const merged = {
      ...scene,
      ...fresh,
      customPrompt: null,
      extraNotes: scene.extraNotes,
      status: scene.video ? SCENE_STATUS.DONE : SCENE_STATUS.IDLE,
      stale: Boolean(scene.video),
      error: '',
    };
    return recompile(project.bible, merged, project.scenes.length);
  });
  return touch(project, scenes);
}

/**
 * Cập nhật bible (nhân vật, sản phẩm, bối cảnh, tông màu...).
 * Áp cho tất cả các scene chưa bị viết đè prompt thủ công - đúng ý đồ "sửa một lần, đồng bộ tất cả".
 */
export function updateBible(project, patch) {
  const bible = patchBible(project.bible, patch);
  const scenes = project.scenes.map((scene) => recompile(bible, scene, project.scenes.length));
  return touch(project, scenes, bible);
}

/**
 * Dựng lại toàn bộ kịch bản khi người dùng đổi ý tưởng / tuỳ chọn.
 * @param {object} project
 * @param {object} next {idea, options}
 * @param {object} [opts] {keepVideos: giữ lại video đã tạo của các scene còn tồn tại}
 */
export function rebuildProject(project, next, opts = {}) {
  const idea = next.idea != null ? next.idea : project.idea;
  const options = { ...project.options, ...(next.options || {}) };
  const fresh = createProject(idea, options);

  if (opts.keepVideos) {
    fresh.scenes = fresh.scenes.map((scene, i) => {
      const old = project.scenes[i];
      if (!old || !old.video) return scene;
      return { ...scene, video: old.video, status: SCENE_STATUS.DONE, stale: true };
    });
  }
  return { ...fresh, id: project.id, createdAt: project.createdAt };
}

/** Gắn video (từ Google Flow hoặc từ API) vào một scene. */
export function attachVideo(project, index, video) {
  const scenes = project.scenes.map((scene, i) => (
    i === index
      ? { ...scene, video, status: SCENE_STATUS.DONE, stale: false, error: '' }
      : scene
  ));
  return touch(project, scenes);
}

export function setSceneStatus(project, index, status, error = '') {
  const scenes = project.scenes.map((scene, i) => (
    i === index ? { ...scene, status, error } : scene
  ));
  return touch(project, scenes);
}

export function clearVideo(project, index) {
  const scenes = project.scenes.map((scene, i) => (
    i === index ? { ...scene, video: null, status: SCENE_STATUS.IDLE, stale: false } : scene
  ));
  return touch(project, scenes);
}

export function totalDuration(project) {
  return project.scenes.reduce((sum, scene) => sum + (Number(scene.duration) || 0), 0);
}

export function progress(project) {
  const done = project.scenes.filter((scene) => scene.video).length;
  return { done, total: project.scenes.length, percent: project.scenes.length ? Math.round((done / project.scenes.length) * 100) : 0 };
}
