export const strings = {
  app: {
    title: "Pool Simulator",
  },
  home: {
    goToTable: "Go to the Table",
    scenarios: "Scenarios",
    debugScenarios: "Debug Scenarios",
  },
  screens: {
    home: "Home",
    table: "Table",
    scenarios: "Scenarios",
    debugScenarios: "Debug Scenarios",
  },
  table: {
    shoot: "Shoot",
    reset: "Reset",
    aimLeft: "◀",
    aimRight: "▶",
    aimLeftFine: "◁",
    aimRightFine: "▷",
  },
  scenarios: {
    free_play: { name: "Free Play", description: "Full rack — 15 balls" },
    rolling_direct: { name: "Rolling Direct", description: "Natural roll into object ball" },
    half_ball_rolling: { name: "Rolling ½ Ball", description: "Rolling cut shot" },
    stop_shot: { name: "Stop Shot", description: "Backspin — cue stops dead" },
    half_ball_stun: { name: "Stun ½ Ball", description: "Stun cut along tangent line" },
    max_draw: { name: "Max Draw", description: "Full backspin — cue draws back" },
    max_follow: { name: "Max Follow", description: "Full topspin — cue follows through" },
    lag_shot: { name: "Lag Shot", description: "Gentle roll to far rail and back" },
    baulk_to_rail: { name: "Baulk to Rail", description: "Calibration — just reaches far rail" },
    pot_corner_tr: { name: "Pot Corner TR", description: "Straight pot into top-right corner" },
    pot_corner_tl: { name: "Pot Corner TL", description: "Straight pot into top-left corner" },
    pot_corner_br: { name: "Pot Corner BR", description: "Straight pot into bottom-right corner" },
    pot_corner_bl: { name: "Pot Corner BL", description: "Straight pot into bottom-left corner" },
    pot_side: { name: "Pot Side", description: "Straight shot into side pocket" },
    pot_side_higher: { name: "Pot Side Higher", description: "Straight shot into side pocket from higher position" },
    pot_side_right: { name: "Pot Side Right", description: "Straight shot into right side pocket" },
    two_ball: { name: "Two Ball", description: "Cue ball and object ball — aim freely" },
  },
} as const;

export type ScenarioId = keyof typeof strings.scenarios;
