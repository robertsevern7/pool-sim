import {
  createContext,
  useContext,
  useReducer,
  useRef,
  useCallback,
  useEffect,
  type ReactNode,
} from "react";
import { BallState, MotionState } from "../engine/physics/ball-state";
import { STANDARD_9_FOOT, MAX_CUE_SPIN } from "../engine/physics/constants";
import {
  recordSimulation,
  recordTrajectories,
  Frame,
  Trajectory,
} from "../engine/physics/recorder";
import { cueStrike } from "../engine/physics/motion-models";
import { Vec2, norm, normalize, sub } from "../engine/physics/vec2";

// ── Constants ────────────────────────────────────────────────────────

export const FINE_AIM_STEP = 0.02 * (Math.PI / 180);
export const COARSE_AIM_STEP = 2.0 * (Math.PI / 180);
export const MAX_POWER = 5.0; // m/s

// ── Types ────────────────────────────────────────────────────────────

type Mode = "preview" | "playing" | "done";

interface InternalState {
  mode: Mode;
  initialBalls: BallState[];
  cueSpin: number;
  power: number;
  targetBallIndex: number | null;
  aimDirection: Vec2 | null;
  aimAngleOffset: number;
  frames: Frame[];
  frameIndex: number;
  trajectories: Trajectory[];
}

/** Public game state exposed via context */
export interface GameState {
  mode: Mode;
  balls: { pos: Vec2; motion: number }[];
  trajectories: Trajectory[];
  targetBallIndex: number | null;
  power: number;
  spin: number;
}

/** Dispatch functions exposed via context */
export interface GameDispatch {
  shoot: () => void;
  setTarget: (ballIndex: number) => void;
  aimAtPoint: (point: Vec2) => void;
  adjustAngle: (delta: number) => void;
  setPower: (power: number) => void;
  setSpin: (spin: number) => void;
}

// ── Contexts ─────────────────────────────────────────────────────────

const GameStateContext = createContext<GameState | null>(null);
const GameDispatchContext = createContext<GameDispatch | null>(null);

// ── Reducer ──────────────────────────────────────────────────────────

type Action =
  | { type: "LOAD_SCENARIO"; balls: BallState[] }
  | { type: "SET_TARGET"; ballIndex: number }
  | { type: "AIM_AT_POINT"; point: Vec2 }
  | { type: "ADJUST_ANGLE"; delta: number }
  | { type: "SET_POWER"; power: number }
  | { type: "SET_SPIN"; spin: number }
  | { type: "SHOOT" }
  | { type: "TICK" }
  | { type: "RESET" };

function extractCueParams(cueBall: BallState): { speed: number; spin: number } {
  const speed = norm(cueBall.vel);
  const omega = cueBall.omega;
  return { speed, spin: speed > 0 ? omega / (MAX_CUE_SPIN * speed) : 0 };
}

function buildAimedBalls(state: InternalState): BallState[] {
  const cueBall = state.initialBalls[0];
  if (!cueBall) return state.initialBalls;

  let dir: Vec2;
  if (state.aimDirection !== null) {
    dir = state.aimDirection;
  } else if (state.targetBallIndex !== null) {
    const targetBall = state.initialBalls[state.targetBallIndex];
    if (!targetBall) return state.initialBalls;
    dir = normalize(sub(targetBall.pos, cueBall.pos));
  } else {
    const speed = norm(cueBall.vel);
    if (speed > 0) {
      dir = normalize(cueBall.vel);
    } else {
      dir = [1, 0];
    }
  }

  const cos = Math.cos(state.aimAngleOffset);
  const sin = Math.sin(state.aimAngleOffset);
  const rotated: Vec2 = [
    dir[0] * cos - dir[1] * sin,
    dir[0] * sin + dir[1] * cos,
  ];

  const newCue = cueStrike(cueBall.pos, rotated, state.power, state.cueSpin);
  return [newCue, ...state.initialBalls.slice(1)];
}

function recomputeSimulation(state: InternalState): InternalState {
  const balls = buildAimedBalls(state);
  const frames = recordSimulation(balls, STANDARD_9_FOOT);
  const trajectories = recordTrajectories(balls, STANDARD_9_FOOT);
  return { ...state, frames, frameIndex: 0, trajectories };
}

function previewFromFinalPositions(state: InternalState): InternalState {
  const finalFrame = state.frames.length > 0
    ? state.frames[state.frames.length - 1]
    : null;

  if (!finalFrame || finalFrame.balls.length === 0) return state;

  const newBalls = finalFrame.balls.map(
    (b) => new BallState(
      b.pos as [number, number],
      [0, 0],
      0,
      MotionState.STOPPED,
    ),
  );

  return {
    mode: "preview",
    initialBalls: newBalls,
    cueSpin: state.cueSpin,
    power: state.power,
    targetBallIndex: newBalls.length > 1 ? 1 : null,
    aimDirection: null,
    aimAngleOffset: 0,
    frames: [],
    frameIndex: 0,
    trajectories: [],
  };
}

function reducer(state: InternalState, action: Action): InternalState {
  switch (action.type) {
    case "LOAD_SCENARIO": {
      const { speed, spin } = extractCueParams(action.balls[0]);
      const frames = recordSimulation(action.balls, STANDARD_9_FOOT);
      const trajectories = recordTrajectories(action.balls, STANDARD_9_FOOT);
      return {
        mode: "preview",
        initialBalls: action.balls,
        cueSpin: spin,
        power: speed,
        targetBallIndex: null,
        aimDirection: null,
        aimAngleOffset: 0,
        frames,
        frameIndex: 0,
        trajectories,
      };
    }

    case "SET_TARGET": {
      let base = state;
      if (state.mode === "done") base = previewFromFinalPositions(state);
      if (base.mode !== "preview") return state;
      if (action.ballIndex < 1 || action.ballIndex >= base.initialBalls.length) return state;
      return recomputeSimulation({
        ...base,
        targetBallIndex: action.ballIndex,
        aimDirection: null,
        aimAngleOffset: 0,
      });
    }

    case "AIM_AT_POINT": {
      let base = state;
      if (state.mode === "done") base = previewFromFinalPositions(state);
      if (base.mode !== "preview") return state;
      const cueBall = base.initialBalls[0];
      if (!cueBall) return state;
      const diff = sub(action.point, cueBall.pos);
      if (norm(diff) < 0.001) return state;
      return recomputeSimulation({
        ...base,
        targetBallIndex: null,
        aimDirection: normalize(diff),
        aimAngleOffset: 0,
      });
    }

    case "ADJUST_ANGLE": {
      let base = state;
      if (state.mode === "done") base = previewFromFinalPositions(state);
      if (base.mode !== "preview") return state;
      return recomputeSimulation({
        ...base,
        aimAngleOffset: base.aimAngleOffset + action.delta,
      });
    }

    case "SET_POWER": {
      const power = Math.max(0.1, Math.min(MAX_POWER, action.power));
      let base = state;
      if (state.mode === "done") base = previewFromFinalPositions(state);
      if (base.mode !== "preview") return state;
      return recomputeSimulation({ ...base, power });
    }

    case "SET_SPIN": {
      const cueSpin = Math.max(-1, Math.min(1, action.spin));
      let base = state;
      if (state.mode === "done") base = previewFromFinalPositions(state);
      if (base.mode !== "preview") return state;
      return recomputeSimulation({ ...base, cueSpin });
    }

    case "SHOOT": {
      if (state.initialBalls.length === 0) return state;

      let base = state;
      if (state.mode === "done") base = previewFromFinalPositions(state);
      if (base.mode !== "preview") return state;

      const aimed = buildAimedBalls(base);
      const frames = recordSimulation(aimed, STANDARD_9_FOOT);
      return {
        ...base,
        mode: "playing",
        frames,
        frameIndex: 0,
      };
    }

    case "TICK": {
      if (state.mode !== "playing") return state;
      const next = state.frameIndex + 1;
      if (next >= state.frames.length) {
        return { ...state, mode: "done", frameIndex: state.frames.length - 1 };
      }
      return { ...state, frameIndex: next };
    }

    case "RESET":
      return previewFromFinalPositions(state);
  }
}

const INITIAL_STATE: InternalState = {
  mode: "preview",
  initialBalls: [],
  cueSpin: 0,
  power: 2.5,
  targetBallIndex: null,
  aimDirection: null,
  aimAngleOffset: 0,
  frames: [],
  frameIndex: 0,
  trajectories: [],
};

// ── Provider ─────────────────────────────────────────────────────────

interface GameProviderProps {
  initialBalls: BallState[];
  children: ReactNode;
}

export function GameProvider({ initialBalls, children }: GameProviderProps) {
  const [state, dispatch] = useReducer(reducer, INITIAL_STATE);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (initialBalls.length > 0) {
      dispatch({ type: "LOAD_SCENARIO", balls: initialBalls });
    }
  }, [initialBalls]);

  useEffect(() => {
    if (state.mode !== "playing") {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      return;
    }

    let lastTime = 0;
    const frameDuration = 1000 / 60;

    const tick = (timestamp: number) => {
      if (lastTime === 0) lastTime = timestamp;
      if (timestamp - lastTime >= frameDuration) {
        dispatch({ type: "TICK" });
        lastTime = timestamp;
      }
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [state.mode]);

  const currentBalls =
    state.frames.length > 0 && state.frameIndex < state.frames.length
      ? state.frames[state.frameIndex].balls
      : state.initialBalls.map((b) => ({ pos: b.pos, motion: b.motion }));

  const gameState: GameState = {
    mode: state.mode,
    balls: currentBalls,
    trajectories: state.trajectories,
    targetBallIndex: state.targetBallIndex,
    power: state.power,
    spin: state.cueSpin,
  };

  const gameDispatch: GameDispatch = {
    shoot: useCallback(() => dispatch({ type: "SHOOT" }), []),
    setTarget: useCallback((ballIndex: number) => dispatch({ type: "SET_TARGET", ballIndex }), []),
    aimAtPoint: useCallback((point: Vec2) => dispatch({ type: "AIM_AT_POINT", point }), []),
    adjustAngle: useCallback((delta: number) => dispatch({ type: "ADJUST_ANGLE", delta }), []),
    setPower: useCallback((power: number) => dispatch({ type: "SET_POWER", power }), []),
    setSpin: useCallback((spin: number) => dispatch({ type: "SET_SPIN", spin }), []),
  };

  return (
    <GameStateContext.Provider value={gameState}>
      <GameDispatchContext.Provider value={gameDispatch}>
        {children}
      </GameDispatchContext.Provider>
    </GameStateContext.Provider>
  );
}

// ── Hooks ────────────────────────────────────────────────────────────

export function useGame(): GameState {
  const ctx = useContext(GameStateContext);
  if (!ctx) throw new Error("useGame must be used within a GameProvider");
  return ctx;
}

export function useGameDispatch(): GameDispatch {
  const ctx = useContext(GameDispatchContext);
  if (!ctx) throw new Error("useGameDispatch must be used within a GameProvider");
  return ctx;
}
