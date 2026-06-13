import Phaser from 'phaser'
import type { GameResult, GameSettings as AppGameSettings } from '../app/App'
import { getGameBoardSize, getGameDifficultyTuning, getGameTimeLimitSeconds } from '../app/data/gameRules.ts'
import { Start as RobotPreloadScene } from './robotSlide/scenes/RobotPreloadScene.ts'
import { RobotSlideScene } from './robotSlide/scenes/RobotSlideScene.ts'
import { GameConfig } from './robotSlide/utils/GameConfig.ts'

type RobotGameSettings = AppGameSettings & {
  hudTarget?: EventTarget
}

let game: Phaser.Game | null = null

export function startGame(
  parent: HTMLElement,
  settings: RobotGameSettings,
  onFinish: (result: GameResult) => void
) {
  destroyGame()
  const tuning = getGameDifficultyTuning(settings.difficulty)
  GameConfig.SESSION_SECONDS = getGameTimeLimitSeconds()
  GameConfig.BOARD_SIZE = getGameBoardSize(settings.difficulty)
  GameConfig.BLANK_COUNT = tuning.blankCount
  GameConfig.TILE_SIZE = Math.floor(Math.min(104, GameConfig.BOARD_SIZE >= 8 ? 576 / GameConfig.BOARD_SIZE : 540 / GameConfig.BOARD_SIZE))
  const boardPixelSize = GameConfig.BOARD_SIZE * GameConfig.TILE_SIZE
  GameConfig.BOARD_ORIGIN_X = Math.max(430, (GameConfig.GAME_WIDTH - boardPixelSize) / 2)
  GameConfig.BOARD_ORIGIN_Y = 388 - (GameConfig.BOARD_SIZE * GameConfig.TILE_SIZE) / 2
  GameConfig.ROBOT_SCALE = tuning.robotScale
  GameConfig.ROBOT_STEP_MS = tuning.robotStepMs
  GameConfig.ROBOT_STEP_ACCELERATION_MS = tuning.robotStepAccelerationMs
  GameConfig.MIN_ROBOT_STEP_MS = tuning.minRobotStepMs
  GameConfig.BOOST_ROBOT_STEP_REDUCTION_MS = tuning.boostRobotStepReductionMs
  GameConfig.MIN_BOOST_ROBOT_STEP_MS = tuning.minBoostRobotStepMs
  GameConfig.SLIDE_TWEEN_MS = tuning.slideTweenMs
  GameConfig.ROBOT_TWEEN_MS = tuning.robotTweenMs
  GameConfig.JEWEL_EXPIRE_SECONDS = tuning.jewelExpireSeconds
  GameConfig.JEWEL_EXPIRE_COUNT = tuning.jewelExpireCount
  GameConfig.TARGET_SCORE = tuning.targetScore
  GameConfig.SPEED_SCORE_STEP = tuning.speedScoreStep
  GameConfig.WARNING_ROUTE_STEPS = tuning.warningRouteSteps
  GameConfig.DANGER_ROUTE_STEPS = tuning.dangerRouteSteps

  const options = {
    settings,
    hudTarget: settings.hudTarget ?? null,
    onFinish,
  }

  game = new Phaser.Game({
    type: Phaser.AUTO,
    width: GameConfig.GAME_WIDTH,
    height: GameConfig.GAME_HEIGHT,
    parent,
    backgroundColor: '#071f29',
    scene: [
      new RobotPreloadScene(options),
      RobotSlideScene,
    ],
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
  })
}

export function destroyGame() {
  game?.destroy(true)
  game = null
}
