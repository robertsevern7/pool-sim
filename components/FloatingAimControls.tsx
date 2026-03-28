import { StyleSheet, Pressable, Text } from "react-native";
import { useGame, useGameDispatch, COARSE_AIM_STEP, FINE_AIM_STEP } from "../contexts/GameContext";
import { Vec2 } from "../engine/physics/vec2";
import { computeButtonPositions } from "../lib/aim-geometry";
import { strings } from "../constants/strings";

interface FloatingAimControlsProps {
  toScreen: (pos: Vec2) => { x: number; y: number };
  trajectories: { pos: Vec2 }[][];
  ballRadius: number;
}

/**
 * Floating left/right aim buttons positioned on either side of the
 * cue ball's trajectory line, overlaid on the table.
 */
export default function FloatingAimControls({
  toScreen,
  trajectories,
  ballRadius,
}: FloatingAimControlsProps) {
  const { mode, balls, rules } = useGame();
  const { adjustAngle } = useGameDispatch();

  const disabled =
    mode === "playing" || rules.foul !== null || rules.result !== null;
  if (mode !== "preview") return null;

  const cueBall = balls.find((b) => b.number === 0);
  if (!cueBall) return null;

  const cueScreen = toScreen(cueBall.pos);

  // Get the aim direction from the first trajectory segment
  const cuePath = trajectories[0];
  let aimAngle = 0; // radians, screen-space
  if (cuePath && cuePath.length >= 2) {
    const a = toScreen(cuePath[0].pos);
    const b = toScreen(cuePath[1].pos);
    aimAngle = Math.atan2(b.y - a.y, b.x - a.x);
  }

  const pos = computeButtonPositions(cueScreen, aimAngle, ballRadius);

  const btnSize = Math.max(ballRadius * 4.5, 42);
  const fineBtnSize = Math.max(ballRadius * 3.3, 33);

  // Rotate arrows so they point perpendicular to the trajectory.
  // The glyphs ◀/▶ point at 180°/0° by default; perpendicular is aimAngle ± π/2.
  const arrowRotation = `${aimAngle - Math.PI / 2}rad`;

  return (
    <>
      {/* Coarse left (counter-clockwise) */}
      <Pressable
        style={({ pressed }) => [
          styles.btn,
          {
            width: btnSize,
            height: btnSize,
            borderRadius: btnSize / 2,
            left: pos.coarseLeft.x - btnSize / 2,
            top: pos.coarseLeft.y - btnSize / 2,
          },
          pressed && !disabled && styles.pressed,
          disabled && styles.disabled,
        ]}
        onPress={() => adjustAngle(-COARSE_AIM_STEP)}
        disabled={disabled}
        hitSlop={8}
      >
        <Text style={[styles.label, { fontSize: Math.max(btnSize * 0.5, 14), transform: [{ rotate: arrowRotation }] }]}>
          {strings.table.aimLeft}
        </Text>
      </Pressable>

      {/* Fine left (counter-clockwise) */}
      <Pressable
        style={({ pressed }) => [
          styles.btn,
          styles.fineBtn,
          {
            width: fineBtnSize,
            height: fineBtnSize,
            borderRadius: fineBtnSize / 2,
            left: pos.fineLeft.x - fineBtnSize / 2,
            top: pos.fineLeft.y - fineBtnSize / 2,
          },
          pressed && !disabled && styles.pressed,
          disabled && styles.disabled,
        ]}
        onPress={() => adjustAngle(-FINE_AIM_STEP)}
        disabled={disabled}
        hitSlop={8}
      >
        <Text style={[styles.label, { fontSize: Math.max(fineBtnSize * 0.5, 11), transform: [{ rotate: arrowRotation }] }]}>
          {strings.table.aimLeftFine}
        </Text>
      </Pressable>

      {/* Coarse right (clockwise) */}
      <Pressable
        style={({ pressed }) => [
          styles.btn,
          {
            width: btnSize,
            height: btnSize,
            borderRadius: btnSize / 2,
            left: pos.coarseRight.x - btnSize / 2,
            top: pos.coarseRight.y - btnSize / 2,
          },
          pressed && !disabled && styles.pressed,
          disabled && styles.disabled,
        ]}
        onPress={() => adjustAngle(COARSE_AIM_STEP)}
        disabled={disabled}
        hitSlop={8}
      >
        <Text style={[styles.label, { fontSize: Math.max(btnSize * 0.5, 14), transform: [{ rotate: arrowRotation }] }]}>
          {strings.table.aimRight}
        </Text>
      </Pressable>

      {/* Fine right (clockwise) */}
      <Pressable
        style={({ pressed }) => [
          styles.btn,
          styles.fineBtn,
          {
            width: fineBtnSize,
            height: fineBtnSize,
            borderRadius: fineBtnSize / 2,
            left: pos.fineRight.x - fineBtnSize / 2,
            top: pos.fineRight.y - fineBtnSize / 2,
          },
          pressed && !disabled && styles.pressed,
          disabled && styles.disabled,
        ]}
        onPress={() => adjustAngle(FINE_AIM_STEP)}
        disabled={disabled}
        hitSlop={8}
      >
        <Text style={[styles.label, { fontSize: Math.max(fineBtnSize * 0.5, 11), transform: [{ rotate: arrowRotation }] }]}>
          {strings.table.aimRightFine}
        </Text>
      </Pressable>
    </>
  );
}

const styles = StyleSheet.create({
  btn: {
    position: "absolute",
    backgroundColor: "rgba(0, 0, 0, 0.45)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "rgba(255, 255, 255, 0.5)",
  },
  fineBtn: {
    backgroundColor: "rgba(0, 0, 0, 0.3)",
    borderColor: "rgba(255, 255, 255, 0.35)",
  },
  pressed: {
    backgroundColor: "rgba(0, 0, 0, 0.7)",
  },
  disabled: {
    opacity: 0.3,
  },
  label: {
    color: "#fff",
    fontWeight: "700",
  },
});
