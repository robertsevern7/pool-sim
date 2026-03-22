import { View, StyleSheet } from "react-native";

const SIZE = 70;
const DOT_SIZE = 10;

export default function CueBallControl() {
  return (
    <View style={styles.container}>
      <View style={styles.ball}>
        <View style={styles.dot} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: SIZE + 8,
    height: SIZE + 8,
    justifyContent: "center",
    alignItems: "center",
  },
  ball: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    backgroundColor: "rgb(255, 255, 240)",
    borderWidth: 2,
    borderColor: "rgba(0, 0, 0, 0.3)",
    justifyContent: "center",
    alignItems: "center",
  },
  dot: {
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: DOT_SIZE / 2,
    backgroundColor: "rgb(200, 50, 50)",
  },
});
