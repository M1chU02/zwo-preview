export type ZoneKey = "Z1" | "Z2" | "Z3" | "Z4" | "Z5" | "Z6" | "Z7";

export function ftpToZone(p: number): ZoneKey {
  // proste progi (możesz potem dopasować do Zwifta)
  if (p < 0.55) return "Z1";
  if (p < 0.75) return "Z2";
  if (p < 0.9) return "Z3";
  if (p < 1.05) return "Z4";
  if (p < 1.2) return "Z5";
  if (p < 1.5) return "Z6";
  return "Z7";
}

export const zoneColor: Record<ZoneKey, string> = {
  Z1: "#5e5e5e",
  Z2: "#2f80ed", // niebieski (łatwo rozpoznać warmup/cooldown)
  Z3: "#27ae60", // zielony
  Z4: "#f2c94c", // żółty
  Z5: "#f2994a", // pomarańcz
  Z6: "#eb5757", // czerwony
  Z7: "#9b51e0", // fiolet
};

export function formatDuration(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return s === 0 ? `${m}min` : `${m}min ${s}s`;
}
