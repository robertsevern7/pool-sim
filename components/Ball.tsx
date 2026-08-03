import { View, Text, StyleSheet, Pressable } from "react-native";
import { getBallVisual } from "../engine/balls";
import type { Vec3 } from "../engine/physics/orientation";
import { projectSpinMarker } from "../lib/ball-spin";

interface BallProps {
  x: number;
  y: number;
  radius: number;
  ballNumber: number;
  /** Current spin-marker surface point (see orientation.ts) — drives the rolling look. */
  point: Vec3;
  /** Signed accumulated english (radians) — the stripe band's real on-screen rotation. */
  sideSpinAngle: number;
  /** Accumulated roll rate (radians) — pulses the band's width instead of rotating it. */
  rollPhase: number;
  onPress?: () => void;
}

const STRIPE_BASE_FRACTION = 0.6;
const STRIPE_PULSE_AMPLITUDE = 0.12;

export default function Ball({ x, y, radius, ballNumber, point, sideSpinAngle, rollPhase, onPress }: BallProps) {
  const size = radius * 2;
  const hitSlop = radius;
  const visual = getBallVisual(ballNumber);

  const numberSize = Math.max(size * 0.45, 8);
  const showNumber = visual.style !== "cue" && size >= 12;

  const marker = projectSpinMarker(point, radius);
  const markerSize = Math.max(size * 0.16, 3);

  // Roll (omega) tips the ball's near side toward/away from the camera — not a screen-plane
  // rotation — so instead of spinning the band, its width pulses at the real roll rate,
  // bounded well clear of zero so it never reads as "plain white". English (spinZ) really is
  // a rotation about the viewing axis, so that alone drives the band's actual on-screen angle.
  const stripeHeightFraction = STRIPE_BASE_FRACTION + STRIPE_PULSE_AMPLITUDE * Math.cos(rollPhase);
  const stripeHeight = size * stripeHeightFraction;
  const stripeTop = (size - stripeHeight) / 2;
  const sideSpinDeg = (sideSpinAngle * 180) / Math.PI;

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
      {/* Stripe band — see the roll/english split above. */}
      {visual.style === "stripe" && (
        <View
          style={{
            position: "absolute",
            top: stripeTop,
            left: 0,
            right: 0,
            height: stripeHeight,
            backgroundColor: visual.color,
            borderRadius: 0,
            transform: [{ rotate: `${sideSpinDeg}deg` }],
          }}
        />
      )}
      {/* Number circle — same surface point as the stripe band, so both move/fade together
          as the ball actually rotates instead of staying fixed in place. */}
      {showNumber && (
        <View
          style={[
            styles.numberCircle,
            {
              width: numberSize,
              height: numberSize,
              borderRadius: numberSize / 2,
              opacity: marker.opacity,
              transform: [{ translateX: marker.dx }, { translateY: marker.dy }],
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
      {/* Balls with no number patch (the cue ball, or ones too small to show one) still
          need some visible marking to show the roll, so fall back to a plain dot. */}
      {!showNumber && (
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            left: radius + marker.dx - markerSize / 2,
            top: radius + marker.dy - markerSize / 2,
            width: markerSize,
            height: markerSize,
            borderRadius: markerSize / 2,
            backgroundColor: "rgba(0,0,0,0.35)",
            opacity: marker.opacity,
          }}
        />
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
