import { useRef } from "react";
import { View, StyleSheet, PanResponder } from "react-native";

const TRACK_HEIGHT = 120;
const TRACK_WIDTH = 12;
const THUMB_SIZE = 22;

interface PowerSliderProps {
  value: number; // 0–1
  onValueChange: (value: number) => void;
  disabled?: boolean;
}

export default function PowerSlider({ value, onValueChange, disabled }: PowerSliderProps) {
  const callbackRef = useRef(onValueChange);
  callbackRef.current = onValueChange;
  const disabledRef = useRef(disabled);
  disabledRef.current = disabled;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !disabledRef.current,
      onMoveShouldSetPanResponder: () => !disabledRef.current,
      onPanResponderGrant: (e) => updateValue(e.nativeEvent.locationY),
      onPanResponderMove: (e) => updateValue(e.nativeEvent.locationY),
    }),
  ).current;

  function updateValue(locationY: number) {
    const clamped = Math.max(0, Math.min(TRACK_HEIGHT, locationY));
    const power = 1 - clamped / TRACK_HEIGHT;
    callbackRef.current(Math.max(0.05, power));
  }

  const fillHeight = value * TRACK_HEIGHT;
  const thumbTop = (1 - value) * TRACK_HEIGHT - THUMB_SIZE / 2;

  return (
    <View style={styles.container}>
      <View
        style={styles.track}
        {...panResponder.panHandlers}
      >
        {/* Fill from bottom */}
        <View
          style={[
            styles.fill,
            { height: fillHeight, bottom: 0 },
          ]}
        />
        {/* Thumb */}
        <View style={[styles.thumb, { top: thumbTop }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: TRACK_HEIGHT + THUMB_SIZE,
    width: THUMB_SIZE + 8,
    alignItems: "center",
    justifyContent: "center",
  },
  track: {
    width: TRACK_WIDTH,
    height: TRACK_HEIGHT,
    borderRadius: TRACK_WIDTH / 2,
    backgroundColor: "#333",
    overflow: "visible",
  },
  fill: {
    position: "absolute",
    left: 0,
    right: 0,
    borderRadius: TRACK_WIDTH / 2,
    backgroundColor: "#2a6a8a",
  },
  thumb: {
    position: "absolute",
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    backgroundColor: "#fff",
    borderWidth: 2,
    borderColor: "#2a6a8a",
    left: (TRACK_WIDTH - THUMB_SIZE) / 2,
  },
});
