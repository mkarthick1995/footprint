// Debug overlay for sighted testers (aria-hidden): boxes, tier, TTC. Lets us tune Q2 on clips and phones.
import type { AlertCandidate, FrameInfo, Track } from '@footprint/shared';

const TIER_COLOR: Record<string, string> = { P0: '#ff3b30', P1: '#ff9500', P2: '#ffd60a', P3: '#8e8e93', SYS: '#0a84ff' };

export function drawOverlay(canvas: HTMLCanvasElement, frame: FrameInfo, tracks: Track[], candidates: AlertCandidate[]): void {
  if (canvas.width !== frame.width) canvas.width = frame.width;
  if (canvas.height !== frame.height) canvas.height = frame.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  // Path corridor (central 40 %).
  ctx.fillStyle = 'rgba(255,255,255,0.06)';
  ctx.fillRect(frame.width * 0.3, 0, frame.width * 0.4, frame.height);
  const byId = new Map(candidates.map((c) => [c.id, c]));
  ctx.lineWidth = Math.max(2, frame.width / 320);
  ctx.font = `${Math.max(12, frame.width / 40)}px system-ui`;
  for (const t of tracks) {
    const c = byId.get(t.id);
    const color = c ? (TIER_COLOR[c.tier] ?? '#fff') : '#555';
    ctx.strokeStyle = color;
    ctx.strokeRect(t.box.x, t.box.y, t.box.w, t.box.h);
    const ttc = c && Number.isFinite(c.ttcSeconds) ? `${c.ttcSeconds.toFixed(1)}s` : '–';
    const label = `${t.type} ${c?.tier ?? '…'} ${ttc}${t.edgeCut ? ' cut' : ''}`;
    ctx.fillStyle = color;
    ctx.fillText(label, t.box.x + 4, Math.max(14, t.box.y - 4));
  }
}
