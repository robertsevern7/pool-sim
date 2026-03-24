import { View, Text, StyleSheet, Pressable, PanResponder, useWindowDimensions } from "react-native";
import { useMemo, useCallback, useRef } from "react";
import { STANDARD_9_FOOT, BALL_RADIUS, POCKET_CONFIG } from "../engine/physics/constants";
import {
  GameProvider,
  useGame,
  useGameDispatch,
  FINE_AIM_STEP,
  COARSE_AIM_STEP,
  MAX_POWER,
} from "../contexts/GameContext";
import { SCENARIOS, FREE_PLAY, type Scenario } from "../engine/scenarios";
import { DEBUG_SCENARIOS } from "../engine/debug-scenarios";
import Ball from "./Ball";
import Cushions from "./Cushions";
import CornerPockets from "./CornerPockets";
import SidePockets from "./SidePockets";
import TrajectoryLine from "./TrajectoryLine";
import CueBallControl from "./CueBallControl";
import PowerSlider from "./PowerSlider";
import { Vec2 } from "../engine/physics/vec2";
import { strings } from "../constants/strings";

const ALL = [FREE_PLAY, ...SCENARIOS, ...DEBUG_SCENARIOS];

const TABLE_WIDTH_M = STANDARD_9_FOOT.width;
const TABLE_HEIGHT_M = STANDARD_9_FOOT.height;
const ASPECT_RATIO = TABLE_WIDTH_M / TABLE_HEIGHT_M;

const RAIL_COLOR = "rgb(20, 20, 20)";
const CLOTH_COLOR = "rgb(90, 170, 210)";
const CLOTH_LINE_COLOR = "rgb(82, 158, 196)";
const DIAMOND_COLOR = "rgb(240, 240, 240)";
const RAIL_THICKNESS = 32;
const CUSHION_THICKNESS_INCHES = POCKET_CONFIG.cushionThickness;
const INCHES_TO_M = 0.0254;

const SEGMENT = TABLE_HEIGHT_M / 4;
const LONG_RAIL_POSITIONS = [1, 2, 3, 5, 6, 7].map((i) => (i * SEGMENT) / TABLE_WIDTH_M);
const SHORT_RAIL_POSITIONS = [1, 2, 3].map((i) => (i * SEGMENT) / TABLE_HEIGHT_M);
const DIAMOND_SIZE = 8;

const CONTROLS_HEIGHT = 150;

interface TableViewProps {
  scenarioId: string;
}

export default function TableView({ scenarioId }: TableViewProps) {
  const scenario = useMemo(() => ALL.find((s) => s.id === scenarioId), [scenarioId]);

  const initialBalls = useMemo(() => {
    if (!scenario) return [];
    return scenario.createBalls();
  }, [scenario]);

  return (
    <GameProvider initialBalls={initialBalls} placeCue={scenario?.placeCue}>
      <TableContent hasControls={!!scenario} />
    </GameProvider>
  );
}

export function getScenarioTitle(scenarioId: string): string {
  const scenario = ALL.find((s) => s.id === scenarioId);
  return scenario?.name ?? "Table";
}

function TableContent({ hasControls }: { hasControls: boolean }) {
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const { mode, balls, trajectories, trajectoryBallNumbers } = useGame();
  const { setTarget, placeCue, moveCue, finishMoveCue } = useGameDispatch();
  const isPlacing = mode === "placing";

  const padding = 24;
  const controlsSpace = hasControls ? CONTROLS_HEIGHT + 16 : 0;

  const CT_M = CUSHION_THICKNESS_INCHES * INCHES_TO_M;
  const k = CT_M / TABLE_HEIGHT_M;
  const availW = screenWidth - padding * 2 - RAIL_THICKNESS * 2;
  const availH = screenHeight - padding * 2 - RAIL_THICKNESS * 2 - controlsSpace;

  const maxTableW = availW / (1 + 2 * k);
  const maxTableH = availH / (1 + 2 * k * ASPECT_RATIO);

  let tableWidth: number;
  let tableHeight: number;

  if (maxTableW * ASPECT_RATIO <= maxTableH) {
    tableWidth = maxTableW;
    tableHeight = maxTableW * ASPECT_RATIO;
  } else {
    tableHeight = maxTableH;
    tableWidth = maxTableH / ASPECT_RATIO;
  }

  const scaleX = tableWidth / TABLE_HEIGHT_M;
  const scaleY = tableHeight / TABLE_WIDTH_M;
  const CUSHION_THICKNESS = CT_M * scaleX;
  const border = RAIL_THICKNESS + CUSHION_THICKNESS;
  const ballRadius = BALL_RADIUS * scaleX;

  const toScreen = useCallback(
    (pos: Vec2) => ({
      x: border + pos[1] * scaleX,
      y: border + pos[0] * scaleY,
    }),
    [scaleX, scaleY],
  );

  const tableRef = useRef<View>(null);

  // Keep refs fresh for PanResponder closures
  const stateRef = useRef({ isPlacing, canAim: false, balls, placeCue, moveCue, finishMoveCue, scaleX, scaleY });
  stateRef.current = { isPlacing, canAim: mode === "preview" || mode === "done", balls, placeCue, moveCue, finishMoveCue, scaleX, scaleY };

  const draggingCueRef = useRef(false);
  const dragStartPosRef = useRef<Vec2>([0, 0]);

  const tablePanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => {
        const s = stateRef.current;
        if (s.isPlacing) return true;
        if (!s.canAim) return false;
        return !!s.balls.find((b) => b.number === 0);
      },
      onMoveShouldSetPanResponder: () => draggingCueRef.current,
      onPanResponderGrant: () => {
        const s = stateRef.current;
        if (s.isPlacing) {
          // Place at table center as starting point — drag will move it
          const cueBall = s.balls.find((b) => b.number === 0);
          if (!cueBall) {
            s.placeCue([STANDARD_9_FOOT.width / 4, STANDARD_9_FOOT.height / 2]);
          }
          dragStartPosRef.current = [STANDARD_9_FOOT.width / 4, STANDARD_9_FOOT.height / 2];
        } else {
          const cueBall = s.balls.find((b) => b.number === 0);
          if (cueBall) dragStartPosRef.current = [cueBall.pos[0], cueBall.pos[1]];
        }
        draggingCueRef.current = true;
      },
      onPanResponderMove: (_e, gesture) => {
        if (!draggingCueRef.current) return;
        const s = stateRef.current;
        const start = dragStartPosRef.current;
        // dx maps to physics Y (table short axis), dy maps to physics X (table long axis)
        const newPos: Vec2 = [
          start[0] + gesture.dy / s.scaleY,
          start[1] + gesture.dx / s.scaleX,
        ];
        s.moveCue(newPos);
      },
      onPanResponderRelease: () => {
        if (draggingCueRef.current) {
          stateRef.current.finishMoveCue();
        }
        draggingCueRef.current = false;
      },
    }),
  ).current;

  const rc = RAIL_THICKNESS / 2 - DIAMOND_SIZE / 2;
  const d = DIAMOND_SIZE / 2;

  const diamonds = (cw: number, ch: number) => {
    const thin = 0.75;
    const sides: { key: string; fracs: number[]; pos: (f: number) => object; squish: object }[] = [
      { key: "l", fracs: LONG_RAIL_POSITIONS, pos: (f) => ({ left: rc, top: border + f * ch - d }), squish: { scaleY: thin } },
      { key: "r", fracs: LONG_RAIL_POSITIONS, pos: (f) => ({ right: rc, top: border + f * ch - d }), squish: { scaleY: thin } },
      { key: "t", fracs: SHORT_RAIL_POSITIONS, pos: (f) => ({ top: rc, left: border + f * cw - d }), squish: { scaleX: thin } },
      { key: "b", fracs: SHORT_RAIL_POSITIONS, pos: (f) => ({ bottom: rc, left: border + f * cw - d }), squish: { scaleX: thin } },
    ];
    return sides.flatMap(({ key, fracs, pos, squish }) =>
      fracs.map((f, i) => <View key={`${key}-${i}`} style={[styles.diamond, pos(f), { transform: [squish, { rotate: "135deg" }] }]} />)
    );
  };

  const canAim = mode === "preview" || mode === "done";

  return (
    <View style={styles.container}>
      <View
        ref={tableRef}
        {...tablePanResponder.panHandlers}
        style={[
          styles.rail,
          {
            width: tableWidth + border * 2,
            height: tableHeight + border * 2,
            borderRadius: 10,
          },
        ]}
      >
        {diamonds(tableWidth, tableHeight)}

        <View
          style={[
            styles.cloth,
            {
              position: "absolute",
              left: RAIL_THICKNESS,
              top: RAIL_THICKNESS,
              width: tableWidth + 2 * CUSHION_THICKNESS,
              height: tableHeight + 2 * CUSHION_THICKNESS,
            },
          ]}
        />
        <CornerPockets
          tableWidth={tableWidth}
          tableHeight={tableHeight}
          railThickness={RAIL_THICKNESS}
          cushionThickness={CUSHION_THICKNESS}
          scale={scaleX}
        />
        <SidePockets
          tableWidth={tableWidth}
          tableHeight={tableHeight}
          railThickness={RAIL_THICKNESS}
          cushionThickness={CUSHION_THICKNESS}
          scale={scaleX}
        />
        {Array.from({ length: 31 }, (_, i) => (
          <View
            key={`hl-${i}`}
            style={{
              position: "absolute",
              left: border,
              top: border + ((i + 1) * tableHeight) / 32,
              width: tableWidth,
              height: 1,
              backgroundColor: CLOTH_LINE_COLOR,
            }}
          />
        ))}
        {Array.from({ length: 15 }, (_, i) => (
          <View
            key={`vl-${i}`}
            style={{
              position: "absolute",
              left: border + ((i + 1) * tableWidth) / 16,
              top: border,
              width: 1,
              height: tableHeight,
              backgroundColor: CLOTH_LINE_COLOR,
            }}
          />
        ))}

        <Cushions
          tableWidth={tableWidth}
          tableHeight={tableHeight}
          railThickness={RAIL_THICKNESS}
          cushionThickness={CUSHION_THICKNESS}
          scale={scaleX}
        />

        {mode === "preview" && trajectories.map((path, i) => (
          <TrajectoryLine
            key={`traj-${i}`}
            path={path}
            ballRadius={ballRadius}
            toScreen={toScreen}
            ballNumber={trajectoryBallNumbers[i] ?? 0}
          />
        ))}

        {balls.map((ball, i) => (
          <Ball
            key={`ball-${ball.number}`}
            x={border + ball.pos[1] * scaleX}
            y={border + ball.pos[0] * scaleY}
            radius={ballRadius}
            ballNumber={ball.number}
            onPress={
              canAim && ball.number !== 0
                ? () => setTarget(i)
                : undefined
            }
          />
        ))}
      </View>

      <GameStatus />

      {hasControls && (
        isPlacing
          ? <View style={styles.controlBar}>
              <Text style={styles.placingText}>Tap the table to place the white ball</Text>
            </View>
          : <Controls />
      )}
    </View>
  );
}

function GameStatus() {
  const { rules } = useGame();

  if (rules.result === "win") {
    return <Text style={[styles.statusText, styles.statusWin]}>You win!</Text>;
  }
  if (rules.result === "loss") {
    return <Text style={[styles.statusText, styles.statusLoss]}>{rules.foul ?? "You lose"}</Text>;
  }
  if (rules.foul) {
    return <Text style={[styles.statusText, styles.statusFoul]}>Foul: {rules.foul}</Text>;
  }
  if (rules.assignedSet) {
    return (
      <Text style={styles.statusText}>
        You are {rules.assignedSet === "solid" ? "Solids (1-7)" : "Stripes (9-15)"}
      </Text>
    );
  }
  return null;
}

function Controls() {
  const { mode, power, spin } = useGame();
  const { shoot, adjustAngle, setPower, setSpin } = useGameDispatch();
  const isPlaying = mode === "playing";

  return (
    <View style={styles.controlBar}>
      <View style={styles.controlLeft}>
        <CueBallControl spin={spin} onSpinChange={setSpin} disabled={isPlaying} />
        <PowerSlider value={power / MAX_POWER} onValueChange={(v) => setPower(v * MAX_POWER)} disabled={isPlaying} />
      </View>

      <Pressable
        style={({ pressed }) => [
          styles.shootButton,
          pressed && styles.buttonPressed,
          isPlaying && styles.buttonDisabled,
        ]}
        onPress={shoot}
        disabled={isPlaying}
      >
        <Text style={styles.shootButtonText}>
          {strings.table.shoot}
        </Text>
      </Pressable>

      <View style={styles.controlRight}>
        <View style={[styles.aimControls, isPlaying && styles.buttonDisabled]}>
          <View style={styles.aimRow}>
            <Pressable
              style={({ pressed }) => [styles.aimButton, !isPlaying && pressed && styles.buttonPressed]}
              onPress={() => adjustAngle(-COARSE_AIM_STEP)}
              disabled={isPlaying}
            >
              <Text style={styles.aimButtonText}>{strings.table.aimLeft}</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.aimButton, !isPlaying && pressed && styles.buttonPressed]}
              onPress={() => adjustAngle(COARSE_AIM_STEP)}
              disabled={isPlaying}
            >
              <Text style={styles.aimButtonText}>{strings.table.aimRight}</Text>
            </Pressable>
          </View>
          <View style={styles.aimRow}>
            <Pressable
              style={({ pressed }) => [styles.aimButtonFine, !isPlaying && pressed && styles.buttonPressed]}
              onPress={() => adjustAngle(-FINE_AIM_STEP)}
              disabled={isPlaying}
            >
              <Text style={styles.aimButtonFineText}>{strings.table.aimLeftFine}</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.aimButtonFine, !isPlaying && pressed && styles.buttonPressed]}
              onPress={() => adjustAngle(FINE_AIM_STEP)}
              disabled={isPlaying}
            >
              <Text style={styles.aimButtonFineText}>{strings.table.aimRightFine}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f5f0dc",
  },
  placingText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    marginBottom: 12,
  },
  rail: {
    backgroundColor: RAIL_COLOR,
    justifyContent: "center",
    alignItems: "center",
  },
  cloth: {
    backgroundColor: CLOTH_COLOR,
  },
  diamond: {
    position: "absolute",
    width: DIAMOND_SIZE,
    height: DIAMOND_SIZE,
    backgroundColor: DIAMOND_COLOR,
  },
  controlBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
    height: CONTROLS_HEIGHT,
    paddingHorizontal: 16,
    marginTop: 16,
  },
  controlLeft: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  controlRight: {
    flex: 1,
    alignItems: "flex-end",
    justifyContent: "center",
  },
  shootButton: {
    backgroundColor: "#2a6a8a",
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonPressed: {
    opacity: 0.7,
  },
  buttonDisabled: {
    opacity: 0.4,
  },
  shootButtonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "600",
  },
  aimControls: {
    gap: 6,
    alignItems: "center",
  },
  aimRow: {
    flexDirection: "row",
    gap: 6,
  },
  aimButton: {
    backgroundColor: "#3a3a3a",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
  },
  aimButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  aimButtonFine: {
    backgroundColor: "#555",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
  },
  aimButtonFineText: {
    color: "#ddd",
    fontSize: 16,
    fontWeight: "600",
  },
  statusText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
    marginTop: 8,
  },
  statusWin: {
    color: "#228B22",
    fontSize: 18,
  },
  statusLoss: {
    color: "#B22222",
    fontSize: 18,
  },
  statusFoul: {
    color: "#CC6600",
  },
});
