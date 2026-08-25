/**
 * Test engine bằng node:test (không cần cài thêm gì).
 * Chạy: npm test
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { buildBible } from '../src/engine/bible.js';
import { buildScenes, planBeats, distributeDuration } from '../src/engine/script.js';
import { compilePrompt, compileAll, promptWarnings, exportProjectText } from '../src/engine/prompt.js';
import * as P from '../src/engine/project.js';
import { normalize } from '../src/engine/text.js';
import { buildLogline, buildTimeline } from '../src/engine/synopsis.js';

const IDEA_PERFUME = 'Tạo video quảng cáo một chai nước hoa dành cho nữ, phong cách sang trọng, cinematic';
const IDEA_FASHION = 'Tạo video quảng cáo một cô gái Việt Nam giới thiệu sản phẩm thời trang trong quán cà phê hiện đại';
const OPTS = { genre: 'ad', style: 'cinematic', duration: 30, aspect: '16:9', sceneCount: 5, language: 'vi' };

test('normalize bỏ dấu tiếng Việt', () => {
  assert.equal(normalize('Quán Cà Phê Hiện Đại'), 'quan ca phe hien dai');
  assert.equal(normalize('ĐÀ NẴNG'), 'da nang');
});

test('bible nhận diện đúng sản phẩm, nhân vật và bối cảnh', () => {
  const bible = buildBible(IDEA_FASHION, OPTS);
  assert.equal(bible.product.category, 'fashion');
  assert.equal(bible.setting.name, 'modern coffee shop');
  assert.equal(bible.character.present, true);
  assert.equal(bible.character.ethnicity, 'Vietnamese');
  assert.equal(bible.character.gender, 'female');
});

test('không nhầm chuỗi con: "phong cách" không thành màu hồng, "dành cho" không thành cái chợ', () => {
  const bible = buildBible(IDEA_PERFUME, OPTS);
  assert.equal(bible.product.category, 'fragrance');
  assert.notEqual(bible.setting.name, 'local market');
  assert.notEqual(bible.product.colour, 'soft blush pink');
});

test('"Việt Nam" không bị hiểu là giới tính nam', () => {
  const bible = buildBible('Quảng cáo cô gái Việt Nam uống trà sữa', OPTS);
  assert.equal(bible.character.gender, 'female');
});

test('cùng ý tưởng + tuỳ chọn thì kết quả tái lập được', () => {
  const a = buildBible(IDEA_PERFUME, OPTS);
  const b = buildBible(IDEA_PERFUME, OPTS);
  assert.equal(a.character.lock, b.character.lock);
  assert.equal(a.seed, b.seed);
});

test('planBeats trả đúng số cảnh, kể cả khi ít hơn hay nhiều hơn số beat', () => {
  for (const count of [3, 4, 5, 7, 10, 12]) {
    const beats = planBeats('ad', count);
    assert.equal(beats.length, count, `sceneCount=${count}`);
    assert.equal(beats[0].id, 'hook');
    assert.equal(beats[beats.length - 1].id, 'cta');
  }
});

test('tổng thời lượng các cảnh khớp thời lượng người dùng chọn', () => {
  for (const [count, total] of [[3, 15], [5, 30], [8, 60], [12, 90]]) {
    const beats = planBeats('ad', count);
    const seconds = distributeDuration(beats, total);
    assert.equal(seconds.length, count);
    assert.equal(seconds.reduce((a, b) => a + b, 0), total, `${count} cảnh / ${total}s`);
    assert.ok(seconds.every((s) => s >= 2), 'mỗi cảnh tối thiểu 2 giây');
  }
});

test('prompt của mỗi cảnh có đủ các thành phần bắt buộc', () => {
  const bible = buildBible(IDEA_FASHION, OPTS);
  const scenes = compileAll(bible, buildScenes(bible));
  for (const scene of scenes) {
    for (const label of ['Subject:', 'Action:', 'Setting:', 'Camera:', 'Lighting:', 'Look:', 'Audio:', 'Continuity:', 'Negative prompt:']) {
      assert.ok(scene.prompt.includes(label), `scene ${scene.number} thiếu "${label}"`);
    }
    assert.ok(scene.prompt.includes(bible.character.id), 'thiếu khoá nhân vật');
    assert.ok(scene.prompt.includes(bible.aspect), 'thiếu tỷ lệ khung hình');
  }
});

test('nhân vật và sản phẩm giống hệt nhau ở mọi cảnh', () => {
  const bible = buildBible(IDEA_FASHION, OPTS);
  const scenes = compileAll(bible, buildScenes(bible));
  const charLines = scenes.map((s) => s.prompt.split('\n').find((l) => l.startsWith('Subject:')));
  const prodLines = scenes.map((s) => s.prompt.split('\n').find((l) => l.startsWith('Product')));
  assert.equal(new Set(charLines).size, 1, 'mô tả nhân vật phải giống nhau ở mọi cảnh');
  assert.equal(new Set(prodLines).size, 1, 'mô tả sản phẩm phải giống nhau ở mọi cảnh');
});

test('sửa một cảnh không đụng tới các cảnh khác', () => {
  let project = P.createProject(IDEA_FASHION, OPTS);
  const before = project.scenes.map((s) => s.prompt);

  project = P.updateScene(project, 2, { action: 'cô gái bước tới cửa sổ và nhìn ra ngoài' });
  const after = project.scenes.map((s) => s.prompt);

  assert.notEqual(before[2], after[2], 'cảnh được sửa phải đổi');
  before.forEach((prompt, i) => {
    if (i !== 2) assert.equal(prompt, after[i], `cảnh ${i + 1} không được đổi`);
  });
  assert.ok(after[2].includes(project.bible.character.id), 'nhân vật vẫn phải được khoá trong cảnh đã sửa');
});

test('regenerate một cảnh giữ nguyên nhân vật, sản phẩm và các cảnh khác', () => {
  let project = P.createProject(IDEA_PERFUME, OPTS);
  const before = project.scenes.map((s) => s.prompt);
  const charLock = project.bible.character.lock;

  project = P.regenerateScene(project, 1);
  const after = project.scenes.map((s) => s.prompt);

  before.forEach((prompt, i) => {
    if (i !== 1) assert.equal(prompt, after[i], `cảnh ${i + 1} phải giữ nguyên`);
  });
  assert.equal(project.bible.character.lock, charLock, 'bible không được đổi');
  assert.ok(after[1].includes(charLock), 'cảnh vừa regenerate vẫn dùng đúng nhân vật cũ');
});

test('regenerate không làm mất video của các cảnh khác', () => {
  let project = P.createProject(IDEA_PERFUME, OPTS);
  project = P.attachVideo(project, 0, { kind: 'url', url: 'https://example.com/1.mp4' });
  project = P.attachVideo(project, 3, { kind: 'url', url: 'https://example.com/4.mp4' });
  project = P.regenerateScene(project, 2);

  assert.ok(project.scenes[0].video, 'video cảnh 1 phải còn');
  assert.ok(project.scenes[3].video, 'video cảnh 4 phải còn');
  assert.equal(project.scenes[2].video, null, 'cảnh vừa regenerate chưa có video');
  assert.equal(P.progress(project).done, 2);
});

test('prompt tự viết được giữ và khôi phục lại được', () => {
  let project = P.createProject(IDEA_PERFUME, OPTS);
  const original = project.scenes[1].prompt;

  project = P.setScenePrompt(project, 1, 'PROMPT DO TÔI TỰ VIẾT');
  assert.equal(project.scenes[1].prompt, 'PROMPT DO TÔI TỰ VIẾT');

  // prompt tự viết không bị ghi đè khi cập nhật bible
  project = P.updateBible(project, { palette: 'chỉ hai màu đen trắng' });
  assert.equal(project.scenes[1].prompt, 'PROMPT DO TÔI TỰ VIẾT');
  assert.ok(project.scenes[0].prompt.includes('chỉ hai màu đen trắng'), 'các cảnh khác nhận tông màu mới');

  project = P.resetScenePrompt(project, 1);
  assert.notEqual(project.scenes[1].prompt, 'PROMPT DO TÔI TỰ VIẾT');
  assert.ok(project.scenes[1].prompt.includes('Subject:'));
  assert.notEqual(project.scenes[1].prompt, original, 'prompt gốc được dựng lại theo bible mới nhất');
});

test('cập nhật bible đồng bộ nhân vật mới sang tất cả các cảnh', () => {
  let project = P.createProject(IDEA_FASHION, OPTS);
  const newLock = 'LAN (30-year-old Vietnamese woman) in a red ao dai, same face in every shot';
  project = P.updateBible(project, { character: { lock: newLock } });
  for (const scene of project.scenes) {
    assert.ok(scene.prompt.includes(newLock), `cảnh ${scene.number} phải dùng nhân vật mới`);
  }
});

test('đổi thời lượng một cảnh chỉ đổi cảnh đó', () => {
  let project = P.createProject(IDEA_PERFUME, OPTS);
  const totalBefore = P.totalDuration(project);
  project = P.updateScene(project, 0, { duration: 9 });
  assert.equal(project.scenes[0].duration, 9);
  assert.notEqual(P.totalDuration(project), totalBefore - project.scenes[0].duration);
  assert.ok(project.scenes[0].prompt.includes('9s'));
});

test('cảnh dài hơn 8 giây được cảnh báo', () => {
  const project = P.createProject(IDEA_PERFUME, { ...OPTS, duration: 60, sceneCount: 3 });
  assert.ok(project.warnings.some((w) => w.includes('8s')), 'phải cảnh báo clip quá dài');
});

test('rebuild giữ lại video đã tạo khi được yêu cầu', () => {
  let project = P.createProject(IDEA_PERFUME, OPTS);
  project = P.attachVideo(project, 0, { kind: 'url', url: 'https://example.com/1.mp4' });
  const rebuilt = P.rebuildProject(project, { options: { ...OPTS, style: 'moody' } }, { keepVideos: true });
  assert.ok(rebuilt.scenes[0].video, 'video được giữ');
  assert.equal(rebuilt.id, project.id, 'vẫn là cùng một dự án');
  assert.notEqual(rebuilt.bible.style, project.bible.style);
});

test('mọi thể loại đều dựng được kịch bản đầy đủ', () => {
  const genres = ['ad', 'brand', 'review', 'story', 'tutorial', 'travel', 'music', 'social', 'realestate', 'food'];
  for (const genre of genres) {
    const project = P.createProject('Một ý tưởng video thử nghiệm cho mọi thể loại', { ...OPTS, genre, sceneCount: 6 });
    assert.equal(project.scenes.length, 6, genre);
    project.scenes.forEach((scene) => {
      assert.ok(scene.prompt.length > 200, `${genre} scene ${scene.number} prompt quá ngắn`);
      assert.ok(scene.action && scene.action.length > 10, `${genre} scene ${scene.number} thiếu hành động`);
      assert.ok(!scene.prompt.includes('undefined'), `${genre} scene ${scene.number} có "undefined"`);
      assert.ok(!scene.prompt.includes('{p}'), `${genre} scene ${scene.number} còn placeholder chưa thay`);
    });
  }
});

test('ngôn ngữ "không lời thoại" thì prompt không có dialogue', () => {
  const project = P.createProject(IDEA_PERFUME, { ...OPTS, language: 'none' });
  for (const scene of project.scenes) {
    assert.ok(scene.prompt.includes('Dialogue: none'), `cảnh ${scene.number} phải ghi rõ không có thoại`);
  }
});

test('xuất kịch bản ra text có đủ ý tưởng, phần khoá và toàn bộ prompt', () => {
  const project = P.createProject(IDEA_FASHION, OPTS);
  const text = exportProjectText(project);
  assert.ok(text.includes(project.idea));
  assert.ok(text.includes('Nhân vật & sản phẩm'));
  project.scenes.forEach((scene) => {
    assert.ok(text.includes(`Scene ${scene.number}`), `thiếu scene ${scene.number}`);
    assert.ok(text.includes(scene.prompt), `thiếu prompt scene ${scene.number}`);
  });
});

test('promptWarnings nhắc đặt tên thương hiệu khi chưa có', () => {
  const bible = buildBible(IDEA_PERFUME, OPTS);
  const scenes = compileAll(bible, buildScenes(bible));
  assert.ok(promptWarnings(bible, scenes).some((w) => w.includes('THƯƠNG HIỆU')));

  const branded = buildBible('Quảng cáo nước hoa "Elysia" sang trọng', OPTS);
  const brandedScenes = compileAll(branded, buildScenes(branded));
  assert.equal(branded.product.brand, 'Elysia');
  assert.ok(!promptWarnings(branded, brandedScenes).some((w) => w.includes('THƯƠNG HIỆU')));
});

test('compilePrompt không phụ thuộc thứ tự - gọi lại cho kết quả y hệt', () => {
  const bible = buildBible(IDEA_FASHION, OPTS);
  const scenes = buildScenes(bible);
  const a = compilePrompt(bible, scenes[2], { total: scenes.length });
  const b = compilePrompt(bible, scenes[2], { total: scenes.length });
  assert.equal(a, b);
});

/* ---------------------------------------------- phần Kịch bản (logline + timeline) */

test('logline tiếng Việt nêu đúng thể loại, thời lượng, nhân vật và bối cảnh', () => {
  const project = P.createProject(IDEA_FASHION, OPTS);
  const line = buildLogline(project.bible, project.scenes);
  assert.ok(line.includes('30 giây'), 'phải nêu tổng thời lượng');
  assert.ok(line.includes('5 cảnh'), 'phải nêu số cảnh');
  assert.ok(line.includes(project.bible.character.name), 'phải nhắc tên nhân vật');
  assert.ok(line.includes('quán cà phê hiện đại'), 'phải mô tả bối cảnh bằng tiếng Việt');
  assert.ok(!/[a-z]{3,} [a-z]{3,} and [a-z]{3,}/.test(line), 'tông màu phải hiển thị tiếng Việt');
});

test('logline vẫn chạy khi không có nhân vật hay sản phẩm', () => {
  const project = P.createProject('Video phong cảnh ruộng bậc thang mùa lúa chín', { ...OPTS, genre: 'travel' });
  const line = buildLogline(project.bible, project.scenes);
  assert.ok(line.length > 40);
  assert.ok(!line.includes('undefined'));
});

test('timeline nối liền nhau và kết thúc đúng tổng thời lượng', () => {
  const project = P.createProject(IDEA_PERFUME, OPTS);
  const timeline = buildTimeline(project.scenes);
  assert.equal(timeline.length, project.scenes.length);
  assert.equal(timeline[0].start, 0);
  timeline.forEach((item, i) => {
    assert.equal(item.end - item.start, project.scenes[i].duration, `độ dài cảnh ${i + 1}`);
    if (i > 0) assert.equal(item.start, timeline[i - 1].end, `cảnh ${i + 1} phải nối tiếp cảnh trước`);
  });
  assert.equal(timeline[timeline.length - 1].end, P.totalDuration(project));
  assert.match(timeline[0].range, /^00:00 – 00:\d\d$/);
});

test('timeline cập nhật theo thời lượng người dùng sửa', () => {
  let project = P.createProject(IDEA_PERFUME, OPTS);
  project = P.updateScene(project, 0, { duration: 4 });
  const timeline = buildTimeline(project.scenes);
  assert.equal(timeline[0].end, 4);
  assert.equal(timeline[1].start, 4);
});

test('bản xuất .md có cả phần kịch bản lẫn dòng thời gian', () => {
  const project = P.createProject(IDEA_FASHION, OPTS);
  const text = exportProjectText(project);
  assert.ok(text.includes('## Kịch bản'));
  assert.ok(text.includes(buildLogline(project.bible, project.scenes)));
  buildTimeline(project.scenes).forEach((item) => {
    assert.ok(text.includes(item.range), `thiếu mốc thời gian ${item.range}`);
  });
});

test('tên dự án bỏ phần "Tạo video…" ở đầu câu', () => {
  const fashionTitle = buildBible(IDEA_FASHION, OPTS).title;
  assert.ok(fashionTitle.startsWith('Quảng Cáo Một Cô Gái Việt Nam'), `tên dự án không nên bắt đầu bằng "Tạo video": ${fashionTitle}`);
  assert.equal(buildBible('Làm một clip du lịch Hà Giang', OPTS).title, 'Du Lịch Hà Giang');
  assert.equal(buildBible('Video giới thiệu quán cà phê mới', OPTS).title, 'Giới Thiệu Quán Cà Phê Mới');
  assert.ok(buildBible('', OPTS).title.length > 0, 'ý tưởng rỗng vẫn phải có tên');
  const long = buildBible('Tạo video quảng cáo một dòng sản phẩm chăm sóc da hoàn toàn mới dành cho phụ nữ hiện đại', OPTS).title;
  assert.ok(long.length <= 60, 'tên dài phải được cắt gọn');
  assert.ok(!long.endsWith(' '), 'không được cắt giữa chừng để lại khoảng trắng');
});
