import { useEffect, useMemo, useRef, useState, type ReactElement } from "react";
import { Check, Lightbulb, Minus, Plus, RotateCcw, Star, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from "@/lib/utils";
import {
  AGE_GROUPS,
  JOURNEY,
  STAGES,
  STATIONS,
  sideText,
  solvingSteps,
  sum,
  weight,
  type AgeGroup,
  type Puzzle,
  type Side,
} from "@/lib/bridge-puzzles";

/* ───────────────────────── themes ───────────────────────── */

type ThemeId = "trains" | "space" | "dinos" | "garden";

interface Theme {
  id: ThemeId;
  label: string;
  items: string;
  crosser: string;
  send: string;
  sky: string;
  land: string;
  landTop: string;
  beam: string;
  beamLine: string;
  box: string;
  boxEdge: string;
}

const THEMES: Theme[] = [
  { id: "trains", label: "Trains", items: "crates", crosser: "train", send: "Send the train", sky: "#dbeafe", land: "#a8a29e", landTop: "#65a30d", beam: "#92400e", beamLine: "#fcd34d", box: "#1d4ed8", boxEdge: "#1e3a8a" },
  { id: "space", label: "Space", items: "stars", crosser: "rover", send: "Send the rover", sky: "#1e1b4b", land: "#57534e", landTop: "#a8a29e", beam: "#64748b", beamLine: "#cbd5e1", box: "#7c3aed", boxEdge: "#4c1d95" },
  { id: "dinos", label: "Dinosaurs", items: "eggs", crosser: "dinosaur", send: "Let the dinosaur cross", sky: "#fef3c7", land: "#a16207", landTop: "#4d7c0f", beam: "#78350f", beamLine: "#d6a35c", box: "#047857", boxEdge: "#064e3b" },
  { id: "garden", label: "Garden", items: "apples", crosser: "ladybird", send: "Let the ladybird cross", sky: "#ecfccb", land: "#84cc16", landTop: "#3f6212", beam: "#713f12", beamLine: "#a16207", box: "#b45309", boxEdge: "#78350f" },
];

/* ───────────────────────── saved settings ───────────────────────── */

interface Profile {
  name: string;
  age: AgeGroup;
}

interface Saved {
  profile: Profile | null;
  theme: ThemeId;
  holdUntilCheck: boolean;
  stage: number;
  /** Sums done on the current journey of each level (0–10). */
  stations: Record<number, number>;
  /** Collected stickers, one per level per world: "3-trains". */
  stickers: string[];
  crossed: Record<number, number>;
}

const SAVE_KEY = "balance-bridge:v1";
const DEFAULTS: Saved = { profile: null, theme: "trains", holdUntilCheck: false, stage: 1, stations: {}, stickers: [], crossed: {} };

function loadSaved(): Saved {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    return raw ? { ...DEFAULTS, ...(JSON.parse(raw) as Partial<Saved>) } : DEFAULTS;
  } catch {
    return DEFAULTS;
  }
}

function prefersReducedMotion() {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

function newPuzzle(stage: number, previous?: Puzzle): Puzzle {
  const make = STAGES.find((s) => s.id === stage)?.make ?? STAGES[0].make;
  for (let i = 0; i < 8; i++) {
    const p = make();
    if (!previous || sideText(p.left) + sideText(p.right) !== sideText(previous.left) + sideText(previous.right)) return p;
  }
  return make();
}

/* ───────────────────────── scene drawing ───────────────────────── */

const W = 800;
const H = 400;
const TOP = 230; // cliff top and beam top
const PIVOT = { x: 400, y: 237 };
const UNIT = 14;
const STEP = 17;
const BOX = 40;

type Piece = { kind: "box" | "unit" | "ten"; x: number; y: number };

function layoutSide(side: Side): { pieces: Piece[]; width: number } {
  const pieces: Piece[] = [];
  let x = 0;
  for (let i = 0; i < side.boxes; i++) {
    pieces.push({ kind: "box", x, y: -BOX });
    x += BOX + 6;
  }
  side.groups.forEach((g, gi) => {
    if (gi > 0 || side.boxes > 0) x += 10;
    for (let t = 0; t < Math.floor(g / 10); t++) {
      pieces.push({ kind: "ten", x, y: -STEP * 5 });
      x += 19;
    }
    const ones = g % 10;
    for (let u = 0; u < ones; u++) {
      const col = Math.floor(u / 5);
      const row = u % 5;
      pieces.push({ kind: "unit", x: x + col * STEP, y: -(row + 1) * STEP });
    }
    if (ones) x += Math.ceil(ones / 5) * STEP;
  });
  return { pieces, width: Math.max(x - 6, 1) };
}

function UnitShape({ theme, x, y }: { theme: ThemeId; x: number; y: number }) {
  const cx = x + UNIT / 2;
  const cy = y + UNIT / 2;
  switch (theme) {
    case "trains":
      return (
        <g>
          <rect x={x} y={y} width={UNIT} height={UNIT} rx={2} fill="#d97706" stroke="#78350f" strokeWidth={1.2} />
          <path d={`M${x + 2} ${y + 2} L${x + UNIT - 2} ${y + UNIT - 2} M${x + UNIT - 2} ${y + 2} L${x + 2} ${y + UNIT - 2}`} stroke="#78350f" strokeWidth={1} />
        </g>
      );
    case "space": {
      const pts = Array.from({ length: 10 }, (_, i) => {
        const a = (Math.PI / 5) * i - Math.PI / 2;
        const rad = i % 2 ? 3.2 : 7.4;
        return `${cx + rad * Math.cos(a)},${cy + rad * Math.sin(a)}`;
      }).join(" ");
      return <polygon points={pts} fill="#facc15" stroke="#a16207" strokeWidth={1} />;
    }
    case "dinos":
      return (
        <g>
          <ellipse cx={cx} cy={cy + 0.5} rx={6} ry={7.3} fill="#fef9c3" stroke="#a16207" strokeWidth={1.2} />
          <circle cx={cx - 2} cy={cy - 1} r={1.3} fill="#16a34a" />
          <circle cx={cx + 2.2} cy={cy + 2.5} r={1.1} fill="#16a34a" />
        </g>
      );
    default:
      return (
        <g>
          <circle cx={cx} cy={cy + 1} r={6.6} fill="#dc2626" stroke="#7f1d1d" strokeWidth={1} />
          <path d={`M${cx} ${cy - 5} q2 -3 5 -2 q-2 3 -5 2`} fill="#16a34a" />
        </g>
      );
  }
}

function TenBar({ theme, x, y }: { theme: ThemeId; x: number; y: number }) {
  const fill = { trains: "#d97706", space: "#facc15", dinos: "#fef9c3", garden: "#dc2626" }[theme];
  const ink = theme === "garden" ? "#ffffff" : "#422006";
  return (
    <g>
      <rect x={x} y={y} width={16} height={STEP * 5} rx={3} fill={fill} stroke="#422006" strokeWidth={1.2} />
      {Array.from({ length: 4 }, (_, i) => (
        <line key={i} x1={x + 2} x2={x + 14} y1={y + (i + 1) * 17} y2={y + (i + 1) * 17} stroke="#422006" strokeOpacity={0.35} />
      ))}
      <text x={x + 8} y={y + 12} textAnchor="middle" fontSize={9} fontWeight={700} fill={ink}>
        10
      </text>
    </g>
  );
}

function SidePile({ side, value, theme, t, centerX }: { side: Side; value: number; theme: ThemeId; t: Theme; centerX: number }) {
  const { pieces, width } = layoutSide(side);
  const scale = Math.min(1.8, 250 / width); // small piles draw bigger so young children can count them
  return (
    <g transform={`translate(${centerX - (width * scale) / 2} ${TOP}) scale(${scale})`}>
      {pieces.map((p, i) =>
        p.kind === "box" ? (
          <g key={i}>
            <rect x={p.x} y={p.y} width={BOX} height={BOX} rx={7} fill={t.box} stroke={t.boxEdge} strokeWidth={2} />
            <text x={p.x + BOX / 2} y={p.y + 27} textAnchor="middle" fontSize={20} fontWeight={700} fill="#ffffff">
              {value}
            </text>
          </g>
        ) : p.kind === "ten" ? (
          <TenBar key={i} theme={theme} x={p.x} y={p.y} />
        ) : (
          <UnitShape key={i} theme={theme} x={p.x} y={p.y} />
        ),
      )}
    </g>
  );
}

function Crosser({ theme }: { theme: ThemeId }) {
  // Drawn with its feet/wheels on y = 0, centred on x = 0.
  switch (theme) {
    case "trains":
      return (
        <g>
          <rect x={-30} y={-30} width={42} height={22} rx={4} fill="#dc2626" stroke="#7f1d1d" strokeWidth={1.5} />
          <rect x={8} y={-42} width={22} height={34} rx={3} fill="#1d4ed8" stroke="#1e3a8a" strokeWidth={1.5} />
          <rect x={13} y={-37} width={12} height={10} rx={2} fill="#bfdbfe" />
          <rect x={-24} y={-42} width={8} height={13} fill="#334155" />
          {[-20, -2, 20].map((wx) => (
            <circle key={wx} cx={wx} cy={-6} r={6} fill="#1f2937" stroke="#9ca3af" strokeWidth={1.5} />
          ))}
        </g>
      );
    case "space":
      return (
        <g>
          <rect x={-26} y={-28} width={52} height={16} rx={5} fill="#e2e8f0" stroke="#475569" strokeWidth={1.5} />
          <rect x={-10} y={-40} width={22} height={13} rx={4} fill="#7c3aed" stroke="#4c1d95" strokeWidth={1.5} />
          <line x1={14} y1={-40} x2={20} y2={-52} stroke="#475569" strokeWidth={2} />
          <circle cx={20} cy={-53} r={3} fill="#facc15" />
          {[-18, 0, 18].map((wx) => (
            <circle key={wx} cx={wx} cy={-7} r={7} fill="#334155" stroke="#94a3b8" strokeWidth={1.5} />
          ))}
        </g>
      );
    case "dinos":
      return (
        <g>
          <path d="M-30 -18 Q-40 -26 -46 -20 Q-38 -18 -30 -12 Z" fill="#16a34a" />
          <ellipse cx={-8} cy={-22} rx={24} ry={13} fill="#22c55e" stroke="#14532d" strokeWidth={1.5} />
          <path d="M8 -30 Q18 -58 30 -56 L32 -48 Q22 -48 18 -26 Z" fill="#22c55e" stroke="#14532d" strokeWidth={1.5} />
          <circle cx={29} cy={-52} r={1.6} fill="#14532d" />
          {[-24, -14, 2, 10].map((lx) => (
            <rect key={lx} x={lx} y={-12} width={6} height={12} rx={2} fill="#15803d" />
          ))}
        </g>
      );
    default:
      return (
        <g>
          {[-14, -4, 6].map((lx) => (
            <line key={lx} x1={lx} y1={-6} x2={lx - 3} y2={0} stroke="#111827" strokeWidth={2} />
          ))}
          <path d="M-20 -6 A18 18 0 0 1 16 -6 Z" fill="#dc2626" stroke="#7f1d1d" strokeWidth={1.5} />
          <line x1={-2} y1={-24} x2={-2} y2={-6} stroke="#111827" strokeWidth={1.5} />
          {[[-12, -14], [-7, -20], [4, -18], [9, -11], [-14, -9]].map(([sx, sy], i) => (
            <circle key={i} cx={sx} cy={sy} r={2.6} fill="#111827" />
          ))}
          <circle cx={20} cy={-9} r={6} fill="#111827" />
          <circle cx={22} cy={-11} r={1.4} fill="#ffffff" />
        </g>
      );
  }
}

function Scenery({ t }: { t: Theme }) {
  const deco: Record<ThemeId, ReactElement> = {
    trains: (
      <g>
        <path d="M0 330 Q180 250 360 320 T800 300 V400 H0 Z" fill="#bbf7d0" />
        <ellipse cx={620} cy={70} rx={46} ry={16} fill="#ffffff" />
        <ellipse cx={180} cy={90} rx={36} ry={12} fill="#ffffff" />
      </g>
    ),
    space: (
      <g>
        {[[60, 40], [140, 110], [230, 50], [330, 90], [470, 30], [560, 120], [690, 60], [760, 140], [100, 180], [420, 150]].map(([sx, sy], i) => (
          <circle key={i} cx={sx} cy={sy} r={i % 3 ? 1.6 : 2.4} fill="#ffffff" />
        ))}
        <circle cx={640} cy={90} r={34} fill="#6366f1" />
        <ellipse cx={640} cy={90} rx={54} ry={9} fill="none" stroke="#c7d2fe" strokeWidth={3} />
      </g>
    ),
    dinos: (
      <g>
        <path d="M520 330 L620 120 L660 120 L760 330 Z" fill="#a8a29e" />
        <path d="M620 120 L660 120 L650 150 L630 150 Z" fill="#ea580c" />
        <path d="M120 330 Q140 260 160 330 M150 330 Q175 270 190 330" stroke="#4d7c0f" strokeWidth={6} fill="none" />
      </g>
    ),
    garden: (
      <g>
        {[[200, 300], [260, 310], [560, 305], [610, 296], [470, 315]].map(([fx, fy], i) => (
          <g key={i}>
            <line x1={fx} y1={fy} x2={fx} y2={330} stroke="#3f6212" strokeWidth={2} />
            <circle cx={fx} cy={fy} r={7} fill={["#f472b6", "#facc15", "#a78bfa", "#fb923c", "#f472b6"][i]} />
            <circle cx={fx} cy={fy} r={2.5} fill="#fef3c7" />
          </g>
        ))}
        <circle cx={680} cy={70} r={30} fill="#fde047" />
      </g>
    ),
  };
  return (
    <g>
      <rect width={W} height={H} fill={t.sky} />
      {deco[t.id]}
      <rect x={0} y={330} width={W} height={70} fill={t.land} />
      <rect x={0} y={TOP} width={96} height={H - TOP} fill={t.land} />
      <rect x={0} y={TOP} width={96} height={8} fill={t.landTop} />
      <rect x={704} y={TOP} width={96} height={H - TOP} fill={t.land} />
      <rect x={704} y={TOP} width={96} height={8} fill={t.landTop} />
    </g>
  );
}

/* ───────────────────────── stickers ───────────────────────── */

const STICKER_RING = ["#b45309", "#be123c", "#7c3aed", "#0369a1", "#047857", "#a16207", "#c2410c", "#1d4ed8"];

function Sticker({ stage, theme, earned, size = 88 }: { stage: number; theme: ThemeId; earned: boolean; size?: number }) {
  const th = THEMES.find((x) => x.id === theme) ?? THEMES[0];
  const lv = STAGES.find((s) => s.id === stage);
  const label = earned ? `${th.label} sticker, level ${stage}: ${lv?.name}` : `Not collected yet: ${th.label}, level ${stage}`;
  return (
    <svg viewBox="-50 -50 100 100" width={size} height={size} role="img" aria-label={label} className="shrink-0">
      {earned ? (
        <g>
          <circle r={47} fill={STICKER_RING[(stage - 1) % STICKER_RING.length]} />
          <circle r={40} fill={th.sky} />
          <g transform="translate(0 14) scale(0.9)">
            <Crosser theme={theme} />
          </g>
          <rect x={-40} y={14} width={80} height={6} fill={th.landTop} />
          <path d="M0 -44 L5 -33 L17 -33 L7 -26 L11 -14 L0 -21 L-11 -14 L-7 -26 L-17 -33 L-5 -33 Z" fill="#facc15" stroke="#a16207" strokeWidth={1.5} />
          <text x={0} y={-24} textAnchor="middle" fontSize={11} fontWeight={800} fill="#422006">
            {stage}
          </text>
        </g>
      ) : (
        <g>
          <circle r={44} fill="none" stroke="currentColor" strokeOpacity={0.35} strokeWidth={3} strokeDasharray="7 6" />
          <text x={0} y={9} textAnchor="middle" fontSize={26} fontWeight={700} fill="currentColor" fillOpacity={0.45}>
            {stage}
          </text>
        </g>
      )}
    </svg>
  );
}

const stickerKey = (stage: number, theme: ThemeId) => `${stage}-${theme}`;

/* ───────────────────────── profile screen ───────────────────────── */

function ProfileScreen({ initial, theme, onSave, onCancel }: { initial: Profile | null; theme: ThemeId; onSave: (p: Profile, theme: ThemeId) => void; onCancel?: () => void }) {
  const [name, setName] = useState(initial?.name ?? "");
  const [age, setAge] = useState<AgeGroup | null>(initial?.age ?? null);
  const [pick, setPick] = useState<ThemeId>(theme);
  const start = AGE_GROUPS.find((a) => a.id === age);
  const startStage = STAGES.find((s) => s.id === start?.startStage);
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
      <section id="bridge-work" tabIndex={-1} aria-labelledby="profile-heading" className="rounded-2xl border border-border bg-card p-6 outline-none sm:p-8">
        <h1 id="profile-heading" className="text-3xl font-semibold tracking-tight">
          {initial ? "Your profile" : "Who is playing?"}
        </h1>
        <div className="mt-6 grid gap-2">
          <Label htmlFor="player-name" className="text-base">
            Name
          </Label>
          <Input id="player-name" value={name} onChange={(e) => setName(e.target.value.slice(0, 24))} className="h-12 max-w-sm text-lg" autoComplete="off" />
        </div>
        <fieldset className="mt-6">
          <legend className="text-base font-medium">Age</legend>
          <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {AGE_GROUPS.map((a) => (
              <button
                key={a.id}
                type="button"
                aria-pressed={age === a.id}
                onClick={() => setAge(a.id)}
                className={cn(
                  "h-16 rounded-xl border-2 text-lg font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                  age === a.id ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background hover:bg-accent",
                )}
              >
                {a.label}
              </button>
            ))}
          </div>
          {startStage && (
            <p className="mt-3 text-base">
              Starts at level {startStage.id}: {startStage.name} <span className="font-mono">({startStage.skill})</span>
            </p>
          )}
        </fieldset>
        <fieldset className="mt-6">
          <legend className="text-base font-medium">Favourite world</legend>
          <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {THEMES.map((th) => (
              <button
                key={th.id}
                type="button"
                aria-pressed={pick === th.id}
                onClick={() => setPick(th.id)}
                className={cn(
                  "flex flex-col items-center gap-1 rounded-xl border-2 p-2 font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                  pick === th.id ? "border-primary ring-2 ring-primary" : "border-border hover:bg-accent",
                )}
              >
                <svg viewBox="-50 -60 100 66" className="h-14 w-20 rounded-md" aria-hidden="true">
                  <rect x={-50} y={-60} width={100} height={66} fill={th.sky} />
                  <Crosser theme={th.id} />
                </svg>
                {th.label}
              </button>
            ))}
          </div>
        </fieldset>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button className="h-12 px-8 text-base" disabled={!age} onClick={() => age && onSave({ name: name.trim(), age }, pick)}>
            {initial ? "Save" : "Start playing"}
          </Button>
          {onCancel && (
            <Button variant="outline" className="h-12 px-6 text-base" onClick={onCancel}>
              Cancel
            </Button>
          )}
        </div>
      </section>
    </div>
  );
}

/* ───────────────────────── page ───────────────────────── */

type Phase = "solving" | "crossing" | "solved" | "levelup";

export function HomePage() {
  const [saved, setSaved] = useState<Saved>(loadSaved);
  const [editingProfile, setEditingProfile] = useState(false);
  const [leg, setLeg] = useState(() => legFor(loadSaved(), loadSaved().stage));
  const [puzzle, setPuzzle] = useState<Puzzle>(() => newPuzzle(loadSaved().stage));
  const [value, setValue] = useState(0);
  const [checked, setChecked] = useState(false);
  const [tries, setTries] = useState(0);
  const [phase, setPhase] = useState<Phase>("solving");
  const [hintSteps, setHintSteps] = useState(0);
  const [message, setMessage] = useState("");
  const [newSticker, setNewSticker] = useState(false);
  const [bookOpen, setBookOpen] = useState(false);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(saved));
    } catch {
      /* storage unavailable — keep playing without saving */
    }
  }, [saved]);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const t = THEMES.find((x) => x.id === saved.theme) ?? THEMES[0];
  const stage = STAGES.find((s) => s.id === saved.stage) ?? STAGES[0];
  const stations = STATIONS[t.id];
  const done = Math.min(saved.stations[stage.id] ?? 0, JOURNEY);
  const steps = useMemo(() => solvingSteps(puzzle), [puzzle]);
  const L = weight(puzzle.left, value);
  const R = weight(puzzle.right, value);
  const level = L === R;
  const big = puzzle.max > 15;
  const showTilt = !saved.holdUntilCheck || checked || phase !== "solving";
  const tilt = !showTilt || level ? 0 : -Math.sign(L - R) * Math.min(12, 3 + Math.abs(L - R) * 0.8);
  const nextStage = STAGES.find((s) => s.id === stage.id + 1);
  const name = saved.profile?.name;

  function startPuzzle(stageId: number, legIndex: number, prev?: Puzzle) {
    window.clearTimeout(timer.current);
    setLeg(legIndex);
    setPuzzle(newPuzzle(stageId, prev));
    setValue(0);
    setChecked(false);
    setTries(0);
    setPhase("solving");
    setHintSteps(0);
    setMessage("");
    setNewSticker(false);
  }

  function pickStage(id: number) {
    setSaved((s) => ({ ...s, stage: id }));
    startPuzzle(id, legFor(saved, id));
  }

  function saveProfile(p: Profile, theme: ThemeId) {
    const ageChanged = p.age !== saved.profile?.age;
    const startStage = AGE_GROUPS.find((a) => a.id === p.age)?.startStage ?? 1;
    const stageId = ageChanged ? startStage : saved.stage;
    setSaved((s) => ({ ...s, profile: p, theme, stage: stageId }));
    setEditingProfile(false);
    if (ageChanged) startPuzzle(stageId, legFor(saved, stageId));
  }

  function change(delta: number) {
    if (phase !== "solving") return;
    setValue((v) => Math.min(puzzle.max, Math.max(0, v + delta)));
    setChecked(false);
    setMessage("");
  }

  function check() {
    if (phase !== "solving") return;
    setChecked(true);
    if (level) {
      const count = leg + 1;
      const key = stickerKey(stage.id, t.id);
      const finished = count >= JOURNEY;
      const fresh = finished && !saved.stickers.includes(key);
      setNewSticker(fresh);
      setPhase("crossing");
      setMessage(`Level! The ${t.crosser} is on its way to ${stations[count]}.`);
      setSaved((s) => ({
        ...s,
        stations: { ...s.stations, [stage.id]: count },
        crossed: { ...s.crossed, [stage.id]: (s.crossed[stage.id] ?? 0) + 1 },
        stickers: fresh ? [...s.stickers, key] : s.stickers,
      }));
      timer.current = window.setTimeout(
        () => {
          setPhase(finished ? "levelup" : "solved");
          setMessage(
            finished
              ? `${name ? `${name}, you` : "You"} reached ${stations[JOURNEY]}: 10 sums done!`
              : `Arrived at ${stations[count]}. □ = ${value}, both sides weigh ${L}.`,
          );
        },
        prefersReducedMotion() ? 50 : 2500,
      );
      return;
    }
    const n = tries + 1;
    setTries(n);
    const heavier = L > R ? "left" : "right";
    let text = `Good test. Now we know □ is not ${value}. The ${heavier} side is heavier: left weighs ${L}, right weighs ${R}.`;
    if (n >= 2) {
      const slope = puzzle.left.boxes - puzzle.right.boxes;
      text += (L - R) * slope < 0 ? " Try a bigger number." : " Try a smaller number.";
    }
    setMessage(text);
  }

  function nextLeg() {
    startPuzzle(stage.id, leg + 1, puzzle);
  }

  function goToLevel(id: number) {
    // The finished journey starts again from its first station next time.
    setSaved((s) => ({ ...s, stage: id, stations: { ...s.stations, [stage.id]: 0 } }));
    startPuzzle(id, id === stage.id ? 0 : legFor(saved, id), puzzle);
  }

  if (!saved.profile || editingProfile) {
    return (
      <ProfileScreen
        initial={saved.profile}
        theme={saved.theme}
        onSave={saveProfile}
        onCancel={saved.profile ? () => setEditingProfile(false) : undefined}
      />
    );
  }

  const fromName = stations[leg];
  const toName = stations[Math.min(leg + 1, JOURNEY)];
  const tiltWord = !showTilt ? "is held still until you check" : level ? "is level" : tilt < 0 ? "tips down on the left" : "tips down on the right";

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-5 sm:px-6">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div role="group" aria-label="World" className="flex flex-wrap gap-2">
          {THEMES.map((th) => (
            <button
              key={th.id}
              type="button"
              aria-pressed={th.id === t.id}
              disabled={phase === "crossing"}
              onClick={() => setSaved((s) => ({ ...s, theme: th.id }))}
              className={cn(
                "flex h-11 items-center gap-2 rounded-full border px-3 pr-4 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-60",
                th.id === t.id ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:bg-accent",
              )}
            >
              <svg viewBox="-50 -60 100 66" className="h-6 w-9 rounded-sm" aria-hidden="true">
                <rect x={-50} y={-60} width={100} height={66} fill={th.sky} />
                <Crosser theme={th.id} />
              </svg>
              {th.label}
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Button variant="outline" className="h-11 gap-2" onClick={() => setBookOpen(true)}>
            <Star className="fill-current text-amber-700 dark:text-amber-400" aria-hidden="true" />
            Stickers <span className="tabular-nums">{saved.stickers.length}</span>
          </Button>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="h-11 gap-2">
                <UserRound aria-hidden="true" />
                {name || "Profile"}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-80">
              <p className="font-semibold">{name || "Player"}</p>
              <p className="text-sm">Age {AGE_GROUPS.find((a) => a.id === saved.profile?.age)?.label}</p>
              <Button variant="outline" className="mt-3 w-full" onClick={() => setEditingProfile(true)}>
                Change profile
              </Button>
              <p id="move-label" className="mt-5 mb-3 text-sm font-semibold">
                The bridge moves
              </p>
              <RadioGroup
                aria-labelledby="move-label"
                value={saved.holdUntilCheck ? "check" : "live"}
                onValueChange={(v) => {
                  setSaved((s) => ({ ...s, holdUntilCheck: v === "check" }));
                  setChecked(false);
                }}
              >
                <div className="flex items-center gap-3">
                  <RadioGroupItem value="live" id="mv-live" />
                  <Label htmlFor="mv-live">While I change the number</Label>
                </div>
                <div className="flex items-center gap-3">
                  <RadioGroupItem value="check" id="mv-check" />
                  <Label htmlFor="mv-check">Only when I check (think first)</Label>
                </div>
              </RadioGroup>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[250px_minmax(0,1fr)]">
        <nav aria-label="Levels" className="min-w-0">
          <h2 className="mb-2 text-sm font-semibold text-muted-foreground">Levels</h2>
          <ol className="flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible">
            {STAGES.map((s) => {
              const on = s.id === stage.id;
              const progress = Math.min(saved.stations[s.id] ?? 0, JOURNEY);
              const got = saved.stickers.includes(stickerKey(s.id, t.id));
              return (
                <li key={s.id} className="shrink-0">
                  <button
                    type="button"
                    aria-current={on ? "step" : undefined}
                    disabled={phase === "crossing"}
                    onClick={() => pickStage(s.id)}
                    className={cn(
                      "flex w-52 items-start gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring lg:w-full",
                      on ? "border-primary bg-card ring-2 ring-primary" : "border-border bg-card hover:bg-accent",
                    )}
                  >
                    <span
                      className={cn(
                        "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full text-sm font-bold",
                        on ? "bg-primary text-primary-foreground" : "bg-muted text-foreground",
                      )}
                    >
                      {s.id}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold">{s.name}</span>
                      <span className="block font-mono text-xs text-foreground">{s.skill}</span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">
                        Age {s.ages}
                        {progress > 0 && progress < JOURNEY && ` · ${progress}/${JOURNEY} stations`}
                      </span>
                    </span>
                    {got && <Star className="mt-1 size-4 shrink-0 fill-amber-500 text-amber-700" aria-label={`${t.label} sticker collected`} />}
                  </button>
                </li>
              );
            })}
          </ol>
        </nav>

        <section id="bridge-work" tabIndex={-1} aria-labelledby="puzzle-heading" className="min-w-0 outline-none">
          <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
            <h1 id="puzzle-heading" className="text-2xl font-semibold tracking-tight">
              Level {stage.id}: {stage.name}
            </h1>
            <p className="text-base">
              <span className="font-semibold">{fromName}</span>
              <span aria-hidden="true"> → </span>
              <span className="sr-only"> to </span>
              <span className="font-semibold">{toName}</span>
            </p>
          </div>

          <JourneyStrip stations={stations} done={done} leg={leg} crossing={phase !== "solving"} />

          <figure className="mt-3 overflow-hidden rounded-2xl border border-border">
            <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-labelledby="scene-title scene-desc">
              <title id="scene-title">{`Bridge from ${fromName} to ${toName}`}</title>
              <desc id="scene-desc">
                Left side: {sideText(puzzle.left)}. Right side: {sideText(puzzle.right)}. The box is set to {value}. The bridge {tiltWord}.
              </desc>
              <Scenery t={t} />
              <StationSign x={8} label={fromName} />
              <StationSign x={W - 8} label={toName} anchor="end" />
              <path d={`M${PIVOT.x} 244 L${PIVOT.x - 44} 330 L${PIVOT.x + 44} 330 Z`} fill={t.beam} stroke="#00000033" strokeWidth={2} />
              <text x={PIVOT.x} y={308} textAnchor="middle" fontSize={30} fontWeight={800} fill="#ffffff">
                =
              </text>
              {!showTilt && (
                <g>
                  {[118, 666].map((sx) => (
                    <rect key={sx} x={sx} y={244} width={16} height={86} rx={3} fill="#e5e7eb" stroke="#4b5563" strokeWidth={2} strokeDasharray="6 4" />
                  ))}
                </g>
              )}
              <g
                style={{ transform: `rotate(${tilt}deg)`, transformOrigin: `${PIVOT.x}px ${PIVOT.y}px` }}
                className="transition-transform duration-700 ease-out motion-reduce:transition-none"
              >
                <rect x={100} y={TOP} width={600} height={14} rx={4} fill={t.beam} />
                <line x1={104} x2={696} y1={TOP + 4} y2={TOP + 4} stroke={t.beamLine} strokeWidth={2} />
                {Array.from({ length: 12 }, (_, i) => (
                  <line key={i} x1={110 + i * 50} x2={130 + i * 50} y1={TOP + 14} y2={TOP + 4} stroke={t.beamLine} strokeOpacity={0.6} strokeWidth={2} />
                ))}
                <SidePile side={puzzle.left} value={value} theme={t.id} t={t} centerX={255} />
                <SidePile side={puzzle.right} value={value} theme={t.id} t={t} centerX={545} />
              </g>
              <g
                style={{ transform: `translate(${phase === "solving" ? 48 : 752}px, ${TOP}px)` }}
                className={cn(phase !== "solving" && "transition-transform duration-[2400ms] ease-in-out motion-reduce:transition-none")}
              >
                <Crosser theme={t.id} />
              </g>
            </svg>
            <figcaption className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2 border-t border-border bg-card px-4 py-4 text-2xl font-semibold sm:text-3xl">
              <Equation side={puzzle.left} value={value} />
              <span aria-hidden="true">=</span>
              <span className="sr-only">equals</span>
              <Equation side={puzzle.right} value={value} />
            </figcaption>
          </figure>

          {phase === "solving" && (
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2" role="group" aria-label="Value of the box">
                {big && (
                  <Button variant="outline" className="h-14 px-4 text-base" onClick={() => change(-5)} aria-label="Five less">
                    −5
                  </Button>
                )}
                <Button variant="outline" className="size-14" onClick={() => change(-1)} aria-label="One less" disabled={value <= 0}>
                  <Minus className="size-6" aria-hidden="true" />
                </Button>
                <output
                  aria-live="polite"
                  aria-label={`Box value ${value}`}
                  className="flex h-14 min-w-20 items-center justify-center rounded-xl border-2 px-3 text-3xl font-bold tabular-nums"
                  style={{ borderColor: t.box }}
                >
                  {value}
                </output>
                <Button variant="outline" className="size-14" onClick={() => change(1)} aria-label="One more" disabled={value >= puzzle.max}>
                  <Plus className="size-6" aria-hidden="true" />
                </Button>
                {big && (
                  <Button variant="outline" className="h-14 px-4 text-base" onClick={() => change(5)} aria-label="Five more">
                    +5
                  </Button>
                )}
              </div>
              <Button className="h-14 gap-2 px-6 text-base" onClick={check}>
                <Check className="size-5" aria-hidden="true" />
                {t.send}
              </Button>
              <Button variant="ghost" className="h-14 gap-2 text-base" onClick={() => setHintSteps((h) => Math.min(steps.length, h + 1))} disabled={hintSteps >= steps.length}>
                <Lightbulb className="size-5" aria-hidden="true" />
                {hintSteps === 0 ? "Show me a way" : "Next step"}
              </Button>
            </div>
          )}

          <p aria-live="polite" className="mt-4 min-h-7 text-lg">
            {message}
          </p>

          {phase === "solving" && hintSteps > 0 && (
            <ol className="mt-2 list-decimal space-y-1.5 rounded-xl border border-border bg-card p-4 pl-9 text-base">
              {steps.slice(0, hintSteps).map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ol>
          )}

          {phase === "levelup" && (
            <div className="mt-2 flex flex-col items-center gap-4 rounded-2xl border-2 border-primary bg-card p-6 text-center sm:flex-row sm:text-left">
              <Sticker stage={stage.id} theme={t.id} earned size={120} />
              <div className="flex-1">
                <h2 className="text-2xl font-semibold">{nextStage ? `Level up! On to level ${nextStage.id}` : "You finished the hardest level!"}</h2>
                <p className="mt-1 text-lg">
                  {newSticker
                    ? `New sticker for your book: ${t.label}, level ${stage.id}.`
                    : `You already have this sticker. Try another world to collect a new one.`}
                </p>
                <div className="mt-4 flex flex-wrap justify-center gap-3 sm:justify-start">
                  {nextStage && (
                    <Button className="h-12 px-6 text-base" onClick={() => goToLevel(nextStage.id)} autoFocus>
                      Start level {nextStage.id}: {nextStage.name}
                    </Button>
                  )}
                  <Button variant="outline" className="h-12 gap-2 px-6 text-base" onClick={() => goToLevel(stage.id)} autoFocus={!nextStage}>
                    <RotateCcw className="size-5" aria-hidden="true" /> Ride level {stage.id} again
                  </Button>
                </div>
              </div>
            </div>
          )}

          {(phase === "solved" || phase === "levelup") && (
            <div className="mt-4 rounded-2xl border border-border bg-card p-5">
              <h2 className="text-xl font-semibold">Why it balances</h2>
              <dl className="mt-3 grid gap-2 font-mono text-lg sm:grid-cols-2">
                <div>
                  <dt className="font-sans text-sm text-muted-foreground">Left</dt>
                  <dd>{explain(puzzle.left, value)}</dd>
                </div>
                <div>
                  <dt className="font-sans text-sm text-muted-foreground">Right</dt>
                  <dd>{explain(puzzle.right, value)}</dd>
                </div>
              </dl>
              <h3 className="mt-4 font-semibold">One way to solve it</h3>
              <ol className="mt-1 list-decimal space-y-1 pl-6">
                {steps.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ol>
              {phase === "solved" && (
                <Button className="mt-5 h-12 px-6 text-base" onClick={nextLeg} autoFocus>
                  On to {stations[Math.min(leg + 2, JOURNEY)]}
                </Button>
              )}
            </div>
          )}
        </section>
      </div>

      <Dialog open={bookOpen} onOpenChange={setBookOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{name ? `${name}'s sticker book` : "Sticker book"}</DialogTitle>
            <DialogDescription>
              {saved.stickers.length} of {STAGES.length * THEMES.length} collected
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-5">
            {THEMES.map((th) => (
              <section key={th.id} aria-labelledby={`book-${th.id}`}>
                <h3 id={`book-${th.id}`} className="mb-2 font-semibold">
                  {th.label}
                </h3>
                <ul className="grid grid-cols-4 gap-2 sm:grid-cols-8">
                  {STAGES.map((s) => (
                    <li key={s.id} className="flex justify-center">
                      <Sticker stage={s.id} theme={th.id} earned={saved.stickers.includes(stickerKey(s.id, th.id))} size={68} />
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function legFor(s: Saved, stageId: number) {
  const n = s.stations[stageId] ?? 0;
  return n >= JOURNEY ? 0 : n;
}

function StationSign({ x, label, anchor = "start" }: { x: number; label: string; anchor?: "start" | "end" }) {
  const w = Math.max(90, label.length * 9.5 + 20);
  const left = anchor === "start" ? x : x - w;
  return (
    <g>
      <rect x={left} y={10} width={w} height={34} rx={8} fill="#ffffff" fillOpacity={0.92} stroke="#1f2937" strokeWidth={2} />
      <text x={left + w / 2} y={33} textAnchor="middle" fontSize={17} fontWeight={700} fill="#111827">
        {label}
      </text>
    </g>
  );
}

function JourneyStrip({ stations, done, leg, crossing }: { stations: string[]; done: number; leg: number; crossing: boolean }) {
  return (
    <div>
      <p id="journey-label" className="sr-only">
        Journey: {done} of {JOURNEY} sums done.
      </p>
      <ol aria-labelledby="journey-label" className="flex items-center">
        {stations.map((st, i) => {
          const reached = i <= done;
          const here = i === (crossing ? leg + 1 : leg);
          return (
            <li key={st} className="flex flex-1 items-center last:flex-none">
              <span
                title={st}
                aria-label={`${st}${here ? ", you are here" : reached ? ", reached" : ""}`}
                aria-current={here ? "step" : undefined}
                className={cn(
                  "flex shrink-0 items-center justify-center rounded-full border-2 transition-all",
                  here ? "size-7 border-primary bg-primary text-primary-foreground" : reached ? "size-4 border-primary bg-primary" : "size-4 border-foreground/40 bg-background",
                  i === stations.length - 1 && !here && "size-5 rounded-md",
                )}
              >
                {here && <Star className="size-3.5 fill-current" aria-hidden="true" />}
              </span>
              {i < stations.length - 1 && <span aria-hidden="true" className={cn("h-1 flex-1", i < done ? "bg-primary" : "bg-foreground/20")} />}
            </li>
          );
        })}
      </ol>
      <p className="mt-1 text-sm text-muted-foreground">
        {done} of {JOURNEY} sums to {stations[JOURNEY]}
      </p>
    </div>
  );
}

function explain(s: Side, x: number): string {
  const parts: string[] = [];
  if (s.boxes === 1) parts.push(String(x));
  if (s.boxes > 1) parts.push(`${s.boxes} × ${x}`);
  for (const g of s.groups) parts.push(String(g));
  const text = parts.join(" + ") || "0";
  const total = weight(s, x);
  return parts.length > 1 || s.boxes > 1 ? `${text} = ${total}` : text;
}

function Equation({ side, value }: { side: Side; value: number }) {
  const parts: ReactElement[] = [];
  const chip = (key: string) => (
    <span key={key} className="inline-flex min-w-11 items-center justify-center rounded-lg border-2 border-primary bg-background px-2 tabular-nums">
      <span className="sr-only">box, set to </span>
      {value}
    </span>
  );
  if (side.boxes === 1) parts.push(chip("b"));
  if (side.boxes > 1)
    parts.push(
      <span key="b" className="inline-flex items-center gap-2">
        {side.boxes} <span aria-hidden="true">×</span>
        <span className="sr-only">times</span> {chip("bx")}
      </span>,
    );
  side.groups.forEach((g, i) => parts.push(<span key={`g${i}`}>{g}</span>));
  if (parts.length === 0) parts.push(<span key="z">{sum([])}</span>);
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      {parts.flatMap((p, i) => (i === 0 ? [p] : [<span key={`p${i}`} aria-hidden="true">+</span>, <span key={`ps${i}`} className="sr-only">plus</span>, p]))}
    </span>
  );
}
