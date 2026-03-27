import { View, Text, ScrollView, Pressable, StyleSheet } from "react-native";
import { useState } from "react";
import { STANDARD_9_FOOT, BALL_RADIUS } from "../engine/physics/constants";
import { getBallVisual } from "../engine/balls";
import type { SnapshotBall } from "../contexts/GameContext";
import { strings } from "../constants/strings";

const TABLE_W = STANDARD_9_FOOT.width;
const TABLE_H = STANDARD_9_FOOT.height;
const ASPECT = TABLE_H / TABLE_W;
const LABEL_HEIGHT = 20;

/** "latest" is a special selection meaning the tip/current state */
export type CarouselSelection = number | "latest" | null;

interface ShotHistoryCarouselProps {
  snapshots: { balls: SnapshotBall[] }[];
  latestSnapshot: { balls: SnapshotBall[] } | null;
  selectedIndex: CarouselSelection;
  onSelect: (selection: number | "latest") => void;
  onReplay: () => void;
  canReplay: boolean;
}

export default function ShotHistoryCarousel({
  snapshots,
  latestSnapshot,
  selectedIndex,
  onSelect,
  onReplay,
  canReplay,
}: ShotHistoryCarouselProps) {
  const [containerHeight, setContainerHeight] = useState(0);
  const measured = containerHeight > 0;
  const thumbHeight = measured ? containerHeight - LABEL_HEIGHT - 8 : 80;
  const thumbWidth = thumbHeight * ASPECT;

  if (snapshots.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>{strings.history.noShots}</Text>
      </View>
    );
  }

  return (
    <View
      style={styles.container}
      onLayout={(e) => setContainerHeight(e.nativeEvent.layout.height)}
    >
      <View style={[styles.carouselRow, !measured && { opacity: 0 }]}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.scroll}
            style={styles.scrollContainer}
          >
            {snapshots.map((snapshot, i) => (
              <Pressable
                key={i}
                style={({ pressed }) => [
                  styles.card,
                  pressed && styles.pressed,
                  selectedIndex === i && styles.cardSelected,
                ]}
                onPress={() => onSelect(i)}
              >
                <TableThumbnail balls={snapshot.balls} selected={selectedIndex === i} thumbWidth={thumbWidth} thumbHeight={thumbHeight} />
                <Text style={[styles.label, selectedIndex === i && styles.labelSelected]}>
                  {strings.history.shot(i + 1)}
                </Text>
              </Pressable>
            ))}
            {latestSnapshot && (
              <Pressable
                style={({ pressed }) => [
                  styles.card,
                  pressed && styles.pressed,
                  selectedIndex === "latest" && styles.cardSelected,
                ]}
                onPress={() => onSelect("latest")}
              >
                <TableThumbnail balls={latestSnapshot.balls} selected={selectedIndex === "latest"} thumbWidth={thumbWidth} thumbHeight={thumbHeight} />
                <Text style={[styles.label, selectedIndex === "latest" && styles.labelSelected]}>
                  {strings.history.latest}
                </Text>
              </Pressable>
            )}
          </ScrollView>
          {canReplay && (
            <Pressable
              style={({ pressed }) => [styles.replayButton, pressed && styles.pressed]}
              onPress={onReplay}
            >
              <Text style={styles.replayText}>{strings.history.replayAll}</Text>
            </Pressable>
          )}
      </View>
    </View>
  );
}

function TableThumbnail({ balls, selected, thumbWidth, thumbHeight }: { balls: SnapshotBall[]; selected: boolean; thumbWidth: number; thumbHeight: number }) {
  const scaleX = thumbWidth / TABLE_H;
  const scaleY = thumbHeight / TABLE_W;
  const dotRadius = Math.max(BALL_RADIUS * scaleX, 2);

  return (
    <View style={[styles.table, selected && styles.tableSelected, { width: thumbWidth, height: thumbHeight }]}>
      {balls.map((b) => {
        const visual = getBallVisual(b.number);
        const x = b.pos[1] * scaleX;
        const y = b.pos[0] * scaleY;
        return (
          <View
            key={b.number}
            style={{
              position: "absolute",
              left: x - dotRadius,
              top: y - dotRadius,
              width: dotRadius * 2,
              height: dotRadius * 2,
              borderRadius: dotRadius,
              backgroundColor: visual.color,
              borderWidth: b.number === 0 ? 0.5 : 0,
              borderColor: "rgba(0,0,0,0.3)",
            }}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    height: "100%",
  },
  carouselRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  scrollContainer: {
    flex: 1,
  },
  replayButton: {
    backgroundColor: "#2a6a8a",
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 6,
    marginLeft: 12,
  },
  replayText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "600",
  },
  scroll: {
    gap: 10,
  },
  card: {
    alignItems: "center",
    gap: 4,
    padding: 4,
    borderRadius: 6,
  },
  cardSelected: {
    backgroundColor: "rgba(42, 106, 138, 0.15)",
  },
  pressed: {
    opacity: 0.7,
  },
  table: {
    backgroundColor: "rgb(90, 170, 210)",
    borderRadius: 4,
    borderWidth: 2,
    borderColor: "rgb(20, 20, 20)",
    overflow: "hidden",
  },
  tableSelected: {
    borderColor: "#2a6a8a",
    borderWidth: 3,
  },
  label: {
    fontSize: 12,
    fontWeight: "600",
    color: "#555",
  },
  labelSelected: {
    color: "#2a6a8a",
    fontWeight: "700",
  },
  emptyContainer: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 24,
  },
  emptyText: {
    fontSize: 14,
    color: "#999",
  },
});
