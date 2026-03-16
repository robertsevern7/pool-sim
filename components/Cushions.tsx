import { View } from "react-native";
import { useMemo } from "react";

const CUSHION_COLOR = "rgb(45, 45, 45)";

const INCHES_TO_M = 0.0254;

// Pocket cut configuration — tweak these values
export const POCKET_CONFIG = {
  cornerAngle: 45,           // degrees — cut angle at corner pockets
  sideAngle: 85,             // degrees — cut angle at side pockets
  cornerPocketMouth: 4.5,    // inches — diagonal distance between nose tips at corner pockets
  sidePocketMouth: 5,        // inches — gap at rail edge at side pockets (total)
};

type Dir = "bl" | "br" | "tl" | "tr";

function tri(dir: Dir, legA: number, legB: number): object {
  const base = { width: 0, height: 0 };
  switch (dir) {
    case "bl": // ◣
      return { ...base, borderBottomWidth: legB, borderBottomColor: CUSHION_COLOR, borderRightWidth: legA, borderRightColor: "transparent" };
    case "br": // ◢
      return { ...base, borderBottomWidth: legB, borderBottomColor: CUSHION_COLOR, borderLeftWidth: legA, borderLeftColor: "transparent" };
    case "tl": // ◤
      return { ...base, borderTopWidth: legB, borderTopColor: CUSHION_COLOR, borderRightWidth: legA, borderRightColor: "transparent" };
    case "tr": // ◥
      return { ...base, borderTopWidth: legB, borderTopColor: CUSHION_COLOR, borderLeftWidth: legA, borderLeftColor: "transparent" };
  }
}

interface CushionsProps {
  tableWidth: number;
  tableHeight: number;
  railThickness: number;
  cushionThickness: number;
  scale: number; // pixels per meter
}

export default function Cushions({ tableWidth, tableHeight, railThickness, cushionThickness, scale }: CushionsProps) {
  const elements = useMemo(() => {
    const cw = tableWidth + 2 * cushionThickness;
    const ch = tableHeight + 2 * cushionThickness;
    const R = railThickness;
    const CT = cushionThickness;
    const ccd = POCKET_CONFIG.cornerAngle >= 90 ? 0 : CT / Math.tan((POCKET_CONFIG.cornerAngle * Math.PI) / 180);
    const scd = POCKET_CONFIG.sideAngle >= 90 ? 0 : CT / Math.tan((POCKET_CONFIG.sideAngle * Math.PI) / 180);
    // Gap measured at the cushion rectangle ends (rail edge)
    // Corner pocket mouth is measured diagonally between two perpendicular nose tips;
    // divide by sqrt(2) to get the per-rail offset, then add ccd so the gap is at the tips
    const cm = (POCKET_CONFIG.cornerPocketMouth * INCHES_TO_M * scale) / Math.SQRT2 + ccd;
    const sm = (POCKET_CONFIG.sidePocketMouth / 2) * INCHES_TO_M * scale;

    const segments: { key: string; left: number; top: number; width: number; height: number }[] = [
      { key: "top",    left: R + cm,      top: R,               width: cw - 2 * cm, height: CT },
      { key: "bottom", left: R + cm,      top: R + ch - CT,     width: cw - 2 * cm, height: CT },
      { key: "lt",     left: R,           top: R + cm,          width: CT, height: ch / 2 - cm - sm },
      { key: "lb",     left: R,           top: R + ch / 2 + sm, width: CT, height: ch / 2 - cm - sm },
      { key: "rt",     left: R + cw - CT, top: R + cm,          width: CT, height: ch / 2 - cm - sm },
      { key: "rb",     left: R + cw - CT, top: R + ch / 2 + sm, width: CT, height: ch / 2 - cm - sm },
    ];

    // Each nose triangle: [key, direction, legA, legB, left, top]
    const noses: [string, Dir, number, number, number, number][] = [
      // Top cushion
      ["top-l", "tr", ccd, CT, R + cm - ccd, R],
      ["top-r", "tl", ccd, CT, R + cw - cm,  R],
      // Bottom cushion (mirror of top around X axis)
      ["bot-l", "br", ccd, CT, R + cm - ccd, R + ch - CT],
      ["bot-r", "bl", ccd, CT, R + cw - cm,  R + ch - CT],
      // Left-top
      ["lt-t", "bl", CT, ccd, R, R + cm - ccd],
      ["lt-b", "tl", CT, scd, R, R + ch / 2 - sm],
      // Left-bottom (mirror of left-top around X axis)
      ["lb-t", "bl", CT, scd, R, R + ch / 2 + sm - scd],
      ["lb-b", "tl", CT, ccd, R, R + ch - cm],
      // Right-top (mirror of left-top around Y axis)
      ["rt-t", "br", CT, ccd, R + cw - CT, R + cm - ccd],
      ["rt-b", "tr", CT, scd, R + cw - CT, R + ch / 2 - sm],
      // Right-bottom (mirror of right-top around X axis)
      ["rb-t", "br", CT, scd, R + cw - CT, R + ch / 2 + sm - scd],
      ["rb-b", "tr", CT, ccd, R + cw - CT, R + ch - cm],
    ];

    return (
      <>
        {segments.map((s) => (
          <View
            key={s.key}
            style={{
              position: "absolute",
              left: s.left,
              top: s.top,
              width: s.width,
              height: s.height,
              backgroundColor: CUSHION_COLOR,
            }}
          />
        ))}
        {noses.map(([key, dir, legA, legB, left, top]) =>
          legA > 0 && legB > 0 ? (
            <View key={key} style={[{ position: "absolute", left, top }, tri(dir, legA, legB)]} />
          ) : null
        )}
      </>
    );
  }, [tableWidth, tableHeight, railThickness, cushionThickness, scale]);

  return elements;
}
