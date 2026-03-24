import { View, StyleSheet } from "react-native";
import type { TrajectoryPoint } from "../engine/physics/recorder";
import type { Vec2 } from "../engine/physics/vec2";
import { getBallVisual } from "../engine/balls";

export interface TrajectoryLineProps {
  path: TrajectoryPoint[];
  ballRadius: number;
  toScreen: (pos: Vec2) => { x: number; y: number };
  ballNumber: number;
}

export default function TrajectoryLine({ path, ballRadius, toScreen, ballNumber }: TrajectoryLineProps) {
  if (path.length < 2) return null;

  const visual = getBallVisual(ballNumber);
  const isCue = ballNumber === 0;
  const baseColor = isCue ? "255, 255, 240" : hexToRgb(visual.color);
  const lineColor = `rgba(${baseColor}, 0.25)`;
  const ghostFill = isCue ? "rgb(180, 180, 170)" : `rgba(${baseColor}, 0.5)`;
  const ghostBorder = ghostFill;
  const width = ballRadius * 2;

  const elements: React.ReactElement[] = [];

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

function hexToRgb(hex: string): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `${r}, ${g}, ${b}`;
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
