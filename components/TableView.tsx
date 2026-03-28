import { View, StyleSheet, PanResponder, useWindowDimensions } from "react-native";
import { useMemo, useCallback, useRef, useState, useEffect } from "react";
import { STANDARD_9_FOOT, BALL_RADIUS, POCKET_CONFIG } from "../engine/physics/constants";
import {
  GameProvider,
  useGame,
  useGameDispatch,
} from "../contexts/GameContext";
import { SCENARIOS, FREE_PLAY, type Scenario } from "../engine/scenarios";
import { DEBUG_SCENARIOS } from "../engine/debug-scenarios";
import Ball from "./Ball";
import Cushions from "./Cushions";
import CornerPockets from "./CornerPockets";
import SidePockets from "./SidePockets";
import TrajectoryLine from "./TrajectoryLine";
import FloatingAimControls from "./FloatingAimControls";
import GameStatusBar, { STATUS_HEIGHT } from "./GameStatusBar";
import ShotControls from "./ShotControls";
import ShotHistoryPanel from "./ShotHistoryPanel";
import { Vec2 } from "../engine/physics/vec2";

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

const MIN_CONTROLS_HEIGHT = 120;

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
  const { mode, balls, trajectories, trajectoryBallNumbers, rules } = useGame();
  const { setTarget, placeCue, moveCue, finishMoveCue } = useGameDispatch();
  const isPlacing = mode === "placing";
  const [showHistory, setShowHistory] = useState(false);

  // Switch to history view on foul or game end
  useEffect(() => {
    if (rules.result !== null || rules.foul !== null) {
      setShowHistory(true);
    }
  }, [rules.result, rules.foul]);

  const padding = 24;
  // Reserve minimum space for status bar + controls
  const controlsSpace = hasControls ? MIN_CONTROLS_HEIGHT + STATUS_HEIGHT + 8 + 8 : 0;

  const CT_M = CUSHION_THICKNESS_INCHES * INCHES_TO_M;
  const k = CT_M / TABLE_HEIGHT_M;
  const availW = screenWidth - padding * 2 - RAIL_THICKNESS * 2;
  const availH = screenHeight - RAIL_THICKNESS * 2 - controlsSpace;

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

  const { shotsTaken } = useGame();
  const canDragCue = isPlacing || shotsTaken === 0;

  const stateRef = useRef({ isPlacing, canAim: false, canDragCue, balls, placeCue, moveCue, finishMoveCue, scaleX, scaleY, border });
  stateRef.current = { isPlacing, canAim: mode === "preview" || mode === "done", canDragCue, balls, placeCue, moveCue, finishMoveCue, scaleX, scaleY, border };

  const draggingCueRef = useRef(false);
  const dragStartPosRef = useRef<Vec2>([0, 0]);

  // Measure table offset for hit-testing cue ball proximity
  const tablePageOffset = useRef({ x: 0, y: 0 });

  const tablePanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: (e) => {
        const s = stateRef.current;
        if (!s.canDragCue) { return false; }
        if (s.isPlacing) { return true; }
        if (!s.canAim) { return false; }
        const cueBall = s.balls.find((b) => b.number === 0);
        if (!cueBall) { return false; }
        const cueScreenX = s.border + cueBall.pos[1] * s.scaleX;
        const cueScreenY = s.border + cueBall.pos[0] * s.scaleY;
        const off = tablePageOffset.current;
        const touchLocalX = e.nativeEvent.pageX - off.x;
        const touchLocalY = e.nativeEvent.pageY - off.y;
        const dist = Math.sqrt((touchLocalX - cueScreenX) ** 2 + (touchLocalY - cueScreenY) ** 2);
        return dist < 40;
      },
      onMoveShouldSetPanResponder: () => { return draggingCueRef.current; },
      onPanResponderGrant: (e) => {
        const s = stateRef.current;
        if (s.isPlacing) {
          // Compute tap position but don't dispatch yet — wait for release
          const off = tablePageOffset.current;
          const localX = e.nativeEvent.pageX - off.x;
          const localY = e.nativeEvent.pageY - off.y;
          const physX = (localY - s.border) / s.scaleY;
          const physY = (localX - s.border) / s.scaleX;
          dragStartPosRef.current = [physX, physY];
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
        const pos: Vec2 = [
          start[0] + gesture.dy / s.scaleY,
          start[1] + gesture.dx / s.scaleX,
        ];
        if (s.isPlacing) {
          s.placeCue(pos);
        } else {
          s.moveCue(pos);
        }
      },
      onPanResponderRelease: (_e, gesture) => {
        if (!draggingCueRef.current) return;
        draggingCueRef.current = false;
        const s = stateRef.current;
        const start = dragStartPosRef.current;
        const finalPos: Vec2 = [
          start[0] + gesture.dy / s.scaleY,
          start[1] + gesture.dx / s.scaleX,
        ];
        if (s.isPlacing) {
          s.placeCue(finalPos);
        } else {
          s.moveCue(finalPos);
          s.finishMoveCue();
        }
      },
    }),
  ).current;

  const onTableLayout = useCallback(() => {
    tableRef.current?.measureInWindow((x, y) => {
      tablePageOffset.current = { x, y };
    });
  }, []);

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
        onLayout={onTableLayout}
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

        <FloatingAimControls
          toScreen={toScreen}
          trajectories={trajectories}
          ballRadius={ballRadius}
        />
      </View>

      {hasControls && (
        <View style={styles.bottomPanel}>
          <GameStatusBar
            showHistory={showHistory}
            onToggleHistory={() => setShowHistory((v) => !v)}
          />
          {isPlacing
            ? null
            : showHistory
              ? <ShotHistoryPanel onDismiss={() => setShowHistory(false)} />
              : <ShotControls />
          }
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 24,
    paddingBottom: 24,
    alignItems: "center",
    backgroundColor: "#f5f0dc",
  },
  bottomPanel: {
    flex: 1,
    width: "100%",
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
});
