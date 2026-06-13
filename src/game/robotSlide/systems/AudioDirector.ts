import Phaser from 'phaser'
/**
 * AudioDirector:
 * - 蜉ｹ譫憺浹蜀咲函縺ｨ邁｡譏・AudioContext 邂｡逅・ｒ陦後≧繧ｯ繝ｩ繧ｹ縲・ * - 髮ｰ蝗ｲ豌暦ｼ・mbience・峨ｄ繧ｹ繝ｩ繧､繝会ｼ丞ｮ晉浹・上け繝ｩ繝・す繝･遲峨・髻ｳ蜃ｦ逅・ｒ諡・ｽ薙☆繧九・ */
export class AudioDirector {
    scene: Phaser.Scene
    context: AudioContext | null
    masterGain: GainNode | null
    heartbeatEvent: Phaser.Time.TimerEvent | null
    ambienceLevel: number
    warningCooldownUntil: number

    /**
     * 繧ｳ繝ｳ繧ｹ繝医Λ繧ｯ繧ｿ: AudioDirector 繧貞・譛溷喧縺吶ｋ縲・     * - AudioContext 縺ｮ貅門ｙ・亥庄閭ｽ縺ｪ蝣ｴ蜷茨ｼ峨→繧ｷ繝ｼ繝ｳ縺ｮ pointerdown 縺ｧ縺ｮ resume 繧堤匳骭ｲ縺吶ｋ縲・     */
    constructor(scene: Phaser.Scene) {
        this.scene = scene
        this.context = null
        this.masterGain = null
        this.heartbeatEvent = null
        this.ambienceLevel = -1
        this.warningCooldownUntil = 0
        this.ensureContext()
        this.scene.input.on('pointerdown', () => {
            this.resume()
        })
    }

    /**
     * destroy: 髟ｷ譛溘う繝吶Φ繝茨ｼ・eartbeat 遲会ｼ峨ｒ遐ｴ譽・＠縺ｦ蠕悟ｧ区忰縺吶ｋ縲・     */
    destroy(): void {
        if (this.heartbeatEvent !== null) {
            this.heartbeatEvent.remove()
            this.heartbeatEvent = null
        }
    }

    /**
     * setAmbience: 髮ｰ蝗ｲ豌励Ξ繝吶Ν繧定ｨｭ螳壹＠縲√ワ繝ｼ繝医ン繝ｼ繝茨ｼ亥ｮ壽悄髻ｳ・峨ｒ髢句ｧ具ｼ乗峩譁ｰ縺吶ｋ縲・     * - level 縺ｯ 0..3 縺ｮ遽・峇縺ｧ繧ｯ繝ｪ繝・・縺輔ｌ繧九・     */
    setAmbience(level: number): void {
        const nextLevel = Math.max(0, Math.min(3, level))

        if (this.ambienceLevel === nextLevel) {
            return
        }

        this.ambienceLevel = nextLevel
        this.resume()

        if (this.heartbeatEvent !== null) {
            this.heartbeatEvent.remove()
            this.heartbeatEvent = null
        }

        const delay = nextLevel === 0
            ? 1800
            : nextLevel === 1
                ? 1200
                : nextLevel === 2
                    ? 760
                    : 480

        this.heartbeatEvent = this.scene.time.addEvent({
            delay,
            loop: true,
            callback: () => {
                this.playAmbiencePulse()
            },
        })

        this.playAmbiencePulse()
    }

    /**
     * playSlide: 繧ｹ繝ｩ繧､繝画ｼ泌・縺ｮ蜉ｹ譫憺浹繧貞・逕溘☆繧九・     * - routeGrowth 繧貞渕縺ｫ髻ｳ遞九ｄ騾溷ｺｦ繧定ｪｿ謨ｴ縺吶ｋ縲・     */
    playSlide(routeGrowth: number, chained: boolean): void {
        this.playLoadedSound('se-slide', {
            volume: 0.34,
            rate: Phaser.Math.Clamp(1 + routeGrowth * 0.03 + (chained ? 0.05 : 0), 1, 1.28),
        })
        const baseFrequency = 180 + Math.min(120, routeGrowth * 14)
        this.playTone(baseFrequency, 0.12, 0.05, 'triangle', 0.9)
        this.playTone(baseFrequency + 60, 0.08, chained ? 0.04 : 0.03, 'sine', 1.3)
    }

    /**
     * playJewel: 螳晉浹蜿門ｾ玲凾縺ｮ蜉ｹ譫憺浹縺ｨ陬懷勧繝医・繝ｳ繧貞・逕溘☆繧九・     * - comboCount 縺ｫ繧医▲縺ｦ髻ｳ濶ｲ繧・お繝輔ぉ繧ｯ繝医ｒ螟牙喧縺輔○繧九・     */
    playJewel(comboCount: number): void {
        this.playLoadedSound('se-pickup', {
            volume: 0.42,
            rate: Phaser.Math.Clamp(1 + comboCount * 0.04, 1, 1.4),
            detune: Math.min(700, comboCount * 70),
        })

        if (comboCount >= 2) {
            this.playLoadedSound('se-combo', {
                volume: 0.18,
                rate: Phaser.Math.Clamp(0.98 + comboCount * 0.025, 0.98, 1.24),
            })
        }

        const lift = Math.min(220, comboCount * 22)
        this.playTone(540 + lift, 0.14, 0.08, 'triangle', 1.1)
        this.playTone(760 + lift, 0.18, 0.05, 'sine', 0.8)
    }

    /**
     * playCrash: 繧ｯ繝ｩ繝・す繝･譎ゅ・蜉ｹ譫憺浹繧貞・逕溘☆繧具ｼ亥､ｱ謨玲ｼ泌・・峨・     */
    playCrash(): void {
        this.playLoadedSound('se-fail', {
            volume: 0.48,
            rate: 1,
        })
        this.playTone(130, 0.18, 0.09, 'sawtooth', 0.4)
        this.playTone(96, 0.24, 0.08, 'triangle', 0.25)
    }

    /**
     * playRouteConnect: 繝ｫ繝ｼ繝域磁邯壽・蜉滓凾縺ｮ蜉ｹ譫憺浹繧貞・逕溘☆繧九・     */
    playRouteConnect(): void {
        this.playLoadedSound('se-combo', {
            volume: 0.26,
            rate: 1.06,
        })
        this.playTone(320, 0.1, 0.05, 'triangle', 1.2)
        this.playTone(448, 0.14, 0.04, 'sine', 1.5)
    }

    /**
     * playWarning: 蜊ｱ髯ｺ隴ｦ蜻企浹繧貞・逕溘☆繧九ゆｸ螳夐俣髫斐〒謚大宛縺吶ｋ繧ｯ繝ｼ繝ｫ繝繧ｦ繝ｳ縺後≠繧九・     */
    playWarning(): void {
        const now = this.scene.time.now

        if (now < this.warningCooldownUntil) {
            return
        }

        this.warningCooldownUntil = now + 450
        this.playTone(880, 0.07, 0.035, 'square', 0.6)
        this.playTone(660, 0.07, 0.03, 'square', 0.95)
    }

    /**
     * playSpecial: 迚ｹ谿翫う繝吶Φ繝茨ｼ域ｵ√ｌ逋ｺ蜍輔↑縺ｩ・峨・遏ｭ縺・柑譫憺浹繧貞・逕溘☆繧九・     */
    playSpecial(): void {
        this.playTone(420, 0.1, 0.05, 'triangle', 1.6)
        this.playTone(620, 0.15, 0.04, 'sine', 1.1)
    }

    /**
     * playAmbiencePulse: 迴ｾ蝨ｨ縺ｮ ambience 繝ｬ繝吶Ν縺ｫ蝓ｺ縺･縺・※遏ｭ縺・ヱ繝ｫ繧ｹ髻ｳ繧帝ｳｴ繧峨☆縲・     * - 蜀・Κ縺ｧ playTone 繧堤ｵ・∩蜷医ｏ縺帙※隍・焚繝医・繝ｳ繧堤函謌舌☆繧九・     */
    playAmbiencePulse(): void {
        const level = this.ambienceLevel < 0 ? 0 : this.ambienceLevel
        const baseFrequency = level === 0
            ? 196
            : level === 1
                ? 184
                : level === 2
                    ? 172
                    : 160
        const pulseStrength = level === 0 ? 0.03 : level === 1 ? 0.04 : level === 2 ? 0.055 : 0.075

        this.playTone(baseFrequency, 0.34, pulseStrength, 'sine', 0.25)
        this.playTone(baseFrequency * 1.5, 0.28, pulseStrength * 0.66, 'triangle', 0.4)

        if (level >= 2) {
            this.playTone(baseFrequency * 2, 0.16, pulseStrength * 0.45, 'square', 0.6)
        }
    }

    /**
     * playLoadedSound: 繧ｭ繝｣繝・す繝･縺輔ｌ縺滄浹螢ｰ繧ｭ繝ｼ繧・Phaser 縺ｮ繧ｵ繧ｦ繝ｳ繝峨す繧ｹ繝・Β縺ｧ蜀咲函縺吶ｋ縲・     * - 繧ｭ繝ｼ縺後く繝｣繝・す繝･縺ｫ辟｡縺代ｌ縺ｰ辟｡隕悶☆繧句ｮ牙・蜃ｦ逅・ｒ陦後≧縲・     */
    playLoadedSound(key: string, config: Phaser.Types.Sound.SoundConfig): void {
        if (!this.scene.cache.audio.exists(key)) {
            return
        }

        this.scene.sound.play(key, config)
    }

    /**
     * resume: AudioContext 繧堤｢ｺ菫昴＠縲√し繧ｹ繝壹Φ繝臥憾諷九↑繧・resume 縺吶ｋ縲・     */
    resume(): void {
        this.ensureContext()

        if (this.context !== null && this.context.state === 'suspended') {
            void this.context.resume()
        }
    }

    /**
     * ensureContext: Web Audio 縺ｮ AudioContext 縺ｨ masterGain 繧貞・譛溷喧縺吶ｋ・亥ｭ伜惠縺吶ｌ縺ｰ菴輔ｂ縺励↑縺・ｼ峨・     */
    ensureContext(): void {
        if (this.context !== null && this.masterGain !== null) {
            return
        }

        const audioContextClass = window.AudioContext ?? (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext

        if (audioContextClass === undefined) {
            return
        }

        this.context = new audioContextClass()
        this.masterGain = this.context.createGain()
        this.masterGain.gain.value = 0.7
        this.masterGain.connect(this.context.destination)
    }

    /**
     * playTone: 蜊倅ｸ繝医・繝ｳ繧堤函謌舌＠縺ｦ蜀咲函縺吶ｋ繝ｦ繝ｼ繝・ぅ繝ｪ繝・ぅ縲・     * - frequency: 蜻ｨ豕｢謨ｰHz
     * - durationSeconds: 蜀咲函謖∫ｶ壽凾髢難ｼ育ｧ抵ｼ・     * - gainAmount: 髻ｳ驥擾ｼ育嶌蟇ｾ蛟､・・     * - type: 逋ｺ謖ｯ豕｢蠖｢
     * - detune: 蜊企浹蜊倅ｽ阪・繝・メ繝･繝ｼ繝ｳ驥・     */
    playTone(
        frequency: number,
        durationSeconds: number,
        gainAmount: number,
        type: OscillatorType,
        detune: number,
    ): void {
        this.resume()

        if (this.context === null || this.masterGain === null) {
            return
        }

        const startAt = this.context.currentTime
        const oscillator = this.context.createOscillator()
        const gain = this.context.createGain()
        const filter = this.context.createBiquadFilter()

        oscillator.type = type
        oscillator.frequency.setValueAtTime(frequency, startAt)
        oscillator.detune.setValueAtTime(detune * 12, startAt)
        filter.type = 'lowpass'
        filter.frequency.setValueAtTime(type === 'square' ? 1600 : 2200, startAt)
        gain.gain.setValueAtTime(0.0001, startAt)
        gain.gain.exponentialRampToValueAtTime(gainAmount, startAt + 0.02)
        gain.gain.exponentialRampToValueAtTime(0.0001, startAt + durationSeconds)

        oscillator.connect(filter)
        filter.connect(gain)
        gain.connect(this.masterGain)

        oscillator.start(startAt)
        oscillator.stop(startAt + durationSeconds + 0.03)

        oscillator.onended = () => {
            oscillator.disconnect()
            filter.disconnect()
            gain.disconnect()
        }
    }
}
