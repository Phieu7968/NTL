/**
 * Test độ khớp giữa ý tưởng và những gì engine suy ra.
 *
 * Lỗi từng gặp: "nhân viên" bị hiểu thành nhẫn (trang sức), và mọi video quảng cáo
 * đều bị gán một cô người mẫu mặc váy lụa - kể cả video an toàn lao động.
 * Bộ test này chặn đúng lớp lỗi đó.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { buildBible } from '../src/engine/bible.js';
import * as P from '../src/engine/project.js';

const OPTS = { genre: 'ad', style: 'cinematic', duration: 20, aspect: '16:9', sceneCount: 3, language: 'vi' };

/** Những câu này không nhắc tới sản phẩm nào - engine không được bịa ra. */
const NO_PRODUCT = [
  'Video giới thiệu trường THPT Nguyễn Trãi nhân dịp khai giảng',
  'Clip tuyển dụng nhân viên kỹ thuật cho nhà máy cơ khí',
  'Video hướng dẫn phòng cháy chữa cháy cho khu chung cư',
  'Phóng sự về đội ngũ y bác sĩ tuyến đầu',
  'Video tổng kết năm học của nhà trường',
];

/** Những câu này không nhắc tới người - engine không được thêm nhân vật. */
const NO_PERSON = [
  'Video giới thiệu trường THPT Nguyễn Trãi nhân dịp khai giảng',
  'Quảng cáo chai nước hoa sang trọng',
  'Video hướng dẫn phòng cháy chữa cháy cho khu chung cư',
];

test('không bịa sản phẩm khi ý tưởng không có sản phẩm nào', () => {
  for (const idea of NO_PRODUCT) {
    const bible = buildBible(idea, OPTS);
    assert.equal(bible.product.present, false, `bịa sản phẩm cho: ${idea}`);
  }
});

test('không bịa nhân vật khi ý tưởng không nhắc tới người', () => {
  for (const idea of NO_PERSON) {
    const bible = buildBible(idea, OPTS);
    assert.equal(bible.character.present, false, `bịa nhân vật cho: ${idea}`);
  }
});

test('"nhân viên", "nhân dịp", "nhân vật" không bị hiểu thành nhẫn/trang sức', () => {
  for (const idea of ['Tuyển dụng nhân viên bán hàng', 'Video nhân dịp kỷ niệm 20 năm', 'Giới thiệu nhân vật chính của phim']) {
    const bible = buildBible(idea, OPTS);
    assert.notEqual(bible.product?.category, 'luxury', `hiểu nhầm trang sức: ${idea}`);
  }
});

test('"vay vốn" không bị hiểu thành váy áo thời trang', () => {
  const bible = buildBible('Video giới thiệu gói vay vốn cho hộ kinh doanh', OPTS);
  assert.notEqual(bible.product?.category, 'fashion');
});

test('nghề nghiệp và trang phục bám theo ý tưởng, không mặc định người mẫu', () => {
  const worker = buildBible('Video an toàn lao động cho công nhân xây dựng', OPTS);
  assert.match(worker.character.lock, /factory worker|engineer/);
  assert.match(worker.character.lock, /uniform|helmet/);
  assert.doesNotMatch(worker.character.lock, /slip dress|silk blouse/);
  assert.doesNotMatch(worker.character.lock, /soft natural makeup/, 'không trang điểm đậm cho video công trường');

  const doctor = buildBible('Video giới thiệu đội ngũ bác sĩ phòng khám', OPTS);
  assert.match(doctor.character.lock, /doctor/);
  assert.match(doctor.character.lock, /white coat/);
});

test('video thời trang thì vẫn được giữ trang phục trau chuốt', () => {
  const bible = buildBible('Quảng cáo cô gái Việt Nam giới thiệu bộ sưu tập thời trang', OPTS);
  assert.equal(bible.character.present, true);
  assert.match(bible.character.lock, /blouse|dress|knit/);
});

test('mọi prompt đều mang theo ý tưởng gốc của người dùng', () => {
  for (const idea of [...NO_PRODUCT, 'Quảng cáo chai nước hoa "Elysia" sang trọng']) {
    const project = P.createProject(idea, OPTS);
    for (const scene of project.scenes) {
      assert.ok(scene.prompt.includes(idea), `scene ${scene.number} thiếu ý tưởng gốc: ${idea}`);
    }
  }
});

test('chưa nhận ra sản phẩm thì để trống lời thoại thay vì gán câu lạc đề', () => {
  const project = P.createProject('Video hướng dẫn phòng cháy chữa cháy cho khu chung cư', { ...OPTS, genre: 'tutorial' });
  for (const scene of project.scenes) {
    assert.equal(scene.voiceover, '', `scene ${scene.number} không được có lời thoại bịa`);
    assert.ok(!scene.prompt.includes('khoảnh khắc đẹp'), 'lời thoại quảng cáo lọt vào video hướng dẫn');
  }
  assert.ok(project.warnings.some((w) => w.includes('chưa nhận ra sản phẩm')), 'phải cảnh báo cho người dùng biết');
});

test('bối cảnh không nhận ra thì bám theo ý tưởng, không áp đặt phim trường tối', () => {
  const bible = buildBible('Video kỷ niệm ngày thành lập công ty', OPTS);
  assert.equal(bible.setting.matched, false);
  assert.ok(!bible.setting.description.includes('dark cinematic studio set'));
  assert.match(bible.setting.description, /fits the concept/);
});

test('bối cảnh quen thuộc vẫn nhận ra đúng', () => {
  const cases = [
    ['Video an toàn tại nhà máy sản xuất', 'factory'],
    ['Giới thiệu trường tiểu học', 'school'],
    ['Video hướng dẫn thoát hiểm ở chung cư', 'apartment building'],
    ['Quay quảng cáo tại quán cà phê', 'modern coffee shop'],
    ['Phóng sự ở công trường xây dựng', 'construction site'],
    ['Video giới thiệu dây chuyền sản xuất trong nhà máy', 'factory'],
    ['Video tour căn hộ mẫu', 'living room'],
  ];
  for (const [idea, expected] of cases) {
    assert.equal(buildBible(idea, OPTS).setting.name, expected, idea);
  }
});

test('nghề nghiệp không bị nơi chốn lấn át', () => {
  const bible = buildBible('Clip tuyển dụng kỹ sư cho nhà máy cơ khí', OPTS);
  assert.match(bible.character.lock, /engineer/, 'kỹ sư phải ra engineer, không phải công nhân');
  assert.equal(bible.setting.name, 'factory', 'nhà máy vẫn phải là bối cảnh');
});

test('âm thanh bám theo nơi chốn, không để tiếng đồng quê trong nhà máy', () => {
  const factory = buildBible('Video giới thiệu dây chuyền sản xuất trong nhà máy', OPTS);
  assert.match(factory.audio, /machinery|production line/);
  assert.doesNotMatch(factory.audio, /nature|wind/);

  const school = buildBible('Video khai giảng tại trường tiểu học', OPTS);
  assert.match(school.audio, /school bell|children/);
});
