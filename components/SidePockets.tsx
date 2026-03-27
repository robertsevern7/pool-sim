import { View } from "react-native";
import { useMemo } from "react";
import { getPockets, STANDARD_9_FOOT, POCKET_CONFIG, type Pocket } from "../engine/physics/constants";

const POCKET_COLOR = "#f5f0dc";

interface SidePocketsProps {
  tableWidth: number;
  tableHeight: number;
  railThickness: number;
  cushionThickness: number;
  scale: number;
}

export default function SidePockets({ tableWidth, tableHeight, railThickness, cushionThickness, scale }: SidePocketsProps) {
  const elements = useMemo(() => {
    const R = railThickness;
    const CT = cushionThickness;
    const cw = tableWidth + 2 * CT;
    const ch = tableHeight + 2 * CT;
    const pockets = getPockets(STANDARD_9_FOOT).filter((p) => p.type === "side");

    const views: React.JSX.Element[] = [];

    const screenPositions: { key: string; pocket: Pocket; cx: number; cy: number; dx: number }[] = [
      { key: "sl", pocket: pockets[0], cx: R,      cy: R + ch / 2, dx: -1 },
      { key: "sr", pocket: pockets[1], cx: R + cw, cy: R + ch / 2, dx: 1 },
    ];

    for (const s of screenPositions) {
      const cr = s.pocket.fallRadius * scale;
      const backR = s.pocket.backRadius * scale;
      const backPt = backR;
      const arcSetback = Math.sqrt(cr * cr - backPt * backPt);
      const sagitta = cr - arcSetback;

      // Back semicircle — clip to only show the half facing the playing surface
      const oneInch = 0.0254 * scale;
      views.push(
        <View
          key={`${s.key}-back`}
          style={{
            position: "absolute",
            left: s.dx === -1 ? s.cx - backR - oneInch : s.cx + oneInch,
            top: s.cy - backR,
            width: backR,
            height: backR * 2,
            overflow: "hidden",
          }}
        >
          <View
            style={{
              position: "absolute",
              left: s.dx === -1 ? 0 : -backR,
              top: 0,
              width: backR * 2,
              height: backR * 2,
              borderRadius: backR,
              backgroundColor: POCKET_COLOR,
            }}
          />
        </View>
      );

      // Rectangle filling gap between cloth arc and back semicircle
      const inset = POCKET_CONFIG.sidePocketInset * 0.0254 * scale;
      const arcX = s.cx - s.dx * inset;
      // Extend fill 1px into the semicircle to avoid subpixel gap
      const fillLeft = s.dx === -1 ? s.cx - oneInch - 1 : arcX;
      const fillRight = s.dx === -1 ? arcX : s.cx + oneInch + 1;
      views.push(
        <View
          key={`${s.key}-fill`}
          style={{
            position: "absolute",
            left: fillLeft,
            top: s.cy - backPt,
            width: fillRight - fillLeft,
            height: backPt * 2,
            backgroundColor: POCKET_COLOR,
          }}
        />
      );

      // Cloth arc — rotated 90° so the clip aligns perpendicular to the rail
      const rot = s.dx === -1 ? -90 : 90;
      views.push(
        <View
          key={`${s.key}-cloth`}
          style={{
            position: "absolute",
            left: s.cx - s.dx * inset - backPt,
            top: s.cy,
            width: backPt * 2,
            height: sagitta,
            overflow: "hidden",
            transform: [
              { translateY: -sagitta / 2 },
              { rotate: `${rot}deg` },
              { translateY: sagitta / 2 },
            ],
          }}
        >
          <View
            style={{
              position: "absolute",
              left: backPt - cr,
              top: sagitta - cr * 2,
              width: cr * 2,
              height: cr * 2,
              borderRadius: cr,
              backgroundColor: POCKET_COLOR,
            }}
          />
        </View>
      );
    }

    return <>{views}</>;
  }, [tableWidth, tableHeight, railThickness, cushionThickness, scale]);

  return elements;
}
