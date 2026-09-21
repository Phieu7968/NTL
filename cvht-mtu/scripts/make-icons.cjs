/* =====================================================================
   make-icons.cjs — sinh bộ icon PNG cho PWA
   Chạy:  node scripts/make-icons.cjs
   Không cần thư viện ngoài: tự vẽ pixel rồi tự đóng gói PNG bằng zlib có
   sẵn trong Node. Nhờ vậy dựng lại icon ở máy nào cũng được.

   LƯU Ý: hình ở đây là biểu tượng tạm, dựng theo mô-típ logo Trường.
   Khi xin được tệp vector chính thức từ Phòng CNTT, hãy thay hình trong
   hàm drawMark() rồi chạy lại tệp này.
   ===================================================================== */
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const OUT = path.join(__dirname, "..", "assets", "icons");

const NAVY = [18, 58, 107];
const RED  = [200, 16, 46];
const WHITE = [255, 255, 255];

/* ---------- vẽ trên lưới pixel ---------- */
function canvas(size, bg) {
  const px = new Uint8Array(size * size * 4);
  for (let i = 0; i < size * size; i++) {
    px[i * 4] = bg[0]; px[i * 4 + 1] = bg[1]; px[i * 4 + 2] = bg[2]; px[i * 4 + 3] = 255;
  }
  return { size, px };
}

const setPx = (c, x, y, col) => {
  if (x < 0 || y < 0 || x >= c.size || y >= c.size) return;
  const i = (y * c.size + x) * 4;
  c.px[i] = col[0]; c.px[i + 1] = col[1]; c.px[i + 2] = col[2]; c.px[i + 3] = 255;
};

/** Tô một đa giác bằng thuật toán quét dòng (even-odd). */
function fillPoly(c, pts, col) {
  const ys = pts.map((p) => p[1]);
  const y0 = Math.max(0, Math.floor(Math.min(...ys)));
  const y1 = Math.min(c.size - 1, Math.ceil(Math.max(...ys)));
  for (let y = y0; y <= y1; y++) {
    const cy = y + 0.5;
    const xs = [];
    for (let i = 0, n = pts.length; i < n; i++) {
      const a = pts[i], b = pts[(i + 1) % n];
      if ((a[1] <= cy && b[1] > cy) || (b[1] <= cy && a[1] > cy)) {
        xs.push(a[0] + ((cy - a[1]) / (b[1] - a[1])) * (b[0] - a[0]));
      }
    }
    xs.sort((m, n) => m - n);
    for (let i = 0; i + 1 < xs.length; i += 2) {
      for (let x = Math.ceil(xs[i] - 0.5); x <= Math.floor(xs[i + 1] - 0.5); x++) setPx(c, x, y, col);
    }
  }
}

const rect = (c, x, y, w, h, col) =>
  fillPoly(c, [[x, y], [x + w, y], [x + w, y + h], [x, y + h]], col);

/** Hình chữ nhật bo góc, dùng cho nền icon. */
function roundRect(c, x, y, w, h, r, col) {
  const pts = [];
  const arc = (cx, cy, from, to) => {
    for (let i = 0; i <= 10; i++) {
      const a = from + ((to - from) * i) / 10;
      pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
    }
  };
  arc(x + w - r, y + r, -Math.PI / 2, 0);
  arc(x + w - r, y + h - r, 0, Math.PI / 2);
  arc(x + r, y + h - r, Math.PI / 2, Math.PI);
  arc(x + r, y + r, Math.PI, Math.PI * 1.5);
  fillPoly(c, pts, col);
}

/**
 * Vẽ biểu tượng trong hệ toạ độ 0–100 rồi nhân theo kích thước thật.
 * @param {"light"|"solid"} variant light = nền trắng viền xanh (favicon),
 *                                   solid = nền xanh đặc (icon maskable)
 */
function drawMark(c, variant, inset) {
  const S = c.size;
  const u = (v) => (v / 100) * S * (1 - inset * 2) + inset * S;
  const un = (v) => (v / 100) * S * (1 - inset * 2);

  if (variant === "light") {
    roundRect(c, 0, 0, S, S, S * 0.18, WHITE);
    // khung xanh
    roundRect(c, u(6), u(6), un(88), un(88), un(8), NAVY);
    roundRect(c, u(13), u(13), un(74), un(74), un(5), WHITE);
  }

  const mCol = variant === "light" ? RED : WHITE;
  const barCol = variant === "light" ? NAVY : WHITE;

  // chữ M cách điệu
  fillPoly(c, [
    [u(24), u(60)], [u(24), u(24)], [u(34), u(24)], [u(50), u(42)],
    [u(66), u(24)], [u(76), u(24)], [u(76), u(60)], [u(67), u(60)],
    [u(67), u(38)], [u(50), u(56)], [u(33), u(38)], [u(33), u(60)]
  ], mCol);

  // ba vạch trang sách
  [66, 72.5, 79].forEach((y) => rect(c, u(28), u(y), un(44), un(4), barCol));
}

/* ---------- đóng gói PNG ---------- */
function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = c ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function toPng(c) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(c.size, 0);
  ihdr.writeUInt32BE(c.size, 4);
  ihdr[8] = 8;   // 8 bit mỗi kênh
  ihdr[9] = 6;   // RGBA
  const raw = Buffer.alloc(c.size * (c.size * 4 + 1));
  for (let y = 0; y < c.size; y++) {
    raw[y * (c.size * 4 + 1)] = 0; // không dùng bộ lọc
    Buffer.from(c.px.buffer, y * c.size * 4, c.size * 4)
      .copy(raw, y * (c.size * 4 + 1) + 1);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0))
  ]);
}

/** Vẽ ở độ phân giải gấp 4 rồi thu nhỏ để cạnh hình mịn. */
function render(size, variant, inset) {
  const SS = 4;
  const big = canvas(size * SS, variant === "light" ? WHITE : NAVY);
  drawMark(big, variant, inset);
  const out = canvas(size, WHITE);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0, g = 0, b = 0;
      for (let dy = 0; dy < SS; dy++) {
        for (let dx = 0; dx < SS; dx++) {
          const i = ((y * SS + dy) * big.size + (x * SS + dx)) * 4;
          r += big.px[i]; g += big.px[i + 1]; b += big.px[i + 2];
        }
      }
      const n = SS * SS;
      setPx(out, x, y, [Math.round(r / n), Math.round(g / n), Math.round(b / n)]);
    }
  }
  return out;
}

const FILES = [
  { name: "favicon-32.png", size: 32, variant: "light", inset: 0 },
  { name: "apple-touch-icon.png", size: 180, variant: "light", inset: 0 },
  { name: "icon-192.png", size: 192, variant: "light", inset: 0 },
  { name: "icon-512.png", size: 512, variant: "light", inset: 0 },
  // icon maskable bị hệ điều hành cắt tròn nên chừa lề an toàn 20%
  { name: "icon-maskable-512.png", size: 512, variant: "solid", inset: 0.2 }
];

fs.mkdirSync(OUT, { recursive: true });
FILES.forEach((f) => {
  const buf = toPng(render(f.size, f.variant, f.inset));
  fs.writeFileSync(path.join(OUT, f.name), buf);
  console.log(`${f.name.padEnd(26)} ${f.size}x${f.size}  ${(buf.length / 1024).toFixed(1)} KB`);
});
console.log("Xong. Icon nằm trong assets/icons/");
