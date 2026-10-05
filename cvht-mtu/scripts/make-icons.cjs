/* =====================================================================
   make-icons.cjs — sinh bộ biểu tượng của ứng dụng từ logo Trường
   Chạy:  node scripts/make-icons.cjs

   Đầu vào : assets/icons/logo-source.png  (bản logo gốc, độ phân giải cao)
   Đầu ra  : assets/icons/logo-mtu.png     (bản dùng hiển thị trong app)
             assets/icons/favicon-32.png
             assets/icons/apple-touch-icon.png
             assets/icons/icon-192.png
             assets/icons/icon-512.png
             assets/icons/icon-maskable-512.png

   Thay logo mới: chép tệp PNG mới đè lên logo-source.png rồi chạy lại lệnh
   trên, sau đó tăng số VERSION trong sw.js để máy đã cài nhận bản mới.

   Không cần cài thêm thư viện nào: tệp này tự đọc PNG, tự thu nhỏ, tự giảm
   số màu và tự đóng gói PNG bằng zlib có sẵn trong Node.
   ===================================================================== */
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const DIR = path.join(__dirname, "..", "assets", "icons");
const SOURCE = path.join(DIR, "logo-source.png");

/* ------------------------------------------------------------------ */
/* 1. Đọc tệp PNG                                                      */
/* ------------------------------------------------------------------ */
function readPng(file) {
  const buf = fs.readFileSync(file);
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error(`${file} không phải tệp PNG.`);

  let pos = 8, ihdr = null, palette = null, trns = null;
  const idat = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString("ascii", pos + 4, pos + 8);
    const data = buf.subarray(pos + 8, pos + 8 + len);
    if (type === "IHDR") {
      ihdr = {
        w: data.readUInt32BE(0), h: data.readUInt32BE(4),
        depth: data[8], color: data[9], interlace: data[12]
      };
    } else if (type === "PLTE") palette = Buffer.from(data);
    else if (type === "tRNS") trns = Buffer.from(data);
    else if (type === "IDAT") idat.push(Buffer.from(data));
    else if (type === "IEND") break;
    pos += 12 + len;
  }
  if (!ihdr) throw new Error("Tệp PNG thiếu khối IHDR.");
  if (ihdr.depth !== 8) throw new Error(`Chỉ đọc được PNG 8 bit mỗi kênh (tệp này ${ihdr.depth} bit).`);
  if (ihdr.interlace) throw new Error("Chưa hỗ trợ PNG lưu kiểu interlace. Hãy lưu lại ở dạng thường.");

  const CH = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[ihdr.color];
  if (!CH) throw new Error(`Kiểu màu PNG ${ihdr.color} chưa hỗ trợ.`);

  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = ihdr.w * CH;
  const out = Buffer.alloc(ihdr.h * stride);

  // Gỡ bộ lọc từng dòng quét theo đúng đặc tả PNG
  for (let y = 0; y < ihdr.h; y++) {
    const filter = raw[y * (stride + 1)];
    const src = raw.subarray(y * (stride + 1) + 1, y * (stride + 1) + 1 + stride);
    const cur = out.subarray(y * stride, (y + 1) * stride);
    const prev = y ? out.subarray((y - 1) * stride, y * stride) : null;
    for (let i = 0; i < stride; i++) {
      const a = i >= CH ? cur[i - CH] : 0;
      const b = prev ? prev[i] : 0;
      const c = prev && i >= CH ? prev[i - CH] : 0;
      let v = src[i];
      if (filter === 1) v += a;
      else if (filter === 2) v += b;
      else if (filter === 3) v += (a + b) >> 1;
      else if (filter === 4) {
        const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      } else if (filter !== 0) throw new Error(`Bộ lọc dòng ${filter} không hợp lệ.`);
      cur[i] = v & 255;
    }
  }

  // Quy về RGBA để các bước sau xử lý cho gọn
  const rgba = Buffer.alloc(ihdr.w * ihdr.h * 4, 255);
  for (let i = 0, n = ihdr.w * ihdr.h; i < n; i++) {
    let r, g, b, a = 255;
    if (ihdr.color === 0) { r = g = b = out[i]; }
    else if (ihdr.color === 4) { r = g = b = out[i * 2]; a = out[i * 2 + 1]; }
    else if (ihdr.color === 2) { r = out[i * 3]; g = out[i * 3 + 1]; b = out[i * 3 + 2]; }
    else if (ihdr.color === 6) { r = out[i * 4]; g = out[i * 4 + 1]; b = out[i * 4 + 2]; a = out[i * 4 + 3]; }
    else { // bảng màu
      const idx = out[i];
      r = palette[idx * 3]; g = palette[idx * 3 + 1]; b = palette[idx * 3 + 2];
      if (trns && idx < trns.length) a = trns[idx];
    }
    rgba[i * 4] = r; rgba[i * 4 + 1] = g; rgba[i * 4 + 2] = b; rgba[i * 4 + 3] = a;
  }
  return { w: ihdr.w, h: ihdr.h, rgba };
}

/* ------------------------------------------------------------------ */
/* 2. Cắt bỏ lề trắng quanh logo                                       */
/* ------------------------------------------------------------------ */
function trim(img) {
  const { w, h, rgba } = img;
  const ink = (x, y) => {
    const i = (y * w + x) * 4;
    if (rgba[i + 3] < 24) return false;
    return (255 - rgba[i]) + (255 - rgba[i + 1]) + (255 - rgba[i + 2]) > 60;
  };
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!ink(x, y)) continue;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  }
  if (x1 < 0) return { x: 0, y: 0, w, h };
  return { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

/* ------------------------------------------------------------------ */
/* 3. Thu nhỏ bằng cách lấy trung bình vùng — cạnh hình mịn            */
/* ------------------------------------------------------------------ */
function drawScaled(dst, dw, dh, src, crop, dx, dy, tw, th, bg) {
  for (let y = 0; y < th; y++) {
    const sy0 = crop.y + (y * crop.h) / th;
    const sy1 = crop.y + ((y + 1) * crop.h) / th;
    for (let x = 0; x < tw; x++) {
      const sx0 = crop.x + (x * crop.w) / tw;
      const sx1 = crop.x + ((x + 1) * crop.w) / tw;
      let r = 0, g = 0, b = 0, n = 0;
      for (let sy = Math.floor(sy0); sy < Math.max(Math.ceil(sy1), Math.floor(sy0) + 1); sy++) {
        if (sy < 0 || sy >= src.h) continue;
        for (let sx = Math.floor(sx0); sx < Math.max(Math.ceil(sx1), Math.floor(sx0) + 1); sx++) {
          if (sx < 0 || sx >= src.w) continue;
          const i = (sy * src.w + sx) * 4;
          const a = src.rgba[i + 3] / 255;
          // nền của logo là màu trắng: pha alpha lên nền cho khỏi viền xám
          r += src.rgba[i] * a + bg[0] * (1 - a);
          g += src.rgba[i + 1] * a + bg[1] * (1 - a);
          b += src.rgba[i + 2] * a + bg[2] * (1 - a);
          n++;
        }
      }
      if (!n) continue;
      const px = ((dy + y) * dw + (dx + x)) * 4;
      if (dx + x < 0 || dx + x >= dw || dy + y < 0 || dy + y >= dh) continue;
      dst[px] = Math.round(r / n);
      dst[px + 1] = Math.round(g / n);
      dst[px + 2] = Math.round(b / n);
      dst[px + 3] = 255;
    }
  }
}

/** Khung vuông nền trắng, logo đặt giữa, chừa lề theo tỉ lệ pad. */
function square(src, crop, size, pad) {
  const rgba = Buffer.alloc(size * size * 4, 255);
  const inner = size * (1 - pad * 2);
  const s = Math.min(inner / crop.w, inner / crop.h);
  const tw = Math.max(1, Math.round(crop.w * s));
  const th = Math.max(1, Math.round(crop.h * s));
  drawScaled(rgba, size, size, src, crop, Math.round((size - tw) / 2), Math.round((size - th) / 2),
    tw, th, [255, 255, 255]);
  return { w: size, h: size, rgba };
}

/** Bản giữ nguyên tỉ lệ, dùng cho chỗ hiển thị logo trong giao diện. */
function wide(src, crop, targetW) {
  const tw = targetW;
  const th = Math.max(1, Math.round((crop.h / crop.w) * targetW));
  const rgba = Buffer.alloc(tw * th * 4, 255);
  drawScaled(rgba, tw, th, src, crop, 0, 0, tw, th, [255, 255, 255]);
  return { w: tw, h: th, rgba };
}

/* ------------------------------------------------------------------ */
/* 4. Giảm số màu rồi đóng gói PNG bảng màu cho tệp thật nhẹ           */
/* ------------------------------------------------------------------ */
/** Cắt trung vị: chia dần không gian màu, mỗi ô lấy màu trung bình. */
function quantize(img, maxColors) {
  const counts = new Map();
  for (let i = 0, n = img.w * img.h; i < n; i++) {
    const k = (img.rgba[i * 4] << 16) | (img.rgba[i * 4 + 1] << 8) | img.rgba[i * 4 + 2];
    counts.set(k, (counts.get(k) || 0) + 1);
  }
  const colors = Array.from(counts, ([k, c]) => ({ r: (k >> 16) & 255, g: (k >> 8) & 255, b: k & 255, c }));
  if (colors.length <= maxColors) {
    return finish(colors.map((x) => [x.r, x.g, x.b]));
  }

  let boxes = [colors];
  while (boxes.length < maxColors) {
    let bi = -1, best = -1;
    boxes.forEach((box, i) => {
      if (box.length < 2) return;
      const span = spread(box);
      if (span.range > best) { best = span.range; bi = i; }
    });
    if (bi < 0) break;
    const box = boxes[bi];
    const ch = spread(box).ch;
    box.sort((a, b) => a[ch] - b[ch]);
    const mid = box.length >> 1;
    boxes.splice(bi, 1, box.slice(0, mid), box.slice(mid));
  }

  const palette = boxes.map((box) => {
    let r = 0, g = 0, b = 0, n = 0;
    box.forEach((x) => { r += x.r * x.c; g += x.g * x.c; b += x.b * x.c; n += x.c; });
    return [Math.round(r / n), Math.round(g / n), Math.round(b / n)];
  });
  return finish(palette);

  function spread(box) {
    let lo = [255, 255, 255], hi = [0, 0, 0];
    box.forEach((x) => {
      [x.r, x.g, x.b].forEach((v, i) => { if (v < lo[i]) lo[i] = v; if (v > hi[i]) hi[i] = v; });
    });
    const d = [hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]];
    const m = Math.max(d[0], d[1], d[2]);
    return { range: m, ch: ["r", "g", "b"][d.indexOf(m)] };
  }

  function finish(palette) {
    const cache = new Map();
    const idx = Buffer.alloc(img.w * img.h);
    for (let i = 0, n = img.w * img.h; i < n; i++) {
      const r = img.rgba[i * 4], g = img.rgba[i * 4 + 1], b = img.rgba[i * 4 + 2];
      const key = (r << 16) | (g << 8) | b;
      let p = cache.get(key);
      if (p === undefined) {
        let bd = Infinity;
        for (let k = 0; k < palette.length; k++) {
          const dr = palette[k][0] - r, dg = palette[k][1] - g, db = palette[k][2] - b;
          const d = dr * dr + dg * dg + db * db;
          if (d < bd) { bd = d; p = k; }
        }
        cache.set(key, p);
      }
      idx[i] = p;
    }
    return { palette, idx };
  }
}

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
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function writePng(file, img, maxColors) {
  const { palette, idx } = quantize(img, maxColors || 64);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(img.w, 0);
  ihdr.writeUInt32BE(img.h, 4);
  ihdr[8] = 8;  // 8 bit cho mỗi chỉ số màu
  ihdr[9] = 3;  // ảnh dùng bảng màu
  const plte = Buffer.alloc(palette.length * 3);
  palette.forEach((c, i) => { plte[i * 3] = c[0]; plte[i * 3 + 1] = c[1]; plte[i * 3 + 2] = c[2]; });

  const raw = Buffer.alloc(img.h * (img.w + 1));
  for (let y = 0; y < img.h; y++) {
    raw[y * (img.w + 1)] = 0;
    idx.copy(raw, y * (img.w + 1) + 1, y * img.w, (y + 1) * img.w);
  }
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("PLTE", plte),
    chunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0))
  ]);
  fs.writeFileSync(file, png);
  return { bytes: png.length, colors: palette.length };
}

/* ------------------------------------------------------------------ */
/* 5. Chạy                                                             */
/* ------------------------------------------------------------------ */
if (!fs.existsSync(SOURCE)) {
  console.error(`Không tìm thấy ${SOURCE}.\nHãy đặt tệp logo PNG vào đó rồi chạy lại.`);
  process.exit(1);
}
const src = readPng(SOURCE);
const crop = trim(src);
console.log(`Logo gốc : ${src.w}x${src.h}`);
console.log(`Sau khi cắt lề trắng: ${crop.w}x${crop.h} (tại ${crop.x},${crop.y})`);

const jobs = [
  { name: "logo-mtu.png", img: () => wide(src, crop, 320), colors: 64 },
  { name: "favicon-32.png", img: () => square(src, crop, 32, 0.03), colors: 64 },
  { name: "apple-touch-icon.png", img: () => square(src, crop, 180, 0.07), colors: 64 },
  { name: "icon-192.png", img: () => square(src, crop, 192, 0.06), colors: 64 },
  { name: "icon-512.png", img: () => square(src, crop, 512, 0.06), colors: 96 },
  // icon maskable bị hệ điều hành cắt tròn nên chừa lề an toàn rộng hơn
  { name: "icon-maskable-512.png", img: () => square(src, crop, 512, 0.22), colors: 96 }
];

let total = 0;
jobs.forEach((j) => {
  const img = j.img();
  const r = writePng(path.join(DIR, j.name), img, j.colors);
  total += r.bytes;
  console.log(`${j.name.padEnd(24)} ${String(img.w + "x" + img.h).padEnd(9)} ${(r.bytes / 1024).toFixed(1).padStart(6)} KB  ${r.colors} màu`);
});
console.log(`Tổng cộng: ${(total / 1024).toFixed(1)} KB`);
console.log("Xong. Nhớ tăng số VERSION trong sw.js để máy đã cài nhận bộ icon mới.");
