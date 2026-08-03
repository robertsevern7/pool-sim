import {
  createContext,
  useContext,
  useReducer,
  useRef,
  useCallback,
  useEffect,
  type ReactNode,
} from "react";
import { BallState } from "../engine/physics/ball-state";
import { SPIN_MARKER_REST, Vec3 } from "../engine/physics/orientation";
import { Trajectory } from "../engine/physics/recorder";
import { Vec2 } from "../engine/physics/vec2";
import type { GameRules } from "../engine/rules";
import {
  reducer,
  INITIAL_STATE,
  type Mode,
} from "../engine/game-reducer";

export {
  FINE_AIM_STEP,
  COARSE_AIM_STEP,
  MAX_POWER,
} from "../engine/game-reducer";

// ── Types ────────────────────────────────────────────────────────────

/** Lightweight ball info for thumbnails */
export interface SnapshotBall {
  pos: Vec2;
  number: number;
}

/** Public game state exposed via context */
export interface GameState {
  mode: Mode;
  balls: { pos: Vec2; motion: number; number: number; point: Vec3; sideSpinAngle: number; rollPhase: number }[];
  trajectories: Trajectory[];
  trajectoryBallNumbers: number[];
  targetBallIndex: number | null;
  power: number;
  spin: number;
  sidespin: number;
  shotsTaken: number;
  rules: GameRules;
  /** Snapshots for the shot history carousel */
  shotSnapshots: { balls: SnapshotBall[] }[];
  /** The current/tip state snapshot (shown as "Latest" in carousel) */
  latestSnapshot: { balls: SnapshotBall[] } | null;
  canReplay: boolean;
  isReplaying: boolean;
}

/** Dispatch functions exposed via context */
export interface GameDispatch {
  shoot: () => void;
  setTarget: (ballIndex: number) => void;
  aimAtPoint: (point: Vec2) => void;
  adjustAngle: (delta: number) => void;
  setPower: (power: number) => void;
  setTipOffset: (spin: number, sidespin: number) => void;
  placeCue: (pos: Vec2) => void;
  moveCue: (pos: Vec2) => void;
  finishMoveCue: () => void;
  restoreToShot: (shotIndex: number) => void;
  restoreToLatest: () => void;
  replay: () => void;
}

// ── Contexts ─────────────────────────────────────────────────────────

const GameStateContext = createContext<GameState | null>(null);
const GameDispatchContext = createContext<GameDispatch | null>(null);

// ── Provider ─────────────────────────────────────────────────────────

interface GameProviderProps {
  initialBalls: BallState[];
  placeCue?: boolean;
  children: ReactNode;
}

export function GameProvider({ initialBalls, placeCue, children }: GameProviderProps) {
  const [state, dispatch] = useReducer(reducer, INITIAL_STATE);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (initialBalls.length > 0) {
      dispatch({ type: "LOAD_SCENARIO", balls: initialBalls, placeCue });
    }
  }, [initialBalls, placeCue]);

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
      : state.initialBalls.map((b) => ({ pos: b.pos, motion: b.motion, number: b.number, point: SPIN_MARKER_REST, sideSpinAngle: 0, rollPhase: 0 }));

  const gameState: GameState = {
    mode: state.mode,
    balls: currentBalls,
    trajectories: state.trajectories,
    trajectoryBallNumbers: state.initialBalls.map((b) => b.number),
    targetBallIndex: state.targetBallIndex,
    power: state.power,
    spin: state.cueSpin,
    sidespin: state.cueSidespin,
    shotsTaken: state.shotsTaken,
    rules: state.rules,
    shotSnapshots: state.shotHistory.map((s) => ({
      balls: s.initialBalls.map((b) => ({ pos: b.pos, number: b.number })),
    })),
    latestSnapshot: state.latestBalls.length > 0
      ? { balls: state.latestBalls.map((b) => ({ pos: b.pos, number: b.number })) }
      : null,
    canReplay: state.shotHistory.length > 0,
    isReplaying: state.replayQueue !== null,
  };

  const gameDispatch: GameDispatch = {
    shoot: useCallback(() => dispatch({ type: "SHOOT" }), []),
    setTarget: useCallback((ballIndex: number) => dispatch({ type: "SET_TARGET", ballIndex }), []),
    aimAtPoint: useCallback((point: Vec2) => dispatch({ type: "AIM_AT_POINT", point }), []),
    adjustAngle: useCallback((delta: number) => dispatch({ type: "ADJUST_ANGLE", delta }), []),
    setPower: useCallback((power: number) => dispatch({ type: "SET_POWER", power }), []),
    setTipOffset: useCallback(
      (spin: number, sidespin: number) => dispatch({ type: "SET_TIP_OFFSET", spin, sidespin }),
      [],
    ),
    placeCue: useCallback((pos: Vec2) => dispatch({ type: "PLACE_CUE", pos }), []),
    moveCue: useCallback((pos: Vec2) => dispatch({ type: "MOVE_CUE", pos }), []),
    finishMoveCue: useCallback(() => dispatch({ type: "FINISH_MOVE_CUE" }), []),
    restoreToShot: useCallback((shotIndex: number) => dispatch({ type: "RESTORE_TO_SHOT", shotIndex }), []),
    restoreToLatest: useCallback(() => dispatch({ type: "RESTORE_TO_LATEST" }), []),
    replay: useCallback(() => dispatch({ type: "REPLAY" }), []),
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
