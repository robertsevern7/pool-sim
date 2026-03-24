import { View, Text, StyleSheet, Pressable } from "react-native";
import { getBallVisual } from "../engine/balls";

interface BallProps {
  x: number;
  y: number;
  radius: number;
  ballNumber: number;
  onPress?: () => void;
}

export default function Ball({ x, y, radius, ballNumber, onPress }: BallProps) {
  const size = radius * 2;
  const hitSlop = radius;
  const visual = getBallVisual(ballNumber);

  const numberSize = Math.max(size * 0.45, 8);
  const showNumber = visual.style !== "cue" && size >= 12;

  const ballContent = (
    <View
      style={[
        styles.ball,
        {
          width: size,
          height: size,
          borderRadius: radius,
          backgroundColor: visual.style === "stripe" ? "#FFFFF0" : visual.color,
          borderColor: "rgba(0,0,0,0.2)",
        },
      ]}
    >
      {/* Stripe band */}
      {visual.style === "stripe" && (
        <View
          style={{
            position: "absolute",
            top: size * 0.2,
            left: 0,
            right: 0,
            height: size * 0.6,
            backgroundColor: visual.color,
            borderRadius: 0,
          }}
        />
      )}
      {/* Number circle */}
      {showNumber && (
        <View
          style={[
            styles.numberCircle,
            {
              width: numberSize,
              height: numberSize,
              borderRadius: numberSize / 2,
            },
          ]}
        >
          <Text
            style={[styles.numberText, { fontSize: numberSize * 0.6 }]}
            numberOfLines={1}
          >
            {visual.number}
          </Text>
        </View>
      )}
    </View>
  );

  if (!onPress) {
    return (
      <View style={{ position: "absolute", left: x - radius, top: y - radius }}>
        {ballContent}
      </View>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      hitSlop={hitSlop}
      style={{
        position: "absolute",
        left: x - radius,
        top: y - radius,
        width: size,
        height: size,
      }}
    >
      {ballContent}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  ball: {
    width: "100%",
    height: "100%",
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  numberCircle: {
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1,
  },
  numberText: {
    color: "#000",
    fontWeight: "700",
    textAlign: "center",
  },
});
