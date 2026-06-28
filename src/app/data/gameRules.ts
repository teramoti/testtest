export const GAME_SESSION_SECONDS = 60

export const GAME_BOARD_SIZES = {
  easy: 4,
  normal: 6,
  hard: 8,
} as const

export type GameDifficulty = keyof typeof GAME_BOARD_SIZES

export const GAME_DIFFICULTY_TUNING = {
  easy: {
    blankCount: 2,
    robotStepMs: 3300,
    robotStepAccelerationMs: 4,
    minRobotStepMs: 2550,
    boostRobotStepReductionMs: 70,
    minBoostRobotStepMs: 2400,
    slideTweenMs: 115,
    robotTweenMs: 230,
    robotScale: 2.55,
    jewelExpireSeconds: 999,
    jewelExpireCount: 0,
    targetScore: 10,
    speedScoreStep: 22,
    warningRouteSteps: 12,
    dangerRouteSteps: 7,
  },
  normal: {
    blankCount: 4,
    robotStepMs: 2850,
    robotStepAccelerationMs: 6,
    minRobotStepMs: 2100,
    boostRobotStepReductionMs: 110,
    minBoostRobotStepMs: 1900,
    slideTweenMs: 135,
    robotTweenMs: 240,
    robotScale: 2.2,
    jewelExpireSeconds: 999,
    jewelExpireCount: 0,
    targetScore: 22,
    speedScoreStep: 18,
    warningRouteSteps: 9,
    dangerRouteSteps: 5,
  },
  hard: {
    blankCount: 2,
    robotStepMs: 1900,
    robotStepAccelerationMs: 14,
    minRobotStepMs: 1150,
    boostRobotStepReductionMs: 160,
    minBoostRobotStepMs: 980,
    slideTweenMs: 155,
    robotTweenMs: 250,
    robotScale: 1.8,
    jewelExpireSeconds: 28,
    jewelExpireCount: 2,
    targetScore: 36,
    speedScoreStep: 12,
    warningRouteSteps: 6,
    dangerRouteSteps: 3,
  },
} as const

export const difficultyDescriptions: Record<GameDifficulty, string> = {
  easy: '4×4の小さめ盤面です。ターン制で、初見でも操作を確認しながら遊べる低速設定です。',
  normal: '6×6の標準盤面です。TURN内で道づくりと宝石回収を両立する提出用の標準難度です。',
  hard: '8×8の広い盤面です。ロボットが速く、少ないTURNで先読みと連続スライドが必要です。',
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
