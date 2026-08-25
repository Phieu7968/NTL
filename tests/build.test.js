/**
 * Test bản gộp một file.
 *
 * Bản này tồn tại để người dùng bấm đúp là chạy, nên nó phải tự đứng được:
 * không tham chiếu file ngoài, và không chứa chuỗi làm vỡ thẻ <script>.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

test('npm run build tạo được file gộp và file đó tự đứng một mình', () => {
  execFileSync(process.execPath, [resolve(ROOT, 'build.js')], { cwd: ROOT, stdio: 'pipe' });
  const html = readFileSync(resolve(ROOT, 'dist/ai-video-studio.html'), 'utf8');

  // Không còn tham chiếu ra ngoài - bấm đúp ở đâu cũng chạy.
  assert.ok(!html.includes('src="./src/app.js"'), 'vẫn còn nạp app.js từ ngoài');
  assert.ok(!html.includes('styles.css'), 'vẫn còn nạp styles.css từ ngoài');
  assert.ok(!/<script[^>]*\ssrc=/.test(html), 'không được còn script tải từ ngoài');

  // Chuỗi "</script" lọt vào phần JS sẽ cắt đứt script giữa chừng.
  const js = html.slice(html.indexOf('<script>'), html.lastIndexOf('</script>'));
  assert.ok(!js.includes('</script'), 'phần JS nội tuyến chứa thẻ đóng script');

  // Các phần bắt buộc phải có mặt.
  for (const marker of ['Bạn muốn tạo video gì?', 'buildLogline', 'compilePrompt', 'const P = {', 'const store = {']) {
    assert.ok(html.includes(marker), `thiếu "${marker}" trong bản gộp`);
  }
  assert.ok(html.length > 80000, 'bản gộp quá nhỏ, có thể thiếu module');
});
