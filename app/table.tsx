import { View, StyleSheet, useWindowDimensions } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useMemo } from "react";
import { STANDARD_9_FOOT, BALL_RADIUS } from "../engine/physics/constants";
import { ALL_SCENARIOS } from "../engine/scenarios";
import Ball from "../components/Ball";

const TABLE_WIDTH_M = STANDARD_9_FOOT.width;
const TABLE_HEIGHT_M = STANDARD_9_FOOT.height;
// Vertical table: rendered height/width = long side / short side
const ASPECT_RATIO = TABLE_WIDTH_M / TABLE_HEIGHT_M;

const RAIL_COLOR = "rgb(60, 30, 10)";
const CLOTH_COLOR = "rgb(0, 100, 50)";
const DIAMOND_COLOR = "rgb(220, 200, 140)";
const RAIL_THICKNESS = 32;

const SEGMENT = TABLE_HEIGHT_M / 4;
const LONG_RAIL_POSITIONS = [1, 2, 3, 5, 6, 7].map((i) => (i * SEGMENT) / TABLE_WIDTH_M);
const SHORT_RAIL_POSITIONS = [1, 2, 3].map((i) => (i * SEGMENT) / TABLE_HEIGHT_M);
const DIAMOND_SIZE = 8;

export default function TableScreen() {
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const { scenario: scenarioId } = useLocalSearchParams<{ scenario?: string }>();

  const balls = useMemo(() => {
    if (!scenarioId) return [];
    const scenario = ALL_SCENARIOS.find((s) => s.id === scenarioId);
    if (!scenario) return [];
    return scenario.createBalls();
  }, [scenarioId]);

  const padding = 24;
  const maxWidth = screenWidth - padding * 2 - RAIL_THICKNESS * 2;
  const maxHeight = screenHeight - padding * 2 - RAIL_THICKNESS * 2;

  let tableWidth: number;
  let tableHeight: number;

  if (maxWidth * ASPECT_RATIO <= maxHeight) {
    tableWidth = maxWidth;
    tableHeight = maxWidth * ASPECT_RATIO;
  } else {
    tableHeight = maxHeight;
    tableWidth = maxHeight / ASPECT_RATIO;
  }

  // Scale from world meters to screen pixels
  // Vertical: world X maps to screen Y, world Y maps to screen X
  const scaleX = tableWidth / TABLE_HEIGHT_M;
  const scaleY = tableHeight / TABLE_WIDTH_M;
  const ballRadius = BALL_RADIUS * scaleX;

  const rc = RAIL_THICKNESS / 2 - DIAMOND_SIZE / 2;
  const d = DIAMOND_SIZE / 2;

  const diamonds = (cw: number, ch: number) => {
    const sides: { key: string; fracs: number[]; pos: (f: number) => object }[] = [
      { key: "l", fracs: LONG_RAIL_POSITIONS, pos: (f) => ({ left: rc, top: RAIL_THICKNESS + f * ch - d }) },
      { key: "r", fracs: LONG_RAIL_POSITIONS, pos: (f) => ({ right: rc, top: RAIL_THICKNESS + f * ch - d }) },
      { key: "t", fracs: SHORT_RAIL_POSITIONS, pos: (f) => ({ top: rc, left: RAIL_THICKNESS + f * cw - d }) },
      { key: "b", fracs: SHORT_RAIL_POSITIONS, pos: (f) => ({ bottom: rc, left: RAIL_THICKNESS + f * cw - d }) },
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
            width: tableWidth + RAIL_THICKNESS * 2,
            height: tableHeight + RAIL_THICKNESS * 2,
            borderRadius: 10,
          },
        ]}
      >
        {diamonds(tableWidth, tableHeight)}

        <View
          style={[
            styles.cloth,
            {
              width: tableWidth,
              height: tableHeight,
            },
          ]}
        />

        {balls.map((ball, i) => (
          <Ball
            key={`ball-${i}`}
            x={RAIL_THICKNESS + ball.pos[1] * scaleX}
            y={RAIL_THICKNESS + ball.pos[0] * scaleY}
            radius={ballRadius}
            isCue={i === 0}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#1e1e1e",
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
});
