import { View, Text, StyleSheet, Pressable } from "react-native";
import { useGame } from "../contexts/GameContext";
import { ballSet } from "../engine/rules";
import { strings } from "../constants/strings";

const STATUS_HEIGHT = 24;

interface GameStatusBarProps {
  showHistory: boolean;
  onToggleHistory: () => void;
}

export default function GameStatusBar({ showHistory, onToggleHistory }: GameStatusBarProps) {
  const { rules, mode, balls, shotSnapshots } = useGame();
  const isPlaying = mode === "playing";
  const hasHistory = shotSnapshots.length > 0;

  const isPlacing = mode === "placing";

  let content: string | null = null;
  let extraStyle = null;

  if (isPlacing) {
    content = strings.table.placeCue;
  } else if (rules.result === "win") {
    content = strings.table.youWin;
    extraStyle = styles.statusWin;
  } else if (rules.result === "loss") {
    content = rules.foul ?? strings.table.youLose;
    extraStyle = styles.statusLoss;
  } else if (rules.foul) {
    content = strings.table.foul(rules.foul);
    extraStyle = styles.statusFoul;
  } else if (rules.assignedSet) {
    const myRemaining = balls.filter((b) => ballSet(b.number) === rules.assignedSet);
    if (myRemaining.length === 0) {
      content = strings.table.potTheEight;
    } else {
      content = rules.assignedSet === "solid" ? strings.table.assignedSolids : strings.table.assignedStripes;
    }
  }

  return (
    <View style={styles.statusContainer}>
      <View style={styles.statusLeft}>
        {content && <Text style={[styles.statusText, extraStyle]}>{content}</Text>}
      </View>
      {hasHistory && !isPlaying && (
        <Pressable
          style={({ pressed }) => [styles.historyToggle, pressed && styles.buttonPressed]}
          onPress={onToggleHistory}
        >
          <Text style={styles.historyToggleText}>
            {showHistory ? strings.history.controls : strings.history.history}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

export { STATUS_HEIGHT };

const styles = StyleSheet.create({
  statusContainer: {
    height: STATUS_HEIGHT,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    marginTop: 8,
    width: "100%",
  },
  statusLeft: {
    flex: 1,
  },
  statusText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
  },
  statusWin: {
    color: "#228B22",
    fontSize: 18,
  },
  statusLoss: {
    color: "#B22222",
    fontSize: 18,
  },
  statusFoul: {
    color: "#CC6600",
  },
  historyToggle: {
    backgroundColor: "#555",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 6,
  },
  historyToggleText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "600",
  },
  buttonPressed: {
    opacity: 0.7,
  },
});
