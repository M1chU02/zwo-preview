import { useEffect, useMemo, useState } from "react";

const STORAGE_KEY_FTP = "zwo-preview:ftp";
const STORAGE_KEY_WEIGHT = "zwo-preview:weight";
const STORAGE_KEY_SHOW_WATTS = "zwo-preview:showWatts";

function loadFtp(): number {
  try {
    const v = localStorage.getItem(STORAGE_KEY_FTP);
    if (v != null) {
      const n = parseInt(v, 10);
      if (Number.isFinite(n) && n > 0) return n;
    }
  } catch (_) {}
  return 250;
}

function loadWeight(): number {
  try {
    const v = localStorage.getItem(STORAGE_KEY_WEIGHT);
    if (v != null) {
      const n = parseInt(v, 10);
      if (Number.isFinite(n) && n > 0) return n;
    }
  } catch (_) {}
  return 75;
}

function loadShowWatts(): boolean {
  try {
    const v = localStorage.getItem(STORAGE_KEY_SHOW_WATTS);
    if (v === "true") return true;
    if (v === "false") return false;
  } catch (_) {}
  return false;
}

import { parseZwo } from "./zwo";
import { WorkoutChart } from "./WorkoutChart";
import { ftpToZone, formatDuration, zoneColor } from "./zones";
import type { Segment, Workout } from "./zwo";
import { ProfilePanel } from "./ProfilePanel";
import avatarImg from "./assets/cyclist_avatar.png";

// ─── helpers ────────────────────────────────────────────────────────────────

function sumDuration(segments: Segment[]) {
  return segments.length ? segments[segments.length - 1].endSec : 0;
}

function timeInZones(segments: Segment[]) {
  const map: Record<string, number> = { Z1: 0, Z2: 0, Z3: 0, Z4: 0, Z5: 0, Z6: 0, Z7: 0 };
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
    tss += hrs * if_ * if_ * 100;
  }
  return Math.round(tss);
}

function calculateAvgWatts(segments: Segment[], ftp: number) {
  let totalWork = 0;
  let totalDur = 0;
  for (const s of segments) {
    const dur = s.endSec - s.startSec;
    let p = 0;
    if (s.kind === "steady") p = s.ftp;
    else if (s.kind === "ramp") p = (s.ftpLow + s.ftpHigh) / 2;
    else if (s.kind === "free") p = 0.5;
    totalWork += dur * p * ftp;
    totalDur += dur;
  }
  return totalDur > 0 ? Math.round(totalWork / totalDur) : 0;
}

/** Decode workout file name → pretty label */
function decodeName(raw: string): string {
  return raw
    .replace(/\.zwo$/i, "")
    .replace(/[_]+/g, " ")
    .replace(/×/g, "x")
    .trim();
}

// ─── types ───────────────────────────────────────────────────────────────────

interface LibraryEntry {
  fileName: string;
  workout: Workout;
}

// ─── App ─────────────────────────────────────────────────────────────────────

export default function App() {
  const [view, setView] = useState<"landing" | "library" | "detail">("landing");
  const [library, setLibrary] = useState<LibraryEntry[]>([]);
  const [selectedEntry, setSelectedEntry] = useState<LibraryEntry | null>(null);

  // Single-file drag/drop xml (legacy path kept)
  const [xml, setXml] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [ftp, setFtp] = useState(loadFtp);
  const [weight, setWeight] = useState(loadWeight);
  const [showWatts, setShowWatts] = useState(loadShowWatts);
  const [isDragging, setIsDragging] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  // Search & Sort State
  const [searchQuery, setSearchQuery] = useState("");
  const [sortKey, setSortKey] = useState<"name" | "duration" | "tss" | "watts">("name");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  useEffect(() => { try { localStorage.setItem(STORAGE_KEY_FTP, String(ftp)); } catch (_) {} }, [ftp]);
  useEffect(() => { try { localStorage.setItem(STORAGE_KEY_WEIGHT, String(weight)); } catch (_) {} }, [weight]);
  useEffect(() => { try { localStorage.setItem(STORAGE_KEY_SHOW_WATTS, String(showWatts)); } catch (_) {} }, [showWatts]);

  // The currently displayed workout (either library selection or single-drop)
  const workout = useMemo(() => {
    if (selectedEntry) return selectedEntry.workout;
    if (!xml) return null;
    try {
      setError(null);
      return parseZwo(xml);
    } catch (e: any) {
      setError(e?.message ?? "Parse error");
      return null;
    }
  }, [xml, selectedEntry]);

  const filteredLibrary = useMemo(() => {
    if (view !== "library") return [];
    let result = [...library];

    // Filter
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter((entry) => {
        const name = entry.workout.name ?? decodeName(entry.fileName);
        return name.toLowerCase().includes(q);
      });
    }

    // Sort
    result.sort((a, b) => {
      let valA: any, valB: any;
      if (sortKey === "name") {
        valA = a.workout.name ?? decodeName(a.fileName);
        valB = b.workout.name ?? decodeName(b.fileName);
      } else if (sortKey === "duration") {
        valA = sumDuration(a.workout.segments);
        valB = sumDuration(b.workout.segments);
      } else if (sortKey === "tss") {
        valA = calculateTSS(a.workout.segments);
        valB = calculateTSS(b.workout.segments);
      } else if (sortKey === "watts") {
        valA = calculateAvgWatts(a.workout.segments, ftp);
        valB = calculateAvgWatts(b.workout.segments, ftp);
      }

      const order = sortOrder === "asc" ? 1 : -1;
      if (valA < valB) return -1 * order;
      if (valA > valB) return 1 * order;
      return 0;
    });

    return result;
  }, [library, searchQuery, sortKey, sortOrder, view, ftp]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (searchQuery) count++;
    if (sortKey !== "name") count++;
    return count;
  }, [searchQuery, sortKey]);

  const totalSec = workout ? sumDuration(workout.segments) : 0;
  const zones = workout ? timeInZones(workout.segments) : null;
  const tss = workout ? calculateTSS(workout.segments) : 0;
  const avgWatts = workout ? calculateAvgWatts(workout.segments, ftp) : 0;

  // ── file handlers ──────────────────────────────────────────────────────────

  const onSingleFile = async (file: File) => {
    const text = await file.text();
    setXml(text);
    setSelectedEntry(null);
    setIsDragging(false);
    setView("detail");
  };

  /** Load multiple .zwo files at once → library */
  const onLibraryFiles = async (files: FileList) => {
    const entries: LibraryEntry[] = [];
    for (const file of Array.from(files)) {
      try {
        const text = await file.text();
        const workout = parseZwo(text);
        entries.push({ fileName: file.name, workout });
      } catch (_) {
        // skip unreadable files
      }
    }
    if (entries.length === 0) return;
    setLibrary(entries);
    setView("library");
  };

  const openFromLibrary = (entry: LibraryEntry) => {
    setSelectedEntry(entry);
    setXml(null);
    setView("detail");
  };

  const goBack = () => {
    if (library.length > 0) {
      setView("library");
    } else {
      setView("landing");
    }
    setSelectedEntry(null);
    setXml(null);
  };

  // ── drag & drop (only on landing/detail) ──────────────────────────────────

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };
  const handleDragLeave = (e: React.DragEvent) => {
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setIsDragging(false);
  };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f) onSingleFile(f);
  };

  // ── render ─────────────────────────────────────────────────────────────────

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
        <div style={{
          position: "absolute", inset: 0,
          background: "rgba(0,0,0,0.8)", zIndex: 999,
          display: "flex", alignItems: "center", justifyContent: "center",
          backdropFilter: "blur(4px)",
          border: "4px dashed var(--c-accent)",
        }}>
          <div style={{ pointerEvents: "none", textAlign: "center" }}>
            <div style={{ fontSize: 64 }}>📥</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: "#fff", marginTop: 16 }}>
              Drop .zwo file to load
            </div>
          </div>
        </div>
      )}

      {/* ── Header ── */}
    <header style={{
        borderBottom: "1px solid var(--c-border)",
        padding: "0 24px", height: 80,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        background: "var(--c-bg-page)",
        position: "sticky", top: 0, zIndex: 100,
      }}>
        {/* Left Section (Logo & Back) */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 320 }}>
          {/* Back button */}
          {(view === "detail" || view === "library") && (
            <button
              onClick={goBack}
              title="Back"
              style={{
                background: "var(--c-bg-element)",
                border: "1px solid var(--c-border)",
                borderRadius: 8,
                padding: "6px 12px",
                color: "var(--c-text-muted)",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 6,
                transition: "all 0.2s",
              }}>
              ← {library.length > 0 && view === "detail" ? "Library" : "Home"}
            </button>
          )}
          <div
            style={{
              width: 40, height: 40,
              background: "linear-gradient(135deg, #fc6719, #d64b00)",
              borderRadius: 8,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontWeight: 800, fontSize: 20, color: "#fff",
              cursor: "pointer",
            }}
            onClick={() => { setView("landing"); setSelectedEntry(null); setXml(null); }}>
            Z
          </div>
          <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: -0.5 }}>
            ZWO <span style={{ color: "var(--c-accent)" }}>Preview</span>
          </div>
            {view === "library" && (
              <div style={{ display: "flex", alignItems: "center" }}>
                <span style={{
                  fontSize: 12, color: "var(--c-text-muted)",
                  background: "var(--c-bg-element)",
                  border: "1px solid var(--c-border)",
                  borderRadius: 99, padding: "3px 10px",
                }}>
                  {library.length} workout{library.length !== 1 ? "s" : ""}
                </span>
                {activeFilterCount > 0 && (
                  <span className="filter-badge" title="Active filters">
                    {activeFilterCount}
                  </span>
                )}
              </div>
            )}
          </div>

        {/* Search Bar (Library View Only) */}
        {view === "library" && (
          <div className="search-bar">
            <span className="search-bar__icon">🔍</span>
            <input
              type="text"
              placeholder="Filter by name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button className="search-bar__clear" onClick={() => setSearchQuery("")}>
                ✕
              </button>
            )}
          </div>
        )}

        {/* Right controls */}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {/* Load Library (multi-file) */}
          <label style={{
            display: "flex", alignItems: "center", gap: 8,
            padding: "8px 18px",
            background: "linear-gradient(135deg, var(--c-accent), #d64b00)",
            borderRadius: 99, cursor: "pointer",
            fontSize: 13, fontWeight: 700, color: "#fff",
            boxShadow: "0 2px 12px rgba(252,103,25,0.3)",
            transition: "all 0.2s",
          }}>
            <span>📂 Load Library</span>
            <input
              type="file"
              accept=".zwo,.xml,application/xml,text/xml"
              multiple
              onChange={(e) => { if (e.target.files?.length) onLibraryFiles(e.target.files); }}
              style={{ display: "none" }}
            />
          </label>

          {/* Single file import */}
          <label style={{
            display: "flex", alignItems: "center", gap: 8,
            padding: "8px 16px",
            background: "var(--c-bg-element)",
            borderRadius: 99, cursor: "pointer",
            fontSize: 13, fontWeight: 600,
            border: "1px solid transparent",
            transition: "all 0.2s",
          }}>
            <span>Import .zwo</span>
            <input
              type="file"
              accept=".zwo,.xml,application/xml,text/xml"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) onSingleFile(f); }}
              style={{ display: "none" }}
            />
          </label>

          <div style={{ width: 1, height: 24, background: "var(--c-border)" }} />

          <button onClick={() => setShowWatts(!showWatts)} style={{ fontSize: 12, padding: "4px 10px" }}>
            {showWatts ? "WATTS" : "% FTP"}
          </button>

          {/* Profile icon */}
          <button
            id="profile-btn"
            className="profile-icon-btn"
            onClick={() => setProfileOpen(true)}
            title="Rider Profile"
          >
            <img src={avatarImg} alt="Profile" />
          </button>
        </div>
      </header>

      {/* ── Profile Panel ── */}
      <ProfilePanel
        open={profileOpen}
        onClose={() => setProfileOpen(false)}
        ftp={ftp}
        weight={weight}
        onFtpChange={setFtp}
        onWeightChange={setWeight}
      />

      {/* ── Main ── */}
      <main className="container" style={{ flex: 1, paddingBottom: 60 }}>

        {/* ── LIBRARY VIEW ── */}
        {view === "library" && (
          <div style={{ marginTop: 40 }}>
            <div style={{ marginBottom: 32 }}>
              <h1 style={{ fontSize: 36, marginBottom: 8, letterSpacing: "-0.02em" }}>
                Workout <span style={{ color: "var(--c-accent)" }}>Library</span>
              </h1>
              <p style={{ color: "var(--c-text-muted)", fontSize: 14 }}>
                Click any workout to view details · {library.length} workouts loaded
              </p>
            </div>

            {/* Sort Controls */}
            <div className="sort-container">
              <span className="sort-label">Sort by:</span>
              <div className="sort-pills">
                {[
                  { key: "name", label: "Name" },
                  { key: "duration", label: "Duration" },
                  { key: "tss", label: "TSS" },
                  { key: "watts", label: "Avg Watts" },
                ].map((item) => (
                  <button
                    key={item.key}
                    className={`sort-pill ${sortKey === item.key ? "sort-pill--active" : ""}`}
                    onClick={() => {
                      if (sortKey === item.key) {
                        setSortOrder(sortOrder === "asc" ? "desc" : "asc");
                      } else {
                        setSortKey(item.key as any);
                        setSortOrder(item.key === "name" ? "asc" : "desc"); // Default name to asc, others to desc
                      }
                    }}
                  >
                    {item.label}
                    {sortKey === item.key && (
                      <span className="sort-pill__order">
                        {sortOrder === "asc" ? "↑" : "↓"}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {filteredLibrary.length === 0 ? (
              <div style={{ textAlign: "center", padding: "80px 0", color: "var(--c-text-muted)" }}>
                 <div style={{ fontSize: 48, marginBottom: 16 }}>🔎</div>
                 <h3>No workouts match your search</h3>
                 <button 
                   onClick={() => setSearchQuery("")}
                   style={{ marginTop: 20, background: "transparent", border: "1px solid var(--c-border)" }}
                 >
                   Clear filters
                 </button>
              </div>
            ) : (
              <div className="library-grid">
                {filteredLibrary.map((entry, i) => (
                  <WorkoutCard
                    key={i}
                    entry={entry}
                    ftp={ftp}
                    onClick={() => openFromLibrary(entry)}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── DETAIL VIEW ── */}
        {view === "detail" && workout && (
          <div style={{ marginTop: 40 }}>
            {/* Breadcrumbs */}
            <div style={{
              display: "flex", gap: 8, fontSize: 12,
              color: "var(--c-text-muted)", marginBottom: 16,
              textTransform: "uppercase", letterSpacing: "0.05em",
            }}>
              <span
                className="pill"
                style={{
                  border: "1px solid var(--c-border)",
                  padding: "4px 8px", borderRadius: 4,
                  cursor: library.length > 0 ? "pointer" : "default",
                  transition: "border-color 0.2s",
                }}
                onClick={library.length > 0 ? () => setView("library") : undefined}>
                Workouts
              </span>
              <span style={{ opacity: 0.5 }}>»</span>
              <span className="pill" style={{ border: "1px solid var(--c-border)", padding: "4px 8px", borderRadius: 4 }}>
                {workout.name}
              </span>
            </div>

            <h1 style={{ fontSize: 42, marginBottom: 40, color: "#eee", letterSpacing: "-0.02em" }}>
              {workout.name}
            </h1>

            {/* Layout Grid */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 40 }}>
              {/* Left Column */}
              <div style={{ display: "flex", flexDirection: "column", gap: 40 }}>
                {/* Chart */}
                <div>
                  <div style={{ height: 300, marginBottom: 24, position: "relative" }}>
                    <WorkoutChart segments={workout.segments} ftpWatts={ftp} showWatts={showWatts} height={300} />
                  </div>

                  {/* Stats Bar */}
                  <div style={{
                    display: "grid", gridTemplateColumns: "repeat(5, 1fr)",
                    gap: 1, background: "var(--c-border)",
                    borderRadius: 16, overflow: "hidden",
                  }}>
                    <StatBox label="Duration" value={formatDuration(totalSec)} />
                    <StatBox label="Stress Points" value={tss.toString()} />
                    <StatBox label="Avg Watts" value={`${avgWatts}W`} />
                    <StatBox label="Watts/kg" value={(avgWatts / (weight || 1)).toFixed(2)} />
                    <StatBox label="Segments" value={workout.segments.length.toString()} />
                  </div>
                </div>

                {/* Description */}
                <div>
                  <h3 style={{ fontSize: 18, marginBottom: 12, color: "var(--c-text-muted)" }}>
                    Workout Overview
                  </h3>
                  <p style={{ lineHeight: 1.6, color: "#ccc", fontSize: 15 }}>
                    {workout.description || "No description available for this workout."}
                  </p>
                  <div style={{ marginTop: 20, display: "flex", gap: 12 }}>
                    <div style={{
                      padding: "8px 16px", background: "var(--c-bg-card)",
                      borderRadius: 99, fontSize: 13, color: "var(--c-accent)",
                      border: "1px solid var(--c-border)",
                    }}>
                      ✓ Available in Zwift
                    </div>
                  </div>
                </div>

                {/* Segments List */}
                <div>
                  <h3 style={{ fontSize: 18, marginBottom: 16, color: "var(--c-text-muted)" }}>
                    Workout Segments
                  </h3>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    {workout.nodes.map((node, i) => (
                      <SegmentRow key={i} node={node} ftp={ftp} showWatts={showWatts} />
                    ))}
                  </div>
                </div>
              </div>

              {/* Right Column (Sidebar) */}
              <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
                {/* Zone Distribution */}
                <div className="card">
                  <h3 className="uppercase" style={{ fontSize: 12, marginBottom: 20, color: "var(--c-text-muted)" }}>
                    Zone Distribution
                  </h3>
                  {zones && (
                    <div style={{ display: "flex", alignItems: "flex-end", height: 120, gap: 8 }}>
                      {(() => {
                        const entries = Object.entries(zones);
                        const maxVal = Math.max(...entries.map(([_, sec]) => sec));
                        const totalS = totalSec || 1;
                        return entries.map(([z, sec]) => {
                          const pctOfTotal = sec / totalS;
                          const heightPct = maxVal > 0 ? (sec / maxVal) * 100 : 0;
                          return (
                            <div key={z} style={{
                              flex: 1, height: "100%",
                              display: "flex", flexDirection: "column",
                              alignItems: "center", justifyContent: "flex-end", gap: 6,
                            }}>
                              <div style={{ fontSize: 10, fontWeight: 700 }}>
                                {Math.round(pctOfTotal * 100)}%
                              </div>
                              <div style={{
                                flex: 1, width: "100%",
                                display: "flex", alignItems: "flex-end", justifyContent: "center",
                                minHeight: 0,
                              }}>
                                <div style={{
                                  width: "100%",
                                  height: `${Math.max(4, heightPct)}%`,
                                  background: (zoneColor as any)[z],
                                  borderRadius: "4px 4px 0 0",
                                  opacity: 0.9, transition: "height 0.3s ease",
                                }} />
                              </div>
                              <div style={{ fontSize: 10, color: "var(--c-text-muted)" }}>{z}</div>
                            </div>
                          );
                        });
                      })()}
                    </div>
                  )}
                </div>

                <div className="card">
                  <h3 className="uppercase" style={{ fontSize: 12, marginBottom: 20, color: "var(--c-text-muted)" }}>
                    Tags
                  </h3>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {workout.tags?.map((t) => (
                      <span key={t.name} style={{
                        fontSize: 12, padding: "4px 8px",
                        background: "rgba(255,255,255,0.05)",
                        borderRadius: 4, color: "var(--c-text-muted)",
                      }}>
                        {t.name}
                      </span>
                    )) || <span style={{ fontSize: 12, color: "var(--c-text-muted)" }}>No tags</span>}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── LANDING / EMPTY STATE ── */}
        {(view === "landing" || (view === "detail" && !workout)) && (
          <div style={{
            display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center",
            height: "calc(100vh - 140px)", gap: 24,
          }}>
            <div style={{ fontSize: 72 }}>🚴</div>
            <div style={{ textAlign: "center" }}>
              <h2 style={{ fontSize: 28, marginBottom: 8 }}>Welcome to ZWO Preview</h2>
              <p style={{ color: "var(--c-text-muted)", fontSize: 15, maxWidth: 420 }}>
                Load your entire Zwift workout library for a grid overview, or drop a single file to inspect it.
              </p>
            </div>

            <div style={{ display: "flex", gap: 16, marginTop: 8 }}>
              {/* Load Library CTA */}
              <label style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "14px 28px",
                background: "linear-gradient(135deg, var(--c-accent), #d64b00)",
                borderRadius: 12, cursor: "pointer",
                fontSize: 15, fontWeight: 700, color: "#fff",
                boxShadow: "0 4px 24px rgba(252,103,25,0.35)",
                transition: "transform 0.2s, box-shadow 0.2s",
              }}>
                <span style={{ fontSize: 20 }}>📂</span>
                Load Library
                <input
                  type="file"
                  accept=".zwo,.xml,application/xml,text/xml"
                  multiple
                  onChange={(e) => { if (e.target.files?.length) onLibraryFiles(e.target.files); }}
                  style={{ display: "none" }}
                />
              </label>

              {/* Single file CTA */}
              <label style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "14px 28px",
                background: "var(--c-bg-card)",
                border: "1px solid var(--c-border)",
                borderRadius: 12, cursor: "pointer",
                fontSize: 15, fontWeight: 600, color: "#ddd",
                transition: "border-color 0.2s",
              }}>
                <span style={{ fontSize: 20 }}>📄</span>
                Single File
                <input
                  type="file"
                  accept=".zwo,.xml,application/xml,text/xml"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) onSingleFile(f); }}
                  style={{ display: "none" }}
                />
              </label>
            </div>

            <p style={{ fontSize: 12, color: "var(--c-text-muted)", opacity: 0.6 }}>
              or drag & drop a .zwo file anywhere
            </p>

            {error && (
              <div style={{
                color: "var(--z6)", padding: "10px 16px",
                background: "rgba(255, 32, 32, 0.1)", borderRadius: 8,
              }}>
                Error: {error}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

// ─── WorkoutCard ──────────────────────────────────────────────────────────────

function WorkoutCard({
  entry, ftp, onClick,
}: {
  entry: LibraryEntry;
  ftp: number;
  onClick: () => void;
}) {
  const { workout, fileName } = entry;
  const name = workout.name ?? decodeName(fileName);
  const totalSec = sumDuration(workout.segments);
  const tss = calculateTSS(workout.segments);
  const avgWatts = calculateAvgWatts(workout.segments, ftp);

  return (
    <div className="workout-card" onClick={onClick}>
      {/* Mini chart */}
      <div className="workout-card__chart">
        <WorkoutChart
          segments={workout.segments}
          ftpWatts={ftp}
          showWatts={false}
          height={80}
          interactive={false}
        />
      </div>

      {/* Info */}
      <div className="workout-card__body">
        <div className="workout-card__name">{name}</div>

        <div className="workout-card__badges">
          <span className="badge badge--duration">⏱ {formatDuration(totalSec)}</span>
          <span className="badge badge--tss">⚡ {tss} TSS</span>
          <span className="badge badge--watts">
            {avgWatts > 0 ? `${avgWatts}W avg` : "Free Ride"}
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── StatBox ─────────────────────────────────────────────────────────────────

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <div style={{
      background: "var(--c-bg-card)", padding: "20px",
      display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
    }}>
      <div style={{ fontSize: 24, fontWeight: 700, color: "#fff" }}>{value}</div>
      <div style={{
        fontSize: 12, textTransform: "uppercase",
        letterSpacing: "0.05em", color: "var(--c-text-muted)",
      }}>
        {label}
      </div>
    </div>
  );
}

// ─── SegmentRow ───────────────────────────────────────────────────────────────

function SegmentRow({ node, ftp, showWatts }: { node: any; ftp: number; showWatts: boolean }) {
  const fmt = (sec: number) => formatDuration(sec);
  const pwr = (p: number) => showWatts ? `${Math.round(p * ftp)}W` : `${Math.round(p * 100)}%`;

  let text = "", subText = "", color = "transparent";

  if (node.kind === "group") {
    const { repeat, onDuration, onPower, offDuration, offPower } = node;
    const onTxt = `${fmt(onDuration)} @ ${pwr(onPower)}`;
    if (offDuration > 0) {
      text = `${repeat}x ${onTxt}, ${fmt(offDuration)} @ ${pwr(offPower)}`;
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
      color = zoneColor[ftpToZone((s.ftpLow + s.ftpHigh) / 2)];
    } else {
      text = `${fmt(dur)} Free Ride`;
      subText = s.label || "Free Ride";
      color = "#444";
    }
  }

  return (
    <div style={{
      position: "relative", margin: "0 0 4px 0",
      background: color, borderRadius: 4, padding: "10px 16px",
      display: "flex", flexDirection: "column", justifyContent: "center",
      boxShadow: "0 1px 2px rgba(0,0,0,0.1)", overflow: "hidden",
    }}>
      <div style={{ position: "relative", zIndex: 1, color: "#fff", fontWeight: 700, fontSize: 15, textShadow: "0 1px 3px rgba(0,0,0,0.4)" }}>
        {text}
      </div>
      <div style={{ position: "relative", zIndex: 1, color: "rgba(255,255,255,0.9)", fontSize: 11, fontWeight: 600, textShadow: "0 1px 2px rgba(0,0,0,0.4)", marginTop: 2, textTransform: "uppercase", letterSpacing: "0.05em" }}>
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
