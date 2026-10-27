// Balance Bridge puzzle engine.
// Every puzzle is an equation of the form  a·□ + groups = c·□ + groups,
// with one positive whole-number answer. The balance model is purely additive,
// so no stage needs subtraction or negative numbers to be drawn.

export interface Side {
  /** How many mystery boxes sit on this side (each weighs the answer). */
  boxes: number;
  /** Plain weights, drawn as separate piles (e.g. 4 + 3 shows two piles). */
  groups: number[];
}

export interface Puzzle {
  left: Side;
  right: Side;
  answer: number;
  /** Highest value the number control offers for this puzzle. */
  max: number;
}

export interface Stage {
  id: number;
  name: string;
  skill: string;
  ages: string;
  make: () => Puzzle;
}

const r = (lo: number, hi: number) => lo + Math.floor(Math.random() * (hi - lo + 1));

function mirror(p: Puzzle): Puzzle {
  return Math.random() < 0.5 ? p : { ...p, left: p.right, right: p.left };
}

export const STAGES: Stage[] = [
  {
    id: 1,
    name: "Count it",
    skill: "□ = 3",
    ages: "4+",
    make: () => {
      const x = r(1, 5);
      return { left: { boxes: 0, groups: [x] }, right: { boxes: 1, groups: [] }, answer: x, max: 10 };
    },
  },
  {
    id: 2,
    name: "Add to 10",
    skill: "□ + 2 = 7",
    ages: "4–5",
    make: () => {
      const x = r(1, 7);
      const a = r(1, 10 - x);
      return mirror({ left: { boxes: 1, groups: [a] }, right: { boxes: 0, groups: [a + x] }, answer: x, max: 10 });
    },
  },
  {
    id: 3,
    name: "Add to 20",
    skill: "8 + □ = 15",
    ages: "6",
    make: () => {
      const x = r(2, 12);
      const a = r(2, 20 - x);
      return mirror({ left: { boxes: 1, groups: [a] }, right: { boxes: 0, groups: [a + x] }, answer: x, max: 20 });
    },
  },
  {
    id: 4,
    name: "Same on both sides",
    skill: "4 + 5 = □ + 3",
    ages: "6–7",
    make: () => {
      const a = r(2, 10);
      const b = r(2, 10);
      const c = r(1, a + b - 1);
      return mirror({ left: { boxes: 0, groups: [a, b] }, right: { boxes: 1, groups: [c] }, answer: a + b - c, max: 20 });
    },
  },
  {
    id: 5,
    name: "Equal groups",
    skill: "3 × □ = 12",
    ages: "7–8",
    make: () => {
      const k = r(2, 5);
      const x = r(1, 10);
      return mirror({ left: { boxes: k, groups: [] }, right: { boxes: 0, groups: [k * x] }, answer: x, max: 15 });
    },
  },
  {
    id: 6,
    name: "Two steps",
    skill: "2 × □ + 1 = 9",
    ages: "8–9",
    make: () => {
      const k = r(2, 5);
      const x = r(1, 10);
      const a = r(1, 10);
      return mirror({ left: { boxes: k, groups: [a] }, right: { boxes: 0, groups: [k * x + a] }, answer: x, max: 20 });
    },
  },
  {
    id: 7,
    name: "Boxes on both sides",
    skill: "3 × □ + 2 = □ + 12",
    ages: "9–10",
    make: () => {
      const j = r(1, 3);
      const k = j + r(1, 3);
      const x = r(1, 10);
      const a = r(0, 8);
      const b = (k - j) * x + a;
      return mirror({
        left: { boxes: k, groups: a ? [a] : [] },
        right: { boxes: j, groups: [b] },
        answer: x,
        max: 20,
      });
    },
  },
  {
    id: 8,
    name: "Master builder",
    skill: "5 × □ + 7 = 2 × □ + 31",
    ages: "10+",
    make: () => {
      const j = r(1, 4);
      const k = j + r(1, 5);
      const x = r(3, 20);
      const a = r(0, 15);
      const b = (k - j) * x + a;
      return mirror({
        left: { boxes: k, groups: a ? [a] : [] },
        right: { boxes: j, groups: [b] },
        answer: x,
        max: 30,
      });
    },
  },
];

export const sum = (xs: number[]) => xs.reduce((t, v) => t + v, 0);
export const weight = (s: Side, x: number) => s.boxes * x + sum(s.groups);

/** "3 × □ + 2" style text for one side. */
export function sideText(s: Side, box = "□"): string {
  const parts: string[] = [];
  if (s.boxes === 1) parts.push(box);
  if (s.boxes > 1) parts.push(`${s.boxes} × ${box}`);
  for (const g of s.groups) parts.push(String(g));
  return parts.length ? parts.join(" + ") : "0";
}

/**
 * One clear way to solve the puzzle, as short steps a child can follow:
 * tidy the piles, take the same off both sides, then share equally.
 */
export function solvingSteps(p: Puzzle): string[] {
  // Work with the side that holds more boxes as "A".
  const [A, B] = p.left.boxes >= p.right.boxes ? [p.left, p.right] : [p.right, p.left];
  const steps: string[] = [];
  let k = A.boxes;
  let n = sum(A.groups);
  let m = sum(B.groups);

  for (const s of [A, B]) {
    if (s.groups.length > 1) steps.push(`Put the piles together: ${s.groups.join(" + ")} = ${sum(s.groups)}.`);
  }
  if (B.boxes > 0) {
    const j = B.boxes;
    k -= j;
    steps.push(
      `Take ${j} ${j === 1 ? "box" : "boxes"} off both sides. The bridge stays level: ${sideText({ boxes: k, groups: n ? [n] : [] })} = ${m}.`,
    );
  }
  if (n > 0) {
    m -= n;
    steps.push(`Take ${n} off both sides: ${sideText({ boxes: k, groups: [] })} = ${m}.`);
    n = 0;
  }
  if (k > 1) {
    steps.push(`Share ${m} into ${k} equal boxes: ${m} ÷ ${k} = ${m / k}, so □ = ${m / k}.`);
  } else if (steps.length === 0) {
    steps.push(`Count the weights on the other side: □ = ${m}.`);
  } else if (!steps[steps.length - 1].endsWith(`□ = ${m}.`)) {
    steps.push(`So □ = ${m}.`);
  }
  return steps;
}

/* ───────────────────────── journeys and profiles ───────────────────────── */

/** Sums in one journey. Finishing a journey levels up and earns a sticker. */
export const JOURNEY = 10;

export type AgeGroup = "4-5" | "6-7" | "8-9" | "10+";

export const AGE_GROUPS: { id: AgeGroup; label: string; startStage: number }[] = [
  { id: "4-5", label: "4–5 years", startStage: 1 },
  { id: "6-7", label: "6–7 years", startStage: 3 },
  { id: "8-9", label: "8–9 years", startStage: 5 },
  { id: "10+", label: "10 years or older", startStage: 7 },
];

/** The start station plus one station per sum (JOURNEY + 1 names per theme). */
export const STATIONS: Record<"trains" | "space" | "dinos" | "garden", string[]> = {
  trains: ["Maple Halt", "Brook Crossing", "Hill Top", "Mill Lane", "River Bend", "Old Oak", "Fox Hollow", "Lantern Square", "Windmill Hill", "Seaside", "Grand Central"],
  space: ["Launch Pad", "Moon Base", "Comet Dock", "Mars Camp", "Asteroid Belt", "Jupiter Gate", "Saturn Rings", "Ice Moon", "Nebula Point", "Twin Suns", "Star Harbour"],
  dinos: ["Fern Valley", "Egg Nest", "Bone Bridge", "Tar Pit", "Volcano View", "River Ford", "Footprint Path", "Cave Camp", "Lagoon", "Giant Tree", "Dino Valley"],
  garden: ["Seed Patch", "Daisy Lane", "Puddle Pond", "Mushroom Ring", "Rose Arch", "Bee Hive", "Old Log", "Berry Bush", "Snail Trail", "Sunflower Hill", "Treehouse"],
};
