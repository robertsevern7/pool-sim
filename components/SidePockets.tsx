import { View } from "react-native";
import { useMemo } from "react";
import { POCKET_CONFIG } from "../engine/physics/constants";

const POCKET_COLOR = "#f5f0dc";
const INCHES_TO_M = 0.0254;


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

    const cr = POCKET_CONFIG.sideClothRadius * INCHES_TO_M * scale;
    const sm = (POCKET_CONFIG.sidePocketMouth / 2) * INCHES_TO_M * scale;
    const scd = POCKET_CONFIG.sideAngle >= 90 ? 0 : CT / Math.tan((POCKET_CONFIG.sideAngle * Math.PI) / 180);

    // Back points are at the nose tips: ±(sm - scd) from center
    const backPt = sm - scd;
    const backR = backPt;

    // Arc passes through back points at ±backPt from center
    const arcSetback = Math.sqrt(cr * cr - backPt * backPt);
    // How far the arc protrudes past the back points line
    const sagitta = cr - arcSetback;

    const pockets: { key: string; cx: number; cy: number; dx: number }[] = [
      { key: "sl", cx: R,      cy: R + ch / 2, dx: -1 },
      { key: "sr", cx: R + cw, cy: R + ch / 2, dx: 1 },
    ];

    const views: React.JSX.Element[] = [];

    for (const p of pockets) {
      // Back semicircle — clip to only show the half facing the playing surface
      views.push(
        <View
          key={`${p.key}-back`}
          style={{
            position: "absolute",
            left: p.dx === -1 ? p.cx - backR - 1 * INCHES_TO_M * scale : p.cx + 1 * INCHES_TO_M * scale,
            top: p.cy - backR,
            width: backR,
            height: backR * 2,
            overflow: "hidden",
          }}
        >
          <View
            style={{
              position: "absolute",
              left: p.dx === -1 ? 0 : -backR,
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
      const arcX = p.cx - p.dx * (0.5 * INCHES_TO_M * scale);
      const oneInch = 1 * INCHES_TO_M * scale;
      const fillLeft = p.dx === -1 ? p.cx - oneInch : arcX;
      const fillRight = p.dx === -1 ? arcX : p.cx + oneInch;
      views.push(
        <View
          key={`${p.key}-fill`}
          style={{
            position: "absolute",
            left: fillLeft,
            top: p.cy - backPt,
            width: fillRight - fillLeft,
            height: backPt * 2,
            backgroundColor: POCKET_COLOR,
          }}
        />
      );

      // Cloth arc — rotated 90° so the clip aligns perpendicular to the rail
      const rot = p.dx === -1 ? -90 : 90;
      views.push(
        <View
          key={`${p.key}-cloth`}
          style={{
            position: "absolute",
            left: p.cx - p.dx * (0.5 * INCHES_TO_M * scale) - backPt,
            top: p.cy,
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
