import { View, StyleSheet } from "react-native";
import type { TrajectoryPoint } from "../engine/physics/recorder";
import type { Vec2 } from "../engine/physics/vec2";

interface TrajectoryLineProps {
  path: TrajectoryPoint[];
  ballRadius: number;
  toScreen: (pos: Vec2) => { x: number; y: number };
  isCue: boolean;
}

const CUE_LINE_COLOR = "rgba(255, 255, 240, 0.25)";
const OBJ_LINE_COLOR = "rgba(230, 50, 50, 0.25)";
const CUE_GHOST_COLOR = "rgb(180, 180, 170)";
const OBJ_GHOST_COLOR = "rgb(150, 50, 50)";
const GHOST_BORDER_CUE = CUE_GHOST_COLOR;
const GHOST_BORDER_OBJ = OBJ_GHOST_COLOR;

export default function TrajectoryLine({ path, ballRadius, toScreen, isCue }: TrajectoryLineProps) {
  if (path.length < 2) return null;

  const lineColor = isCue ? CUE_LINE_COLOR : OBJ_LINE_COLOR;
  const ghostFill = isCue ? CUE_GHOST_COLOR : OBJ_GHOST_COLOR;
  const ghostBorder = isCue ? GHOST_BORDER_CUE : GHOST_BORDER_OBJ;
  const width = ballRadius * 2;

  const elements: React.ReactElement[] = [];

  // Line segments
  for (let i = 0; i < path.length - 1; i++) {
    const a = toScreen(path[i].pos);
    const b = toScreen(path[i + 1].pos);
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const length = Math.sqrt(dx * dx + dy * dy);
    if (length < 0.5) continue;

    const angle = Math.atan2(dy, dx);
    const cx = (a.x + b.x) / 2;
    const cy = (a.y + b.y) / 2;

    elements.push(
      <View
        key={`seg-${i}`}
        style={[
          styles.segment,
          {
            width: length + 1,
            height: width,
            backgroundColor: lineColor,
            left: cx - (length + 1) / 2,
            top: cy - width / 2,
            transform: [{ rotate: `${angle}rad` }],
          },
        ]}
      />,
    );
  }

  // Ghost balls at collision points
  for (let i = 0; i < path.length; i++) {
    if (!path[i].ghost) continue;
    const p = toScreen(path[i].pos);
    elements.push(
      <View
        key={`ghost-${i}`}
        style={[
          styles.ghost,
          {
            width: width,
            height: width,
            borderRadius: ballRadius,
            backgroundColor: ghostFill,
            borderColor: ghostBorder,
            left: p.x - ballRadius,
            top: p.y - ballRadius,
          },
        ]}
      />,
    );
  }

  return <>{elements}</>;
}

const styles = StyleSheet.create({
  segment: {
    position: "absolute",
  },
  ghost: {
    position: "absolute",
    borderWidth: 1,
  },
});
