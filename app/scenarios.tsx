import { View, Text, StyleSheet, Pressable, FlatList } from "react-native";

const SCENARIOS = [
  { id: "rolling_direct", name: "Rolling Direct", description: "Natural roll into object ball" },
  { id: "half_ball_rolling", name: "Rolling ½ Ball", description: "Rolling cut shot" },
  { id: "stop_shot", name: "Stop Shot", description: "Backspin — cue stops dead" },
  { id: "half_ball_stun", name: "Stun ½ Ball", description: "Stun cut along tangent line" },
  { id: "max_draw", name: "Max Draw", description: "Full backspin — cue draws back" },
  { id: "max_follow", name: "Max Follow", description: "Full topspin — cue follows through" },
  { id: "lag_shot", name: "Lag Shot", description: "Gentle roll to far rail and back" },
  { id: "baulk_to_rail", name: "Baulk to Rail", description: "Calibration — just reaches far rail" },
];

export default function ScenariosScreen() {
  return (
    <View style={styles.container}>
      <FlatList
        data={SCENARIOS}
        numColumns={2}
        columnWrapperStyle={styles.row}
        contentContainerStyle={styles.grid}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <Pressable
            style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
          >
            <Text style={styles.cardTitle}>{item.name}</Text>
            <Text style={styles.cardDesc}>{item.description}</Text>
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#1e1e1e",
  },
  grid: {
    padding: 16,
  },
  row: {
    gap: 12,
    marginBottom: 12,
  },
  card: {
    flex: 1,
    backgroundColor: "#006432",
    borderRadius: 12,
    padding: 16,
    minHeight: 100,
    justifyContent: "center",
  },
  cardPressed: {
    opacity: 0.7,
  },
  cardTitle: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 4,
  },
  cardDesc: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 12,
  },
});
