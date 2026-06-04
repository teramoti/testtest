import { MainMenu } from './scenes/MainMenu.js';
import { Start } from './scenes/StartScene.js';
import { TurtleProto } from './scenes/TurtleProto.js';
import { GameConfig } from './utils/GameConfig.js';
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
        TurtleProto
    ],
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH
    }
};
new Phaser.Game(config);
