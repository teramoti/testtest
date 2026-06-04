const UI_FONT = '"Trebuchet MS", "Yu Gothic UI", sans-serif';
export class Start extends Phaser.Scene {
    constructor(){
        super('Start');
    }
    preload() {
        this.cameras.main.setBackgroundColor('#071f29');
        const title = this.add.text(640, 280, 'Turtle Current', {
            fontFamily: UI_FONT,
            fontSize: '52px',
            color: '#fef5c2',
            fontStyle: 'bold'
        }).setOrigin(0.5);
        const subtitle = this.add.text(640, 334, 'Loading dive assets', {
            fontFamily: UI_FONT,
            fontSize: '22px',
            color: '#b6ecf5'
        }).setOrigin(0.5);
        const track = this.add.graphics();
        track.fillStyle(0x0d4254, 0.96);
        track.fillRoundedRect(400, 396, 480, 16, 8);
        track.lineStyle(2, 0x6fd4df, 1);
        track.strokeRoundedRect(400, 396, 480, 16, 8);
        const fill = this.add.graphics();
        const progressText = this.add.text(640, 434, '0%', {
            fontFamily: UI_FONT,
            fontSize: '18px',
            color: '#c7fbff'
        }).setOrigin(0.5);
        this.load.on('progress', (value)=>{
            fill.clear();
            fill.fillStyle(0x8fe5eb, 1);
            fill.fillRoundedRect(400, 396, Math.max(18, 480 * value), 16, 8);
            progressText.setText(`${Math.round(value * 100)}%`);
        });
        this.load.on('complete', ()=>{
            title.destroy();
            subtitle.destroy();
            track.destroy();
            fill.destroy();
            progressText.destroy();
        });
        this.load.image('tile-straight', 'assets/tile_straight.png');
        this.load.image('tile-corner', 'assets/tile_curve.png');
        this.load.image('tile-cross', 'assets/tile_cross.png');
        this.load.image('tile-tee', 'assets/tile_t.png');
        this.load.image('tile-branch', 'assets/tile_t.png');
        this.load.image('turtle-idle', 'assets/turtle.png');
        this.load.image('gem-idle', 'assets/gem.png');
        for(let index = 0; index < 8; index += 1){
            this.load.image(`turtle-walk-${index}`, `assets/turtle_walk_${index}.png`);
        }
        for(let index = 0; index < 10; index += 1){
            this.load.image(`gem-pickup-${index}`, `assets/gem_pickup_${index}.png`);
            this.load.image(`tile-slide-${index}`, `assets/tile_slide_${index}.png`);
        }
        this.load.audio('se-slide', 'assets/slide.wav');
        this.load.audio('se-pickup', 'assets/pickup.wav');
        this.load.audio('se-fail', 'assets/fail.wav');
        this.load.audio('se-combo', 'assets/combo.wav');
    }
    create() {
        this.ensureAnimations();
        this.scene.start('MainMenu');
    }
    ensureAnimations() {
        if (!this.anims.exists('turtle-walk')) {
            this.anims.create({
                key: 'turtle-walk',
                frames: Array.from({
                    length: 8
                }, (_, index)=>({
                        key: `turtle-walk-${index}`
                    })),
                frameRate: 14,
                repeat: -1
            });
        }
        if (!this.anims.exists('gem-pickup')) {
            this.anims.create({
                key: 'gem-pickup',
                frames: Array.from({
                    length: 10
                }, (_, index)=>({
                        key: `gem-pickup-${index}`
                    })),
                frameRate: 22,
                repeat: 0
            });
        }
        if (!this.anims.exists('tile-slide')) {
            this.anims.create({
                key: 'tile-slide',
                frames: Array.from({
                    length: 10
                }, (_, index)=>({
                        key: `tile-slide-${index}`
                    })),
                frameRate: 26,
                repeat: 0
            });
        }
    }
}
