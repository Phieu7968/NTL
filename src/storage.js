/**
 * Lưu trữ phía trình duyệt.
 * - Dự án (text/JSON) -> localStorage, nhẹ và đọc ngay khi mở lại app.
 * - Video (blob, có thể vài chục MB) -> IndexedDB, vì localStorage không chứa nổi.
 */

const PROJECT_KEY = 'ntl.aivideo.project.v1';
const SETTINGS_KEY = 'ntl.aivideo.settings.v1';
const DB_NAME = 'ntl-aivideo';
const STORE = 'videos';

export function saveProject(project) {
  try {
    localStorage.setItem(PROJECT_KEY, JSON.stringify(project));
    return true;
  } catch (err) {
    console.warn('Không lưu được dự án:', err);
    return false;
  }
}

export function loadProject() {
  try {
    const raw = localStorage.getItem(PROJECT_KEY);
    if (!raw) return null;
    const project = JSON.parse(raw);
    if (!project?.bible || !Array.isArray(project.scenes)) return null;
    // objectURL của phiên trước đã chết -> dựng lại từ IndexedDB khi render.
    project.scenes = project.scenes.map((scene) => (
      scene.video ? { ...scene, video: { ...scene.video, url: scene.video.kind === 'idb' ? null : scene.video.url } } : scene
    ));
    return project;
  } catch (err) {
    console.warn('Không đọc được dự án đã lưu:', err);
    return null;
  }
}

export function clearProject() {
  localStorage.removeItem(PROJECT_KEY);
}

export function saveSettings(settings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch (err) {
    console.warn('Không lưu được cấu hình:', err);
  }
}

export function loadSettings() {
  try {
    return JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
  } catch (err) {
    return {};
  }
}

function openDb() {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) {
      reject(new Error('Trình duyệt không hỗ trợ IndexedDB.'));
      return;
    }
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function withStore(mode, fn) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const store = tx.objectStore(STORE);
    const result = fn(store);
    tx.oncomplete = () => { db.close(); resolve(result?.result !== undefined ? result.result : result); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

export async function putVideo(key, blob) {
  return withStore('readwrite', (store) => store.put(blob, key));
}

export async function getVideo(key) {
  return withStore('readonly', (store) => store.get(key));
}

export async function deleteVideo(key) {
  return withStore('readwrite', (store) => store.delete(key));
}

export async function clearVideos() {
  try {
    await withStore('readwrite', (store) => store.clear());
  } catch (err) {
    console.warn('Không xoá được video đã lưu:', err);
  }
}
