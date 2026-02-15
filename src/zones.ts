export type ZoneKey = "Z1" | "Z2" | "Z3" | "Z4" | "Z5" | "Z6" | "Z7";

export function ftpToZone(p: number): ZoneKey {
  // Zwift standard zones
  if (p < 0.6) return "Z1";
  if (p < 0.76) return "Z2";
  if (p < 0.9) return "Z3";
  if (p < 1.05) return "Z4";
  if (p < 1.19) return "Z5";
  if (p < 1.5) return "Z6";
  return "Z7";
}

export const zoneColor: Record<ZoneKey, string> = {
  Z1: "#7f7f7f", // Gray (Recovery)
  Z2: "#3284ff", // Blue
  Z3: "#5aca5a", // Green
  Z4: "#ffcc33", // Yellow
  Z5: "#ff6633", // Orange
  Z6: "#ff3333", // Red
  Z7: "#800080", // Purple/Dark Red
};

export function formatDuration(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return s === 0 ? `${m}min` : `${m}min ${s}s`;
}
