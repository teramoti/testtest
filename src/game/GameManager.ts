import Phaser from 'phaser'
import type { GameResult, GameSettings as AppGameSettings } from '../app/App'
import { getGameBoardSize, getGameTimeLimitSeconds } from '../app/data/gameRules.ts'
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
  GameConfig.SESSION_SECONDS = getGameTimeLimitSeconds(settings.difficulty)
  GameConfig.BOARD_SIZE = getGameBoardSize(settings.difficulty)

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
