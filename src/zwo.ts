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

export type SegmentGroup = {
  kind: "group";
  repeat: number;
  onDuration: number;
  offDuration: number;
  onPower: number;
  offPower: number;
  text: string; // "3x 5min @ 95%"
  segments: Segment[];
};

export type WorkoutNode = Segment | SegmentGroup;

export type Workout = {
  name?: string;
  description?: string;
  segments: Segment[];
  nodes: WorkoutNode[];
  tags?: { name: string }[];
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

  const tags: { name: string }[] = [];
  const tagNodes = root.querySelectorAll("tags > tag");
  tagNodes.forEach((t) => {
    const n = t.getAttribute("name");
    if (n) tags.push({ name: n });
  });

  const segments: Segment[] = [];
  const nodes: WorkoutNode[] = [];
  let t = 0;

  const pushSteady = (dur: number, ftp: number, label?: string) => {
    const s: Segment = {
      kind: "steady",
      startSec: t,
      endSec: t + dur,
      ftp,
      label,
    };
    segments.push(s);
    t += dur;
    return s;
  };
  const pushRamp = (dur: number, low: number, high: number, label?: string) => {
    const s: Segment = {
      kind: "ramp",
      startSec: t,
      endSec: t + dur,
      ftpLow: low,
      ftpHigh: high,
      label,
    };
    segments.push(s);
    t += dur;
    return s;
  };
  const pushFree = (dur: number, label?: string) => {
    const s: Segment = { kind: "free", startSec: t, endSec: t + dur, label };
    segments.push(s);
    t += dur;
    return s;
  };

  const steps = Array.from(workoutNode.children).filter(
    (n) => n.nodeType === 1, // Element node
  ) as Element[];

  for (const step of steps) {
    switch (step.tagName) {
      case "Warmup": {
        const dur = numAttr(step, "Duration") ?? 0;
        const low = numAttr(step, "PowerLow") ?? numAttr(step, "Power") ?? 0;
        const high =
          numAttr(step, "PowerHigh") ?? numAttr(step, "Power") ?? low;
        if (low !== high) nodes.push(pushRamp(dur, low, high, "Warmup"));
        else nodes.push(pushSteady(dur, low, "Warmup"));
        break;
      }
      case "Cooldown": {
        const dur = numAttr(step, "Duration") ?? 0;
        const low = numAttr(step, "PowerLow") ?? numAttr(step, "Power") ?? 0;
        const high =
          numAttr(step, "PowerHigh") ?? numAttr(step, "Power") ?? low;
        if (low !== high) nodes.push(pushRamp(dur, low, high, "Cooldown"));
        else nodes.push(pushSteady(dur, low, "Cooldown"));
        break;
      }
      case "SteadyState": {
        const dur = numAttr(step, "Duration") ?? 0;
        const p = numAttr(step, "Power") ?? 0;
        nodes.push(pushSteady(dur, p, "Steady"));
        break;
      }
      case "FreeRide": {
        const dur = numAttr(step, "Duration") ?? 0;
        nodes.push(pushFree(dur, "Free ride"));
        break;
      }
      case "IntervalsT": {
        const repeat = numAttr(step, "Repeat") ?? 1;
        const onDur = numAttr(step, "OnDuration") ?? 0;
        const offDur = numAttr(step, "OffDuration") ?? 0;
        const onP = numAttr(step, "OnPower") ?? 0;
        const offP = numAttr(step, "OffPower") ?? 0;

        const groupSegments: Segment[] = [];

        for (let i = 0; i < repeat; i++) {
          groupSegments.push(pushSteady(onDur, onP, `On ${i + 1}/${repeat}`));
          if (offDur > 0)
            groupSegments.push(
              pushSteady(offDur, offP, `Off ${i + 1}/${repeat}`),
            );
        }

        nodes.push({
          kind: "group",
          repeat,
          onDuration: onDur,
          offDuration: offDur,
          onPower: onP,
          offPower: offP,
          text: `${repeat}x`, // will be formatted in UI
          segments: groupSegments,
        });
        break;
      }
      default: {
        // fallback: nie wywalaj się na nieznanych tagach
        const dur = numAttr(step, "Duration");
        if (dur) nodes.push(pushFree(dur, step.tagName));
        break;
      }
    }
  }

  return { name, description, segments, nodes, tags };
}
