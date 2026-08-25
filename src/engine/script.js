/**
 * Script engine - biến Project Bible thành kịch bản chia cảnh.
 *
 * Mỗi genre có một bộ "beat" (nhịp kể chuyện). Số scene người dùng chọn được
 * ánh xạ vào bộ beat đó, sau đó mỗi scene nhận thời lượng, cỡ cảnh, góc máy,
 * chuyển động máy, hành động và lời thoại riêng.
 */

import { makeRng, pick, clamp } from './text.js';
import { MAX_CLIP_SECONDS } from './presets.js';

const BEATS = {
  ad: [
    { id: 'hook', vi: 'Mở đầu gây chú ý', purpose: 'grab attention in the first second', shot: 'macro', weight: 0.9 },
    { id: 'desire', vi: 'Khơi gợi mong muốn', purpose: 'set up the desire the product answers', shot: 'medium', weight: 1 },
    { id: 'reveal', vi: 'Lộ diện sản phẩm', purpose: 'hero reveal of the product', shot: 'close', weight: 1.1 },
    { id: 'demo', vi: 'Sản phẩm trong sử dụng', purpose: 'show the product being used', shot: 'medium', weight: 1.15 },
    { id: 'detail', vi: 'Cận cảnh chi tiết', purpose: 'macro detail that proves quality', shot: 'macro', weight: 0.9 },
    { id: 'emotion', vi: 'Cao trào cảm xúc', purpose: 'emotional payoff on the subject', shot: 'closeup', weight: 1 },
    { id: 'cta', vi: 'Chốt & kêu gọi hành động', purpose: 'final hero frame with logo space', shot: 'wide', weight: 0.85 },
  ],
  brand: [
    { id: 'world', vi: 'Mở ra thế giới thương hiệu', purpose: 'establish the world of the brand', shot: 'wide', weight: 1 },
    { id: 'character', vi: 'Giới thiệu nhân vật', purpose: 'introduce the human at the centre', shot: 'medium', weight: 1 },
    { id: 'tension', vi: 'Điều còn thiếu', purpose: 'show what is missing', shot: 'closeup', weight: 0.95 },
    { id: 'reveal', vi: 'Thương hiệu xuất hiện', purpose: 'the brand enters the story', shot: 'close', weight: 1.1 },
    { id: 'value', vi: 'Giá trị cốt lõi', purpose: 'demonstrate the core value', shot: 'medium', weight: 1.05 },
    { id: 'emotion', vi: 'Khoảnh khắc cảm xúc', purpose: 'emotional high point', shot: 'closeup', weight: 1 },
    { id: 'cta', vi: 'Kết & logo', purpose: 'end frame with logo space', shot: 'wide', weight: 0.85 },
  ],
  review: [
    { id: 'intro', vi: 'Chào & nêu vấn đề', purpose: 'host greets and frames the question', shot: 'medium', weight: 1 },
    { id: 'unbox', vi: 'Mở hộp / Cầm sản phẩm', purpose: 'first physical contact with the product', shot: 'close', weight: 1.05 },
    { id: 'feature', vi: 'Điểm nổi bật', purpose: 'call out the strongest feature', shot: 'macro', weight: 1 },
    { id: 'use', vi: 'Trải nghiệm thực tế', purpose: 'real world usage', shot: 'medium', weight: 1.1 },
    { id: 'compare', vi: 'So sánh / Lưu ý', purpose: 'honest caveat or comparison', shot: 'closeup', weight: 0.95 },
    { id: 'verdict', vi: 'Kết luận', purpose: 'verdict to camera', shot: 'medium', weight: 1 },
    { id: 'cta', vi: 'Kêu gọi theo dõi', purpose: 'call to action', shot: 'wide', weight: 0.85 },
  ],
  story: [
    { id: 'setup', vi: 'Thiết lập bối cảnh', purpose: 'establish place and mood', shot: 'wide', weight: 1 },
    { id: 'character', vi: 'Nhân vật xuất hiện', purpose: 'meet the character', shot: 'medium', weight: 1 },
    { id: 'inciting', vi: 'Sự kiện khởi đầu', purpose: 'the event that starts everything', shot: 'close', weight: 1.05 },
    { id: 'rising', vi: 'Đẩy kịch tính', purpose: 'raise the stakes', shot: 'medium', weight: 1.1 },
    { id: 'climax', vi: 'Cao trào', purpose: 'the turning point', shot: 'closeup', weight: 1.15 },
    { id: 'resolution', vi: 'Giải quyết', purpose: 'resolution and release', shot: 'wide', weight: 1 },
  ],
  tutorial: [
    { id: 'intro', vi: 'Giới thiệu kết quả', purpose: 'show the finished result first', shot: 'close', weight: 0.9 },
    { id: 'prep', vi: 'Chuẩn bị', purpose: 'lay out what is needed', shot: 'topdown', weight: 1 },
    { id: 'step1', vi: 'Bước 1', purpose: 'first step in the process', shot: 'medium', weight: 1.05 },
    { id: 'step2', vi: 'Bước 2', purpose: 'second step in the process', shot: 'close', weight: 1.05 },
    { id: 'step3', vi: 'Bước 3', purpose: 'third step in the process', shot: 'macro', weight: 1 },
    { id: 'result', vi: 'Thành phẩm', purpose: 'the finished result revealed', shot: 'close', weight: 1 },
    { id: 'cta', vi: 'Chốt & mời theo dõi', purpose: 'wrap up and call to action', shot: 'medium', weight: 0.85 },
  ],
  travel: [
    { id: 'establish', vi: 'Toàn cảnh mở màn', purpose: 'sweeping establishing view', shot: 'aerial', weight: 1.1 },
    { id: 'arrival', vi: 'Đặt chân đến nơi', purpose: 'arrival moment', shot: 'medium', weight: 1 },
    { id: 'explore', vi: 'Khám phá', purpose: 'exploring the details of the place', shot: 'close', weight: 1 },
    { id: 'people', vi: 'Con người bản địa', purpose: 'local life and faces', shot: 'closeup', weight: 0.95 },
    { id: 'highlight', vi: 'Điểm nhấn', purpose: 'the signature highlight of the trip', shot: 'wide', weight: 1.1 },
    { id: 'sunset', vi: 'Hoàng hôn', purpose: 'golden hour beauty pass', shot: 'aerial', weight: 1 },
    { id: 'outro', vi: 'Kết', purpose: 'closing frame with title space', shot: 'wide', weight: 0.85 },
  ],
  music: [
    { id: 'intro', vi: 'Intro', purpose: 'atmospheric opening', shot: 'wide', weight: 1 },
    { id: 'verse', vi: 'Verse', purpose: 'performance in the main location', shot: 'medium', weight: 1 },
    { id: 'build', vi: 'Pre-chorus', purpose: 'energy builds', shot: 'close', weight: 1 },
    { id: 'chorus', vi: 'Chorus', purpose: 'biggest visual moment', shot: 'wide', weight: 1.2 },
    { id: 'bridge', vi: 'Bridge', purpose: 'contrast and intimacy', shot: 'closeup', weight: 0.95 },
    { id: 'outro', vi: 'Outro', purpose: 'fade out frame', shot: 'aerial', weight: 0.9 },
  ],
  social: [
    { id: 'hook', vi: 'Hook 1 giây đầu', purpose: 'stop the scroll instantly', shot: 'closeup', weight: 0.8 },
    { id: 'problem', vi: 'Vấn đề', purpose: 'name the pain point', shot: 'medium', weight: 1 },
    { id: 'solution', vi: 'Giải pháp', purpose: 'reveal the solution', shot: 'close', weight: 1.1 },
    { id: 'proof', vi: 'Bằng chứng', purpose: 'proof it works', shot: 'macro', weight: 1 },
    { id: 'cta', vi: 'Kêu gọi hành động', purpose: 'direct call to action', shot: 'medium', weight: 0.9 },
  ],
  realestate: [
    { id: 'exterior', vi: 'Ngoại thất', purpose: 'exterior establishing view', shot: 'aerial', weight: 1.1 },
    { id: 'entrance', vi: 'Lối vào', purpose: 'entering the space', shot: 'wide', weight: 1 },
    { id: 'living', vi: 'Phòng khách', purpose: 'main living area', shot: 'wide', weight: 1.05 },
    { id: 'kitchen', vi: 'Bếp & bàn ăn', purpose: 'kitchen and dining detail', shot: 'medium', weight: 1 },
    { id: 'private', vi: 'Không gian riêng tư', purpose: 'bedroom or private area', shot: 'medium', weight: 1 },
    { id: 'view', vi: 'Tầm nhìn', purpose: 'the view that sells it', shot: 'wide', weight: 1.05 },
    { id: 'cta', vi: 'Kết & thông tin', purpose: 'closing frame with info space', shot: 'aerial', weight: 0.85 },
  ],
  food: [
    { id: 'ingredients', vi: 'Nguyên liệu', purpose: 'fresh ingredients laid out', shot: 'topdown', weight: 1 },
    { id: 'prep', vi: 'Sơ chế', purpose: 'hands preparing the ingredients', shot: 'macro', weight: 1 },
    { id: 'cooking', vi: 'Chế biến', purpose: 'the heat and action of cooking', shot: 'close', weight: 1.1 },
    { id: 'plating', vi: 'Trình bày món', purpose: 'plating the dish', shot: 'topdown', weight: 1 },
    { id: 'taste', vi: 'Thưởng thức', purpose: 'the first taste reaction', shot: 'closeup', weight: 1.05 },
    { id: 'cta', vi: 'Kết & thương hiệu', purpose: 'hero frame with brand space', shot: 'wide', weight: 0.85 },
  ],
};

const SHOT_LABEL = {
  aerial: 'aerial establishing shot',
  wide: 'wide shot',
  medium: 'medium shot',
  close: 'close-up shot',
  closeup: 'tight close-up on the face',
  macro: 'macro detail shot',
  topdown: 'top-down overhead shot',
};

const ANGLES = {
  aerial: ['high aerial angle', 'drone descending angle'],
  wide: ['eye-level wide angle', 'slightly low hero angle'],
  medium: ['eye-level angle', 'over-the-shoulder angle'],
  close: ['eye-level angle', 'three-quarter angle'],
  closeup: ['eye-level angle', 'slightly low intimate angle'],
  macro: ['macro angle at product level', 'top-down macro angle'],
  topdown: ['90-degree overhead angle', 'slightly tilted overhead angle'],
};

const MOVES = {
  aerial: ['slow drone push-in', 'drone orbit around the subject', 'drone reveal rising over the horizon'],
  wide: ['slow dolly in', 'lateral tracking shot', 'static locked-off frame with subtle drift'],
  medium: ['smooth gimbal follow', 'slow push-in on the subject', 'gentle handheld float'],
  close: ['slow push-in', 'slider move left to right', 'rack focus from foreground to subject'],
  closeup: ['very slow push-in', 'static frame with micro handheld breathing'],
  macro: ['macro slider across the surface', 'slow probe-lens move around the product', 'rotating turntable move'],
  topdown: ['overhead slow rise', 'overhead lateral slide'],
};

const PRODUCT_VI = {
  fragrance: 'chai nước hoa',
  fashion: 'thiết kế thời trang',
  beauty: 'sản phẩm dưỡng da',
  tech: 'thiết bị công nghệ',
  luxury: 'sản phẩm cao cấp',
  beverage: 'ly đồ uống',
  automotive: 'chiếc xe',
  food: 'món ăn',
  interior: 'món nội thất',
  space: 'không gian sống',
  digital: 'ứng dụng',
  education: 'khoá học',
  general: 'sản phẩm',
};

/** Động từ sử dụng sản phẩm theo nhóm ngành - tránh câu kiểu "mặc chiếc điện thoại". */
const USE_ACTION = {
  fragrance: 'sprays {p} onto the wrist, then breathes in the mist with eyes closed',
  fashion: 'wears {p} and turns slowly so the fabric catches the light',
  beauty: 'applies {p} to the skin with slow, careful movements',
  tech: 'unlocks {p} and swipes through the glowing interface',
  luxury: 'fastens {p} on and turns the wrist so it catches the light',
  beverage: 'lifts {p} and takes a slow first sip',
  automotive: 'runs a hand along the body line of {p}, then opens the door',
  food: 'lifts a portion of {p} with chopsticks, steam rising',
  interior: 'runs a hand across {p} and settles into it',
  space: 'walks through {p}, taking it in',
  digital: 'taps through {p}, the interface responding instantly',
  education: 'opens {p} and starts taking notes',
  general: 'holds {p} up and turns it slowly in the light',
};

function useAction(product, productName) {
  const template = USE_ACTION[product?.category] || USE_ACTION.general;
  return template.replace(/\{p\}/g, productName);
}

/** Câu thoại/VO mẫu theo beat, viết sẵn hai ngôn ngữ. */
const VO = {
  hook: { vi: 'Bạn đã bao giờ dừng lại chỉ vì một khoảnh khắc đẹp?', en: 'Ever stopped just for a beautiful moment?' },
  desire: { vi: 'Có những thứ không cần nói nhiều, chỉ cần cảm nhận.', en: 'Some things need no words - only feeling.' },
  reveal: { vi: 'Và đây là {product}.', en: 'And here it is: {product}.' },
  demo: { vi: 'Chỉ một chạm, mọi thứ khác hẳn.', en: 'One touch, and everything changes.' },
  detail: { vi: 'Từng chi tiết đều được chăm chút.', en: 'Every detail, carefully made.' },
  emotion: { vi: 'Tự tin là khi bạn là chính mình.', en: 'Confidence is simply being yourself.' },
  cta: { vi: '{brand} - trải nghiệm ngay hôm nay.', en: '{brand} - experience it today.' },
  world: { vi: 'Mọi câu chuyện đều bắt đầu từ một nơi chốn.', en: 'Every story begins somewhere.' },
  character: { vi: 'Đây là {name}.', en: 'This is {name}.' },
  tension: { vi: 'Nhưng vẫn còn một điều chưa trọn vẹn.', en: 'But something is still missing.' },
  value: { vi: 'Điều chúng tôi tin: chất lượng nằm ở chi tiết.', en: 'What we believe: quality lives in the details.' },
  intro: { vi: 'Hôm nay mình sẽ cùng bạn xem thử {product}.', en: 'Today we are looking at {product}.' },
  unbox: { vi: 'Cảm giác đầu tiên khi cầm trên tay rất khác.', en: 'The first thing you notice is how it feels.' },
  feature: { vi: 'Điểm mình thích nhất chính là đây.', en: 'This is the part I like most.' },
  use: { vi: 'Dùng thử trong ngày thường thì sao?', en: 'So how does it hold up in real life?' },
  compare: { vi: 'Có một điểm bạn nên cân nhắc.', en: 'There is one thing to keep in mind.' },
  verdict: { vi: 'Kết luận của mình: rất đáng để thử.', en: 'My verdict: absolutely worth trying.' },
  setup: { vi: 'Một buổi sáng như mọi buổi sáng.', en: 'A morning like any other.' },
  inciting: { vi: 'Cho đến khi điều đó xảy ra.', en: 'Until it happened.' },
  rising: { vi: 'Mọi thứ bắt đầu thay đổi.', en: 'Everything starts to change.' },
  climax: { vi: 'Khoảnh khắc quyết định.', en: 'The deciding moment.' },
  resolution: { vi: 'Và mọi thứ trở về đúng chỗ của nó.', en: 'And everything falls into place.' },
  prep: { vi: 'Chuẩn bị đầy đủ trước khi bắt đầu.', en: 'Get everything ready first.' },
  step1: { vi: 'Bước một: bắt đầu thật nhẹ nhàng.', en: 'Step one: start gently.' },
  step2: { vi: 'Bước hai: đây là phần quan trọng.', en: 'Step two: this is the important part.' },
  step3: { vi: 'Bước ba: hoàn thiện chi tiết cuối.', en: 'Step three: finish the last details.' },
  result: { vi: 'Và đây là thành quả.', en: 'And here is the result.' },
  establish: { vi: 'Nơi này đẹp hơn mọi tấm ảnh.', en: 'This place is better than any photo.' },
  arrival: { vi: 'Chạm chân đến nơi, mọi mệt mỏi tan biến.', en: 'The moment you arrive, everything fades.' },
  explore: { vi: 'Càng đi càng thấy nhiều điều bất ngờ.', en: 'The further you go, the more you find.' },
  people: { vi: 'Điều đẹp nhất luôn là con người.', en: 'The best part is always the people.' },
  highlight: { vi: 'Và đây là khoảnh khắc đáng giá nhất.', en: 'And here is the moment worth the trip.' },
  sunset: { vi: 'Hoàng hôn khép lại một ngày trọn vẹn.', en: 'Sunset closes a perfect day.' },
  outro: { vi: 'Hẹn gặp lại ở hành trình tiếp theo.', en: 'See you on the next journey.' },
  problem: { vi: 'Vấn đề là ai cũng gặp phải điều này.', en: 'The problem is, this happens to everyone.' },
  solution: { vi: 'Giải pháp đơn giản hơn bạn nghĩ.', en: 'The fix is simpler than you think.' },
  proof: { vi: 'Kết quả nói thay lời muốn nói.', en: 'The result speaks for itself.' },
  exterior: { vi: 'Không gian sống bắt đầu từ ấn tượng đầu tiên.', en: 'A home starts with a first impression.' },
  entrance: { vi: 'Mở cửa ra là một thế giới khác.', en: 'Open the door to another world.' },
  living: { vi: 'Phòng khách ngập tràn ánh sáng tự nhiên.', en: 'The living room is full of natural light.' },
  kitchen: { vi: 'Khu bếp được thiết kế cho những bữa ăn quây quần.', en: 'The kitchen is made for shared meals.' },
  private: { vi: 'Không gian riêng tư, yên tĩnh tuyệt đối.', en: 'A private space, perfectly quiet.' },
  view: { vi: 'Và tầm nhìn này là thứ khó quên nhất.', en: 'And this view is the unforgettable part.' },
  ingredients: { vi: 'Bắt đầu từ nguyên liệu tươi nhất.', en: 'It starts with the freshest ingredients.' },
  cooking: { vi: 'Lửa vừa tới, hương thơm bắt đầu dậy.', en: 'The heat rises and the aroma follows.' },
  plating: { vi: 'Trình bày cũng là một phần của hương vị.', en: 'Plating is part of the flavour.' },
  taste: { vi: 'Miếng đầu tiên luôn là miếng ngon nhất.', en: 'The first bite is always the best.' },
  build: { vi: '', en: '' },
  verse: { vi: '', en: '' },
  chorus: { vi: '', en: '' },
  bridge: { vi: '', en: '' },
};

/** Các thể loại mà lời thoại mẫu xoay quanh một sản phẩm cụ thể. */
export const PRODUCT_LED_GENRES = ['ad', 'brand', 'review', 'social', 'food', 'realestate', 'tutorial'];

function beatsFor(genreId) {
  return BEATS[genreId] || BEATS.ad;
}

/** Ánh xạ số scene người dùng chọn vào bộ beat: luôn giữ beat mở đầu và beat kết. */
export function planBeats(genreId, sceneCount) {
  const beats = beatsFor(genreId);
  const count = clamp(Math.round(sceneCount) || beats.length, 2, 24);
  if (count === beats.length) return beats.map((b, i) => ({ ...b, repeat: 0, order: i }));

  if (count < beats.length) {
    const chosen = [beats[0]];
    const middle = beats.slice(1, -1);
    const need = count - 2;
    for (let i = 0; i < need; i += 1) {
      const idx = Math.round((i * (middle.length - 1)) / Math.max(1, need - 1));
      chosen.push(middle[clamp(idx, 0, middle.length - 1)]);
    }
    chosen.push(beats[beats.length - 1]);
    return chosen.slice(0, count).map((b, i) => ({ ...b, repeat: 0, order: i }));
  }

  // Nhiều scene hơn số beat: nhân bản các beat giữa, đánh số biến thể để nội dung không lặp y hệt.
  const out = beats.map((b) => ({ ...b, repeat: 0 }));
  const middle = beats.slice(1, -1);
  let i = 0;
  while (out.length < count) {
    const source = middle[i % middle.length];
    const repeat = Math.floor(i / middle.length) + 1;
    out.splice(out.length - 1, 0, { ...source, repeat });
    i += 1;
  }
  return out.map((b, idx) => ({ ...b, order: idx }));
}

/** Chia thời lượng tổng cho các scene theo trọng số, tối thiểu 2 giây mỗi scene. */
export function distributeDuration(beats, totalSeconds) {
  const total = Math.max(beats.length * 2, Math.round(totalSeconds) || 30);
  const weights = beats.map((b) => b.weight || 1);
  const sum = weights.reduce((a, b) => a + b, 0);
  const raw = weights.map((w) => (w / sum) * total);
  const seconds = raw.map((value) => Math.max(2, Math.round(value)));

  let diff = total - seconds.reduce((a, b) => a + b, 0);
  let guard = 0;
  while (diff !== 0 && guard < 500) {
    for (let i = 0; i < seconds.length && diff !== 0; i += 1) {
      const step = diff > 0 ? 1 : -1;
      if (step === -1 && seconds[i] <= 2) continue;
      seconds[i] += step;
      diff -= step;
    }
    guard += 1;
  }
  return seconds;
}

function fillTemplate(template, bible) {
  const productVi = PRODUCT_VI[bible.product?.category] || PRODUCT_VI.general;
  // Chưa có tên thương hiệu thì để placeholder rõ ràng để người dùng điền, thay vì bịa tên.
  const brand = bible.product?.brand || '[TÊN THƯƠNG HIỆU]';
  return String(template || '')
    .replace(/\{product\}/g, bible.options.language === 'en' ? (bible.product?.name || 'the product') : productVi)
    .replace(/\{brand\}/g, brand)
    .replace(/\{name\}/g, bible.character?.name || 'nhân vật chính');
}

function voiceoverFor(beat, bible) {
  if (bible.languageId === 'none') return '';
  // Lời thoại mẫu được viết cho video bán một sản phẩm. Chưa nhận ra sản phẩm mà
  // vẫn gán vào thì ra những câu lạc đề kiểu "Chỉ một chạm, mọi thứ khác hẳn" trên
  // một video an toàn lao động. Thà để trống cho người dùng tự viết.
  if (!bible.product?.present && PRODUCT_LED_GENRES.includes(bible.genreId)) return '';
  const entry = VO[beat.id];
  if (!entry) return '';
  const useEn = bible.languageId === 'en';
  const line = useEn ? entry.en : entry.vi;
  if (!line) return '';
  return fillTemplate(line, bible);
}

/** Hành động cụ thể của scene, viết bằng tiếng Anh vì prompt cuối cùng dùng tiếng Anh. */
function actionFor(beat, bible, rng) {
  const c = bible.character;
  const p = bible.product;
  const who = c?.present ? c.id : 'the camera';
  const productName = p?.present
    ? (p.brand ? `the "${p.brand}" ${p.name}` : `the ${p.name}`)
    : 'the main subject of the concept';

  const byBeat = {
    hook: p?.present
      ? `${productName} fills the frame in extreme close-up as a shaft of light grazes across its surface`
      : `a striking detail of the scene fills the frame as light moves across it`,
    desire: c?.present ? `${who} pauses mid-motion and looks off-frame, thoughtful` : `the environment breathes, empty and waiting`,
    reveal: p?.present ? `${productName} is revealed as ${p.hero}` : `the subject is revealed in full`,
    demo: c?.present && p?.present
      ? `${who} ${useAction(p, productName)}`
      : `${productName} is shown in use`,
    detail: p?.present ? `an extreme macro travels across the surface of ${productName}` : `an extreme macro travels across the texture of the scene`,
    emotion: c?.present ? `${who} smiles softly and turns towards the light` : `light shifts across the scene in a quiet beat`,
    cta: p?.present ? `${productName} rests centred with clean negative space around it for the logo` : `a clean final frame with negative space for the logo`,
    world: `a sweeping view establishes the world of the story`,
    character: c?.present ? `${who} walks into frame and settles, at ease` : `the main subject enters the frame`,
    tension: c?.present ? `${who} hesitates, glancing down` : `a small imperfection is noticed`,
    value: `hands work carefully, showing the craft behind the product`,
    intro: c?.present ? `${who} greets the camera and holds up ${productName}` : `${productName} is introduced to camera`,
    unbox: c?.present ? `${who} opens the box and lifts ${productName} out slowly` : `${productName} is revealed and handled up close`,
    feature: `a macro pass highlights the key feature of ${productName}`,
    use: c?.present && p?.present
      ? `${who} ${useAction(p, productName)}, moving naturally through the space`
      : `${productName} is shown in real use`,
    compare: c?.present ? `${who} turns ${productName} in the hand, weighing it up` : `two options sit side by side`,
    verdict: c?.present ? `${who} looks straight into the lens and gives the verdict` : `a final hero frame lands`,
    setup: `the location wakes up quietly, small movements in the frame`,
    inciting: c?.present ? `${who} notices something and stops` : `something changes in the frame`,
    rising: c?.present ? `${who} moves with purpose, pace picking up` : `movement accelerates through the frame`,
    climax: c?.present ? `${who} takes the decisive action, breath held` : `the decisive moment lands`,
    resolution: c?.present ? `${who} exhales and lets the moment settle` : `the scene settles into stillness`,
    prep: `hands arrange everything needed neatly within the frame`,
    step1: `hands begin the first step slowly and clearly`,
    step2: `hands perform the key step, the most important motion of the process`,
    step3: `hands finish the final detail with care`,
    result: `the finished result is presented, still and perfect`,
    establish: `the landscape opens up below as the camera rises`,
    arrival: c?.present ? `${who} steps into the location and looks around` : `the first steps into the location`,
    explore: `small discoveries fill the frame one after another`,
    people: `a local face breaks into a genuine smile`,
    highlight: `the signature view of the place fills the frame`,
    sunset: `the sun drops to the horizon and floods the frame with gold`,
    outro: `the camera pulls back and holds on a final wide frame`,
    problem: c?.present ? `${who} reacts to the everyday problem with visible frustration` : `the problem is shown plainly`,
    solution: `${productName} enters frame as the answer`,
    proof: `a clear before-and-after comparison plays out in frame`,
    exterior: `the building is revealed from above in one continuous move`,
    entrance: `the door opens and the camera glides through`,
    living: `the camera travels across the living space, light pouring in`,
    kitchen: `the camera moves along the counter, catching every finish`,
    private: `the camera drifts into the quiet private space`,
    view: `the camera settles on the view through the full-height window`,
    ingredients: `the ingredients are arranged one by one from above`,
    cooking: `steam and heat rise as the cooking happens`,
    plating: `the dish is plated with precise, elegant movements`,
    taste: c?.present ? `${who} takes the first bite and reacts with delight` : `the first bite is taken`,
    verse: c?.present ? `${who} performs to camera, moving with the beat` : `the performance carries the frame`,
    build: `energy rises, motion accelerates with the music`,
    chorus: c?.present ? `${who} hits the biggest movement of the track` : `the biggest visual moment lands`,
    bridge: c?.present ? `${who} slows down into an intimate, quiet beat` : `the frame goes quiet and intimate`,
  };

  const base = byBeat[beat.id] || `the scene plays out around ${productName}`;
  if (beat.repeat > 0) {
    const variations = [
      'seen from a fresh angle on the opposite side of the set',
      'covered again in a tighter framing with different blocking',
      'repeated at a different moment of the action, with new movement',
    ];
    return `${base}, ${variations[(beat.repeat - 1) % variations.length]}`;
  }
  return base;
}

/**
 * Dựng danh sách scene từ bible. Hàm thuần: cùng bible → cùng kết quả.
 * @param {object} bible
 * @param {object} [opts] {variantSeeds: {sceneIndex: seed}} để regenerate riêng từng scene
 */
export function buildScenes(bible, opts = {}) {
  const beats = planBeats(bible.genreId, bible.options.sceneCount);
  const durations = distributeDuration(beats, bible.options.duration);
  const variantSeeds = opts.variantSeeds || {};

  return beats.map((beat, index) => {
    const seed = variantSeeds[index] != null ? variantSeeds[index] : bible.seed + index * 7919;
    const rng = makeRng(seed);
    const shot = beat.shot;
    const angle = pick(ANGLES[shot] || ANGLES.medium, rng);
    const movement = pick(MOVES[shot] || MOVES.medium, rng);

    return {
      id: `scene-${index + 1}`,
      index,
      number: index + 1,
      beatId: beat.id,
      title: beat.repeat > 0 ? `${beat.vi} (biến thể ${beat.repeat + 1})` : beat.vi,
      purpose: beat.purpose,
      duration: durations[index],
      overLimit: durations[index] > MAX_CLIP_SECONDS,
      shot,
      shotLabel: SHOT_LABEL[shot] || SHOT_LABEL.medium,
      angle,
      movement,
      action: actionFor(beat, bible, rng),
      voiceover: voiceoverFor(beat, bible),
      onScreenText: beat.id === 'cta' ? (bible.product?.brand || bible.title) : '',
      seed,
      variant: variantSeeds[index] != null ? 1 : 0,
    };
  });
}

export { BEATS, SHOT_LABEL, PRODUCT_VI, USE_ACTION };
