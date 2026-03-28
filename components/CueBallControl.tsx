import { useRef, useState } from "react";
import { View, StyleSheet, PanResponder, LayoutChangeEvent } from "react-native";

const INNER_RATIO = 0.6;
const DOT_RATIO = 10 / 70;
const BORDER = 2;

interface CueBallControlProps {
  /** Vertical spin: -1 (draw) to 1 (follow) */
  spin: number;
  onSpinChange: (spin: number) => void;
  disabled?: boolean;
}

export default function CueBallControl({ spin, onSpinChange, disabled }: CueBallControlProps) {
  const [size, setSize] = useState(0);
  const radius = size / 2;
  const innerRadius = radius * INNER_RATIO;
  const dotSize = Math.max(size * DOT_RATIO, 6);

  const callbackRef = useRef(onSpinChange);
  callbackRef.current = onSpinChange;
  const disabledRef = useRef(disabled);
  disabledRef.current = disabled;
  const sizeRef = useRef({ radius, innerRadius });
  sizeRef.current = { radius, innerRadius };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !disabledRef.current,
      onMoveShouldSetPanResponder: () => !disabledRef.current,
      onPanResponderGrant: (e) => updateSpin(e.nativeEvent.locationY),
      onPanResponderMove: (e) => updateSpin(e.nativeEvent.locationY),
    }),
  ).current;

  function updateSpin(locationY: number) {
    const s = sizeRef.current;
    if (s.radius === 0) return;
    const offsetY = locationY - s.radius;
    const clamped = Math.max(-s.innerRadius, Math.min(s.innerRadius, offsetY));
    const value = -(clamped / s.innerRadius);
    callbackRef.current(value);
  }

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    const s = Math.min(width, height);
    setSize(s);
  };

  const dotOffsetY = -spin * innerRadius;

  return (
    <View style={styles.container} onLayout={onLayout}>
      {size > 0 && (
        <View
          style={{
            width: size,
            height: size,
            borderRadius: radius,
            backgroundColor: "rgb(255, 255, 240)",
            borderWidth: BORDER,
            borderColor: "rgba(0, 0, 0, 0.3)",
          }}
          {...panResponder.panHandlers}
        >
          <View
            style={{
              position: "absolute",
              width: innerRadius * 2,
              height: innerRadius * 2,
              borderRadius: innerRadius,
              borderWidth: 1,
              borderColor: "rgba(0, 0, 0, 0.15)",
              top: radius - innerRadius - BORDER,
              left: radius - innerRadius - BORDER,
            }}
          />
          <View
            style={{
              position: "absolute",
              width: dotSize,
              height: dotSize,
              borderRadius: dotSize / 2,
              backgroundColor: "rgb(200, 50, 50)",
              top: radius - BORDER + dotOffsetY - dotSize / 2,
              left: radius - BORDER - dotSize / 2,
            }}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    aspectRatio: 1,
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
});
