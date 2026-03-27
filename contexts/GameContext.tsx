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
import { analyzeShot, INITIAL_RULES, type GameRules } from "../engine/rules";

// ── Constants ────────────────────────────────────────────────────────

export const FINE_AIM_STEP = 0.02 * (Math.PI / 180);
export const COARSE_AIM_STEP = 2.0 * (Math.PI / 180);
export const MAX_POWER = 5.0; // m/s

// ── Types ────────────────────────────────────────────────────────────

type Mode = "placing" | "preview" | "playing" | "done";

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
  /** Ball numbers at the start of the current shot (for rules analysis) */
  ballNumbersBeforeShot: number[];
  firstHitBallNumber: number | null;
  railHitAfterContact: boolean;
  shotsTaken: number;
  rules: GameRules;
}

/** Public game state exposed via context */
export interface GameState {
  mode: Mode;
  balls: { pos: Vec2; motion: number; number: number }[];
  trajectories: Trajectory[];
  trajectoryBallNumbers: number[];
  targetBallIndex: number | null;
  power: number;
  spin: number;
  shotsTaken: number;
  rules: GameRules;
}

/** Dispatch functions exposed via context */
export interface GameDispatch {
  shoot: () => void;
  setTarget: (ballIndex: number) => void;
  aimAtPoint: (point: Vec2) => void;
  adjustAngle: (delta: number) => void;
  setPower: (power: number) => void;
  setSpin: (spin: number) => void;
  placeCue: (pos: Vec2) => void;
  moveCue: (pos: Vec2) => void;
  finishMoveCue: () => void;
}

// ── Contexts ─────────────────────────────────────────────────────────

const GameStateContext = createContext<GameState | null>(null);
const GameDispatchContext = createContext<GameDispatch | null>(null);

// ── Reducer ──────────────────────────────────────────────────────────

type Action =
  | { type: "LOAD_SCENARIO"; balls: BallState[]; placeCue?: boolean }
  | { type: "PLACE_CUE"; pos: Vec2 }
  | { type: "MOVE_CUE"; pos: Vec2 }
  | { type: "FINISH_MOVE_CUE" }
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
  const { frames } = recordSimulation(balls, STANDARD_9_FOOT);
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
      b.number,
    ),
  );

  return {
    ...state,
    mode: "preview",
    initialBalls: newBalls,
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
      if (action.placeCue) {
        return {
          mode: "placing",
          initialBalls: action.balls,
          cueSpin: 0,
          power: 2.5,
          targetBallIndex: null,
          aimDirection: null,
          aimAngleOffset: 0,
          frames: [],
          frameIndex: 0,
          trajectories: [],
          ballNumbersBeforeShot: [],
          firstHitBallNumber: null,
          railHitAfterContact: false,
          shotsTaken: 0,
          rules: INITIAL_RULES,
        };
      }
      const { speed, spin } = extractCueParams(action.balls[0]);
      const { frames } = recordSimulation(action.balls, STANDARD_9_FOOT);
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
        ballNumbersBeforeShot: [],
        firstHitBallNumber: null,
        railHitAfterContact: false,
        shotsTaken: 0,
        rules: INITIAL_RULES,
      };
    }

    case "PLACE_CUE": {
      if (state.mode !== "placing") return state;
      const cue = new BallState(
        action.pos as [number, number],
        [0, 0], 0, MotionState.STOPPED, 0,
      );
      const newBalls = [cue, ...state.initialBalls];
      const targetIdx = newBalls.length > 1 ? 1 : null;
      return recomputeSimulation({
        ...state,
        mode: "preview",
        initialBalls: newBalls,
        targetBallIndex: targetIdx,
      });
    }

    case "MOVE_CUE": {
      if (state.mode !== "preview" && state.mode !== "done") return state;
      const cueBallIdx = state.initialBalls.findIndex((b) => b.number === 0);
      if (cueBallIdx === -1) return state;
      const updated = state.initialBalls.map((b, i) =>
        i === cueBallIdx
          ? new BallState(action.pos as [number, number], [0, 0], 0, MotionState.STOPPED, 0)
          : b,
      );
      return {
        ...state,
        mode: "preview",
        initialBalls: updated,
        frames: [],
        trajectories: [],
      };
    }

    case "FINISH_MOVE_CUE": {
      if (state.mode !== "preview") return state;
      return recomputeSimulation(state);
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
      // Don't allow shooting if game is over
      if (state.rules.result !== null) return state;

      let base = state;
      if (state.mode === "done") base = previewFromFinalPositions(state);
      if (base.mode !== "preview") return state;

      const aimed = buildAimedBalls(base);
      const ballNumbersBefore = aimed.map((b) => b.number);
      const { frames, firstHitBallNumber, railHitAfterContact } = recordSimulation(aimed, STANDARD_9_FOOT);
      return {
        ...base,
        mode: "playing",
        frames,
        frameIndex: 0,
        ballNumbersBeforeShot: ballNumbersBefore,
        firstHitBallNumber,
        railHitAfterContact,
        shotsTaken: base.shotsTaken + 1,
      };
    }

    case "TICK": {
      if (state.mode !== "playing") return state;
      const next = state.frameIndex + 1;
      if (next >= state.frames.length) {
        // Shot finished — analyze rules
        const finalFrame = state.frames[state.frames.length - 1];
        const ballNumbersAfter = finalFrame.balls.map((b) => b.number);
        const newRules = analyzeShot(
          state.ballNumbersBeforeShot,
          ballNumbersAfter,
          state.firstHitBallNumber,
          state.railHitAfterContact,
          state.rules,
        );

        const newState: InternalState = {
          ...state,
          mode: "done",
          frameIndex: state.frames.length - 1,
          rules: newRules,
        };

        // If cue ball was potted, go to placing mode
        if (newRules.cueBallPotted && newRules.result === null) {
          const finalBalls = finalFrame.balls
            .filter((b) => b.number !== 0)
            .map((b) => new BallState(
              b.pos as [number, number], [0, 0], 0, MotionState.STOPPED, b.number,
            ));
          return {
            ...newState,
            mode: "placing",
            initialBalls: finalBalls,
            frames: [],
            trajectories: [],
          };
        }

        return newState;
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
  ballNumbersBeforeShot: [],
  firstHitBallNumber: null,
  rules: INITIAL_RULES,
};

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
      : state.initialBalls.map((b) => ({ pos: b.pos, motion: b.motion, number: b.number }));

  const gameState: GameState = {
    mode: state.mode,
    balls: currentBalls,
    trajectories: state.trajectories,
    trajectoryBallNumbers: state.initialBalls.map((b) => b.number),
    targetBallIndex: state.targetBallIndex,
    power: state.power,
    spin: state.cueSpin,
    shotsTaken: state.shotsTaken,
    rules: state.rules,
  };

  const gameDispatch: GameDispatch = {
    shoot: useCallback(() => dispatch({ type: "SHOOT" }), []),
    setTarget: useCallback((ballIndex: number) => dispatch({ type: "SET_TARGET", ballIndex }), []),
    aimAtPoint: useCallback((point: Vec2) => dispatch({ type: "AIM_AT_POINT", point }), []),
    adjustAngle: useCallback((delta: number) => dispatch({ type: "ADJUST_ANGLE", delta }), []),
    setPower: useCallback((power: number) => dispatch({ type: "SET_POWER", power }), []),
    setSpin: useCallback((spin: number) => dispatch({ type: "SET_SPIN", spin }), []),
    placeCue: useCallback((pos: Vec2) => dispatch({ type: "PLACE_CUE", pos }), []),
    moveCue: useCallback((pos: Vec2) => dispatch({ type: "MOVE_CUE", pos }), []),
    finishMoveCue: useCallback(() => dispatch({ type: "FINISH_MOVE_CUE" }), []),
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
