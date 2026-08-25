/**
 * Project Bible - "bộ nhớ" của dự án.
 *
 * Đây là nơi khoá lại nhân vật, sản phẩm, bối cảnh, tông màu, ánh sáng và âm thanh.
 * Mọi prompt của mọi scene đều được dựng lại từ đúng object này, nên sửa hay
 * regenerate một scene không bao giờ làm lệch nhân vật/sản phẩm ở các scene khác.
 */

import { normalize, hashSeed, makeRng, pick, joinParts, titleCase } from './text.js';
import { findPreset, STYLES, GENRES, ASPECTS, LANGUAGES } from './presets.js';

const FEMALE_NAMES = ['Linh', 'Mai', 'Ngọc', 'Thảo', 'Hà', 'Trâm', 'An', 'Vy'];
const MALE_NAMES = ['Minh', 'Nam', 'Khang', 'Duy', 'Bảo', 'Hưng', 'Quân', 'Phong'];

const CHARACTER_RULES = [
  { keys: ['co gai', 'cô gái', 'nu chinh', 'nguoi mau nu', 'girl', 'young woman'], gender: 'female', age: '25-year-old', role: 'young woman' },
  { keys: ['nguoi phu nu', 'phu nu', 'woman', 'ba me', 'me bim'], gender: 'female', age: '32-year-old', role: 'woman' },
  { keys: ['chang trai', 'anh chang', 'nam chinh', 'young man', 'guy'], gender: 'male', age: '27-year-old', role: 'young man' },
  { keys: ['nguoi dan ong', 'dan ong', 'man', 'quy ong'], gender: 'male', age: '35-year-old', role: 'man' },
  { keys: ['dau bep', 'chef', 'bep truong'], gender: 'neutral', age: '38-year-old', role: 'chef', wardrobe: 'crisp white chef jacket, dark apron' },
  { keys: ['doanh nhan', 'ceo', 'giam doc', 'businessman', 'businesswoman'], gender: 'neutral', age: '38-year-old', role: 'executive', wardrobe: 'tailored charcoal suit, minimal jewellery' },
  { keys: ['van dong vien', 'athlete', 'runner', 'gym'], gender: 'neutral', age: '26-year-old', role: 'athlete', wardrobe: 'technical sportswear, running shoes' },
  { keys: ['em be', 'tre em', 'baby', 'child', 'kid'], gender: 'neutral', age: '6-year-old', role: 'child', wardrobe: 'soft pastel casual clothes' },
  { keys: ['gia dinh', 'family'], gender: 'neutral', age: '', role: 'family of three', wardrobe: 'warm casual knitwear' },
  { keys: ['ca si', 'singer', 'nhac si'], gender: 'neutral', age: '24-year-old', role: 'singer', wardrobe: 'stage outfit with subtle sequins' },
  { keys: ['sinh vien', 'hoc sinh', 'student'], gender: 'neutral', age: '20-year-old', role: 'student', wardrobe: 'casual campus outfit, canvas backpack' },
  { keys: ['nguoi mau', 'model', 'fashionista'], gender: 'neutral', age: '24-year-old', role: 'fashion model', wardrobe: 'editorial designer outfit' },
  { keys: ['barista', 'pha che'], gender: 'neutral', age: '27-year-old', role: 'barista', wardrobe: 'denim apron over a plain tee' },
];

const ETHNICITIES = [
  { keys: ['viet nam', 'vietnam', 'vietnamese', 'ha noi', 'sai gon', 'da nang', 'hue'], label: 'Vietnamese' },
  { keys: ['han quoc', 'korea', 'korean'], label: 'Korean' },
  { keys: ['nhat ban', 'japan', 'japanese'], label: 'Japanese' },
  { keys: ['trung quoc', 'chinese'], label: 'Chinese' },
  { keys: ['thai lan', 'thailand', 'thai'], label: 'Thai' },
  { keys: ['chau au', 'european', 'phuong tay', 'western'], label: 'European' },
  { keys: ['nguoi my', 'hoa ky', 'american', 'usa'], label: 'American' },
];

const PRODUCT_RULES = [
  { keys: ['nuoc hoa', 'perfume', 'fragrance', 'eau de parfum'], name: 'perfume bottle', category: 'fragrance', material: 'faceted crystal glass with a polished metal cap', hero: 'the bottle catching a thin rim of light as it turns' },
  { keys: ['thoi trang', 'fashion', 'quan ao', 'vay', 'dam', 'ao dai', 'outfit', 'clothing'], name: 'fashion outfit', category: 'fashion', material: 'soft flowing fabric with visible weave and stitching', hero: 'fabric moving in slow motion as the model turns' },
  { keys: ['my pham', 'cosmetic', 'skincare', 'serum', 'kem duong', 'son moi', 'lipstick'], name: 'skincare bottle', category: 'beauty', material: 'frosted glass dropper bottle with matte label', hero: 'a single drop of serum falling in macro' },
  { keys: ['dien thoai', 'smartphone', 'phone', 'iphone'], name: 'smartphone', category: 'tech', material: 'brushed aluminium frame and glossy glass back', hero: 'the screen lighting up in a dark frame' },
  { keys: ['laptop', 'may tinh'], name: 'laptop', category: 'tech', material: 'anodised aluminium unibody', hero: 'the lid opening to reveal a glowing display' },
  { keys: ['dong ho', 'watch', 'timepiece'], name: 'wristwatch', category: 'luxury', material: 'stainless steel case with sapphire crystal', hero: 'a macro sweep across the dial and second hand' },
  { keys: ['giay', 'sneaker', 'shoes'], name: 'sneaker', category: 'fashion', material: 'knit upper with rubber outsole', hero: 'the sole compressing on impact in slow motion' },
  { keys: ['ca phe', 'coffee', 'espresso', 'latte'], name: 'cup of coffee', category: 'beverage', material: 'ceramic cup with crema surface and rising steam', hero: 'steam curling up through a shaft of light' },
  { keys: ['tra sua', 'bubble tea', 'milk tea', 'nuoc ep', 'sinh to'], name: 'drink cup', category: 'beverage', material: 'clear cup with layered liquid and condensation', hero: 'ice tumbling into the cup in slow motion' },
  { keys: ['o to', 'xe hoi', 'car', 'suv', 'sedan'], name: 'car', category: 'automotive', material: 'metallic paint with sharp specular highlights', hero: 'a slow reflection sweeping along the body line' },
  { keys: ['xe may', 'motorbike', 'scooter'], name: 'motorbike', category: 'automotive', material: 'painted metal with chrome accents', hero: 'wheels spinning as light streaks past' },
  { keys: ['trang suc', 'jewel', 'nhan', 'vong co', 'necklace', 'ring'], name: 'jewellery piece', category: 'luxury', material: '18k gold with brilliant-cut stones', hero: 'stones throwing tiny rainbow highlights in macro' },
  { keys: ['banh ngot', 'banh', 'cake', 'pastry', 'do an', 'food', 'mon an', 'pho bo', 'bun bo', 'nha hang'], name: 'dish', category: 'food', material: 'fresh ingredients with visible texture and steam', hero: 'a close macro of texture and rising steam' },
  { keys: ['sua tuoi', 'sua chua', 'sua hat', 'milk', 'yogurt'], name: 'dairy product', category: 'food', material: 'chilled bottle with condensation on the surface', hero: 'a splash of milk frozen mid-air' },
  { keys: ['noi that', 'furniture', 'sofa', 'ban ghe'], name: 'furniture piece', category: 'interior', material: 'natural oak and woven textile', hero: 'light moving slowly across the surface' },
  { keys: ['can ho', 'bat dong san', 'nha pho', 'villa', 'apartment', 'real estate'], name: 'apartment', category: 'space', material: 'stone, glass and warm wood finishes', hero: 'a smooth glide through the living space' },
  { keys: ['app', 'ung dung', 'phan mem', 'website', 'saas'], name: 'mobile app', category: 'digital', material: 'clean UI on a floating device mockup', hero: 'the interface animating under the fingertip' },
  { keys: ['khoa hoc', 'course', 'workshop'], name: 'course', category: 'education', material: 'notebooks, laptop and warm desk light', hero: 'a hand writing while the screen glows' },
];

const SETTING_RULES = [
  { keys: ['quan ca phe', 'coffee shop', 'cafe', 'quan cafe'], name: 'modern coffee shop', description: 'a modern coffee shop with warm wood tables, hanging pendant lights, indoor plants and a large window', time: 'late morning' },
  { keys: ['studio', 'phong chup'], name: 'photo studio', description: 'a seamless studio backdrop with controlled softbox lighting and a subtle floor reflection', time: 'timeless studio light' },
  { keys: ['bai bien', 'bo bien', 'beach', 'seaside'], name: 'beach', description: 'an open beach with fine sand, gentle waves and a wide horizon', time: 'golden hour' },
  { keys: ['duong pho', 'street', 'pho co', 'do thi', 'thanh pho', 'city'], name: 'city street', description: 'a busy city street with neon storefronts, wet asphalt and passing traffic lights', time: 'blue hour' },
  { keys: ['van phong', 'office', 'coworking'], name: 'office', description: 'a bright modern office with glass partitions, minimalist desks and city view windows', time: 'daytime' },
  { keys: ['nha bep', 'kitchen', 'bep'], name: 'kitchen', description: 'a clean contemporary kitchen with marble counters and morning light from a side window', time: 'morning' },
  { keys: ['rung', 'forest', 'nui', 'mountain'], name: 'forest', description: 'a misty forest with tall trees, soft fog and shafts of light between branches', time: 'early morning' },
  { keys: ['phong khach', 'living room', 'trong nha', 'căn hộ', 'can ho'], name: 'living room', description: 'a warm minimalist living room with linen sofa, oak floor and sheer curtains', time: 'afternoon' },
  { keys: ['showroom', 'cua hang', 'store', 'boutique'], name: 'boutique showroom', description: 'a premium boutique showroom with spotlit displays and polished stone floor', time: 'evening' },
  { keys: ['san thuong', 'rooftop'], name: 'rooftop', description: 'a rooftop terrace overlooking a glittering skyline', time: 'sunset' },
  { keys: ['gym', 'phong tap'], name: 'gym', description: 'an industrial gym with black rubber floor, chalk dust in the air and hard top light', time: 'early morning' },
  { keys: ['khach san', 'hotel', 'resort'], name: 'luxury hotel suite', description: 'a luxury hotel suite with marble surfaces, silk drapes and layered practical lighting', time: 'dusk' },
  { keys: ['ruong', 'lang que', 'nong thon', 'countryside'], name: 'countryside', description: 'terraced rice fields with a soft haze rolling over the hills', time: 'sunrise' },
  { keys: ['khu cho', 'cho dem', 'cho truyen thong', 'market'], name: 'local market', description: 'a lively local market with colourful stalls, hanging lamps and moving crowds', time: 'morning' },
];

const MOOD_RULES = [
  { keys: ['sang trong', 'luxury', 'cao cap', 'premium'], mood: 'luxurious and confident', palette: 'deep black, champagne gold and warm amber' },
  { keys: ['nhe nhang', 'diu dang', 'soft', 'gentle', 'lang man', 'romantic'], mood: 'soft and romantic', palette: 'blush pink, cream and pale gold' },
  { keys: ['nang dong', 'tre trung', 'energetic', 'youthful', 'vui'], mood: 'energetic and playful', palette: 'coral, electric blue and sunlit yellow' },
  { keys: ['cam dong', 'am ap', 'warm', 'emotional', 'gia dinh'], mood: 'warm and heartfelt', palette: 'honey amber, terracotta and soft ivory' },
  { keys: ['bi an', 'huyen bi', 'mysterious', 'dark'], mood: 'mysterious and cinematic', palette: 'midnight blue, smoke grey and cold silver' },
  { keys: ['hien dai', 'modern', 'cong nghe', 'tech', 'futuristic'], mood: 'sleek and modern', palette: 'cool graphite, glass white and cyan accents' },
  { keys: ['thien nhien', 'natural', 'moc mac', 'organic'], mood: 'natural and grounded', palette: 'sage green, sand beige and warm wood' },
];

const LIGHTING_BY_MOOD = {
  'luxurious and confident': 'controlled key light with deep falloff, soft rim light separating the subject from a dark background',
  'soft and romantic': 'large diffused window light, gentle wrap, airy highlights',
  'energetic and playful': 'bright bounced daylight with crisp specular highlights',
  'warm and heartfelt': 'golden practical lights mixed with soft late-afternoon sun',
  'mysterious and cinematic': 'low-key lighting, single hard source, volumetric haze',
  'sleek and modern': 'clean broad softbox light with cool edge highlights',
  'natural and grounded': 'natural available light, soft overcast diffusion',
};

const AUDIO_BY_MOOD = {
  'luxurious and confident': 'sparse cinematic piano, deep sub-bass swell, silky room tone',
  'soft and romantic': 'warm felt piano, light strings, soft breathing room tone',
  'energetic and playful': 'upbeat pop percussion, finger snaps, bright synth plucks',
  'warm and heartfelt': 'acoustic guitar, soft strings, gentle ambient life',
  'mysterious and cinematic': 'low drone, slow pulsing bass, distant reverb tail',
  'sleek and modern': 'minimal electronic pulse, clean UI clicks, airy pad',
  'natural and grounded': 'ambient nature bed, soft wind, organic foley',
};

const DEFAULT_NEGATIVE = 'no text overlays, no watermark, no logo distortion, no extra fingers, no deformed hands or faces, no warped product label, no duplicated subject, no subtitles, no jitter, no blurry frames, no oversaturated skin tones';

/** So khớp theo *từ* chứ không phải chuỗi con: "phong cách" không được tính là màu "hồng". */
function containsPhrase(text, phrase) {
  const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`).test(text);
}

function matchRule(rules, text) {
  for (const rule of rules) {
    if (rule.keys.some((key) => containsPhrase(text, key))) return rule;
  }
  return null;
}

function detectGender(text, fallback) {
  // Thứ tự quan trọng: kiểm tra nữ trước, và tránh các từ dễ nhầm ("Việt Nam" không phải giới tính nam).
  if (/(^|[^a-z])(co gai|nu|nu chinh|phu nu|nguoi mau nu|ba me|female|woman|girl)([^a-z]|$)/.test(text)) return 'female';
  if (/(^|[^a-z])(chang trai|anh chang|nam chinh|nam gioi|nguoi dan ong|dan ong|quy ong|male|man|guy|boy)([^a-z]|$)/.test(text)) return 'male';
  return fallback || 'neutral';
}

function buildCharacter(text, options, rng) {
  const rule = matchRule(CHARACTER_RULES, text);
  const genreNeedsPerson = ['ad', 'brand', 'review', 'story', 'tutorial', 'social', 'music'].includes(options.genre);
  if (!rule && !genreNeedsPerson) {
    return { present: false };
  }

  const DEFAULT_ROLE = {
    ad: 'model', brand: 'model', review: 'presenter', tutorial: 'instructor',
    social: 'presenter', story: 'lead character', music: 'performer',
  };
  const base = rule || { gender: 'neutral', age: '26-year-old', role: DEFAULT_ROLE[options.genre] || 'presenter' };
  const gender = detectGender(text, base.gender);
  const ethnicity = (matchRule(ETHNICITIES, text) || { label: 'Vietnamese' }).label;
  const namePool = gender === 'male' ? MALE_NAMES : FEMALE_NAMES;
  const name = pick(namePool, rng);

  const hairOptions = gender === 'male'
    ? ['short neatly parted black hair', 'textured black hair swept back']
    : ['long straight black hair', 'shoulder-length black hair with a soft wave', 'black hair in a low elegant bun'];

  const hair = pick(hairOptions, rng);
  const wardrobe = base.wardrobe || pick(
    gender === 'male'
      ? ['a tailored off-white linen shirt and dark trousers', 'a fitted black knit and slim charcoal trousers']
      : ['a minimalist cream silk blouse and tailored trousers', 'an elegant off-white slip dress', 'a soft beige knit top with wide-leg trousers'],
    rng,
  );

  const descriptor = joinParts([
    base.age,
    ethnicity,
    base.role,
  ], ' ');

  return {
    present: true,
    id: name.toUpperCase(),
    name,
    gender,
    ethnicity,
    role: base.role,
    age: base.age,
    hair,
    wardrobe,
    skin: 'natural glowing skin with visible pores, no heavy retouching',
    expression: 'calm confident expression with a subtle warm smile',
    /** Chuỗi này được nhúng nguyên văn vào mọi scene để giữ nhân vật nhất quán. */
    lock: joinParts([
      `${name.toUpperCase()} (${descriptor})`,
      hair,
      'natural glowing skin, soft natural makeup',
      `wearing ${wardrobe}`,
      'same face, same hairstyle and same outfit in every shot',
    ]),
  };
}

function buildProduct(idea, text, options, rng) {
  const rule = matchRule(PRODUCT_RULES, text);
  const sellsSomething = ['ad', 'brand', 'review', 'food', 'realestate', 'social'].includes(options.genre);
  if (!rule && !sellsSomething) return { present: false };

  const base = rule || {
    name: 'hero product',
    category: 'general',
    material: 'clean matte surface with a subtle branded label',
    hero: 'a slow rotating hero shot on a lit pedestal',
  };

  const brandMatch = String(idea).match(/["“”']([^"“”']{2,40})["“”']/);
  const brand = brandMatch ? brandMatch[1].trim() : '';
  const colour = matchRule([
    { keys: ['mau vang', 'anh vang', 'gold', 'golden'], label: 'champagne gold' },
    { keys: ['mau den', 'black'], label: 'matte black' },
    { keys: ['mau trang', 'white', 'ivory'], label: 'ivory white' },
    { keys: ['mau hong', 'pink'], label: 'soft blush pink' },
    { keys: ['mau xanh la', 'green', 'emerald'], label: 'deep emerald green' },
    { keys: ['mau xanh', 'blue', 'navy'], label: 'midnight blue' },
    { keys: ['mau do', 'red', 'crimson'], label: 'crimson red' },
  ], text);

  return {
    present: true,
    name: base.name,
    category: base.category,
    brand,
    colour: colour ? colour.label : '',
    material: base.material,
    hero: base.hero,
    /** Chuỗi khoá sản phẩm - lặp lại y hệt ở mọi scene. */
    lock: joinParts([
      brand ? `"${brand}" ${base.name}` : `the hero ${base.name}`,
      colour ? colour.label : '',
      base.material,
      'exactly the same shape, colour, label and proportions in every shot',
    ]),
  };
}

function buildSetting(text, rng) {
  const rule = matchRule(SETTING_RULES, text) || {
    name: 'cinematic studio set',
    description: 'a dark cinematic studio set with a reflective floor and layered practical lights',
    time: 'evening',
  };
  return {
    present: true,
    name: rule.name,
    description: rule.description,
    time: rule.time,
    lock: `${rule.description}, ${rule.time}`,
  };
}

function buildMood(text, styleId) {
  const rule = matchRule(MOOD_RULES, text);
  if (rule) return rule;
  const byStyle = {
    cinematic: MOOD_RULES[0],
    minimal: MOOD_RULES[5],
    documentary: MOOD_RULES[6],
    vibrant: MOOD_RULES[2],
    moody: MOOD_RULES[4],
    anime: MOOD_RULES[2],
    '3d': MOOD_RULES[5],
    retro: MOOD_RULES[3],
  };
  return byStyle[styleId] || MOOD_RULES[0];
}

/**
 * Dựng Project Bible từ ý tưởng thô + tuỳ chọn của người dùng.
 * @param {string} idea
 * @param {object} options {genre, style, duration, aspect, sceneCount, language}
 * @param {number} [seed] truyền seed để tái lập; bỏ trống thì tính từ chính ý tưởng
 */
export function buildBible(idea, options, seed) {
  const text = normalize(idea);
  const usedSeed = seed == null ? hashSeed(`${text}|${options.genre}|${options.style}`) : seed >>> 0;
  const rng = makeRng(usedSeed);

  const style = findPreset(STYLES, options.style);
  const genre = findPreset(GENRES, options.genre);
  const aspect = findPreset(ASPECTS, options.aspect);
  const language = findPreset(LANGUAGES, options.language);

  const character = buildCharacter(text, options, rng);
  const product = buildProduct(idea, text, options, rng);
  const setting = buildSetting(text, rng);
  const moodRule = buildMood(text, style.id);

  const lens = pick(['35mm', '50mm', '85mm', '24mm'], rng);

  return {
    seed: usedSeed,
    idea: String(idea || '').trim(),
    options: { ...options },
    genre: genre.en,
    genreVi: genre.vi,
    genreId: genre.id,
    styleId: style.id,
    style: style.en,
    styleVi: style.vi,
    styleLook: style.look,
    aspect: aspect.id,
    aspectVi: aspect.vi,
    language: language.label,
    languageVi: language.vi,
    languageId: language.id,
    mood: moodRule.mood,
    palette: moodRule.palette,
    lighting: LIGHTING_BY_MOOD[moodRule.mood] || LIGHTING_BY_MOOD['luxurious and confident'],
    audio: AUDIO_BY_MOOD[moodRule.mood] || AUDIO_BY_MOOD['luxurious and confident'],
    lens,
    grade: `${style.en} grade, ${moodRule.palette}, filmic contrast, natural skin tones`,
    filmStock: 'shot on ARRI Alexa with vintage prime lenses, natural 24fps motion blur, subtle film grain',
    negative: DEFAULT_NEGATIVE,
    character,
    product,
    setting,
    title: titleCase(String(idea || 'Video project').split(/[.,;]/)[0].slice(0, 60)),
  };
}

/**
 * Áp bản chỉnh sửa thủ công của người dùng lên bible mà vẫn giữ nguyên cấu trúc.
 * Dùng khi người dùng sửa tên nhân vật / sản phẩm ở tab "Nhân vật & Sản phẩm".
 */
export function patchBible(bible, patch) {
  const next = { ...bible, ...patch };
  next.character = { ...bible.character, ...(patch.character || {}) };
  next.product = { ...bible.product, ...(patch.product || {}) };
  next.setting = { ...bible.setting, ...(patch.setting || {}) };
  return next;
}

export { DEFAULT_NEGATIVE };
