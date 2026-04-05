import { useEffect, useRef } from "react";
import avatarImg from "./assets/cyclist_avatar.png";

// ─── Zwift zone definitions ───────────────────────────────────────────────────

interface ZoneDef {
  key: string;
  name: string;
  description: string;
  minPct: number; // inclusive lower bound in % of FTP
  maxPct: number | null; // null = no upper bound
  color: string;
  bgColor: string;
}

const ZONE_DEFS: ZoneDef[] = [
  {
    key: "Z1",
    name: "Active Recovery",
    description: "Easy spinning, recovery rides",
    minPct: 0,
    maxPct: 59,
    color: "#9ca3af",
    bgColor: "rgba(156, 163, 175, 0.12)",
  },
  {
    key: "Z2",
    name: "Endurance",
    description: "All-day pace, fat burning",
    minPct: 60,
    maxPct: 75,
    color: "#3b82f6",
    bgColor: "rgba(59, 130, 246, 0.12)",
  },
  {
    key: "Z3",
    name: "Tempo",
    description: "Sustained effort, pace riding",
    minPct: 76,
    maxPct: 89,
    color: "#22c55e",
    bgColor: "rgba(34, 197, 94, 0.12)",
  },
  {
    key: "Z4",
    name: "Threshold",
    description: "Just at or below FTP, race pace",
    minPct: 90,
    maxPct: 104,
    color: "#eab308",
    bgColor: "rgba(234, 179, 8, 0.12)",
  },
  {
    key: "Z5",
    name: "VO2 Max",
    description: "Hard, 3–8 min efforts",
    minPct: 105,
    maxPct: 118,
    color: "#f97316",
    bgColor: "rgba(249, 115, 22, 0.12)",
  },
  {
    key: "Z6",
    name: "Anaerobic",
    description: "Very hard, <3 min efforts",
    minPct: 119,
    maxPct: 149,
    color: "#ef4444",
    bgColor: "rgba(239, 68, 68, 0.12)",
  },
  {
    key: "Z7",
    name: "Neuromuscular",
    description: "Max sprint, <30s efforts",
    minPct: 150,
    maxPct: null,
    color: "#a855f7",
    bgColor: "rgba(168, 85, 247, 0.12)",
  },
];

function zoneWatts(ftp: number, minPct: number, maxPct: number | null): string {
  const lo = Math.round((minPct / 100) * ftp);
  if (maxPct === null) return `${lo}+ W`;
  const hi = Math.round((maxPct / 100) * ftp);
  return `${lo} – ${hi} W`;
}

// ─── Component ────────────────────────────────────────────────────────────────

interface ProfilePanelProps {
  open: boolean;
  onClose: () => void;
  ftp: number;
  weight: number;
  onFtpChange: (v: number) => void;
  onWeightChange: (v: number) => void;
}

export function ProfilePanel({
  open,
  onClose,
  ftp,
  weight,
  onFtpChange,
  onWeightChange,
}: ProfilePanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  // Close on Escape key
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  // Close on backdrop click
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
      onClose();
    }
  };

  const wpkg = weight > 0 ? (ftp / weight).toFixed(2) : "–";

  return (
    <>
      {/* Backdrop */}
      <div
        className={`profile-backdrop ${open ? "profile-backdrop--visible" : ""}`}
        onClick={handleBackdropClick}
        aria-hidden={!open}
      />

      {/* Slide-over panel */}
      <aside
        ref={panelRef}
        className={`profile-panel ${open ? "profile-panel--open" : ""}`}
        aria-label="User Profile"
      >
        {/* Header */}
        <div className="profile-panel__header">
          <span className="profile-panel__title">Rider Profile</span>
          <button
            className="profile-panel__close"
            onClick={onClose}
            title="Close profile"
          >
            ✕
          </button>
        </div>

        {/* Avatar + identity */}
        <div className="profile-panel__identity">
          <div className="profile-avatar-wrap">
            <img
              src={avatarImg}
              alt="Rider avatar"
              className="profile-avatar"
            />
            <div className="profile-avatar-ring" />
          </div>
          <div>
            <div className="profile-panel__rider-name">Your Profile</div>
            <div className="profile-panel__rider-sub">
              {ftp} W · {wpkg} W/kg
            </div>
          </div>
        </div>

        {/* Settings */}
        <div className="profile-panel__section">
          <div className="profile-panel__section-title">Settings</div>

          <div className="profile-field">
            <label className="profile-field__label" htmlFor="profile-ftp">
              FTP
              <span className="profile-field__hint">Functional Threshold Power</span>
            </label>
            <div className="profile-field__input-row">
              <input
                id="profile-ftp"
                type="number"
                min={1}
                max={600}
                value={ftp}
                onChange={(e) => {
                  const v = parseInt(e.target.value, 10);
                  if (Number.isFinite(v) && v > 0) onFtpChange(v);
                }}
                className="profile-input"
              />
              <span className="profile-field__unit">W</span>
            </div>
            {/* FTP slider */}
            <input
              type="range"
              min={50}
              max={500}
              value={Math.min(500, Math.max(50, ftp))}
              onChange={(e) => onFtpChange(Number(e.target.value))}
              className="profile-slider"
              style={{ "--slider-pct": `${((Math.min(500, ftp) - 50) / 450) * 100}%` } as React.CSSProperties}
            />
            <div className="profile-slider-labels">
              <span>50W</span>
              <span>500W</span>
            </div>
          </div>

          <div className="profile-field">
            <label className="profile-field__label" htmlFor="profile-weight">
              Body Weight
              <span className="profile-field__hint">Used for W/kg calculations</span>
            </label>
            <div className="profile-field__input-row">
              <input
                id="profile-weight"
                type="number"
                min={1}
                max={200}
                value={weight}
                onChange={(e) => {
                  const v = parseInt(e.target.value, 10);
                  if (Number.isFinite(v) && v > 0) onWeightChange(v);
                }}
                className="profile-input"
              />
              <span className="profile-field__unit">kg</span>
            </div>
            <input
              type="range"
              min={40}
              max={150}
              value={Math.min(150, Math.max(40, weight))}
              onChange={(e) => onWeightChange(Number(e.target.value))}
              className="profile-slider"
              style={{ "--slider-pct": `${((Math.min(150, weight) - 40) / 110) * 100}%` } as React.CSSProperties}
            />
            <div className="profile-slider-labels">
              <span>40 kg</span>
              <span>150 kg</span>
            </div>
          </div>
        </div>

        {/* Power Zones */}
        <div className="profile-panel__section">
          <div className="profile-panel__section-title">
            Power Zones
            <span className="profile-panel__section-badge">Zwift Method</span>
          </div>

          <div className="zones-table">
            {ZONE_DEFS.map((z) => {
              const watts = zoneWatts(ftp, z.minPct, z.maxPct);
              const pctLabel =
                z.maxPct === null
                  ? `≥${z.minPct}%`
                  : `${z.minPct}–${z.maxPct}%`;

              // bar width represents zone width relative to FTP
              const barWidth =
                z.maxPct === null
                  ? 40
                  : ((z.maxPct - z.minPct) / 150) * 100;

              return (
                <div
                  key={z.key}
                  className="zone-row"
                  style={{ background: z.bgColor }}
                >
                  {/* Color stripe */}
                  <div
                    className="zone-row__stripe"
                    style={{ background: z.color }}
                  />

                  {/* Badge */}
                  <div
                    className="zone-row__key"
                    style={{ color: z.color, borderColor: z.color + "44" }}
                  >
                    {z.key}
                  </div>

                  {/* Info */}
                  <div className="zone-row__info">
                    <div className="zone-row__name">{z.name}</div>
                    <div className="zone-row__desc">{z.description}</div>
                    {/* mini power bar */}
                    <div className="zone-bar-track">
                      <div
                        className="zone-bar-fill"
                        style={{
                          width: `${barWidth}%`,
                          background: z.color,
                          marginLeft: `${(z.minPct / 150) * 100}%`,
                        }}
                      />
                    </div>
                  </div>

                  {/* Power values */}
                  <div className="zone-row__power">
                    <div className="zone-row__watts">{watts}</div>
                    <div className="zone-row__pct">{pctLabel} FTP</div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="profile-ftp-note">
            Based on FTP: <strong style={{ color: "var(--c-accent)" }}>{ftp} W</strong>
            &nbsp;·&nbsp;
            <strong style={{ color: "#6daffe" }}>{wpkg} W/kg</strong>
          </div>
        </div>
      </aside>
    </>
  );
}
