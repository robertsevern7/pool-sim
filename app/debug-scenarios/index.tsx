import { View, Text, StyleSheet, Pressable, SectionList } from "react-native";
import { useRouter } from "expo-router";
import { DEBUG_SCENARIOS } from "../../engine/debug-scenarios";
import type { Scenario } from "../../engine/scenarios";

// Group consecutive scenarios by their (optional) `section` — unsectioned ones fall under
// a titleless default section rendered with no header, so existing scenarios are unaffected.
function groupBySection(scenarios: Scenario[]): { title: string; data: Scenario[] }[] {
  const sections: { title: string; data: Scenario[] }[] = [];
  for (const s of scenarios) {
    const title = s.section ?? "";
    const last = sections[sections.length - 1];
    if (last && last.title === title) last.data.push(s);
    else sections.push({ title, data: [s] });
  }
  return sections;
}

// Pair up items within each section so a 2-column grid still works inside SectionList
// (which lays out one row per section entry, unlike FlatList's numColumns).
function pairUp(items: Scenario[]): Scenario[][] {
  const rows: Scenario[][] = [];
  for (let i = 0; i < items.length; i += 2) rows.push(items.slice(i, i + 2));
  return rows;
}

export default function DebugScenariosScreen() {
  const router = useRouter();
  const sections = groupBySection(DEBUG_SCENARIOS).map((s) => ({ title: s.title, data: pairUp(s.data) }));

  return (
    <View style={styles.container}>
      <SectionList
        sections={sections}
        contentContainerStyle={styles.grid}
        keyExtractor={(row) => row.map((item) => item.id).join("-")}
        renderSectionHeader={({ section: { title } }) =>
          title ? <Text style={styles.sectionHeader}>{title}</Text> : null
        }
        renderItem={({ item: row }) => (
          <View style={styles.row}>
            {row.map((item) => (
              <Pressable
                key={item.id}
                style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
                onPress={() => router.push(`/debug-scenarios/${item.id}`)}
              >
                <Text style={styles.cardTitle}>{item.name}</Text>
                <Text style={styles.cardDesc}>{item.description}</Text>
              </Pressable>
            ))}
            {row.length === 1 && <View style={styles.cardSpacer} />}
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#1e1e1e" },
  grid: { padding: 16 },
  row: { flexDirection: "row", gap: 12, marginBottom: 12 },
  card: {
    flex: 1,
    backgroundColor: "#006432",
    borderRadius: 12,
    padding: 16,
    minHeight: 100,
    justifyContent: "center",
  },
  cardSpacer: { flex: 1 },
  cardPressed: { opacity: 0.7 },
  cardTitle: { color: "#fff", fontSize: 16, fontWeight: "700", marginBottom: 4 },
  cardDesc: { color: "rgba(255,255,255,0.7)", fontSize: 12 },
  sectionHeader: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
    marginTop: 8,
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
});
