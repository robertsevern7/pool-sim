export interface BallVisual {
  number: number;
  color: string;
  style: "cue" | "solid" | "stripe" | "eight";
}

export const BALL_VISUALS: BallVisual[] = [
  { number: 0,  color: "#FFFFF0", style: "cue" },
  { number: 1,  color: "#FFD700", style: "solid" },
  { number: 2,  color: "#0000CD", style: "solid" },
  { number: 3,  color: "#FF4500", style: "solid" },
  { number: 4,  color: "#800080", style: "solid" },
  { number: 5,  color: "#FF8C00", style: "solid" },
  { number: 6,  color: "#228B22", style: "solid" },
  { number: 7,  color: "#8B0000", style: "solid" },
  { number: 8,  color: "#000000", style: "eight" },
  { number: 9,  color: "#FFD700", style: "stripe" },
  { number: 10, color: "#0000CD", style: "stripe" },
  { number: 11, color: "#FF4500", style: "stripe" },
  { number: 12, color: "#800080", style: "stripe" },
  { number: 13, color: "#FF8C00", style: "stripe" },
  { number: 14, color: "#228B22", style: "stripe" },
  { number: 15, color: "#8B0000", style: "stripe" },
];

export function getBallVisual(ballNumber: number): BallVisual {
  return BALL_VISUALS[ballNumber] ?? BALL_VISUALS[0];
}
