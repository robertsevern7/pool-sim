import { View } from "react-native";
import { useMemo } from "react";
import { getPockets, STANDARD_9_FOOT, POCKET_CONFIG } from "../engine/physics/constants";

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

    const pockets = getPockets(STANDARD_9_FOOT).filter((p) => p.type === "corner");

    const cr = POCKET_CONFIG.cornerClothRadius * INCHES_TO_M * scale;
    const clipH = cr * 0.85;

    const screenPositions: { key: string; pocketIdx: number; cx: number; cy: number; rot: number }[] = [
      { key: "tl", pocketIdx: 0, cx: R,      cy: R,      rot: -45 },
      { key: "tr", pocketIdx: 1, cx: R + cw, cy: R,      rot: 45 },
      { key: "bl", pocketIdx: 2, cx: R,      cy: R + ch, rot: -135 },
      { key: "br", pocketIdx: 3, cx: R + cw, cy: R + ch, rot: 135 },
    ];

    const views: React.JSX.Element[] = [];

    for (const s of screenPositions) {
      const pocket = pockets[s.pocketIdx];
      const backR = pocket.backRadius * scale;
      const clipW = pocket.mouthWidth * scale;

      // Back semicircle
      views.push(
        <View
          key={`${s.key}-back`}
          style={{
            position: "absolute",
            left: s.cx - backR,
            top: s.cy - backR,
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
          key={`${s.key}-cloth`}
          style={{
            position: "absolute",
            left: s.cx - clipW / 2,
            top: s.cy,
            width: clipW,
            height: clipH,
            overflow: "hidden",
            transform: [
              { translateY: -clipH / 2 },
              { rotate: `${s.rot}deg` },
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
