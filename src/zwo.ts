export type Segment =
  | {
      kind: "steady";
      startSec: number;
      endSec: number;
      ftp: number; // 0.0-2.0 (np 0.95 = 95% FTP)
      label?: string;
    }
  | {
      kind: "ramp";
      startSec: number;
      endSec: number;
      ftpLow: number;
      ftpHigh: number;
      label?: string;
    }
  | {
      kind: "free";
      startSec: number;
      endSec: number;
      label?: string;
    };

export type Workout = {
  name?: string;
  description?: string;
  segments: Segment[];
};

const numAttr = (el: Element, name: string) => {
  const v = el.getAttribute(name);
  if (!v) return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
};

export function parseZwo(xmlText: string): Workout {
  const doc = new DOMParser().parseFromString(xmlText, "text/xml");
  const root = doc.querySelector("workout_file");
  if (!root) throw new Error("Invalid .zwo: missing <workout_file>");

  const workoutNode = root.querySelector("workout");
  if (!workoutNode) throw new Error("Invalid .zwo: missing <workout>");

  const name = root.querySelector("name")?.textContent?.trim() || undefined;
  const description =
    root.querySelector("description")?.textContent?.trim() || undefined;

  const segments: Segment[] = [];
  let t = 0;

  const pushSteady = (dur: number, ftp: number, label?: string) => {
    segments.push({ kind: "steady", startSec: t, endSec: t + dur, ftp, label });
    t += dur;
  };
  const pushRamp = (dur: number, low: number, high: number, label?: string) => {
    segments.push({
      kind: "ramp",
      startSec: t,
      endSec: t + dur,
      ftpLow: low,
      ftpHigh: high,
      label,
    });
    t += dur;
  };
  const pushFree = (dur: number, label?: string) => {
    segments.push({ kind: "free", startSec: t, endSec: t + dur, label });
    t += dur;
  };

  const steps = Array.from(workoutNode.children).filter(
    (n) => n.nodeType === 1,
  ) as Element[];

  for (const step of steps) {
    switch (step.tagName) {
      case "Warmup": {
        const dur = numAttr(step, "Duration") ?? 0;
        const low = numAttr(step, "PowerLow") ?? numAttr(step, "Power") ?? 0;
        const high =
          numAttr(step, "PowerHigh") ?? numAttr(step, "Power") ?? low;
        if (low !== high) pushRamp(dur, low, high, "Warmup");
        else pushSteady(dur, low, "Warmup");
        break;
      }
      case "Cooldown": {
        const dur = numAttr(step, "Duration") ?? 0;
        const low = numAttr(step, "PowerLow") ?? numAttr(step, "Power") ?? 0;
        const high =
          numAttr(step, "PowerHigh") ?? numAttr(step, "Power") ?? low;
        if (low !== high) pushRamp(dur, low, high, "Cooldown");
        else pushSteady(dur, low, "Cooldown");
        break;
      }
      case "SteadyState": {
        const dur = numAttr(step, "Duration") ?? 0;
        const p = numAttr(step, "Power") ?? 0;
        pushSteady(dur, p, "Steady");
        break;
      }
      case "FreeRide": {
        const dur = numAttr(step, "Duration") ?? 0;
        pushFree(dur, "Free ride");
        break;
      }
      case "IntervalsT": {
        const repeat = numAttr(step, "Repeat") ?? 1;
        const onDur = numAttr(step, "OnDuration") ?? 0;
        const offDur = numAttr(step, "OffDuration") ?? 0;
        const onP = numAttr(step, "OnPower") ?? 0;
        const offP = numAttr(step, "OffPower") ?? 0;

        for (let i = 0; i < repeat; i++) {
          pushSteady(onDur, onP, `On ${i + 1}/${repeat}`);
          if (offDur > 0) pushSteady(offDur, offP, `Off ${i + 1}/${repeat}`);
        }
        break;
      }
      default: {
        // fallback: nie wywalaj się na nieznanych tagach
        const dur = numAttr(step, "Duration");
        if (dur) pushFree(dur, step.tagName);
        break;
      }
    }
  }

  return { name, description, segments };
}
