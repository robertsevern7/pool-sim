import { useRef } from "react";
import { View, StyleSheet, PanResponder } from "react-native";

const SIZE = 70;
const RADIUS = SIZE / 2;
const INNER_RADIUS = RADIUS * 0.6;
const DOT_SIZE = 10;

interface CueBallControlProps {
  /** Vertical spin: -1 (draw) to 1 (follow) */
  spin: number;
  onSpinChange: (spin: number) => void;
  disabled?: boolean;
}

export default function CueBallControl({ spin, onSpinChange, disabled }: CueBallControlProps) {
  const callbackRef = useRef(onSpinChange);
  callbackRef.current = onSpinChange;
  const disabledRef = useRef(disabled);
  disabledRef.current = disabled;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !disabledRef.current,
      onMoveShouldSetPanResponder: () => !disabledRef.current,
      onPanResponderGrant: (e) => updateSpin(e.nativeEvent.locationY),
      onPanResponderMove: (e) => updateSpin(e.nativeEvent.locationY),
    }),
  ).current;

  function updateSpin(locationY: number) {
    const offsetY = locationY - RADIUS;
    const clamped = Math.max(-INNER_RADIUS, Math.min(INNER_RADIUS, offsetY));
    const value = -(clamped / INNER_RADIUS);
    callbackRef.current(value);
  }

  // Dot position: spin 1 = top of inner circle, spin -1 = bottom
  const BORDER = 2;
  const dotOffsetY = -spin * INNER_RADIUS;

  return (
    <View style={styles.container}>
      <View style={styles.ball} {...panResponder.panHandlers}>
        {/* Inner circle guide */}
        <View style={styles.innerCircle} />
        {/* Hit point dot */}
        <View
          style={[
            styles.dot,
            {
              top: RADIUS - BORDER + dotOffsetY - DOT_SIZE / 2,
              left: RADIUS - BORDER - DOT_SIZE / 2,
            },
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: SIZE + 8,
    height: SIZE + 8,
    justifyContent: "center",
    alignItems: "center",
  },
  ball: {
    width: SIZE,
    height: SIZE,
    borderRadius: RADIUS,
    backgroundColor: "rgb(255, 255, 240)",
    borderWidth: 2,
    borderColor: "rgba(0, 0, 0, 0.3)",
  },
  innerCircle: {
    position: "absolute",
    width: INNER_RADIUS * 2,
    height: INNER_RADIUS * 2,
    borderRadius: INNER_RADIUS,
    borderWidth: 1,
    borderColor: "rgba(0, 0, 0, 0.15)",
    top: RADIUS - INNER_RADIUS - 2,
    left: RADIUS - INNER_RADIUS - 2,
  },
  dot: {
    position: "absolute",
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: DOT_SIZE / 2,
    backgroundColor: "rgb(200, 50, 50)",
  },
});
