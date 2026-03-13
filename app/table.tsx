import { View, StyleSheet, useWindowDimensions } from "react-native";

// 9-foot table dimensions in meters (from pool-simulator engine)
const TABLE_WIDTH_M = 2.84;
const TABLE_HEIGHT_M = 1.42;
// Vertical table: rendered height/width = long side / short side
const ASPECT_RATIO = TABLE_WIDTH_M / TABLE_HEIGHT_M;

const RAIL_COLOR = "rgb(60, 30, 10)";
const CLOTH_COLOR = "rgb(0, 100, 50)";
const RAIL_THICKNESS = 32;

export default function TableScreen() {
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();

  const padding = 24;
  const maxWidth = screenWidth - padding * 2 - RAIL_THICKNESS * 2;
  const maxHeight = screenHeight - padding * 2 - RAIL_THICKNESS * 2;

  let tableWidth: number;
  let tableHeight: number;

  if (maxWidth * ASPECT_RATIO <= maxHeight) {
    tableWidth = maxWidth;
    tableHeight = maxWidth * ASPECT_RATIO;
  } else {
    tableHeight = maxHeight;
    tableWidth = maxHeight / ASPECT_RATIO;
  }

  return (
    <View style={styles.container}>
      {/* Rail border */}
      <View
        style={[
          styles.rail,
          {
            width: tableWidth + RAIL_THICKNESS * 2,
            height: tableHeight + RAIL_THICKNESS * 2,
            borderRadius: 10,
          },
        ]}
      >
        {/* Cloth surface */}
        <View
          style={[
            styles.cloth,
            {
              width: tableWidth,
              height: tableHeight,
            },
          ]}
        />
      </View>
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
  rail: {
    backgroundColor: RAIL_COLOR,
    justifyContent: "center",
    alignItems: "center",
  },
  cloth: {
    backgroundColor: CLOTH_COLOR,
  },
});
