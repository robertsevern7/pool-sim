import { View, Text, StyleSheet, Pressable } from "react-native";
import {
  useGame,
  useGameDispatch,
  MAX_POWER,
} from "../contexts/GameContext";
import CueBallControl from "./CueBallControl";
import PowerSlider from "./PowerSlider";
import { strings } from "../constants/strings";

export default function ShotControls() {
  const { mode, power, spin, rules } = useGame();
  const { shoot, setPower, setSpin } = useGameDispatch();
  const isPlaying = mode === "playing";
  const disabled = isPlaying || rules.foul !== null || rules.result !== null;

  return (
    <View style={styles.controlBar}>
      <View style={styles.side}>
        <CueBallControl spin={spin} onSpinChange={setSpin} disabled={disabled} />
      </View>

      <Pressable
        style={({ pressed }) => [
          styles.shootButton,
          pressed && styles.buttonPressed,
          disabled && styles.buttonDisabled,
        ]}
        onPress={shoot}
        disabled={disabled}
      >
        <Text style={styles.shootButtonText}>
          {strings.table.shoot}
        </Text>
      </Pressable>

      <View style={styles.side}>
        <PowerSlider value={power / MAX_POWER} onValueChange={(v) => setPower(v * MAX_POWER)} disabled={disabled} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  controlBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    flex: 1,
    height: "100%",
    marginTop: 8,
    paddingHorizontal: 24,
    gap: 24,
  },
  side: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    height: "100%",
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
});
