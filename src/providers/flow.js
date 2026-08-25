/**
 * Quy trình tạo video bằng Google Flow.
 *
 * Google Flow (labs.google/fx/tools/flow) hiện không có API công khai, nên app đi
 * đường "bán tự động": chuẩn bị sẵn prompt đúng chuẩn, copy vào clipboard, mở Flow,
 * người dùng dán - tạo - tải video về rồi thả lại vào app để preview và ghép.
 */

export const FLOW_URL = 'https://labs.google/fx/tools/flow';

export function flowSteps(scene, bible) {
  return [
    'Bấm "Copy prompt" - prompt của cảnh này đã nằm trong clipboard.',
    'Bấm "Mở Google Flow" để mở Flow ở tab mới (đăng nhập tài khoản Google có quyền dùng Flow).',
    'Trong Flow chọn "Text to Video", dán prompt vào ô nhập.',
    `Đặt tỷ lệ khung hình ${bible.aspect} và độ dài khoảng ${scene.duration}s cho khớp kịch bản.`,
    'Bấm tạo, đợi Flow render xong rồi tải video về máy.',
    'Quay lại app, bấm "Tải video lên" ở đúng cảnh này để xem preview và ghép vào dự án.',
  ];
}

/** Copy an toàn: có Clipboard API thì dùng, không thì fallback textarea. */
export async function copyText(text) {
  if (typeof navigator !== 'undefined' && navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (err) {
      /* rơi xuống fallback bên dưới */
    }
  }
  try {
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(area);
    return ok;
  } catch (err) {
    return false;
  }
}

export function openFlow() {
  window.open(FLOW_URL, '_blank', 'noopener');
}
