import { Link } from "expo-router";
import { Text, View, StyleSheet } from "react-native";

export default function Index() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Pool Simulator</Text>
      <Link href="/table" style={styles.link}>
        <Text style={styles.linkText}>Go to the Table</Text>
      </Link>
      <Link href="/scenarios" style={[styles.link, { marginTop: 12 }]}>
        <Text style={styles.linkText}>Scenarios</Text>
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#1e1e1e",
  },
  title: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#dcdcdc",
    marginBottom: 24,
  },
  link: {
    backgroundColor: "#006432",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  linkText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "600",
  },
});
