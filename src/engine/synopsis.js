/**
 * Tóm tắt kịch bản bằng tiếng Việt: logline + dòng thời gian các cảnh.
 * Đây là phần "Kịch bản" mà người dùng đọc được, nằm giữa Ý tưởng và Danh sách Scene.
 */

import { PRODUCT_VI } from './script.js';

/** Nhãn cỡ cảnh bằng tiếng Việt để người dùng đọc dòng thời gian cho dễ. */
export const SHOT_VI = {
  aerial: 'Toàn cảnh flycam',
  wide: 'Toàn cảnh',
  medium: 'Trung cảnh',
  close: 'Cận cảnh',
  closeup: 'Đặc tả gương mặt',
  macro: 'Macro chi tiết',
  topdown: 'Góc từ trên xuống',
};

const MOOD_VI = {
  'luxurious and confident': 'sang trọng, tự tin',
  'soft and romantic': 'nhẹ nhàng, lãng mạn',
  'energetic and playful': 'năng động, vui tươi',
  'warm and heartfelt': 'ấm áp, giàu cảm xúc',
  'mysterious and cinematic': 'huyền bí, đậm chất điện ảnh',
  'sleek and modern': 'hiện đại, tinh gọn',
  'natural and grounded': 'tự nhiên, mộc mạc',
};

/** Vai/nghề nghiệp dịch sang tiếng Việt cho phần tóm tắt kịch bản. */
const ROLE_VI = {
  'factory worker': 'công nhân', engineer: 'kỹ sư', teacher: 'giáo viên', doctor: 'bác sĩ',
  farmer: 'nông dân', driver: 'tài xế', 'staff member': 'nhân viên', customer: 'khách hàng',
  chef: 'đầu bếp', executive: 'lãnh đạo doanh nghiệp', athlete: 'vận động viên', child: 'em bé',
  'family of three': 'gia đình ba người', singer: 'ca sĩ', student: 'học sinh, sinh viên',
  'fashion model': 'người mẫu', barista: 'nhân viên pha chế', presenter: 'người dẫn',
  instructor: 'người hướng dẫn', 'lead character': 'nhân vật chính', performer: 'nghệ sĩ biểu diễn',
  'young woman': 'cô gái', woman: 'người phụ nữ', 'young man': 'chàng trai', man: 'người đàn ông',
  'person featured in the video': 'nhân vật xuất hiện trong video',
};

function characterVi(bible) {
  const c = bible.character;
  if (!c?.present) return '';
  const roleVi = ROLE_VI[c.role];
  const gender = roleVi || (c.gender === 'male' ? 'chàng trai' : c.gender === 'female' ? 'cô gái' : 'nhân vật');
  const ethnic = c.ethnicity === 'Vietnamese' ? 'Việt Nam' : c.ethnicity;
  const age = String(c.age || '').match(/\d+/);
  return `${c.name} — ${gender} ${ethnic}${age ? ` khoảng ${age[0]} tuổi` : ''}`;
}

function settingVi(bible) {
  const map = {
    'modern coffee shop': 'quán cà phê hiện đại',
    'photo studio': 'studio chụp hình',
    beach: 'bãi biển',
    'city street': 'đường phố thành thị',
    office: 'văn phòng',
    kitchen: 'gian bếp',
    forest: 'khu rừng',
    'living room': 'phòng khách',
    'boutique showroom': 'showroom cao cấp',
    rooftop: 'sân thượng',
    gym: 'phòng tập',
    'luxury hotel suite': 'phòng khách sạn hạng sang',
    countryside: 'vùng quê',
    'local market': 'khu chợ',
    'cinematic studio set': 'phim trường tối, đậm chất điện ảnh',
    'apartment building': 'toà chung cư',
    school: 'khuôn viên trường học',
    factory: 'nhà máy',
    'construction site': 'công trường xây dựng',
    clinic: 'phòng khám',
    restaurant: 'nhà hàng',
    supermarket: 'siêu thị',
    stadium: 'sân vận động',
    warehouse: 'nhà kho',
    'theo ý tưởng': 'bối cảnh theo đúng ý tưởng',
  };
  return map[bible.setting?.name] || bible.setting?.name || 'bối cảnh chính';
}

/** Một đoạn tóm tắt kịch bản bằng tiếng Việt, đọc là hình dung được cả video. */
export function buildLogline(bible, scenes) {
  const total = scenes.reduce((sum, s) => sum + (Number(s.duration) || 0), 0);
  const productVi = bible.product?.present
    ? (bible.product.brand ? `${PRODUCT_VI[bible.product.category] || 'sản phẩm'} "${bible.product.brand}"` : (PRODUCT_VI[bible.product.category] || 'sản phẩm'))
    : '';
  const who = characterVi(bible);

  const parts = [`${bible.genreVi || bible.genre} dài ${total} giây, ${scenes.length} cảnh, phong cách ${(bible.styleVi || bible.style).toLowerCase()}`];
  if (who && productVi) parts.push(`${who} cùng ${productVi} tại ${settingVi(bible)}`);
  else if (who) parts.push(`${who} tại ${settingVi(bible)}`);
  else if (productVi) parts.push(`${productVi} tại ${settingVi(bible)}`);
  else parts.push(`lấy ${settingVi(bible)} làm nhân vật chính`);

  parts.push(`không khí ${MOOD_VI[bible.mood] || bible.mood}, tông màu ${bible.paletteVi || bible.palette}`);

  const last = scenes[scenes.length - 1];
  if (last?.beatId === 'cta') parts.push('khép lại bằng khung hình chốt chừa chỗ đặt logo');

  return `${parts.join('; ')}.`;
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/** Dòng thời gian: mỗi cảnh biết mình bắt đầu và kết thúc ở giây thứ mấy. */
export function buildTimeline(scenes) {
  let cursor = 0;
  return scenes.map((scene) => {
    const start = cursor;
    cursor += Number(scene.duration) || 0;
    return {
      id: scene.id,
      number: scene.number,
      title: scene.title,
      duration: scene.duration,
      start,
      end: cursor,
      range: `${formatTime(start)} – ${formatTime(cursor)}`,
      shotVi: SHOT_VI[scene.shot] || 'Trung cảnh',
      voiceover: scene.voiceover,
      hasVideo: Boolean(scene.video),
    };
  });
}

export { formatTime };
