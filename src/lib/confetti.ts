// Utility pháo giấy (Canvas Confetti) 60fps mượt mà, không phụ thuộc thư viện bên ngoài

interface ConfettiParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  w: number;
  h: number;
  color: string;
  rotation: number;
  rotationSpeed: number;
  tilt: number;
  tiltSpeed: number;
  opacity: number;
  decay: number;
  shape: 'rect' | 'circle' | 'emoji';
  emoji?: string;
  gravity: number;
  drag: number;
}

const BRIGHT_COLORS = [
  '#10b981', // Emerald
  '#34d399', // Mint
  '#f59e0b', // Amber
  '#fbbf24', // Gold
  '#0ea5e9', // Sky blue
  '#38bdf8', // Light blue
  '#f43f5e', // Rose
  '#fb7185', // Pink
  '#8b5cf6', // Violet
  '#a78bfa', // Purple
  '#f97316', // Orange
];

const activeParticles: ConfettiParticle[] = [];
let animFrameId: number | null = null;
let canvasEl: HTMLCanvasElement | null = null;
let ctx: CanvasRenderingContext2D | null = null;

function getOrCreateCanvas(): {
  canvas: HTMLCanvasElement;
  context: CanvasRenderingContext2D;
} | null {
  if (typeof window === 'undefined') return null;

  if (!canvasEl || !document.body.contains(canvasEl)) {
    canvasEl = document.createElement('canvas');
    canvasEl.id = 'studynest-confetti-canvas';
    canvasEl.style.position = 'fixed';
    canvasEl.style.inset = '0';
    canvasEl.style.width = '100vw';
    canvasEl.style.height = '100vh';
    canvasEl.style.pointerEvents = 'none';
    canvasEl.style.zIndex = '99999';
    document.body.appendChild(canvasEl);
    ctx = canvasEl.getContext('2d');
  }

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const width = window.innerWidth;
  const height = window.innerHeight;

  if (
    canvasEl.width !== Math.floor(width * dpr) ||
    canvasEl.height !== Math.floor(height * dpr)
  ) {
    canvasEl.width = Math.floor(width * dpr);
    canvasEl.height = Math.floor(height * dpr);
    ctx = canvasEl.getContext('2d');
    if (ctx) {
      ctx.scale(dpr, dpr);
    }
  }

  return ctx ? { canvas: canvasEl, context: ctx } : null;
}

function renderFrame() {
  const result = getOrCreateCanvas();
  if (!result || activeParticles.length === 0) {
    if (result) {
      result.context.clearRect(0, 0, window.innerWidth, window.innerHeight);
    }
    animFrameId = null;
    return;
  }

  const { context } = result;
  context.clearRect(0, 0, window.innerWidth, window.innerHeight);

  for (let i = activeParticles.length - 1; i >= 0; i--) {
    const p = activeParticles[i];

    // Cập nhật vị trí và vận tốc
    p.vx *= p.drag;
    p.vy *= p.drag;
    p.vy += p.gravity;
    p.x += p.vx;
    p.y += p.vy;
    p.rotation += p.rotationSpeed;
    p.tilt += p.tiltSpeed;
    p.opacity -= p.decay;

    if (p.opacity <= 0 || p.y > window.innerHeight + 50) {
      activeParticles.splice(i, 1);
      continue;
    }

    // Vẽ hạt
    context.save();
    context.translate(p.x, p.y);
    context.rotate((p.rotation * Math.PI) / 180);
    // Hiệu ứng 3D lật lượn bằng scale Y theo góc tilt
    const scaleY = Math.cos(p.tilt);
    context.scale(1, scaleY);
    context.globalAlpha = Math.max(0, p.opacity);
    context.fillStyle = p.color;

    if (p.shape === 'emoji' && p.emoji) {
      context.font = `${Math.round(p.w)}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.fillText(p.emoji, 0, 0);
    } else if (p.shape === 'rect') {
      context.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
    } else {
      context.beginPath();
      context.arc(0, 0, p.w / 2, 0, Math.PI * 2);
      context.fill();
    }

    context.restore();
  }

  if (activeParticles.length > 0) {
    animFrameId = requestAnimationFrame(renderFrame);
  } else {
    context.clearRect(0, 0, window.innerWidth, window.innerHeight);
    animFrameId = null;
  }
}

/**
 * Bắn pháo giấy mini từ vị trí nhấn nút "Đã nhớ kỹ"
 */
export function triggerMiniConfetti(origin?: { x: number; y: number }) {
  const x = origin?.x ?? window.innerWidth / 2;
  const y = origin?.y ?? window.innerHeight * 0.75;

  const count = 45;
  for (let i = 0; i < count; i++) {
    // Góc bắn hướng lên hình nón (-45 đến -135 độ)
    const angle = ((Math.random() * 90 - 135) * Math.PI) / 180;
    const speed = Math.random() * 8 + 6;

    activeParticles.push({
      x,
      y,
      vx: Math.cos(angle) * speed + (Math.random() * 2 - 1),
      vy: Math.sin(angle) * speed,
      w: Math.random() * 6 + 6,
      h: Math.random() * 10 + 8,
      color: BRIGHT_COLORS[Math.floor(Math.random() * BRIGHT_COLORS.length)],
      rotation: Math.random() * 360,
      rotationSpeed: (Math.random() * 10 - 5) * 1.5,
      tilt: Math.random() * 10,
      tiltSpeed: Math.random() * 0.12 + 0.06,
      opacity: 1,
      decay: Math.random() * 0.012 + 0.012,
      shape: Math.random() > 0.3 ? 'rect' : 'circle',
      gravity: 0.3,
      drag: 0.965,
    });
  }

  if (!animFrameId) {
    animFrameId = requestAnimationFrame(renderFrame);
  }
}

/**
 * Đại tiệc pháo giấy bắn rực rỡ từ 2 bên màn hình khi hoàn thành phiên học
 */
export function triggerGrandConfetti() {
  const leftX = window.innerWidth * 0.15;
  const rightX = window.innerWidth * 0.85;
  const bottomY = window.innerHeight * 0.85;

  const countPerSide = 65;

  // Luồng bên trái bắn chếch sang phải
  for (let i = 0; i < countPerSide; i++) {
    const angle = ((Math.random() * 45 - 75) * Math.PI) / 180;
    const speed = Math.random() * 12 + 10;

    activeParticles.push({
      x: leftX,
      y: bottomY,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      w: Math.random() * 8 + 7,
      h: Math.random() * 12 + 10,
      color: BRIGHT_COLORS[Math.floor(Math.random() * BRIGHT_COLORS.length)],
      rotation: Math.random() * 360,
      rotationSpeed: (Math.random() * 12 - 6),
      tilt: Math.random() * 10,
      tiltSpeed: Math.random() * 0.14 + 0.06,
      opacity: 1,
      decay: Math.random() * 0.008 + 0.008,
      shape: Math.random() > 0.25 ? 'rect' : 'circle',
      gravity: 0.28,
      drag: 0.975,
    });
  }

  // Luồng bên phải bắn chếch sang trái
  for (let i = 0; i < countPerSide; i++) {
    const angle = ((Math.random() * 45 - 150) * Math.PI) / 180;
    const speed = Math.random() * 12 + 10;

    activeParticles.push({
      x: rightX,
      y: bottomY,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      w: Math.random() * 8 + 7,
      h: Math.random() * 12 + 10,
      color: BRIGHT_COLORS[Math.floor(Math.random() * BRIGHT_COLORS.length)],
      rotation: Math.random() * 360,
      rotationSpeed: (Math.random() * 12 - 6),
      tilt: Math.random() * 10,
      tiltSpeed: Math.random() * 0.14 + 0.06,
      opacity: 1,
      decay: Math.random() * 0.008 + 0.008,
      shape: Math.random() > 0.25 ? 'rect' : 'circle',
      gravity: 0.28,
      drag: 0.975,
    });
  }

  if (!animFrameId) {
    animFrameId = requestAnimationFrame(renderFrame);
  }
}

/**
 * Hiệu ứng Mặt cảm xúc Chibi / Emoji reaction nảy lên khi bấm "Tạm nhớ" (Bộ Ý Tưởng 4)
 */
export function triggerGoodFeedbackBurst(origin?: { x: number; y: number }) {
  const x = origin?.x ?? window.innerWidth / 2;
  const y = origin?.y ?? window.innerHeight * 0.75;

  // Biểu cảm Chibi ngầu, tươi cười, nỗ lực
  const CHIBI_EMOJIS = ['🥰', '😎', '💪', '⭐', '✨', '🌟', '🥳'];
  const AMBER_COLORS = ['#f59e0b', '#fbbf24', '#fcd34d', '#fef08a', '#d97706'];

  // 14 hạt biểu cảm Chibi bay nảy lên theo quỹ đạo cung vui nhộn
  for (let i = 0; i < 14; i++) {
    const angle = ((Math.random() * 80 - 130) * Math.PI) / 180;
    const speed = Math.random() * 6.5 + 4.5;
    activeParticles.push({
      x: x + (Math.random() * 24 - 12),
      y: y + (Math.random() * 12 - 6),
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      w: Math.random() * 8 + 24, // Kích thước font emoji 24-32px
      h: Math.random() * 8 + 24,
      color: '#fbbf24',
      rotation: Math.random() * 30 - 15,
      rotationSpeed: Math.random() * 3 - 1.5,
      tilt: 0,
      tiltSpeed: 0,
      opacity: 1,
      decay: Math.random() * 0.015 + 0.012,
      shape: 'emoji',
      emoji: CHIBI_EMOJIS[Math.floor(Math.random() * CHIBI_EMOJIS.length)],
      gravity: 0.18,
      drag: 0.965,
    });
  }

  // 16 hạt đốm sáng vàng óng nổ lấp lánh xung quanh
  for (let i = 0; i < 16; i++) {
    const angle = ((Math.random() * 90 - 135) * Math.PI) / 180;
    const speed = Math.random() * 7 + 4;
    activeParticles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      w: Math.random() * 6 + 4,
      h: Math.random() * 6 + 4,
      color: AMBER_COLORS[Math.floor(Math.random() * AMBER_COLORS.length)],
      rotation: Math.random() * 360,
      rotationSpeed: Math.random() * 8 - 4,
      tilt: Math.random() * 10,
      tiltSpeed: 0.1,
      opacity: 1,
      decay: Math.random() * 0.02 + 0.015,
      shape: 'circle',
      gravity: 0.22,
      drag: 0.96,
    });
  }

  if (!animFrameId) {
    animFrameId = requestAnimationFrame(renderFrame);
  }
}

/**
 * Hiệu ứng Mặt cảm xúc Chibi ôm ấp, cổ vũ dịu dàng khi bấm "Chưa thuộc / Hay quên" (Bộ Ý Tưởng 4)
 */
export function triggerEncouragingFeedbackBurst(origin?: { x: number; y: number }) {
  const x = origin?.x ?? window.innerWidth / 2;
  const y = origin?.y ?? window.innerHeight * 0.75;

  // Biểu cảm Chibi ấm áp, vỗ về, khích lệ
  const CHIBI_EMOJIS = ['🤗', '💖', '🌱', '🌸', '✨', '🧸', '✌️'];
  const PASTEL_COLORS = [
    '#fb7185',
    '#fda4af',
    '#f43f5e',
    '#a78bfa',
    '#34d399',
    '#6ee7b7',
  ];

  // 14 hạt emoji chibi dịu dàng bay bồng bềnh lượn sóng
  for (let i = 0; i < 14; i++) {
    const angle = ((Math.random() * 120 - 150) * Math.PI) / 180;
    const speed = Math.random() * 4.5 + 2.5;
    activeParticles.push({
      x: x + (Math.random() * 24 - 12),
      y: y + (Math.random() * 12 - 6),
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      w: Math.random() * 8 + 24,
      h: Math.random() * 8 + 24,
      color: '#fb7185',
      rotation: Math.random() * 24 - 12,
      rotationSpeed: Math.random() * 2 - 1,
      tilt: 0,
      tiltSpeed: 0,
      opacity: 1,
      decay: Math.random() * 0.014 + 0.01,
      shape: 'emoji',
      emoji: CHIBI_EMOJIS[Math.floor(Math.random() * CHIBI_EMOJIS.length)],
      gravity: 0.12, // Rất nhẹ để bồng bềnh
      drag: 0.97,
    });
  }

  // 16 hạt đốm sáng pastel dịu dàng
  for (let i = 0; i < 16; i++) {
    const angle = ((Math.random() * 120 - 150) * Math.PI) / 180;
    const speed = Math.random() * 5 + 2;
    activeParticles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      w: Math.random() * 6 + 4,
      h: Math.random() * 6 + 4,
      color: PASTEL_COLORS[Math.floor(Math.random() * PASTEL_COLORS.length)],
      rotation: Math.random() * 360,
      rotationSpeed: Math.random() * 6 - 3,
      tilt: Math.random() * 10,
      tiltSpeed: 0.08,
      opacity: 1,
      decay: Math.random() * 0.018 + 0.012,
      shape: 'circle',
      gravity: 0.15,
      drag: 0.965,
    });
  }

  if (!animFrameId) {
    animFrameId = requestAnimationFrame(renderFrame);
  }
}


