export const GAME_SESSION_SECONDS = 80

export const GAME_BOARD_SIZES = {
  easy: 5,
  normal: 6,
  hard: 7,
} as const

export type GameDifficulty = keyof typeof GAME_BOARD_SIZES

export function getGameTimeLimitSeconds() {
  return GAME_SESSION_SECONDS
}

export function getGameBoardSize(difficulty?: GameDifficulty) {
  if (!difficulty) return GAME_BOARD_SIZES.normal
  return GAME_BOARD_SIZES[difficulty] ?? GAME_BOARD_SIZES.normal
}
