import { View, Text, StyleSheet, Pressable } from "react-native";
import {
  useGame,
  useGameDispatch,
  FINE_AIM_STEP,
  COARSE_AIM_STEP,
  MAX_POWER,
} from "../contexts/GameContext";
import CueBallControl from "./CueBallControl";
import PowerSlider from "./PowerSlider";
import { strings } from "../constants/strings";

const CONTROLS_HEIGHT = 150;

export default function ShotControls() {
  const { mode, power, spin } = useGame();
  const { shoot, adjustAngle, setPower, setSpin } = useGameDispatch();
  const isPlaying = mode === "playing";

  return (
    <View style={styles.controlBar}>
      <View style={styles.controlLeft}>
        <CueBallControl spin={spin} onSpinChange={setSpin} disabled={isPlaying} />
        <PowerSlider value={power / MAX_POWER} onValueChange={(v) => setPower(v * MAX_POWER)} disabled={isPlaying} />
      </View>

      <View style={styles.controlCenter}>
        <Pressable
          style={({ pressed }) => [
            styles.shootButton,
            pressed && styles.buttonPressed,
            isPlaying && styles.buttonDisabled,
          ]}
          onPress={shoot}
          disabled={isPlaying}
        >
          <Text style={styles.shootButtonText}>
            {strings.table.shoot}
          </Text>
        </Pressable>
      </View>

      <View style={styles.controlRight}>
        <View style={[styles.aimControls, isPlaying && styles.buttonDisabled]}>
          <View style={styles.aimRow}>
            <Pressable
              style={({ pressed }) => [styles.aimButton, !isPlaying && pressed && styles.buttonPressed]}
              onPress={() => adjustAngle(-COARSE_AIM_STEP)}
              disabled={isPlaying}
            >
              <Text style={styles.aimButtonText}>{strings.table.aimLeft}</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.aimButton, !isPlaying && pressed && styles.buttonPressed]}
              onPress={() => adjustAngle(COARSE_AIM_STEP)}
              disabled={isPlaying}
            >
              <Text style={styles.aimButtonText}>{strings.table.aimRight}</Text>
            </Pressable>
          </View>
          <View style={styles.aimRow}>
            <Pressable
              style={({ pressed }) => [styles.aimButtonFine, !isPlaying && pressed && styles.buttonPressed]}
              onPress={() => adjustAngle(-FINE_AIM_STEP)}
              disabled={isPlaying}
            >
              <Text style={styles.aimButtonFineText}>{strings.table.aimLeftFine}</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.aimButtonFine, !isPlaying && pressed && styles.buttonPressed]}
              onPress={() => adjustAngle(FINE_AIM_STEP)}
              disabled={isPlaying}
            >
              <Text style={styles.aimButtonFineText}>{strings.table.aimRightFine}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  controlBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
    height: CONTROLS_HEIGHT,
    paddingHorizontal: 16,
    marginTop: 16,
  },
  controlLeft: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  controlCenter: {
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  controlRight: {
    flex: 1,
    alignItems: "flex-end",
    justifyContent: "center",
  },
  shootButton: {
    backgroundColor: "#2a6a8a",
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonPressed: {
    opacity: 0.7,
  },
  buttonDisabled: {
    opacity: 0.4,
  },
  shootButtonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "600",
  },
  aimControls: {
    gap: 6,
    alignItems: "center",
  },
  aimRow: {
    flexDirection: "row",
    gap: 6,
  },
  aimButton: {
    backgroundColor: "#3a3a3a",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
  },
  aimButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  aimButtonFine: {
    backgroundColor: "#555",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
  },
  aimButtonFineText: {
    color: "#ddd",
    fontSize: 16,
    fontWeight: "600",
  },
});
