const pad = (n: number) => String(Math.floor(n)).padStart(2, "0");

export function timecode(sec: number, fps: number): string {
  const s = Math.max(0, sec);
  const frames = Math.floor((s % 1) * fps);
  return `${pad(s / 3600)}:${pad((s % 3600) / 60)}:${pad(s % 60)}:${pad(frames)}`;
}

export function shortTime(sec: number): string {
  const s = Math.max(0, sec);
  return `${pad(s / 60)}:${pad(s % 60)}`;
}
