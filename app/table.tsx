import { View, Text, StyleSheet, Pressable, useWindowDimensions } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useMemo, useCallback } from "react";
import { STANDARD_9_FOOT, BALL_RADIUS } from "../engine/physics/constants";
import { ALL_SCENARIOS } from "../engine/scenarios";
import { useGameState } from "../hooks/useGameState";
import Ball from "../components/Ball";
import Cushions from "../components/Cushions";
import Pockets from "../components/Pockets";
import TrajectoryLine from "../components/TrajectoryLine";
import type { Vec2 } from "../engine/physics/vec2";
import { strings } from "../constants/strings";

const TABLE_WIDTH_M = STANDARD_9_FOOT.width;
const TABLE_HEIGHT_M = STANDARD_9_FOOT.height;
const ASPECT_RATIO = TABLE_WIDTH_M / TABLE_HEIGHT_M;

const RAIL_COLOR = "rgb(20, 20, 20)";
const CLOTH_COLOR = "rgb(90, 170, 210)";
const DIAMOND_COLOR = "rgb(240, 240, 240)";
const RAIL_THICKNESS = 32;
const CUSHION_THICKNESS = 14;

const SEGMENT = TABLE_HEIGHT_M / 4;
const LONG_RAIL_POSITIONS = [1, 2, 3, 5, 6, 7].map((i) => (i * SEGMENT) / TABLE_WIDTH_M);
const SHORT_RAIL_POSITIONS = [1, 2, 3].map((i) => (i * SEGMENT) / TABLE_HEIGHT_M);
const DIAMOND_SIZE = 8;

export default function TableScreen() {
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const { scenario: scenarioId } = useLocalSearchParams<{ scenario?: string }>();

  const initialBalls = useMemo(() => {
    if (!scenarioId) return [];
    const scenario = ALL_SCENARIOS.find((s) => s.id === scenarioId);
    if (!scenario) return [];
    return scenario.createBalls();
  }, [scenarioId]);

  const { mode, balls, trajectories, shoot, reset } = useGameState(initialBalls);

  const padding = 24;
  const buttonHeight = scenarioId ? 60 : 0;
  const border = RAIL_THICKNESS + CUSHION_THICKNESS;
  const maxWidth = screenWidth - padding * 2 - border * 2;
  const maxHeight = screenHeight - padding * 2 - border * 2 - buttonHeight;

  let tableWidth: number;
  let tableHeight: number;

  if (maxWidth * ASPECT_RATIO <= maxHeight) {
    tableWidth = maxWidth;
    tableHeight = maxWidth * ASPECT_RATIO;
  } else {
    tableHeight = maxHeight;
    tableWidth = maxHeight / ASPECT_RATIO;
  }

  const scaleX = tableWidth / TABLE_HEIGHT_M;
  const scaleY = tableHeight / TABLE_WIDTH_M;
  const ballRadius = BALL_RADIUS * scaleX;

  const toScreen = useCallback(
    (pos: Vec2) => ({
      x: border + pos[1] * scaleX,
      y: border + pos[0] * scaleY,
    }),
    [scaleX, scaleY],
  );

  const rc = RAIL_THICKNESS / 2 - DIAMOND_SIZE / 2;
  const d = DIAMOND_SIZE / 2;

  const diamonds = (cw: number, ch: number) => {
    const sides: { key: string; fracs: number[]; pos: (f: number) => object }[] = [
      { key: "l", fracs: LONG_RAIL_POSITIONS, pos: (f) => ({ left: rc, top: border + f * ch - d }) },
      { key: "r", fracs: LONG_RAIL_POSITIONS, pos: (f) => ({ right: rc, top: border + f * ch - d }) },
      { key: "t", fracs: SHORT_RAIL_POSITIONS, pos: (f) => ({ top: rc, left: border + f * cw - d }) },
      { key: "b", fracs: SHORT_RAIL_POSITIONS, pos: (f) => ({ bottom: rc, left: border + f * cw - d }) },
    ];
    return sides.flatMap(({ key, fracs, pos }) =>
      fracs.map((f, i) => <View key={`${key}-${i}`} style={[styles.diamond, pos(f)]} />)
    );
  };

  return (
    <View style={styles.container}>
      <View
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
        <Pockets
          tableWidth={tableWidth}
          tableHeight={tableHeight}
          railThickness={RAIL_THICKNESS}
          cushionThickness={CUSHION_THICKNESS}
          scale={scaleX}
        />
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
            isCue={i === 0}
          />
        ))}

        {balls.map((ball, i) => (
          <Ball
            key={`ball-${i}`}
            x={border + ball.pos[1] * scaleX}
            y={border + ball.pos[0] * scaleY}
            radius={ballRadius}
            isCue={i === 0}
          />
        ))}
      </View>

      {scenarioId && (
        <Pressable
          style={({ pressed }) => [
            styles.button,
            pressed && styles.buttonPressed,
            mode === "playing" && styles.buttonDisabled,
          ]}
          onPress={mode === "done" ? reset : shoot}
          disabled={mode === "playing"}
        >
          <Text style={styles.buttonText}>
            {mode === "done" ? strings.table.reset : strings.table.shoot}
          </Text>
        </Pressable>
      )}
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
    transform: [{ rotate: "45deg" }],
  },
  button: {
    marginTop: 16,
    backgroundColor: "#2a6a8a",
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 8,
  },
  buttonPressed: {
    opacity: 0.7,
  },
  buttonDisabled: {
    opacity: 0.4,
  },
  buttonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "600",
  },
});
