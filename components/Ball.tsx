import { View, StyleSheet } from "react-native";

const CUE_COLOR = "rgb(255, 255, 240)";
const OBJ_COLOR = "rgb(230, 50, 50)";

interface BallProps {
  x: number; // screen px from cloth left edge
  y: number; // screen px from cloth top edge
  radius: number; // screen px
  isCue: boolean;
}

export default function Ball({ x, y, radius, isCue }: BallProps) {
  const size = radius * 2;
  return (
    <View
      style={[
        styles.ball,
        {
          width: size,
          height: size,
          borderRadius: radius,
          backgroundColor: isCue ? CUE_COLOR : OBJ_COLOR,
          borderColor: isCue ? CUE_COLOR : OBJ_COLOR,
          left: x - radius,
          top: y - radius,
        },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  ball: {
    position: "absolute",
    borderWidth: 1,
  },
});
