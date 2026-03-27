import { BallState, MotionState } from "./physics/ball-state";
import { STANDARD_9_FOOT, MAX_CUE_SPIN } from "./physics/constants";
import {
  recordSimulation,
  recordTrajectories,
  Frame,
  Trajectory,
} from "./physics/recorder";
import { cueStrike } from "./physics/motion-models";
import { Vec2, norm, normalize, sub } from "./physics/vec2";
import { analyzeShot, INITIAL_RULES, type GameRules } from "./rules";

// ── Constants ────────────────────────────────────────────────────────

export const FINE_AIM_STEP = 0.02 * (Math.PI / 180);
export const COARSE_AIM_STEP = 2.0 * (Math.PI / 180);
export const MAX_POWER = 5.0; // m/s

// ── Types ────────────────────────────────────────────────────────────

export type Mode = "placing" | "preview" | "playing" | "done";

/** Snapshot saved before each shot so we can undo / replay */
export interface ShotSnapshot {
  initialBalls: BallState[];
  rules: GameRules;
  /** The shot parameters that were used (for replay) */
  power: number;
  cueSpin: number;
  targetBallIndex: number | null;
  aimDirection: Vec2 | null;
  aimAngleOffset: number;
}

export interface InternalState {
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
  /** Stack of snapshots — one per shot taken */
  shotHistory: ShotSnapshot[];
  /** If we restored to a previous shot, the index we branched from (null = at tip) */
  restoredToIndex: number | null;
  /** The tip state saved when we first branch into history browsing */
  tipSnapshot: ShotSnapshot | null;
  /** Ball positions after the most recent completed shot (for "Latest" thumbnail) */
  latestBalls: BallState[];
  /** When replaying, the queue of remaining shots to play back */
  replayQueue: ShotSnapshot[] | null;
}

export type Action =
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
  | { type: "RESET" }
  | { type: "RESTORE_TO_SHOT"; shotIndex: number }
  | { type: "RESTORE_TO_LATEST" }
  | { type: "REPLAY" };

// ── Helpers ──────────────────────────────────────────────────────────

export function extractCueParams(cueBall: BallState): { speed: number; spin: number } {
  const speed = norm(cueBall.vel);
  const omega = cueBall.omega;
  return { speed, spin: speed > 0 ? omega / (MAX_CUE_SPIN * speed) : 0 };
}

export function buildAimedBalls(state: InternalState): BallState[] {
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

export function recomputeSimulation(state: InternalState): InternalState {
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

/** Execute a shot from a snapshot (used by replay) */
function executeShot(snapshot: ShotSnapshot): {
  frames: Frame[];
  firstHitBallNumber: number | null;
  railHitAfterContact: boolean;
  ballNumbersBefore: number[];
} {
  const tempState: InternalState = {
    ...INITIAL_STATE,
    initialBalls: snapshot.initialBalls,
    rules: snapshot.rules,
    power: snapshot.power,
    cueSpin: snapshot.cueSpin,
    targetBallIndex: snapshot.targetBallIndex,
    aimDirection: snapshot.aimDirection,
    aimAngleOffset: snapshot.aimAngleOffset,
  };
  const aimed = buildAimedBalls(tempState);
  const ballNumbersBefore = aimed.map((b) => b.number);
  const { frames, firstHitBallNumber, railHitAfterContact } = recordSimulation(aimed, STANDARD_9_FOOT);
  return { frames, firstHitBallNumber, railHitAfterContact, ballNumbersBefore };
}

// ── Reducer ──────────────────────────────────────────────────────────

export function reducer(state: InternalState, action: Action): InternalState {
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
          shotHistory: [],
          restoredToIndex: null,
          tipSnapshot: null,
          latestBalls: [],
          replayQueue: null,
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
        shotHistory: [],
        restoredToIndex: null,
        tipSnapshot: null,
        latestBalls: [],
        replayQueue: null,
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

      // Save snapshot before the shot
      const snapshot: ShotSnapshot = {
        initialBalls: base.initialBalls,
        rules: base.rules,
        power: base.power,
        cueSpin: base.cueSpin,
        targetBallIndex: base.targetBallIndex,
        aimDirection: base.aimDirection,
        aimAngleOffset: base.aimAngleOffset,
      };

      // Trim any history after the current position
      const trimmedHistory = base.shotHistory.slice(0, base.shotsTaken);

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
        shotsTaken: trimmedHistory.length + 1,
        shotHistory: [...trimmedHistory, snapshot],
        restoredToIndex: null,
        tipSnapshot: null,
        latestBalls: [],
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

        const postShotBalls = finalFrame.balls.map(
          (b) => new BallState(
            b.pos as [number, number], [0, 0], 0, MotionState.STOPPED, b.number,
          ),
        );

        let newState: InternalState = {
          ...state,
          mode: "done",
          frameIndex: state.frames.length - 1,
          rules: newRules,
          latestBalls: postShotBalls,
        };

        // If cue ball was potted, go to placing mode
        if (newRules.cueBallPotted && newRules.result === null) {
          const finalBalls = finalFrame.balls
            .filter((b) => b.number !== 0)
            .map((b) => new BallState(
              b.pos as [number, number], [0, 0], 0, MotionState.STOPPED, b.number,
            ));
          newState = {
            ...newState,
            mode: "placing",
            initialBalls: finalBalls,
            frames: [],
            trajectories: [],
          };
        }

        // If replaying and there are more shots, fire the next one
        if (state.replayQueue && state.replayQueue.length > 0) {
          const [nextShot, ...remaining] = state.replayQueue;
          const result = executeShot(nextShot);
          return {
            ...newState,
            mode: "playing",
            initialBalls: nextShot.initialBalls,
            power: nextShot.power,
            cueSpin: nextShot.cueSpin,
            targetBallIndex: nextShot.targetBallIndex,
            aimDirection: nextShot.aimDirection,
            aimAngleOffset: nextShot.aimAngleOffset,
            frames: result.frames,
            frameIndex: 0,
            ballNumbersBeforeShot: result.ballNumbersBefore,
            firstHitBallNumber: result.firstHitBallNumber,
            railHitAfterContact: result.railHitAfterContact,
            replayQueue: remaining.length > 0 ? remaining : null,
          };
        }

        return newState;
      }
      return { ...state, frameIndex: next };
    }

    case "RESET":
      return previewFromFinalPositions(state);

    case "RESTORE_TO_SHOT": {
      const idx = action.shotIndex;
      if (idx < 0 || idx >= state.shotHistory.length) return state;
      const snapshot = state.shotHistory[idx];
      // Save tip state on first branch so we can return to it
      // Use latestBalls (post-shot state) rather than initialBalls (pre-shot)
      const tipSnapshot = state.tipSnapshot ?? {
        initialBalls: state.latestBalls,
        rules: state.rules,
        power: state.power,
        cueSpin: state.cueSpin,
        targetBallIndex: state.targetBallIndex,
        aimDirection: state.aimDirection,
        aimAngleOffset: state.aimAngleOffset,
      };
      return recomputeSimulation({
        ...state,
        mode: "preview",
        initialBalls: snapshot.initialBalls,
        rules: snapshot.rules,
        power: snapshot.power,
        cueSpin: snapshot.cueSpin,
        targetBallIndex: snapshot.targetBallIndex,
        aimDirection: snapshot.aimDirection,
        aimAngleOffset: snapshot.aimAngleOffset,
        shotsTaken: idx,
        restoredToIndex: idx,
        tipSnapshot,
        replayQueue: null,
        frames: [],
        frameIndex: 0,
        trajectories: [],
      });
    }

    case "RESTORE_TO_LATEST": {
      if (!state.tipSnapshot) return state;
      const tip = state.tipSnapshot;
      return recomputeSimulation({
        ...state,
        mode: "preview",
        initialBalls: tip.initialBalls,
        rules: tip.rules,
        power: tip.power,
        cueSpin: tip.cueSpin,
        targetBallIndex: tip.targetBallIndex,
        aimDirection: tip.aimDirection,
        aimAngleOffset: tip.aimAngleOffset,
        shotsTaken: state.shotHistory.length,
        restoredToIndex: null,
        tipSnapshot: null,
        replayQueue: null,
        frames: [],
        frameIndex: 0,
        trajectories: [],
      });
    }

    case "REPLAY": {
      if (state.shotHistory.length === 0) return state;
      const allShots = state.shotHistory;
      const [first, ...rest] = allShots;
      const result = executeShot(first);
      return {
        ...state,
        mode: "playing",
        initialBalls: first.initialBalls,
        rules: first.rules,
        power: first.power,
        cueSpin: first.cueSpin,
        targetBallIndex: first.targetBallIndex,
        aimDirection: first.aimDirection,
        aimAngleOffset: first.aimAngleOffset,
        frames: result.frames,
        frameIndex: 0,
        ballNumbersBeforeShot: result.ballNumbersBefore,
        firstHitBallNumber: result.firstHitBallNumber,
        railHitAfterContact: result.railHitAfterContact,
        shotsTaken: 0,
        replayQueue: rest.length > 0 ? rest : null,
      };
    }
  }
}

export const INITIAL_STATE: InternalState = {
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
  railHitAfterContact: false,
  shotsTaken: 0,
  rules: INITIAL_RULES,
  shotHistory: [],
  restoredToIndex: null,
  tipSnapshot: null,
  latestBalls: [],
  replayQueue: null,
};
