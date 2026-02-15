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

function calculateTSS(segments: Segment[]) {
  let tss = 0;
  for (const s of segments) {
    const dur = s.endSec - s.startSec;
    const hrs = dur / 3600;
    let if_ = 0;
    if (s.kind === "steady") if_ = s.ftp;
    else if (s.kind === "ramp") if_ = (s.ftpLow + s.ftpHigh) / 2;
    else if (s.kind === "free") if_ = 0.5;
    // TSS = (sec * IF^2) / 3600 * 100
    tss += hrs * if_ * if_ * 100;
  }
  return Math.round(tss);
}

export default function App() {
  const [xml, setXml] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ftp, setFtp] = useState(250);
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
  const tss = workout ? calculateTSS(workout.segments) : 0;

  const [isDragging, setIsDragging] = useState(false);

  const onFile = async (file: File) => {
    const text = await file.text();
    setXml(text);
    setIsDragging(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    // Only leave if we leave the main container, not just entering a child
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f) onFile(f);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) onFile(f);
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      style={{
        minHeight: "100%",
        display: "flex",
        flexDirection: "column",
        background: "var(--c-bg-page)",
        position: "relative",
      }}>
      {/* Global Drag Overlay */}
      {isDragging && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "rgba(0,0,0,0.8)",
            zIndex: 999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backdropFilter: "blur(4px)",
            border: "4px dashed var(--c-accent)",
          }}>
          <div style={{ pointerEvents: "none", textAlign: "center" }}>
            <div style={{ fontSize: 64 }}>📥</div>
            <div
              style={{
                fontSize: 24,
                fontWeight: 700,
                color: "#fff",
                marginTop: 16,
              }}>
              Drop .zwo file to load
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <header
        style={{
          borderBottom: "1px solid var(--c-border)",
          padding: "0 24px",
          height: 80,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          background: "var(--c-bg-page)",
          position: "sticky",
          top: 0,
          zIndex: 100,
        }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div
            style={{
              width: 40,
              height: 40,
              background: "linear-gradient(135deg, #fc6719, #d64b00)",
              borderRadius: 8,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 800,
              fontSize: 20,
              color: "#fff",
            }}>
            Z
          </div>
          <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: -0.5 }}>
            ZWO <span style={{ color: "var(--c-accent)" }}>Preview</span>
          </div>
        </div>

        {/* Removed generic nav tabs */}

        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          {/* Import Button */}
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "8px 16px",
              background: "var(--c-bg-element)",
              borderRadius: 99,
              cursor: "pointer",
              fontSize: 13,
              fontWeight: 600,
              border: "1px solid transparent",
              transition: "all 0.2s",
            }}
            className="hover:border-white">
            <span>Import .zwo</span>
            <input
              type="file"
              accept=".zwo,.xml,application/xml,text/xml"
              onChange={handleFileInput}
              style={{ display: "none" }}
            />
          </label>

          <div
            style={{ width: 1, height: 24, background: "var(--c-border)" }}
          />

          <label style={{ fontSize: 13, color: "var(--c-text-muted)" }}>
            FTP:
            <input
              type="number"
              value={ftp}
              onChange={(e) => setFtp(Number(e.target.value))}
              style={{
                background: "transparent",
                border: "none",
                borderBottom: "1px solid var(--c-border)",
                color: "#fff",
                width: 40,
                marginLeft: 8,
                textAlign: "center",
              }}
            />
          </label>
          <button
            onClick={() => setShowWatts(!showWatts)}
            style={{ fontSize: 12, padding: "4px 10px" }}>
            {showWatts ? "WATTS" : "% FTP"}
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="container" style={{ flex: 1, paddingBottom: 60 }}>
        {!workout ? (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              height: "calc(100vh - 140px)", // Fill remaining space roughly
              gap: 20,
              opacity: 0.6,
            }}>
            <div style={{ fontSize: 64 }}>📂</div>
            <div style={{ fontSize: 24, fontWeight: 600 }}>
              Drop a .zwo file to begin
            </div>

            <label
              style={{
                padding: "12px 24px",
                background: "var(--c-accent)",
                color: "white",
                borderRadius: 8,
                cursor: "pointer",
                fontWeight: 600,
                marginTop: 12,
              }}>
              Browse File
              <input
                type="file"
                accept=".zwo,.xml,application/xml,text/xml"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) onFile(f);
                }}
                style={{ display: "none" }}
              />
            </label>
            {error && (
              <div
                style={{
                  color: "var(--z6)",
                  marginTop: 20,
                  padding: "10px 16px",
                  background: "rgba(255, 32, 32, 0.1)",
                  borderRadius: 8,
                }}>
                Error: {error}
              </div>
            )}
          </div>
        ) : (
          <div style={{ marginTop: 40 }}>
            {/* Breadcrumbs */}
            <div
              style={{
                display: "flex",
                gap: 8,
                fontSize: 12,
                color: "var(--c-text-muted)",
                marginBottom: 16,
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}>
              <span
                className="pill"
                style={{
                  border: "1px solid var(--c-border)",
                  padding: "4px 8px",
                  borderRadius: 4,
                }}>
                Workouts
              </span>
              <span style={{ opacity: 0.5 }}>»</span>
              <span
                className="pill"
                style={{
                  border: "1px solid var(--c-border)",
                  padding: "4px 8px",
                  borderRadius: 4,
                }}>
                {workout.name}
              </span>
            </div>

            <h1
              style={{
                fontSize: 42,
                marginBottom: 40,
                color: "#eee",
                letterSpacing: "-0.02em",
              }}>
              {workout.name}
            </h1>

            {/* Layout Grid */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 340px",
                gap: 40,
              }}>
              {/* Left Column (Chart + Content) */}
              <div
                style={{ display: "flex", flexDirection: "column", gap: 40 }}>
                {/* Chart Card */}
                <div>
                  <div
                    style={{
                      height: 300,
                      marginBottom: 24,
                      position: "relative",
                    }}>
                    <WorkoutChart
                      segments={workout.segments}
                      ftpWatts={ftp}
                      showWatts={showWatts}
                      height={300}
                    />
                  </div>

                  {/* Stats Bar */}
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(3, 1fr)",
                      gap: 1,
                      background: "var(--c-border)",
                      borderRadius: 16,
                      overflow: "hidden",
                    }}>
                    <StatBox
                      label="Duration"
                      value={formatDuration(totalSec)}
                    />
                    <StatBox label="Stress Points" value={tss.toString()} />
                    <StatBox
                      label="Segments"
                      value={workout.segments.length.toString()}
                    />
                  </div>
                </div>

                {/* Description */}
                <div>
                  <h3
                    style={{
                      fontSize: 18,
                      marginBottom: 12,
                      color: "var(--c-text-muted)",
                    }}>
                    Workout Overview
                  </h3>
                  <p style={{ lineHeight: 1.6, color: "#ccc", fontSize: 15 }}>
                    {workout.description ||
                      "No description available for this workout."}
                  </p>
                  <div style={{ marginTop: 20, display: "flex", gap: 12 }}>
                    <div
                      style={{
                        padding: "8px 16px",
                        background: "var(--c-bg-card)",
                        borderRadius: 99,
                        fontSize: 13,
                        color: "var(--c-accent)",
                        border: "1px solid var(--c-border)",
                      }}>
                      ✓ Available in Zwift
                    </div>
                  </div>
                </div>

                {/* Segments List */}
                <div>
                  <h3
                    style={{
                      fontSize: 18,
                      marginBottom: 16,
                      color: "var(--c-text-muted)",
                    }}>
                    Workout Segments
                  </h3>
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 4,
                    }}>
                    {workout.nodes.map((node, i) => (
                      <SegmentRow
                        key={i}
                        node={node}
                        ftp={ftp}
                        showWatts={showWatts}
                      />
                    ))}
                  </div>
                </div>
              </div>

              {/* Right Column (Sidebar) */}
              <div
                style={{ display: "flex", flexDirection: "column", gap: 24 }}>
                {/* Zone Distribution */}
                <div className="card">
                  <h3
                    className="uppercase"
                    style={{
                      fontSize: 12,
                      marginBottom: 20,
                      color: "var(--c-text-muted)",
                    }}>
                    Zone Distribution
                  </h3>
                  {zones && (
                    <div
                      style={{
                        display: "flex",
                        alignItems: "flex-end",
                        height: 120,
                        gap: 8,
                      }}>
                      {(() => {
                        const entries = Object.entries(zones);
                        const maxVal = Math.max(
                          ...entries.map(([_, sec]) => sec),
                        );
                        const totalS = totalSec || 1; // avoid /0

                        return entries.map(([z, sec]) => {
                          const pctOfTotal = sec / totalS;
                          // Auto-scale: Max value fills 100% of the bar area
                          // But we keep relative proportions correct.
                          // If maxVal is 0 (empty workout), height is 4px.
                          const heightPct =
                            maxVal > 0 ? (sec / maxVal) * 100 : 0;

                          return (
                            <div
                              key={z}
                              style={{
                                flex: 1,
                                height: "100%",
                                display: "flex",
                                flexDirection: "column",
                                alignItems: "center",
                                justifyContent: "flex-end",
                                gap: 6,
                              }}>
                              <div style={{ fontSize: 10, fontWeight: 700 }}>
                                {Math.round(pctOfTotal * 100)}%
                              </div>
                              <div
                                style={{
                                  flex: 1,
                                  width: "100%",
                                  display: "flex",
                                  alignItems: "flex-end",
                                  justifyContent: "center",
                                  minHeight: 0, // Fix for flex child overflow
                                }}>
                                <div
                                  style={{
                                    width: "100%",
                                    height: `${Math.max(4, heightPct)}%`,
                                    background: (zoneColor as any)[z],
                                    borderRadius: "4px 4px 0 0",
                                    opacity: 0.9,
                                    transition: "height 0.3s ease",
                                  }}
                                />
                              </div>
                              <div
                                style={{
                                  fontSize: 10,
                                  color: "var(--c-text-muted)",
                                }}>
                                {z}
                              </div>
                            </div>
                          );
                        });
                      })()}
                    </div>
                  )}
                </div>

                <div className="card">
                  <h3
                    className="uppercase"
                    style={{
                      fontSize: 12,
                      marginBottom: 20,
                      color: "var(--c-text-muted)",
                    }}>
                    Tags
                  </h3>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {workout.tags?.map((t) => (
                      <span
                        key={t.name}
                        style={{
                          fontSize: 12,
                          padding: "4px 8px",
                          background: "rgba(255,255,255,0.05)",
                          borderRadius: 4,
                          color: "var(--c-text-muted)",
                        }}>
                        {t.name}
                      </span>
                    )) || (
                      <span
                        style={{ fontSize: 12, color: "var(--c-text-muted)" }}>
                        No tags
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        background: "var(--c-bg-card)",
        padding: "20px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 4,
      }}>
      <div style={{ fontSize: 24, fontWeight: 700, color: "#fff" }}>
        {value}
      </div>
      <div
        style={{
          fontSize: 12,
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          color: "var(--c-text-muted)",
        }}>
        {label}
      </div>
    </div>
  );
}

function SegmentRow({
  node,
  ftp,
  showWatts,
}: {
  node: any;
  ftp: number;
  showWatts: boolean;
}) {
  const fmt = (sec: number) => formatDuration(sec);
  const pwr = (p: number) =>
    showWatts ? `${Math.round(p * ftp)}W` : `${Math.round(p * 100)}%`;

  let text = "";
  let subText = "";
  let color = "transparent";

  if (node.kind === "group") {
    const { repeat, onDuration, onPower, offDuration, offPower } = node;
    const onTxt = `${fmt(onDuration)} @ ${pwr(onPower)}`;

    if (offDuration > 0) {
      const offTxt = `${fmt(offDuration)} @ ${pwr(offPower)}`;
      text = `${repeat}x ${onTxt}, ${offTxt}`;
    } else {
      text = `${repeat}x ${onTxt}`;
    }

    subText = "Intervals";
    color = zoneColor[ftpToZone(onPower)];
  } else {
    const s = node;
    const dur = s.endSec - s.startSec;

    if (s.kind === "steady") {
      text = `${fmt(dur)} @ ${pwr(s.ftp)}`;
      subText = s.label || zoneLabel(s.ftp);
      color = zoneColor[ftpToZone(s.ftp)];
    } else if (s.kind === "ramp") {
      text = `${fmt(dur)} from ${pwr(s.ftpLow)} to ${pwr(s.ftpHigh)}`;
      subText = s.label || "Ramp";
      // Use average power for color
      color = zoneColor[ftpToZone((s.ftpLow + s.ftpHigh) / 2)];
    } else {
      text = `${fmt(dur)} Free Ride`;
      subText = s.label || "Free Ride";
      // Gray for free ride
      color = "#444";
    }
  }

  // Determine text color based on background brightness?
  // Most zones are bright enough for white text with shadow, or black text.
  // Zwift style usually has white text with heavy shadow or just contrast.
  // Let's use white with text-shadow for readability on all colors.

  return (
    <div
      style={{
        position: "relative",
        margin: "0 0 4px 0",
        background: color,
        borderRadius: 4,
        padding: "10px 16px",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        boxShadow: "0 1px 2px rgba(0,0,0,0.1)",
        overflow: "hidden",
      }}>
      <div
        style={{
          position: "relative",
          zIndex: 1,
          color: "#fff",
          fontWeight: 700,
          fontSize: 15,
          textShadow: "0 1px 3px rgba(0,0,0,0.4)",
        }}>
        {text}
      </div>
      <div
        style={{
          position: "relative",
          zIndex: 1,
          color: "rgba(255,255,255,0.9)",
          fontSize: 11,
          fontWeight: 600,
          textShadow: "0 1px 2px rgba(0,0,0,0.4)",
          marginTop: 2,
          textTransform: "uppercase",
          letterSpacing: "0.05em",
        }}>
        {subText}
      </div>
    </div>
  );
}

function zoneLabel(ftpPct: number) {
  const z = ftpToZone(ftpPct);
  if (z === "Z1") return "Recovery";
  if (z === "Z2") return "Endurance";
  if (z === "Z3") return "Tempo";
  if (z === "Z4") return "Threshold";
  if (z === "Z5") return "VO2 Max";
  if (z === "Z6") return "Anaerobic";
  return "Recovery";
}
