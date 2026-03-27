import { View, StyleSheet } from "react-native";
import { useState } from "react";
import { useGame, useGameDispatch } from "../contexts/GameContext";
import ShotHistoryCarousel, { type CarouselSelection } from "./ShotHistoryCarousel";

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
      <ShotHistoryCarousel
        snapshots={shotSnapshots}
        latestSnapshot={latestSnapshot}
        selectedIndex={selectedShot}
        onSelect={handleSelect}
        onReplay={() => { replay(); onDismiss(); }}
        canReplay={canReplay}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  controlBar: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
    flex: 1,
    height: "100%",
    paddingHorizontal: 24,
    marginTop: 8,
    overflow: "hidden",
  },
});
