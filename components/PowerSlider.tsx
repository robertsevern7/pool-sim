import { useRef, useState } from "react";
import { View, StyleSheet, PanResponder, LayoutChangeEvent } from "react-native";

const TRACK_THICKNESS = 12;
const THUMB_SIZE = 22;

interface PowerSliderProps {
  value: number; // 0–1
  onValueChange: (value: number) => void;
  disabled?: boolean;
}

export default function PowerSlider({ value, onValueChange, disabled }: PowerSliderProps) {
  const [trackHeight, setTrackHeight] = useState(0);

  const callbackRef = useRef(onValueChange);
  callbackRef.current = onValueChange;
  const disabledRef = useRef(disabled);
  disabledRef.current = disabled;
  const trackHeightRef = useRef(trackHeight);
  trackHeightRef.current = trackHeight;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !disabledRef.current,
      onMoveShouldSetPanResponder: () => !disabledRef.current,
      onPanResponderGrant: (e) => updateValue(e.nativeEvent.locationY),
      onPanResponderMove: (e) => updateValue(e.nativeEvent.locationY),
    }),
  ).current;

  function updateValue(locationY: number) {
    const th = trackHeightRef.current;
    if (th === 0) return;
    const clamped = Math.max(0, Math.min(th, locationY));
    const power = 1 - clamped / th;
    callbackRef.current(Math.max(0.05, power));
  }

  const onTrackLayout = (e: LayoutChangeEvent) => {
    setTrackHeight(e.nativeEvent.layout.height);
  };

  const fillHeight = trackHeight > 0 ? `${value * 100}%` as const : 0;
  const thumbTop = trackHeight > 0 ? (1 - value) * trackHeight - THUMB_SIZE / 2 : 0;

  return (
    <View style={styles.container}>
      <View
        style={styles.track}
        onLayout={onTrackLayout}
        {...panResponder.panHandlers}
      >
        <View
          style={[
            styles.fill,
            { height: fillHeight, bottom: 0 },
          ]}
        />
        <View style={[styles.thumb, { top: thumbTop }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: THUMB_SIZE + 8,
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  track: {
    width: TRACK_THICKNESS,
    height: "100%",
    borderRadius: TRACK_THICKNESS / 2,
    backgroundColor: "#333",
    overflow: "visible",
  },
  fill: {
    position: "absolute",
    left: 0,
    right: 0,
    borderRadius: TRACK_THICKNESS / 2,
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
    left: (TRACK_THICKNESS - THUMB_SIZE) / 2,
  },
});
