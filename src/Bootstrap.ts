import { MainMenu } from './scenes/MainMenu.ts'
import { Start } from './scenes/StartScene.ts'
import { TurtleProto } from './scenes/TurtleProto.ts'
import { GameConfig } from './utils/GameConfig.ts'

const config = {
    type: Phaser.AUTO,
    title: 'Turtle Current',
    description: '',
    parent: 'game-container',
    width: GameConfig.GAME_WIDTH,
    height: GameConfig.GAME_HEIGHT,
    backgroundColor: '#f4efe6',
    pixelArt: false,
    scene: [
        Start,
        MainMenu,
        TurtleProto,
    ],
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
    },
}

new Phaser.Game(config)
