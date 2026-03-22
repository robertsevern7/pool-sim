import { View, StyleSheet, Pressable } from "react-native";

const CUE_COLOR = "rgb(255, 255, 240)";
const OBJ_COLOR = "rgb(230, 50, 50)";
interface BallProps {
  x: number; // screen px from cloth left edge
  y: number; // screen px from cloth top edge
  radius: number; // screen px
  isCue: boolean;
  onPress?: () => void;
}

export default function Ball({ x, y, radius, isCue, onPress }: BallProps) {
  const size = radius * 2;
  const hitSlop = radius; // expand touch target
  const color = isCue ? CUE_COLOR : OBJ_COLOR;
  const ballView = (
    <View
      style={[
        styles.ball,
        {
          width: size,
          height: size,
          borderRadius: radius,
          backgroundColor: color,
          borderColor: color,
          left: x - radius,
          top: y - radius,
        },
      ]}
    />
  );

  if (!onPress) return ballView;

  return (
    <Pressable
      onPress={onPress}
      hitSlop={hitSlop}
      style={{
        position: "absolute",
        left: x - radius,
        top: y - radius,
        width: size,
        height: size,
      }}
    >
      <View
        style={[
          styles.ball,
          {
            width: size,
            height: size,
            borderRadius: radius,
            backgroundColor: color,
            borderColor: color,
            left: 0,
            top: 0,
          },
        ]}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  ball: {
    position: "absolute",
    borderWidth: 1,
  },
});
