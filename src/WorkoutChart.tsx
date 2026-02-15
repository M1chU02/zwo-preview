import type { Segment } from "./zwo";
import { ftpToZone, zoneColor } from "./zones";

type Props = {
  segments: Segment[];
  ftpWatts?: number; // jeśli podane, pokaż też waty w tooltipie
  showWatts?: boolean;
  height?: number;
};

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

export function WorkoutChart({
  segments,
  ftpWatts = 250,
  showWatts = false,
  height = 220,
}: Props) {
  const total = segments.length ? segments[segments.length - 1].endSec : 0;

  // zakres wykresu: 0–160% FTP (jak często na takich podglądach)
  const maxFtp = 1.6;

  // use a virtual width for calculation, but let SVG stretch
  const viewW = 1000;
  const padding = 0;
  // If height is passed as prop, use it for coordinate system
  const viewH = height;

  const baseY = viewH;
  const chartH = viewH;

  const xAt = (t: number) => (t / total) * viewW;

  const yAt = (p: number) => {
    const v = clamp(p, 0, maxFtp);
    return baseY - (v / maxFtp) * chartH;
  };

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        // background: "#141414", // Removed background from here to parent
        // borderRadius: 14,
        // padding: 14,
      }}>
      <svg
        viewBox={`0 0 ${viewW} ${viewH}`}
        preserveAspectRatio="none"
        width="100%"
        height="100%"
        role="img">
        {/* delikatna linia bazowa */}
        <line
          x1={padding}
          y1={baseY}
          x2={viewW - padding}
          y2={baseY}
          stroke="rgba(255,255,255,0.12)"
        />

        {segments.map((s, idx) => {
          const x0 = xAt(s.startSec);
          const x1 = xAt(s.endSec);
          const w = Math.max(2, x1 - x0);
          const rx = 14;

          if (s.kind === "free") {
            const y0 = yAt(0.55);
            const h = baseY - y0;
            return (
              <g key={idx}>
                <rect
                  x={x0}
                  y={y0}
                  width={w}
                  height={h}
                  rx={rx}
                  fill="rgba(255,255,255,0.12)"
                />
                <title>{s.label ?? "Free ride"}</title>
              </g>
            );
          }

          if (s.kind === "steady") {
            const p = s.ftp;
            const z = ftpToZone(p);
            const y0 = yAt(p);
            const h = baseY - y0;

            const watts = Math.round(p * ftpWatts);
            const tip = showWatts
              ? `${Math.round(p * 100)}% (${watts}W)`
              : `${Math.round(p * 100)}% FTP`;

            return (
              <g key={idx}>
                <rect
                  x={x0}
                  y={y0}
                  width={w}
                  height={h}
                  rx={rx}
                  fill={zoneColor[z]}
                />
                <title>{(s.label ? s.label + " · " : "") + tip}</title>
              </g>
            );
          }

          // ramp
          const low = s.ftpLow;
          const high = s.ftpHigh;
          const z = ftpToZone((low + high) / 2);
          const yLow = yAt(low);
          const yHigh = yAt(high);

          // trapez + zaokrąglenie robimy prosto: polygon + overlay rect (wygląda ok na start)
          const points =
            `${x0},${yLow} ` +
            `${x1},${yHigh} ` +
            `${x1},${baseY} ` +
            `${x0},${baseY}`;

          const tip = `${Math.round(low * 100)}→${Math.round(high * 100)}% FTP`;

          return (
            <g key={idx}>
              <polygon points={points} fill={zoneColor[z]} opacity={0.95} />
              <rect
                x={x0}
                y={Math.min(yLow, yHigh)}
                width={w}
                height={baseY - Math.min(yLow, yHigh)}
                rx={rx}
                fill="transparent"
              />
              <title>{(s.label ? s.label + " · " : "") + tip}</title>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
