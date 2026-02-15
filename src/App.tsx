import { useMemo, useState } from "react";
import { parseZwo } from "./zwo";
import { WorkoutChart } from "./WorkoutChart";
import { ftpToZone, formatDuration, zoneColor } from "./zones";
import type { Segment } from "./zwo";

function sumDuration(segments: Segment[]) {
  return segments.length ? segments[segments.length - 1].endSec : 0;
}

function timeInZones(segments: Segment[]) {
  const map: Record<string, number> = {
    Z1: 0,
    Z2: 0,
    Z3: 0,
    Z4: 0,
    Z5: 0,
    Z6: 0,
    Z7: 0,
  };
  for (const s of segments) {
    const dur = s.endSec - s.startSec;
    if (s.kind === "free") continue;
    if (s.kind === "steady") map[ftpToZone(s.ftp)] += dur;
    else map[ftpToZone((s.ftpLow + s.ftpHigh) / 2)] += dur;
  }
  return map;
}

export default function App() {
  const [xml, setXml] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [ftp, setFtp] = useState(230);
  const [showWatts, setShowWatts] = useState(false);

  const workout = useMemo(() => {
    if (!xml) return null;
    try {
      setError(null);
      return parseZwo(xml);
    } catch (e: any) {
      setError(e?.message ?? "Parse error");
      return null;
    }
  }, [xml]);

  const totalSec = workout ? sumDuration(workout.segments) : 0;
  const zones = workout ? timeInZones(workout.segments) : null;

  const onFile = async (file: File) => {
    const text = await file.text();
    setXml(text);
  };

  return (
    <div
      style={{
        height: "100%",
        display: "grid",
        gridTemplateRows: "60px 1fr",
        background: "#0f0f0f",
        color: "#eaeaea",
      }}>
      {/* Header */}
      <header
        style={{
          borderBottom: "1px solid rgba(255,255,255,0.08)",
          display: "flex",
          alignItems: "center",
          padding: "0 24px",
          gap: 20,
          background: "#141414",
        }}>
        <h1
          style={{
            margin: 0,
            fontSize: 20,
            fontWeight: 600,
            letterSpacing: "-0.02em",
          }}>
          zwo preview
        </h1>

        <div
          style={{
            marginLeft: "auto",
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}>
          {/* File Input */}
          <div
            style={{
              position: "relative",
              overflow: "hidden",
            }}>
            <button
              style={{
                background: "#1b1b1b",
                border: "1px solid rgba(255,255,255,0.15)",
                color: "#eaeaea",
                padding: "6px 12px",
                fontSize: 13,
                borderRadius: 8,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}>
              <span>Import .zwo</span>
            </button>
            <input
              type="file"
              accept=".zwo,application/xml,text/xml"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onFile(f);
              }}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: "100%",
                opacity: 0,
                cursor: "pointer",
              }}
            />
          </div>

          <div
            style={{
              width: 1,
              height: 24,
              background: "rgba(255,255,255,0.1)",
            }}
          />

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 13, opacity: 0.6 }}>FTP</span>
            <input
              value={ftp}
              onChange={(e) => setFtp(Number(e.target.value || 0))}
              type="number"
              min={1}
              style={{
                width: 60,
                background: "#0a0a0a",
                border: "1px solid rgba(255,255,255,0.15)",
                color: "#eaeaea",
                padding: "4px 8px",
                borderRadius: 6,
                fontSize: 13,
                textAlign: "right",
              }}
            />
          </div>

          <button
            onClick={() => setShowWatts((s) => !s)}
            style={{
              background: "transparent",
              border: "1px solid rgba(255,255,255,0.15)",
              color: showWatts ? "#fff" : "rgba(255,255,255,0.6)",
              padding: "6px 12px",
              fontSize: 12,
              borderRadius: 6,
              cursor: "pointer",
            }}>
            {showWatts ? "WATTS" : "% FTP"}
          </button>
        </div>
      </header>

      {/* Content Grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: workout ? "500px 1fr" : "1fr",
          overflow: "hidden",
        }}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const f = e.dataTransfer.files?.[0];
          if (f) onFile(f);
        }}>
        {/* Empty State / Error */}
        {!workout && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 16,
              opacity: 0.5,
              height: "100%",
            }}>
            <div style={{ fontSize: 48 }}>🚴</div>
            <div>Drop a .zwo file here to preview</div>
            {error && <div style={{ color: "#ff6b6b" }}>{error}</div>}
          </div>
        )}

        {/* Sidebar */}
        {workout && (
          <div
            style={{
              borderRight: "1px solid rgba(255,255,255,0.08)",
              overflowY: "auto",
              background: "#111",
              display: "flex",
              flexDirection: "column",
            }}>
            <div
              style={{
                padding: 20,
                borderBottom: "1px solid rgba(255,255,255,0.05)",
              }}>
              <div style={{ fontSize: 18, fontWeight: 600, lineHeight: 1.3 }}>
                {workout.name ?? "Untitled Workout"}
              </div>
              <div
                style={{
                  marginTop: 6,
                  fontSize: 13,
                  opacity: 0.6,
                  display: "flex",
                  gap: 12,
                }}>
                <span>
                  {Math.floor(totalSec / 60)}m{" "}
                  {String(totalSec % 60).padStart(2, "0")}s
                </span>
                <span>•</span>
                <span>{workout.segments.length} intervals</span>
              </div>
            </div>

            <div style={{ padding: 12, display: "grid", gap: 8 }}>
              {workout.segments.map((s, i) => {
                const dur = s.endSec - s.startSec;

                let text = "";
                if (s.kind === "steady") {
                  const v = showWatts
                    ? `${Math.round(s.ftp * ftp)}W`
                    : `${Math.round(s.ftp * 100)}%`;
                  text = `${formatDuration(dur)} @ ${v}`;
                } else if (s.kind === "ramp") {
                  const a = showWatts
                    ? `${Math.round(s.ftpLow * ftp)}W`
                    : `${Math.round(s.ftpLow * 100)}%`;
                  const b = showWatts
                    ? `${Math.round(s.ftpHigh * ftp)}W`
                    : `${Math.round(s.ftpHigh * 100)}%`;
                  text = `${formatDuration(dur)} ramp ${a}-${b}`;
                } else {
                  text = `${formatDuration(dur)} free ride`;
                }

                const color =
                  s.kind === "free"
                    ? "rgba(255,255,255,0.1)"
                    : s.kind === "steady"
                      ? zoneColor[ftpToZone(s.ftp)]
                      : zoneColor[ftpToZone((s.ftpLow + s.ftpHigh) / 2)];

                return (
                  <div
                    key={i}
                    style={{
                      background: "rgba(255,255,255,0.03)",
                      borderRadius: 8,
                      padding: "14px 16px",
                      display: "flex",
                      gap: 12,
                      alignItems: "center",
                      borderLeft: `4px solid ${color}`,
                    }}>
                    <div style={{ flex: 1 }}>
                      <div
                        style={{ fontSize: 13, fontWeight: 500, opacity: 0.9 }}>
                        {s.label ||
                          (s.kind === "free" ? "Free Ride" : "Interval")}
                      </div>
                      <div style={{ fontSize: 12, opacity: 0.6, marginTop: 2 }}>
                        {text}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Main Chart Area */}
        {workout && (
          <div
            style={{
              overflowY: "auto",
              padding: "24px 40px",
              display: "flex",
              flexDirection: "column",
              gap: 32,
            }}>
            {/* Chart Container */}
            <div
              style={{
                background: "#141414",
                border: "1px solid rgba(255,255,255,0.05)",
                borderRadius: 16,
                padding: 20,
                height: 260,
                display: "flex",
                flexDirection: "column",
              }}>
              <h3
                style={{
                  margin: "0 0 20px 0",
                  fontSize: 14,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  opacity: 0.7,
                }}>
                Profile
              </h3>
              <div style={{ flex: 1, minHeight: 0 }}>
                <WorkoutChart
                  segments={workout.segments}
                  ftpWatts={ftp}
                  showWatts={showWatts}
                  height={200}
                />
              </div>
            </div>

            {/* Stats Grid */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
                gap: 24,
              }}>
              {/* Zone Distribution */}
              <div
                style={{
                  background: "#141414",
                  border: "1px solid rgba(255,255,255,0.05)",
                  borderRadius: 16,
                  padding: 20,
                }}>
                <h3
                  style={{
                    margin: "0 0 20px 0",
                    fontSize: 14,
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    opacity: 0.7,
                  }}>
                  Zone Distribution
                </h3>
                {zones && (
                  <div
                    style={{
                      display: "flex",
                      gap: 12,
                      alignItems: "flex-end",
                      height: 80,
                      paddingBottom: 4,
                    }}>
                    {Object.entries(zones).map(([z, sec]) => {
                      const pct = totalSec ? sec / totalSec : 0;
                      return (
                        <div
                          key={z}
                          style={{
                            flex: 1,
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            gap: 8,
                            height: "100%",
                            justifyContent: "flex-end",
                          }}>
                          <div
                            style={{
                              width: "100%",
                              height: `${Math.max(4, pct * 100)}%`,
                              background: (zoneColor as any)[z],
                              borderRadius: 4,
                              opacity: 0.9,
                              transition: "height 0.3s ease",
                            }}
                            title={`${z}: ${Math.round(pct * 100)}%`}
                          />
                          <div
                            style={{
                              fontSize: 11,
                              fontWeight: 600,
                              opacity: 0.6,
                            }}>
                            {z}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
