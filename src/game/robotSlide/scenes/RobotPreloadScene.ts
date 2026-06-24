import Phaser from 'phaser'
/**
 * StartScene:
 * - 繧｢繧ｻ繝・ヨ縺ｮ繝励Μ繝ｭ繝ｼ繝峨→繧｢繝九Γ繝ｼ繧ｷ繝ｧ繝ｳ螳夂ｾｩ繧定｡後≧ Scene縲・ * - 隱ｭ縺ｿ霎ｼ縺ｿ螳御ｺ・ｾ後↓ MainMenu 繧帝幕蟋九☆繧九・ */
const UI_FONT = '"Trebuchet MS", "Yu Gothic UI", sans-serif'

export class Start extends Phaser.Scene {
    options: object

    constructor(options: object = {}) {
        super('Start')
        this.options = options
    }

    init(options: object = {}): void {
        if (Object.keys(options).length > 0) {
            this.options = options
        }
    }

    preload(): void {
        this.cameras.main.setBackgroundColor('#071f29')

        const title = this.add.text(640, 280, 'Wind-Up Route Rush', {
            fontFamily: UI_FONT,
            fontSize: '52px',
            color: '#fef5c2',
            fontStyle: 'bold',
        }).setOrigin(0.5)

        const subtitle = this.add.text(640, 334, 'Loading route gears', {
            fontFamily: UI_FONT,
            fontSize: '22px',
            color: '#b6ecf5',
        }).setOrigin(0.5)

        const track = this.add.graphics()
        track.fillStyle(0x0d4254, 0.96)
        track.fillRoundedRect(400, 396, 480, 16, 8)
        track.lineStyle(2, 0x6fd4df, 1)
        track.strokeRoundedRect(400, 396, 480, 16, 8)

        const fill = this.add.graphics()
        const progressText = this.add.text(640, 434, '0%', {
            fontFamily: UI_FONT,
            fontSize: '18px',
            color: '#c7fbff',
        }).setOrigin(0.5)

        this.load.on('progress', (value: number) => {
            fill.clear()
            fill.fillStyle(0x8fe5eb, 1)
            fill.fillRoundedRect(400, 396, Math.max(18, 480 * value), 16, 8)
            progressText.setText(`${Math.round(value * 100)}%`)
        })

        this.load.on('complete', () => {
            title.destroy()
            subtitle.destroy()
            track.destroy()
            fill.destroy()
            progressText.destroy()
        })

        this.load.image('game-background', 'assets/Image/title/title_background_1280x720.png')
        this.load.image('tile-straight-vertical', 'assets/Image/path_tiles_32x32/path_vertical.png')
        this.load.image('tile-straight-horizontal', 'assets/Image/path_tiles_32x32/path_horizontal.png')
        this.load.image('tile-corner-up-right', 'assets/Image/path_tiles_32x32/path_corner_top_right.png')
        this.load.image('tile-corner-right-down', 'assets/Image/path_tiles_32x32/path_corner_right_bottom.png')
        this.load.image('tile-corner-down-left', 'assets/Image/path_tiles_32x32/path_corner_left_bottom.png')
        this.load.image('tile-corner-left-up', 'assets/Image/path_tiles_32x32/path_corner_left_top.png')
        this.load.image('tile-cross', 'assets/Image/path_tiles_32x32/path_cross.png')
        this.load.image('tile-tee-up', 'assets/Image/path_tiles_32x32/path_t_up.png')
        this.load.image('tile-tee-right', 'assets/Image/path_tiles_32x32/path_t_right.png')
        this.load.image('tile-tee-down', 'assets/Image/path_tiles_32x32/path_t_down.png')
        this.load.image('tile-tee-left', 'assets/Image/path_tiles_32x32/path_t_left.png')
        this.load.image('tile-hole', 'assets/Image/path_tiles_32x32/path_hole.png')

        this.load.image('robot-idle', 'assets/Image/robot_32x32_frames/robot_right_idle.png')
        this.load.image('robot-front-idle', 'assets/Image/robot_32x32_frames/robot_front_idle.png')
        this.load.image('robot-back-idle', 'assets/Image/robot_32x32_frames/robot_back_idle.png')
        this.load.image('robot-left-idle', 'assets/Image/robot_32x32_frames/robot_left_idle.png')
        this.load.image('robot-right-idle', 'assets/Image/robot_32x32_frames/robot_right_idle.png')
        this.load.image('robot-front-walk-1', 'assets/Image/robot_32x32_frames/robot_front_walk1.png')
        this.load.image('robot-front-walk-2', 'assets/Image/robot_32x32_frames/robot_front_walk2.png')
        this.load.image('robot-left-walk-1', 'assets/Image/robot_32x32_frames/robot_left_walk1.png')
        this.load.image('robot-left-walk-2', 'assets/Image/robot_32x32_frames/robot_left_walk2.png')
        this.load.image('robot-right-walk-1', 'assets/Image/robot_32x32_frames/robot_right_walk1.png')
        this.load.image('robot-right-walk-2', 'assets/Image/robot_32x32_frames/robot_right_walk2.png')

        this.load.image('gem-idle', 'assets/Image/gem_anim_8frames_32x32/gem_anim_01.png')
        this.load.image('gem-blue-idle', 'assets/Image/gem_anim_8frames_32x32_blue/gem_anim_01.png')
        this.load.image('gem-cyan-idle', 'assets/Image/gem_anim_8frames_32x32_cyan/gem_anim_01.png')
        this.load.image('gem-purple-idle', 'assets/Image/gem_anim_8frames_32x32_purple/gem_anim_01.png')

        for (let index = 0; index < 8; index += 1) {
            this.load.image(`robot-walk-${index}`, `assets/Image/robot_32x32_frames/robot_right_walk${index % 2 === 0 ? 1 : 2}.png`)
        }

        for (let index = 0; index < 10; index += 1) {
            const gemFrame = Math.min(index + 1, 8).toString().padStart(2, '0')
            this.load.image(`gem-pickup-${index}`, `assets/Image/gem_anim_8frames_32x32/gem_anim_${gemFrame}.png`)
            const steamFrame = (index % 4) + 1
            this.load.image(`tile-slide-${index}`, `assets/Image/effects/steam/steam_${steamFrame.toString().padStart(2, '0')}.png`)
        }

        this.load.audio('se-slide', 'assets/slide.wav')
        this.load.audio('se-pickup', 'assets/pickup.wav')
        this.load.audio('se-fail', 'assets/fail.wav')
        this.load.audio('se-combo', 'assets/combo.wav')
    }

    create(): void {
        this.ensureAnimations()
        this.scene.start('RobotSlideScene', this.options)
    }

    ensureAnimations(): void {
        if (!this.anims.exists('robot-walk')) {
            this.anims.create({
                key: 'robot-walk',
                frames: Array.from({ length: 8 }, (_, index) => ({ key: `robot-walk-${index}` })),
                frameRate: 14,
                repeat: -1,
            })
        }

        if (!this.anims.exists('robot-walk-right')) {
            this.anims.create({
                key: 'robot-walk-right',
                frames: [{ key: 'robot-right-walk-1' }, { key: 'robot-right-walk-2' }],
                frameRate: 8,
                repeat: -1,
            })
        }

        if (!this.anims.exists('robot-walk-left')) {
            this.anims.create({
                key: 'robot-walk-left',
                frames: [{ key: 'robot-left-walk-1' }, { key: 'robot-left-walk-2' }],
                frameRate: 8,
                repeat: -1,
            })
        }

        if (!this.anims.exists('robot-walk-front')) {
            this.anims.create({
                key: 'robot-walk-front',
                frames: [{ key: 'robot-front-walk-1' }, { key: 'robot-front-walk-2' }],
                frameRate: 8,
                repeat: -1,
            })
        }

        if (!this.anims.exists('robot-walk-back')) {
            this.anims.create({
                key: 'robot-walk-back',
                frames: [{ key: 'robot-back-idle' }, { key: 'robot-back-idle' }],
                frameRate: 8,
                repeat: -1,
            })
        }

        if (!this.anims.exists('gem-pickup')) {
            this.anims.create({
                key: 'gem-pickup',
                frames: Array.from({ length: 10 }, (_, index) => ({ key: `gem-pickup-${index}` })),
                frameRate: 22,
                repeat: 0,
            })
        }

        if (!this.anims.exists('tile-slide')) {
            this.anims.create({
                key: 'tile-slide',
                frames: Array.from({ length: 10 }, (_, index) => ({ key: `tile-slide-${index}` })),
                frameRate: 26,
                repeat: 0,
            })
        }
    }
}
