export const GAME_SESSION_SECONDS = 60

export const GAME_BOARD_SIZES = {
  easy: 4,
  normal: 6,
  hard: 8,
} as const

export type GameDifficulty = keyof typeof GAME_BOARD_SIZES

export const GAME_DIFFICULTY_TUNING = {
  easy: {
    blankCount: 4,
    robotStepMs: 1250,
    robotStepAccelerationMs: 25,
    minRobotStepMs: 760,
    boostRobotStepReductionMs: 120,
    minBoostRobotStepMs: 620,
    slideTweenMs: 130,
    robotTweenMs: 230,
    robotScale: 2.55,
    jewelExpireSeconds: 999,
    jewelExpireCount: 0,
    targetScore: 12,
    speedScoreStep: 8,
    warningRouteSteps: 6,
    dangerRouteSteps: 3,
  },
  normal: {
    blankCount: 4,
    robotStepMs: 1220,
    robotStepAccelerationMs: 35,
    minRobotStepMs: 680,
    boostRobotStepReductionMs: 150,
    minBoostRobotStepMs: 500,
    slideTweenMs: 140,
    robotTweenMs: 240,
    robotScale: 2.2,
    jewelExpireSeconds: 999,
    jewelExpireCount: 0,
    targetScore: 18,
    speedScoreStep: 10,
    warningRouteSteps: 5,
    dangerRouteSteps: 2,
  },
  hard: {
    blankCount: 3,
    robotStepMs: 1020,
    robotStepAccelerationMs: 55,
    minRobotStepMs: 460,
    boostRobotStepReductionMs: 190,
    minBoostRobotStepMs: 300,
    slideTweenMs: 155,
    robotTweenMs: 250,
    robotScale: 1.8,
    jewelExpireSeconds: 999,
    jewelExpireCount: 0,
    targetScore: 28,
    speedScoreStep: 12,
    warningRouteSteps: 4,
    dangerRouteSteps: 1,
  },
} as const

export const difficultyDescriptions: Record<GameDifficulty, string> = {
  easy: '4×4の小さめ盤面です。ロボットの移動も遅めで、道をつなげる練習向けです。',
  normal: '6×6の標準盤面です。移動に少し余裕を持たせた基本ルール向けです。',
  hard: '8×8の広い盤面です。先読みと複数スライドが重要になります。',
}

export function getGameTimeLimitSeconds() {
  return GAME_SESSION_SECONDS
}

export function getGameBoardSize(difficulty?: GameDifficulty) {
  if (!difficulty) return GAME_BOARD_SIZES.normal
  return GAME_BOARD_SIZES[difficulty] ?? GAME_BOARD_SIZES.normal
}

export function getGameDifficultyTuning(difficulty?: GameDifficulty) {
  if (!difficulty) return GAME_DIFFICULTY_TUNING.normal
  return GAME_DIFFICULTY_TUNING[difficulty] ?? GAME_DIFFICULTY_TUNING.normal
}
