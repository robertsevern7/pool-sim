export const strings = {
  app: {
    title: "Pool Simulator",
  },
  home: {
    goToTable: "Go to the Table",
    scenarios: "Scenarios",
  },
  screens: {
    home: "Home",
    table: "Table",
    scenarios: "Scenarios",
  },
  table: {
    shoot: "Shoot",
    reset: "Reset",
  },
  scenarios: {
    rolling_direct: { name: "Rolling Direct", description: "Natural roll into object ball" },
    half_ball_rolling: { name: "Rolling ½ Ball", description: "Rolling cut shot" },
    stop_shot: { name: "Stop Shot", description: "Backspin — cue stops dead" },
    half_ball_stun: { name: "Stun ½ Ball", description: "Stun cut along tangent line" },
    max_draw: { name: "Max Draw", description: "Full backspin — cue draws back" },
    max_follow: { name: "Max Follow", description: "Full topspin — cue follows through" },
    lag_shot: { name: "Lag Shot", description: "Gentle roll to far rail and back" },
    baulk_to_rail: { name: "Baulk to Rail", description: "Calibration — just reaches far rail" },
    pot_corner: { name: "Pot Corner", description: "Straight shot into corner pocket" },
    pot_side: { name: "Pot Side", description: "Straight shot into side pocket" },
  },
} as const;

export type ScenarioId = keyof typeof strings.scenarios;
