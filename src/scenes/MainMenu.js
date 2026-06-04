const MENU_FONT = '"Trebuchet MS", "Yu Gothic UI", sans-serif'

export class MainMenu extends Phaser.Scene {
    constructor() {
        super('MainMenu')
    }

    create(): void {
        this.cameras.main.setBackgroundColor('#071f29')

        const background = this.add.graphics()
        background.fillStyle(0x071f29, 1)
        background.fillRect(0, 0, 1280, 720)
        background.fillStyle(0x0d3847, 1)
        background.fillRect(0, 0, 1280, 260)
        background.fillStyle(0x1a6074, 0.65)
        background.fillRect(0, 260, 1280, 460)

        for (let index = 0; index < 5; index += 1) {
            const glow = this.add.ellipse(180 + index * 240, 420 + (index % 2) * 54, 260, 44, 0xa7edf5, 0.12)
            this.tweens.add({
                targets: glow,
                x: glow.x + 70,
                duration: 5200 + index * 900,
                yoyo: true,
                repeat: -1,
                ease: 'Sine.easeInOut',
            })
        }

        const panel = this.add.graphics()
        panel.fillStyle(0x072a36, 0.9)
        panel.fillRoundedRect(100, 80, 1080, 560, 38)
        panel.lineStyle(3, 0x8be2ef, 1)
        panel.strokeRoundedRect(100, 80, 1080, 560, 38)

        this.add.text(640, 138, 'Turtle Current', {
            fontFamily: MENU_FONT,
            fontSize: '50px',
            color: '#fef5c2',
            fontStyle: 'bold',
        }).setOrigin(0.5)

        this.add.text(640, 186, '先読みで海流をつなぎ、相手より多く得点するポイントバトル', {
            fontFamily: MENU_FONT,
            fontSize: '23px',
            color: '#c2f7ff',
        }).setOrigin(0.5)

        const turtle = this.add.sprite(226, 152, 'turtle-idle')
        turtle.setScale(0.82)
        turtle.play('turtle-walk')
        turtle.angle = 10

        const gem = this.add.image(1056, 156, 'gem-idle')
        gem.setScale(0.68)
        this.tweens.add({
            targets: gem,
            y: gem.y - 12,
            duration: 860,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut',
        })

        const showcase = [
            { key: 'tile-straight', x: 468, y: 232, angle: 0 },
            { key: 'tile-corner', x: 552, y: 232, angle: 0 },
            { key: 'tile-cross', x: 636, y: 232, angle: 0 },
            { key: 'tile-tee', x: 720, y: 232, angle: 0 },
            { key: 'tile-branch', x: 804, y: 232, angle: 90 },
        ]

        for (const tile of showcase) {
            const image = this.add.image(tile.x, tile.y, tile.key)
            image.setScale(0.5)
            image.setAngle(tile.angle)
        }

        const bulletStyle = {
            fontFamily: MENU_FONT,
            fontSize: '23px',
            color: '#d6f4fb',
        }

        this.add.text(174, 296, '・道を伸ばすほど高得点', bulletStyle)
        this.add.text(174, 344, '・危険ルートは赤く点滅', bulletStyle)
        this.add.text(174, 392, '・FLOW と NO MISS が倍率になる', bulletStyle)
        this.add.text(174, 440, '・BOOST 中は亀が加速', bulletStyle)

        this.add.text(676, 296, '・青い予測ラインで数手先を読む', bulletStyle)
        this.add.text(676, 344, '・RIVAL SCORE を上回り続ける', bulletStyle)
        this.add.text(676, 392, '・中盤以降は相手の加速が強まる', bulletStyle)
        this.add.text(676, 440, '・クラッシュすると相手に流れを渡す', bulletStyle)

        const hintPanel = this.add.graphics()
        hintPanel.fillStyle(0x0f4251, 0.96)
        hintPanel.fillRoundedRect(174, 500, 932, 72, 24)
        hintPanel.lineStyle(2, 0x6fd4df, 1)
        hintPanel.strokeRoundedRect(174, 500, 932, 72, 24)

        this.add.text(640, 536, '重要なのは「次の1歩」ではなく「数歩先まで道が残るか」と「相手との差」です。', {
            fontFamily: MENU_FONT,
            fontSize: '24px',
            color: '#fff3c7',
        }).setOrigin(0.5)

        const startButtonBg = this.add.graphics()
        startButtonBg.fillStyle(0x8fe5eb, 1)
        startButtonBg.fillRoundedRect(500, 594, 280, 54, 24)
        startButtonBg.lineStyle(2, 0xdffcff, 1)
        startButtonBg.strokeRoundedRect(500, 594, 280, 54, 24)
        const startButton = this.add.text(640, 621, 'START DIVE', {
            fontFamily: MENU_FONT,
            fontSize: '28px',
            color: '#072a36',
            fontStyle: 'bold',
        }).setOrigin(0.5)

        startButtonBg.setInteractive(
            new Phaser.Geom.Rectangle(500, 594, 280, 54),
            Phaser.Geom.Rectangle.Contains,
        )
        startButtonBg.on('pointerdown', () => {
            this.scene.start('TurtleProto')
        })

        this.tweens.add({
            targets: startButtonBg,
            alpha: 0.86,
            duration: 760,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut',
        })
    }
}
