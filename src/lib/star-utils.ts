// Deterministic helpers for star color, size, and position from a name.

function hashString(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number) {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = t;
    r = Math.imul(r ^ (r >>> 15), r | 1);
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

// Astronomical color temperatures: warm yellows, cool blues, deep reds, soft whites
const STAR_PALETTE = [
  "#fff4d6", // warm white
  "#ffe9b0", // soft gold
  "#ffd27a", // warm yellow
  "#ffb86b", // amber
  "#ff8a5c", // sunset orange
  "#ff6b6b", // deep red
  "#e8efff", // ice white
  "#b8d4ff", // pale blue
  "#7fb6ff", // cool blue
  "#9b7cff", // violet
  "#ffd6f0", // pink white
];

export function colorForName(name: string): string {
  const h = hashString(name.toLowerCase().trim());
  return STAR_PALETTE[h % STAR_PALETTE.length];
}

export function sizeForName(name: string): number {
  const rng = mulberry32(hashString(name + "_size"));
  // 0.6 -> 1.6 with bias toward smaller
  return 0.6 + Math.pow(rng(), 1.5) * 1.0;
}

// Distribute stars in a roughly spherical volume, denser toward center.
export function positionForName(name: string, index = 0): [number, number, number] {
  const rng = mulberry32(hashString(name + "_pos_" + index));
  const u = rng();
  const v = rng();
  const theta = 2 * Math.PI * u;
  const phi = Math.acos(2 * v - 1);
  // radius biased outward but clipped
  const r = 30 + Math.pow(rng(), 0.6) * 220;
  const x = r * Math.sin(phi) * Math.cos(theta);
  const y = r * Math.sin(phi) * Math.sin(theta) * 0.6; // flatten slightly
  const z = r * Math.cos(phi);
  return [x, y, z];
}

// Nebula naming
const NEBULA_PREFIXES = [
  "Oryn",
  "Kael",
  "Vespera",
  "Lirien",
  "Thal",
  "Myros",
  "Aevum",
  "Solane",
  "Caldris",
  "Eunoia",
  "Halix",
  "Pyre",
  "Sable",
  "Veyra",
  "Nyx",
  "Auris",
  "Cinder",
  "Drift",
  "Hollow",
  "Iris",
  "Ember",
];

export function nebulaName(index: number): string {
  return `Nebula ${NEBULA_PREFIXES[index % NEBULA_PREFIXES.length]}${
    index >= NEBULA_PREFIXES.length ? " " + (Math.floor(index / NEBULA_PREFIXES.length) + 1) : ""
  }`;
}

// Cluster stars into nebulae of ~100. Returns groups (indices of stars per nebula).
export function clusterIntoNebulae<T extends { x: number; y: number; z: number }>(
  stars: T[],
  perNebula = 100,
): { center: [number, number, number]; stars: T[]; name: string }[] {
  if (stars.length < perNebula) return [];
  // Sort by position (Morton-like) for deterministic grouping
  const sorted = [...stars].sort(
    (a, b) => a.x + a.y * 0.3 + a.z * 0.7 - (b.x + b.y * 0.3 + b.z * 0.7),
  );
  const groups: { center: [number, number, number]; stars: T[]; name: string }[] = [];
  for (let i = 0; i + perNebula <= sorted.length; i += perNebula) {
    const slice = sorted.slice(i, i + perNebula);
    const cx = slice.reduce((s, p) => s + p.x, 0) / slice.length;
    const cy = slice.reduce((s, p) => s + p.y, 0) / slice.length;
    const cz = slice.reduce((s, p) => s + p.z, 0) / slice.length;
    groups.push({ center: [cx, cy, cz], stars: slice, name: nebulaName(groups.length) });
  }
  return groups;
}

// Validation
import { z } from "zod";

export const starSchema = z.object({
  name: z.string().trim().min(1, "Name your star").max(40, "Keep it under 40 characters"),
  email: z.string().trim().email("A valid email").max(255),
  message: z
    .string()
    .trim()
    .min(1, "Leave your mark")
    .max(180, "One sentence — under 180 characters"),
  category: z.enum(["lokiai-waitlist", "feedback", "reach-out"], {
    required_error: "Please select a category",
  }),
});
export type StarInput = z.infer<typeof starSchema>;
