import { useReducer, useRef, useCallback, useEffect } from "react";
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

type Mode = "preview" | "playing" | "done";

export const FINE_AIM_STEP = 0.02 * (Math.PI / 180);
export const COARSE_AIM_STEP = 2.0 * (Math.PI / 180);

interface GameState {
  mode: Mode;
  initialBalls: BallState[];
  /** Cue ball speed from original scenario (preserved during aiming) */
  cueSpeed: number;
  /** Cue ball spin from original scenario */
  cueSpin: number;
  /** Index of the targeted object ball (1-based, null = no target) */
  targetBallIndex: number | null;
  /** Fine-tune angle offset in radians */
  aimAngleOffset: number;
  frames: Frame[];
  frameIndex: number;
  trajectories: Trajectory[];
}

type Action =
  | { type: "LOAD_SCENARIO"; balls: BallState[] }
  | { type: "SET_TARGET"; ballIndex: number }
  | { type: "ADJUST_ANGLE"; delta: number }
  | { type: "SHOOT" }
  | { type: "TICK" }
  | { type: "RESET" };

function extractCueParams(cueBall: BallState): { speed: number; spin: number } {
  const speed = norm(cueBall.vel);
  const omega = cueBall.omega;
  return { speed, spin: speed > 0 ? omega / (MAX_CUE_SPIN * speed) : 0 };
}

function buildAimedBalls(state: GameState): BallState[] {
  const cueBall = state.initialBalls[0];
  if (!cueBall) return state.initialBalls;

  // Base direction: toward target ball, or the original cue velocity direction
  let dir: Vec2;
  if (state.targetBallIndex !== null) {
    const targetBall = state.initialBalls[state.targetBallIndex];
    if (!targetBall) return state.initialBalls;
    dir = normalize(sub(targetBall.pos, cueBall.pos));
  } else {
    const speed = norm(cueBall.vel);
    if (speed > 0) {
      dir = normalize(cueBall.vel);
    } else {
      // Stopped cue ball with no target — aim right by default
      dir = [1, 0];
    }
  }

  // Apply angle offset (rotate direction)
  const cos = Math.cos(state.aimAngleOffset);
  const sin = Math.sin(state.aimAngleOffset);
  const rotated: Vec2 = [
    dir[0] * cos - dir[1] * sin,
    dir[0] * sin + dir[1] * cos,
  ];

  const newCue = cueStrike(cueBall.pos, rotated, state.cueSpeed, state.cueSpin);
  return [newCue, ...state.initialBalls.slice(1)];
}

function recomputeSimulation(state: GameState): GameState {
  const balls = buildAimedBalls(state);
  const frames = recordSimulation(balls, STANDARD_9_FOOT);
  const trajectories = recordTrajectories(balls, STANDARD_9_FOOT);
  return { ...state, frames, frameIndex: 0, trajectories };
}

/** Build a preview state from final frame positions (no trajectories yet). */
function previewFromFinalPositions(state: GameState): GameState {
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
    cueSpeed: state.cueSpeed,
    cueSpin: state.cueSpin,
    targetBallIndex: newBalls.length > 1 ? 1 : null,
    aimAngleOffset: 0,
    frames: [],
    frameIndex: 0,
    trajectories: [],
  };
}

function reducer(state: GameState, action: Action): GameState {
  switch (action.type) {
    case "LOAD_SCENARIO": {
      const { speed, spin } = extractCueParams(action.balls[0]);
      const frames = recordSimulation(action.balls, STANDARD_9_FOOT);
      const trajectories = recordTrajectories(action.balls, STANDARD_9_FOOT);
      return {
        mode: "preview",
        initialBalls: action.balls,
        cueSpeed: speed,
        cueSpin: spin,
        targetBallIndex: null,
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

const INITIAL_STATE: GameState = {
  mode: "preview",
  initialBalls: [],
  cueSpeed: 0,
  cueSpin: 0,
  targetBallIndex: null,
  aimAngleOffset: 0,
  frames: [],
  frameIndex: 0,
  trajectories: [],
};

export function useGameState(initialBalls: BallState[]) {
  const [state, dispatch] = useReducer(reducer, INITIAL_STATE);
  const rafRef = useRef<number | null>(null);

  // Load scenario when balls change
  useEffect(() => {
    if (initialBalls.length > 0) {
      dispatch({ type: "LOAD_SCENARIO", balls: initialBalls });
    }
  }, [initialBalls]);

  // Animation loop
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

  const shoot = useCallback(() => dispatch({ type: "SHOOT" }), []);
  const setTarget = useCallback(
    (ballIndex: number) => dispatch({ type: "SET_TARGET", ballIndex }),
    [],
  );
  const adjustAngle = useCallback(
    (delta: number) => dispatch({ type: "ADJUST_ANGLE", delta }),
    [],
  );

  // Current ball positions: during playback use frames, otherwise use initial positions
  const currentBalls =
    state.frames.length > 0 && state.frameIndex < state.frames.length
      ? state.frames[state.frameIndex].balls
      : state.initialBalls.map((b) => ({ pos: b.pos, motion: b.motion }));

  return {
    mode: state.mode,
    balls: currentBalls,
    trajectories: state.trajectories,
    targetBallIndex: state.targetBallIndex,
    shoot,
    setTarget,
    adjustAngle,
  };
}
