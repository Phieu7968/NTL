/**
 * Gộp app thành MỘT file HTML chạy được bằng cách bấm đúp (giao thức file://).
 *
 * Lý do cần bản này: index.html nạp mã bằng ES module, mà trình duyệt chặn module
 * trên file:// vì lý do bảo mật. Bản gộp nội tuyến toàn bộ CSS và JS vào một
 * <script> thường nên không còn phụ thuộc vào server.
 *
 * Chạy: npm run build  ->  dist/ai-video-studio.html
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const ENTRY = resolve(ROOT, 'src/app.js');

const IMPORT_RE = /^\s*import\s+[^;]*?from\s+['"]([^'"]+)['"]\s*;?\s*$/gm;
const BARE_IMPORT_RE = /^\s*import\s+['"]([^'"]+)['"]\s*;?\s*$/gm;
// import * as NS from './x.js' - phải dựng lại object NS vì bản gộp không còn module
const NAMESPACE_IMPORT_RE = /^\s*import\s+\*\s+as\s+([A-Za-z_$][\w$]*)\s+from\s+['"]([^'"]+)['"]\s*;?\s*$/gm;

/** Tên các thứ một module export ra, kèm tên nội bộ tương ứng. */
function exportedNames(source) {
  const names = new Map(); // tên xuất ra -> tên nội bộ
  const declared = /^\s*export\s+(?:async\s+)?(?:function|const|let|var|class)\s+([A-Za-z_$][\w$]*)/gm;
  let match = declared.exec(source);
  while (match) {
    names.set(match[1], match[1]);
    match = declared.exec(source);
  }
  const listed = /^\s*export\s*\{([^}]*)\}\s*;?\s*$/gm;
  match = listed.exec(source);
  while (match) {
    match[1].split(',').forEach((entry) => {
      const parts = entry.trim().split(/\s+as\s+/);
      if (!parts[0]) return;
      names.set((parts[1] || parts[0]).trim(), parts[0].trim());
    });
    match = listed.exec(source);
  }
  return names;
}

/** Đọc một module và trả về danh sách module nó phụ thuộc. */
function dependenciesOf(source, file) {
  const deps = [];
  for (const re of [IMPORT_RE, BARE_IMPORT_RE]) {
    re.lastIndex = 0;
    let match = re.exec(source);
    while (match) {
      const spec = match[1];
      if (!spec.startsWith('.')) {
        throw new Error(`${file}: chỉ hỗ trợ import tương đối, gặp "${spec}"`);
      }
      deps.push(resolve(dirname(file), spec));
      match = re.exec(source);
    }
  }
  return deps;
}

/** Bỏ import/export để mọi module dùng chung một scope. */
function stripModuleSyntax(source) {
  return source
    .replace(IMPORT_RE, '')
    .replace(BARE_IMPORT_RE, '')
    // export { a, b as c };  ->  bỏ hẳn, mọi thứ đã cùng scope
    .replace(/^\s*export\s*\{[^}]*\}\s*;?\s*$/gm, '')
    .replace(/^(\s*)export\s+default\s+/gm, '$1')
    .replace(/^(\s*)export\s+(const|let|var|function|class|async)\b/gm, '$1$2');
}

/** Duyệt đồ thị phụ thuộc theo chiều sâu, module phụ thuộc đứng trước. */
function collectModules(entry) {
  const ordered = [];
  const state = new Map(); // 'visiting' | 'done'

  function visit(file) {
    if (state.get(file) === 'done') return;
    if (state.get(file) === 'visiting') throw new Error(`Phụ thuộc vòng tại ${file}`);
    state.set(file, 'visiting');

    const source = readFileSync(file, 'utf8');
    dependenciesOf(source, file).forEach(visit);

    state.set(file, 'done');
    ordered.push({ file, source });
  }

  visit(entry);
  return ordered;
}

/** Bắt lỗi trùng tên giữa các module - vì bản gộp dùng chung một scope. */
function assertNoNameClash(modules) {
  const seen = new Map();
  const declaration = /^(?:async\s+)?(?:function|const|let|var|class)\s+([A-Za-z_$][\w$]*)/gm;

  for (const { file, source } of modules) {
    const stripped = stripModuleSyntax(source);
    declaration.lastIndex = 0;
    let match = declaration.exec(stripped);
    while (match) {
      const name = match[1];
      if (seen.has(name) && seen.get(name) !== file) {
        throw new Error(`Trùng tên "${name}" giữa ${seen.get(name)} và ${file} - đổi tên một bên trước khi gộp.`);
      }
      seen.set(name, file);
      match = declaration.exec(stripped);
    }
  }
}

function build() {
  const modules = collectModules(ENTRY);
  assertNoNameClash(modules);

  const exportsByFile = new Map(modules.map(({ file, source }) => [file, exportedNames(source)]));

  const js = modules
    .map(({ file, source }) => {
      const label = file.replace(ROOT + '/', '');
      const namespaces = [];
      NAMESPACE_IMPORT_RE.lastIndex = 0;
      let match = NAMESPACE_IMPORT_RE.exec(source);
      while (match) {
        const [, alias, spec] = match;
        const target = resolve(dirname(file), spec);
        const names = exportsByFile.get(target);
        if (!names) throw new Error(`${label}: không tìm thấy module "${spec}" để dựng namespace ${alias}`);
        const fields = [...names.entries()].map(([out, local]) => (out === local ? out : `${out}: ${local}`));
        namespaces.push(`const ${alias} = { ${fields.join(', ')} };`);
        match = NAMESPACE_IMPORT_RE.exec(source);
      }
      const body = stripModuleSyntax(source).trim();
      return `\n/* ===== ${label} ===== */\n${namespaces.length ? `${namespaces.join('\n')}\n` : ''}${body}\n`;
    })
    .join('');

  const css = readFileSync(resolve(ROOT, 'styles.css'), 'utf8');
  let html = readFileSync(resolve(ROOT, 'index.html'), 'utf8');

  // Dùng hàm thay thế chứ không phải chuỗi: mã nguồn có '$&' (escape regex) và
  // String.replace sẽ diễn giải nó thành đoạn vừa khớp, làm hỏng cả file.
  html = html.replace('<link rel="stylesheet" href="./styles.css" />', () => `<style>\n${css}\n</style>`);
  html = html.replace(
    '<script type="module" src="./src/app.js"></script>',
    () => `<script>\n(function () {\n'use strict';\n${js}\n})();\n</script>`,
  );
  html = html.replace(
    '<title>',
    () => '<!-- Bản gộp một file, tạo bằng: npm run build. Sửa mã nguồn trong src/ rồi build lại. -->\n<title>',
  );

  // Không được để chuỗi kết thúc thẻ script lọt vào phần JS nội tuyến.
  const scriptBody = html.slice(html.indexOf('<script>'), html.lastIndexOf('</script>'));
  if (scriptBody.includes('</script')) {
    throw new Error('Phần JS nội tuyến chứa "</script" - bản gộp sẽ vỡ khi trình duyệt phân tích.');
  }

  mkdirSync(resolve(ROOT, 'dist'), { recursive: true });
  const out = resolve(ROOT, 'dist/ai-video-studio.html');
  writeFileSync(out, html, 'utf8');

  const kb = Math.round(Buffer.byteLength(html, 'utf8') / 1024);
  console.log(`Đã gộp ${modules.length} module -> dist/ai-video-studio.html (${kb} KB)`);
  modules.forEach((m) => console.log('  ·', m.file.replace(ROOT + '/', '')));
}

build();
