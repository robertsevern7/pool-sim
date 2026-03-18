import { View } from "react-native";
import { useMemo } from "react";
import { POCKET_CONFIG } from "../engine/physics/constants";

const POCKET_COLOR = "#f5f0dc";
const INCHES_TO_M = 0.0254;


interface CornerPocketsProps {
  tableWidth: number;
  tableHeight: number;
  railThickness: number;
  cushionThickness: number;
  scale: number;
}

export default function CornerPockets({ tableWidth, tableHeight, railThickness, cushionThickness, scale }: CornerPocketsProps) {
  const elements = useMemo(() => {
    const R = railThickness;
    const CT = cushionThickness;
    const cw = tableWidth + 2 * CT;
    const ch = tableHeight + 2 * CT;

    const cr = POCKET_CONFIG.cornerClothRadius * INCHES_TO_M * scale;
    const clipW = POCKET_CONFIG.cornerPocketMouth * INCHES_TO_M * scale;
    const backR = clipW / 2;
    const clipH = cr * 0.85;

    const pockets: { key: string; cx: number; cy: number; rot: number }[] = [
      { key: "tl", cx: R,      cy: R,      rot: -45 },
      { key: "tr", cx: R + cw, cy: R,      rot: 45 },
      { key: "bl", cx: R,      cy: R + ch, rot: -135 },
      { key: "br", cx: R + cw, cy: R + ch, rot: 135 },
    ];

    const views: React.JSX.Element[] = [];

    for (const p of pockets) {
      // Back semicircle
      views.push(
        <View
          key={`${p.key}-back`}
          style={{
            position: "absolute",
            left: p.cx - backR,
            top: p.cy - backR,
            width: backR * 2,
            height: backR * 2,
            borderRadius: backR,
            backgroundColor: POCKET_COLOR,
          }}
        />
      );

      // Cloth arc — large circle clipped to mouth width
      views.push(
        <View
          key={`${p.key}-cloth`}
          style={{
            position: "absolute",
            left: p.cx - clipW / 2,
            top: p.cy,
            width: clipW,
            height: clipH,
            overflow: "hidden",
            transform: [
              { translateY: -clipH / 2 },
              { rotate: `${p.rot}deg` },
              { translateY: clipH / 2 },
            ],
          }}
        >
          <View
            style={{
              position: "absolute",
              left: clipW / 2 - cr,
              top: -cr * 1.25,
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
