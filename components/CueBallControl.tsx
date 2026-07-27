import { useRef, useState } from "react";
import { View, StyleSheet, PanResponder, LayoutChangeEvent } from "react-native";

const INNER_RATIO = 0.6;
const DOT_RATIO = 10 / 70;
const BORDER = 2;

interface CueBallControlProps {
  /** Vertical spin: -1 (draw) to 1 (follow) */
  spin: number;
  /** Horizontal spin (English): -1 (left) to 1 (right) */
  sidespin: number;
  onTipOffsetChange: (spin: number, sidespin: number) => void;
  disabled?: boolean;
}

export default function CueBallControl({ spin, sidespin, onTipOffsetChange, disabled }: CueBallControlProps) {
  const [size, setSize] = useState(0);
  const radius = size / 2;
  const innerRadius = radius * INNER_RATIO;
  const dotSize = Math.max(size * DOT_RATIO, 6);

  const callbackRef = useRef(onTipOffsetChange);
  callbackRef.current = onTipOffsetChange;
  const disabledRef = useRef(disabled);
  disabledRef.current = disabled;
  const sizeRef = useRef({ radius, innerRadius });
  sizeRef.current = { radius, innerRadius };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !disabledRef.current,
      onMoveShouldSetPanResponder: () => !disabledRef.current,
      onPanResponderGrant: (e) => updateTipOffset(e.nativeEvent.locationX, e.nativeEvent.locationY),
      onPanResponderMove: (e) => updateTipOffset(e.nativeEvent.locationX, e.nativeEvent.locationY),
    }),
  ).current;

  function updateTipOffset(locationX: number, locationY: number) {
    const s = sizeRef.current;
    if (s.radius === 0 || s.innerRadius === 0) return;
    let offsetX = locationX - s.radius;
    let offsetY = locationY - s.radius;

    // Clamp the combined offset to the inner circle (the tip-offset/miscue limit is on
    // the combined magnitude, not each axis independently — see cueStrike).
    const dist = Math.sqrt(offsetX * offsetX + offsetY * offsetY);
    if (dist > s.innerRadius) {
      const scale = s.innerRadius / dist;
      offsetX *= scale;
      offsetY *= scale;
    }

    const newSpin = -(offsetY / s.innerRadius);
    const newSidespin = offsetX / s.innerRadius;
    callbackRef.current(newSpin, newSidespin);
  }

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    const s = Math.min(width, height);
    setSize(s);
  };

  const dotOffsetX = sidespin * innerRadius;
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
              left: radius - BORDER + dotOffsetX - dotSize / 2,
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
