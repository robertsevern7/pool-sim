import { BallState, MotionState } from "./physics/ball-state";
import { BALL_RADIUS, STANDARD_9_FOOT } from "./physics/constants";
import { cueStrike } from "./physics/motion-models";
import { strings, ScenarioId } from "../constants/strings";

const TABLE = STANDARD_9_FOOT;
const R = BALL_RADIUS;
const CY = TABLE.height / 2;

export function obj(pos: [number, number], ballNumber: number): BallState {
  return new BallState(pos, [0, 0], 0, MotionState.STOPPED, ballNumber);
}

export interface Scenario {
  id: ScenarioId;
  name: string;
  description: string;
  createBalls: () => BallState[];
  /** If true, user must place the cue ball before playing */
  placeCue?: boolean;
}

export function scenario(
  id: ScenarioId,
  createBalls: () => BallState[],
  options?: { placeCue?: boolean },
): Scenario {
  const { name, description } = strings.scenarios[id];
  return { id, name, description, createBalls, ...options };
}

// ── Standard 8-ball rack ─────────────────────────────────────────────

/** Random offset simulating imperfect rack — ±JITTER meters per ball */
const RACK_JITTER = 0.0005; // 0.5mm

function jitter(): number {
  return (Math.random() - 0.5) * 2 * RACK_JITTER;
}

function createRack(): BallState[] {
  const footSpot: [number, number] = [TABLE.width * 3 / 4, CY];
  const rowGap = R * Math.sqrt(3);

  const rows: number[][] = [
    [1],
    [10, 2],
    [3, 8, 11],
    [12, 4, 5, 13],
    [6, 14, 9, 7, 15],
  ];

  const balls: BallState[] = [];
  for (let row = 0; row < rows.length; row++) {
    const count = rows[row].length;
    const x = footSpot[0] + row * rowGap;
    const startY = footSpot[1] - (count - 1) * R;
    for (let col = 0; col < count; col++) {
      const y = startY + col * R * 2;
      balls.push(obj([x + jitter(), y + jitter()], rows[row][col]));
    }
  }
  return balls;
}

// ── User scenarios ───────────────────────────────────────────────────

// Free play is accessed directly from the home screen, not listed in the scenarios grid
export const FREE_PLAY = scenario("free_play", () => {
  const baulkX = TABLE.width / 4;
  const rack = createRack();
  const apex = rack[0];
  const dx = apex.pos[0] - baulkX;
  const dy = apex.pos[1] - CY;
  const len = Math.sqrt(dx * dx + dy * dy);
  const cue = cueStrike([baulkX, CY], [dx / len, dy / len], 4.0, 0.15);
  return [cue, ...rack];
});

/** Scenarios shown in the scenarios grid */
export const SCENARIOS: Scenario[] = [
  scenario("random", () => {
    const margin = R * 3;
    const minDist = R * 2.5;
    const positions: [number, number][] = [];

    // Place 15 object balls randomly, rejecting overlaps
    while (positions.length < 15) {
      const x = margin + Math.random() * (TABLE.width - 2 * margin);
      const y = margin + Math.random() * (TABLE.height - 2 * margin);
      const tooClose = positions.some(
        (p) => Math.sqrt((p[0] - x) ** 2 + (p[1] - y) ** 2) < minDist,
      );
      if (!tooClose) positions.push([x, y]);
    }

    return positions.map((pos, i) => obj(pos, i + 1));
  }, { placeCue: true }),
];
