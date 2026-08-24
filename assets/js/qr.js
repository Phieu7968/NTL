/* =========================================================
   QR encoder — byte mode, mức sửa lỗi M, phiên bản 1–15.
   Đủ dùng cho payload VietQR (thường ~120–180 ký tự).
   Không phụ thuộc thư viện ngoài.
   ========================================================= */
window.QR = (function () {
  "use strict";

  /* Bảng khối sửa lỗi (mức M): [số khối, tổng codeword, codeword dữ liệu] */
  var RSB = [null,[[1,26,16]],[[1,44,28]],[[1,70,44]],[[2,50,32]],[[2,67,43]],[[4,43,27]],[[4,49,31]],[[2,60,38],[2,61,39]],[[3,58,36],[2,59,37]],[[4,69,43],[1,70,44]],[[1,80,50],[4,81,51]],[[6,58,36],[2,59,37]],[[8,59,37],[1,60,38]],[[4,64,40],[5,65,41]],[[5,65,41],[5,66,42]]];
  /* Toạ độ tâm ô căn chỉnh theo phiên bản */
  var ALIGN = [null,[],[6,18],[6,22],[6,26],[6,30],[6,34],[6,22,38],[6,24,42],[6,26,46],[6,28,50],[6,30,54],[6,32,58],[6,34,62],[6,26,46,66],[6,26,48,70]];
  var ECL_FORMAT_BITS = 0; /* mức M */

  function blocksOf(v) {
    var out = [];
    RSB[v].forEach(function (g) { for (var i = 0; i < g[0]; i++) out.push({ total: g[1], data: g[2] }); });
    return out;
  }
  function dataCodewords(v) { return blocksOf(v).reduce(function (n, b) { return n + b.data; }, 0); }

  /* ---------- số học trên GF(256), đa thức sinh 0x11D ---------- */
  function mul(x, y) {
    var z = 0;
    for (var i = 7; i >= 0; i--) {
      z = (z << 1) ^ ((z >>> 7) * 0x11D);
      z ^= ((y >>> i) & 1) * x;
    }
    return z & 0xFF;
  }
  function rsDivisor(degree) {
    var result = [];
    for (var i = 0; i < degree - 1; i++) result.push(0);
    result.push(1);
    var root = 1;
    for (i = 0; i < degree; i++) {
      for (var j = 0; j < result.length; j++) {
        result[j] = mul(result[j], root);
        if (j + 1 < result.length) result[j] ^= result[j + 1];
      }
      root = mul(root, 0x02);
    }
    return result;
  }
  function rsRemainder(data, divisor) {
    var result = divisor.map(function () { return 0; });
    data.forEach(function (b) {
      var factor = b ^ result.shift();
      result.push(0);
      divisor.forEach(function (d, i) { result[i] ^= mul(d, factor); });
    });
    return result;
  }

  /* ---------- chuỗi bit ---------- */
  function pushBits(bb, val, len) { for (var i = len - 1; i >= 0; i--) bb.push((val >>> i) & 1); }

  function toBytes(str) {
    var out = [], enc = unescape(encodeURIComponent(str));
    for (var i = 0; i < enc.length; i++) out.push(enc.charCodeAt(i) & 0xFF);
    return out;
  }

  function pickVersion(byteLen) {
    for (var v = 1; v <= 15; v++) {
      var ccBits = v < 10 ? 8 : 16;
      if (4 + ccBits + 8 * byteLen <= 8 * dataCodewords(v)) return v;
    }
    throw new Error("Nội dung QR quá dài (tối đa ~600 ký tự)");
  }

  function makeCodewords(bytes, v) {
    var bb = [], ccBits = v < 10 ? 8 : 16;
    pushBits(bb, 4, 4);                 /* chế độ byte */
    pushBits(bb, bytes.length, ccBits); /* độ dài */
    bytes.forEach(function (b) { pushBits(bb, b, 8); });

    var cap = 8 * dataCodewords(v);
    pushBits(bb, 0, Math.min(4, cap - bb.length));      /* dấu kết thúc */
    pushBits(bb, 0, (8 - bb.length % 8) % 8);           /* đệm tới biên byte */
    for (var pad = 0xEC; bb.length < cap; pad ^= 0xEC ^ 0x11) pushBits(bb, pad, 8);

    var data = [];
    for (var i = 0; i < bb.length; i += 8) {
      var b = 0;
      for (var j = 0; j < 8; j++) b = (b << 1) | bb[i + j];
      data.push(b);
    }

    /* chia khối, tính ECC, xen kẽ */
    var blocks = blocksOf(v), ecLen = blocks[0].total - blocks[0].data;
    var divisor = rsDivisor(ecLen), dat = [], ecc = [], k = 0;
    blocks.forEach(function (bl) {
      var chunk = data.slice(k, k + bl.data); k += bl.data;
      dat.push(chunk);
      ecc.push(rsRemainder(chunk, divisor));
    });

    var out = [], maxData = Math.max.apply(null, dat.map(function (d) { return d.length; }));
    for (i = 0; i < maxData; i++) dat.forEach(function (d) { if (i < d.length) out.push(d[i]); });
    for (i = 0; i < ecLen; i++) ecc.forEach(function (e) { out.push(e[i]); });
    return out;
  }

  /* ---------- dựng ma trận ---------- */
  function build(text, forceMask) {
    var bytes = toBytes(text), v = pickVersion(bytes.length);
    var codewords = makeCodewords(bytes, v);
    var size = v * 4 + 17;
    var mods = [], fn = [];
    for (var y = 0; y < size; y++) { mods.push(new Array(size).fill(false)); fn.push(new Array(size).fill(false)); }

    var setFn = function (x, y, dark) {
      if (x < 0 || y < 0 || x >= size || y >= size) return;
      mods[y][x] = dark; fn[y][x] = true;
    };
    var getBit = function (n, i) { return ((n >>> i) & 1) !== 0; };

    /* hàng/cột định thời */
    for (var i = 0; i < size; i++) { setFn(6, i, i % 2 === 0); setFn(i, 6, i % 2 === 0); }

    /* ô định vị góc */
    [[3, 3], [size - 4, 3], [3, size - 4]].forEach(function (c) {
      for (var dy = -4; dy <= 4; dy++) for (var dx = -4; dx <= 4; dx++) {
        var d = Math.max(Math.abs(dx), Math.abs(dy));
        setFn(c[0] + dx, c[1] + dy, d !== 2 && d !== 4);
      }
    });

    /* ô căn chỉnh */
    var ap = ALIGN[v], n = ap.length;
    for (i = 0; i < n; i++) for (var j = 0; j < n; j++) {
      if ((i === 0 && j === 0) || (i === 0 && j === n - 1) || (i === n - 1 && j === 0)) continue;
      for (var dy = -2; dy <= 2; dy++) for (var dx = -2; dx <= 2; dx++)
        setFn(ap[i] + dx, ap[j] + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
    }

    function drawFormat(mask) {
      var data = (ECL_FORMAT_BITS << 3) | mask, rem = data;
      for (var i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
      var bits = (((data << 10) | rem) ^ 0x5412) & 0x7FFF;
      for (i = 0; i <= 5; i++) setFn(8, i, getBit(bits, i));
      setFn(8, 7, getBit(bits, 6)); setFn(8, 8, getBit(bits, 7)); setFn(7, 8, getBit(bits, 8));
      for (i = 9; i < 15; i++) setFn(14 - i, 8, getBit(bits, i));
      for (i = 0; i < 8; i++) setFn(size - 1 - i, 8, getBit(bits, i));
      for (i = 8; i < 15; i++) setFn(8, size - 15 + i, getBit(bits, i));
      setFn(8, size - 8, true);
    }
    drawFormat(0);

    if (v >= 7) {
      var rem = v;
      for (i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1F25);
      var bits = (v << 12) | rem;
      for (i = 0; i < 18; i++) {
        var bit = getBit(bits, i), a = size - 11 + i % 3, b = Math.floor(i / 3);
        setFn(a, b, bit); setFn(b, a, bit);
      }
    }

    /* rải codeword theo đường zigzag */
    var idx = 0;
    for (var right = size - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5;
      for (var vert = 0; vert < size; vert++) {
        for (j = 0; j < 2; j++) {
          var x = right - j, upward = ((right + 1) & 2) === 0;
          var yy = upward ? size - 1 - vert : vert;
          if (!fn[yy][x] && idx < codewords.length * 8) {
            mods[yy][x] = getBit(codewords[idx >>> 3], 7 - (idx & 7));
            idx++;
          }
        }
      }
    }

    var maskFns = [
      function (x, y) { return (x + y) % 2 === 0; },
      function (x, y) { return y % 2 === 0; },
      function (x) { return x % 3 === 0; },
      function (x, y) { return (x + y) % 3 === 0; },
      function (x, y) { return (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0; },
      function (x, y) { return (x * y) % 2 + (x * y) % 3 === 0; },
      function (x, y) { return ((x * y) % 2 + (x * y) % 3) % 2 === 0; },
      function (x, y) { return ((x + y) % 2 + (x * y) % 3) % 2 === 0; }
    ];
    function applyMask(m) {
      for (var y = 0; y < size; y++) for (var x = 0; x < size; x++)
        if (!fn[y][x] && maskFns[m](x, y)) mods[y][x] = !mods[y][x];
    }

    function penalty() {
      var p = 0, x, y, i, run, color;
      for (y = 0; y < size; y++) {
        run = 0; color = false;
        for (x = 0; x < size; x++) {
          if (mods[y][x] === color) { run++; if (run === 5) p += 3; else if (run > 5) p++; }
          else { color = mods[y][x]; run = 1; }
        }
      }
      for (x = 0; x < size; x++) {
        run = 0; color = false;
        for (y = 0; y < size; y++) {
          if (mods[y][x] === color) { run++; if (run === 5) p += 3; else if (run > 5) p++; }
          else { color = mods[y][x]; run = 1; }
        }
      }
      for (y = 0; y < size - 1; y++) for (x = 0; x < size - 1; x++) {
        var c = mods[y][x];
        if (c === mods[y][x + 1] && c === mods[y + 1][x] && c === mods[y + 1][x + 1]) p += 3;
      }
      var patt = [true, false, true, true, true, false, true];
      function hasPattern(get) {
        var hits = 0;
        for (var s = 0; s + 7 <= size; s++) {
          var ok = true;
          for (var k = 0; k < 7; k++) if (get(s + k) !== patt[k]) { ok = false; break; }
          if (!ok) continue;
          var before = true, after = true;
          for (k = 1; k <= 4; k++) { if (s - k >= 0 && get(s - k)) before = false; }
          for (k = 0; k < 4; k++) { if (s + 7 + k < size && get(s + 7 + k)) after = false; }
          if (before || after) hits++;
        }
        return hits;
      }
      for (y = 0; y < size; y++) p += 40 * hasPattern(function (i) { return mods[y][i]; });
      for (x = 0; x < size; x++) p += 40 * hasPattern(function (i) { return mods[i][x]; });
      var dark = 0;
      for (y = 0; y < size; y++) for (x = 0; x < size; x++) if (mods[y][x]) dark++;
      p += 10 * Math.floor(Math.abs(dark * 20 - size * size * 10) / (size * size));
      return p;
    }

    var best = forceMask;
    if (best === undefined || best === null) {
      var min = Infinity;
      for (var m = 0; m < 8; m++) {
        applyMask(m); drawFormat(m);
        var s = penalty();
        if (s < min) { min = s; best = m; }
        applyMask(m); /* hoàn tác */
      }
    }
    applyMask(best); drawFormat(best);
    return { modules: mods, size: size, version: v, mask: best };
  }

  /* ---------- xuất SVG ---------- */
  function svg(text, opt) {
    opt = opt || {};
    var q = build(text, opt.mask), quiet = opt.quiet === undefined ? 4 : opt.quiet;
    var dim = q.size + quiet * 2;
    var path = "";
    for (var y = 0; y < q.size; y++) for (var x = 0; x < q.size; x++)
      if (q.modules[y][x]) path += "M" + (x + quiet) + "," + (y + quiet) + "h1v1h-1z";
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + dim + " " + dim +
      '" shape-rendering="crispEdges" role="img" aria-label="' + (opt.label || "Mã QR") + '">' +
      '<rect width="' + dim + '" height="' + dim + '" fill="' + (opt.bg || "#fff") + '"/>' +
      '<path d="' + path + '" fill="' + (opt.fg || "#000") + '"/></svg>';
  }
  function dataUri(text, opt) {
    return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg(text, opt));
  }

  return { build: build, svg: svg, dataUri: dataUri };
})();
