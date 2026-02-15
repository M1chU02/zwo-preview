import React, { useState } from "react";
import type { Segment } from "./zwo";
import { ftpToZone, formatDuration, zoneColor } from "./zones";

type Props = {
  segments: Segment[];
  ftpWatts?: number;
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
  const [hovered, setHovered] = useState<{
    x: number;
    y: number;
    s: Segment;
  } | null>(null);

  const total = segments.length ? segments[segments.length - 1].endSec : 0;
  // Chart range: 0-160% FTP
  const maxFtp = 1.6;
  const viewW = 1000;
  const padding = 0; // sidebar padding handles surrounding space
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
        position: "relative",
        userSelect: "none",
      }}
      onMouseLeave={() => setHovered(null)}>
      <svg
        viewBox={`0 0 ${viewW} ${viewH}`}
        preserveAspectRatio="none"
        width="100%"
        height="100%"
        style={{ overflow: "visible" }}
        role="img">
        {/* Base line */}
        <line
          x1={padding}
          y1={baseY}
          x2={viewW - padding}
          y2={baseY}
          stroke="rgba(255,255,255,0.1)"
          strokeWidth={1}
        />

        {segments.map((s, idx) => {
          const x0 = xAt(s.startSec);
          const x1 = xAt(s.endSec);
          const rawW = x1 - x0;

          // Minimal gap for visual separation
          const gap = 1;
          const w = Math.max(1, rawW - gap);
          const drawX = x0 + (rawW - w) / 2;

          const rx = 4; // Rounded top corners? Or just all corners

          const onMove = (e: React.MouseEvent) => {
            setHovered({ x: e.clientX, y: e.clientY, s });
          };

          const commonProps = {
            onMouseEnter: onMove,
            onMouseMove: onMove,
            style: { cursor: "crosshair", transition: "opacity 0.1s" },
          };

          let shape = null;
          let color = "#444";

          // Helper to create rounded path for top only or full?
          // Simple rect is fine for now

          if (s.kind === "free") {
            const y0 = yAt(0.5);
            const h = baseY - y0;
            color = "#555";
            shape = (
              <rect
                x={drawX}
                y={y0}
                width={w}
                height={h}
                rx={rx}
                fill={color}
                stroke="none"
              />
            );
          } else if (s.kind === "steady") {
            const y0 = yAt(s.ftp);
            const h = baseY - y0;
            color = zoneColor[ftpToZone(s.ftp)];
            shape = (
              <rect
                x={drawX}
                y={y0}
                width={w}
                height={h}
                rx={rx}
                fill={color}
              />
            );
          } else {
            // RAMP
            const low = s.ftpLow;
            const high = s.ftpHigh;
            const yLow = yAt(low);
            const yHigh = yAt(high);
            // const h = baseY - Math.min(yLow, yHigh); // Removed unused variable
            // const midTopY = (yLow + yHigh) / 2; // Removed unused variable
            // labelY = (midTopY + baseY) / 2; // Removed unused variable

            // Gradient for ramp
            const gradId = `ramp-grad-${idx}`;
            // If it's a ramp, we want the color to represent the zones it passes through??
            // Or just a gradient from start zone color to end zone color.
            const c1 = zoneColor[ftpToZone(low)];
            const c2 = zoneColor[ftpToZone(high)];

            shape = (
              <g>
                <defs>
                  <linearGradient id={gradId} x1="0" x2="1" y1="0" y2="0">
                    <stop offset="0%" stopColor={c1} />
                    <stop offset="100%" stopColor={c2} />
                  </linearGradient>
                </defs>
                <polygon
                  points={`${drawX},${yLow} ${drawX + w},${yHigh} ${drawX + w},${baseY} ${drawX},${baseY}`}
                  fill={`url(#${gradId})`}
                />
              </g>
            );
          }

          // Show label only if wide enough
          // const showLabel = rawW > 50; // Removed unused variable
          // let labelText = ""; // Removed unused variable
          // if (showLabel) {
          //   if (s.label) labelText = s.label;
          // }

          return (
            <g key={idx} {...commonProps}>
              {shape}
              {/* Optional: Add a subtle overlay on hover? Handled by opacity transition currently */}
            </g>
          );
        })}
      </svg>

      {hovered && (
        <Tooltip
          x={hovered.x}
          y={hovered.y}
          s={hovered.s}
          ftpWatts={ftpWatts}
          showWatts={showWatts}
        />
      )}
    </div>
  );
}

function Tooltip({
  x,
  y,
  s,
  ftpWatts,
  showWatts,
}: {
  x: number;
  y: number;
  s: Segment;
  ftpWatts: number;
  showWatts: boolean;
}) {
  const dur = s.endSec - s.startSec;

  const fmtPower = (p: number) => {
    // Round to 5W or 1%
    if (showWatts) return `${Math.round(p * ftpWatts)}W`;
    return `${Math.round(p * 100)}%`;
  };

  let powerStr = "";
  let zoneStr = "Free Ride";
  let curZoneColor = "transparent";

  if (s.kind === "steady") {
    powerStr = fmtPower(s.ftp);
    const z = ftpToZone(s.ftp);
    zoneStr = z;
    curZoneColor = zoneColor[z];
  } else if (s.kind === "ramp") {
    powerStr = `${fmtPower(s.ftpLow)} → ${fmtPower(s.ftpHigh)}`;
    const avg = (s.ftpLow + s.ftpHigh) / 2;
    const z = ftpToZone(avg);
    zoneStr = `${z} (Avg)`;
    curZoneColor = zoneColor[z];
  } else {
    powerStr = "-";
  }

  // Adjust tooltip position to not fly off screen?
  // Simple offset for now.
  const style: React.CSSProperties = {
    position: "fixed",
    left: x + 16,
    top: y + 16,
    background: "rgba(22, 22, 22, 0.9)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 8,
    padding: "10px 14px",
    pointerEvents: "none",
    zIndex: 9999,
    boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
    backdropFilter: "blur(8px)",
    minWidth: 140,
  };

  return (
    <div style={style}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 4,
        }}>
        <div
          style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: curZoneColor,
          }}
        />
        <div style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>
          {s.label || (s.kind === "free" ? "Free Ride" : "Interval")}
        </div>
      </div>

      <div
        style={{
          fontSize: 12,
          color: "rgba(255,255,255,0.6)",
          display: "grid",
          gridTemplateColumns: "auto 1fr",
          gap: "2px 10px",
        }}>
        <span>Duration:</span>
        <span style={{ color: "#eee", textAlign: "right" }}>
          {formatDuration(dur)}
        </span>

        {s.kind !== "free" && (
          <>
            <span>Power:</span>
            <span style={{ color: "#eee", textAlign: "right" }}>
              {powerStr}
            </span>
            <span>Zone:</span>
            <span style={{ color: "#eee", textAlign: "right" }}>{zoneStr}</span>
          </>
        )}
      </div>
    </div>
  );
}
