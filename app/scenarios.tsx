import { View, Text, StyleSheet, Pressable, FlatList } from "react-native";
import { useRouter } from "expo-router";
import { SCENARIOS } from "../engine/scenarios";

export default function ScenariosScreen() {
  const router = useRouter();

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
            onPress={() => router.push({ pathname: "/table", params: { scenario: item.id } })}
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
