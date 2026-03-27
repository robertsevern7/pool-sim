import { View, Text, StyleSheet, Pressable } from "react-native";
import { useState } from "react";
import { useGame, useGameDispatch } from "../contexts/GameContext";
import ShotHistoryCarousel, { type CarouselSelection } from "./ShotHistoryCarousel";
import { strings } from "../constants/strings";

const CONTROLS_HEIGHT = 150;

interface ShotHistoryPanelProps {
  onDismiss: () => void;
}

export default function ShotHistoryPanel({ onDismiss }: ShotHistoryPanelProps) {
  const { shotSnapshots, latestSnapshot, canReplay } = useGame();
  const { restoreToShot, restoreToLatest, replay } = useGameDispatch();
  const [selectedShot, setSelectedShot] = useState<CarouselSelection>(null);

  const handleSelect = (selection: number | "latest") => {
    setSelectedShot(selection);
    if (selection === "latest") {
      restoreToLatest();
    } else {
      restoreToShot(selection);
    }
  };

  return (
    <View style={styles.controlBar}>
      <View style={styles.historyPanel}>
        <ShotHistoryCarousel
          snapshots={shotSnapshots}
          latestSnapshot={latestSnapshot}
          selectedIndex={selectedShot}
          onSelect={handleSelect}
          onReplay={() => { replay(); onDismiss(); }}
          canReplay={canReplay}
        />
        {selectedShot !== null && (
          <Pressable
            style={({ pressed }) => [styles.goToShotButton, pressed && styles.buttonPressed]}
            onPress={() => { setSelectedShot(null); onDismiss(); }}
          >
            <Text style={styles.goToShotText}>
              {selectedShot === "latest" ? strings.history.goToLatest : strings.history.goToShot(selectedShot + 1)}
            </Text>
          </Pressable>
        )}
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
  historyPanel: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  buttonPressed: {
    opacity: 0.7,
  },
  goToShotButton: {
    backgroundColor: "#2a6a8a",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 6,
  },
  goToShotText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "600",
  },
});
