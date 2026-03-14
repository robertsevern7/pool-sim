import { useReducer, useRef, useCallback, useEffect } from "react";
import type { BallState } from "../engine/physics/ball-state";
import { STANDARD_9_FOOT } from "../engine/physics/constants";
import { recordSimulation, Frame } from "../engine/physics/recorder";

type Mode = "preview" | "playing" | "done";

interface GameState {
  mode: Mode;
  initialBalls: BallState[];
  frames: Frame[];
  frameIndex: number;
}

type Action =
  | { type: "LOAD_SCENARIO"; balls: BallState[] }
  | { type: "SHOOT" }
  | { type: "TICK" }
  | { type: "RESET" };

function reducer(state: GameState, action: Action): GameState {
  switch (action.type) {
    case "LOAD_SCENARIO":
      return {
        mode: "preview",
        initialBalls: action.balls,
        frames: [],
        frameIndex: 0,
      };

    case "SHOOT": {
      if (state.mode !== "preview" || state.initialBalls.length === 0) return state;
      const frames = recordSimulation(state.initialBalls, STANDARD_9_FOOT);
      return {
        ...state,
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
      return {
        ...state,
        mode: "preview",
        frames: [],
        frameIndex: 0,
      };
  }
}

const INITIAL_STATE: GameState = {
  mode: "preview",
  initialBalls: [],
  frames: [],
  frameIndex: 0,
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
  const reset = useCallback(() => dispatch({ type: "RESET" }), []);

  // Current ball positions: during playback use frames, otherwise use initial positions
  const currentBalls =
    state.frames.length > 0 && state.frameIndex < state.frames.length
      ? state.frames[state.frameIndex].balls
      : state.initialBalls.map((b) => ({ pos: b.pos, motion: b.motion }));

  return {
    mode: state.mode,
    balls: currentBalls,
    shoot,
    reset,
  };
}
