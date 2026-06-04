export class AudioDirector {
    scene;
    context;
    masterGain;
    heartbeatEvent;
    ambienceLevel;
    warningCooldownUntil;
    constructor(scene){
        this.scene = scene;
        this.context = null;
        this.masterGain = null;
        this.heartbeatEvent = null;
        this.ambienceLevel = -1;
        this.warningCooldownUntil = 0;
        this.ensureContext();
        this.scene.input.on('pointerdown', ()=>{
            this.resume();
        });
    }
    destroy() {
        if (this.heartbeatEvent !== null) {
            this.heartbeatEvent.remove();
            this.heartbeatEvent = null;
        }
    }
    setAmbience(level) {
        const nextLevel = Math.max(0, Math.min(3, level));
        if (this.ambienceLevel === nextLevel) {
            return;
        }
        this.ambienceLevel = nextLevel;
        this.resume();
        if (this.heartbeatEvent !== null) {
            this.heartbeatEvent.remove();
            this.heartbeatEvent = null;
        }
        const delay = nextLevel === 0 ? 1800 : nextLevel === 1 ? 1200 : nextLevel === 2 ? 760 : 480;
        this.heartbeatEvent = this.scene.time.addEvent({
            delay,
            loop: true,
            callback: ()=>{
                this.playAmbiencePulse();
            }
        });
        this.playAmbiencePulse();
    }
    playSlide(routeGrowth, chained) {
        this.playLoadedSound('se-slide', {
            volume: 0.34,
            rate: Phaser.Math.Clamp(1 + routeGrowth * 0.03 + (chained ? 0.05 : 0), 1, 1.28)
        });
        const baseFrequency = 180 + Math.min(120, routeGrowth * 14);
        this.playTone(baseFrequency, 0.12, 0.05, 'triangle', 0.9);
        this.playTone(baseFrequency + 60, 0.08, chained ? 0.04 : 0.03, 'sine', 1.3);
    }
    playJewel(comboCount) {
        this.playLoadedSound('se-pickup', {
            volume: 0.42,
            rate: Phaser.Math.Clamp(1 + comboCount * 0.04, 1, 1.4),
            detune: Math.min(700, comboCount * 70)
        });
        if (comboCount >= 2) {
            this.playLoadedSound('se-combo', {
                volume: 0.18,
                rate: Phaser.Math.Clamp(0.98 + comboCount * 0.025, 0.98, 1.24)
            });
        }
        const lift = Math.min(220, comboCount * 22);
        this.playTone(540 + lift, 0.14, 0.08, 'triangle', 1.1);
        this.playTone(760 + lift, 0.18, 0.05, 'sine', 0.8);
    }
    playCrash() {
        this.playLoadedSound('se-fail', {
            volume: 0.48,
            rate: 1
        });
        this.playTone(130, 0.18, 0.09, 'sawtooth', 0.4);
        this.playTone(96, 0.24, 0.08, 'triangle', 0.25);
    }
    playRouteConnect() {
        this.playLoadedSound('se-combo', {
            volume: 0.26,
            rate: 1.06
        });
        this.playTone(320, 0.1, 0.05, 'triangle', 1.2);
        this.playTone(448, 0.14, 0.04, 'sine', 1.5);
    }
    playWarning() {
        const now = this.scene.time.now;
        if (now < this.warningCooldownUntil) {
            return;
        }
        this.warningCooldownUntil = now + 450;
        this.playTone(880, 0.07, 0.035, 'square', 0.6);
        this.playTone(660, 0.07, 0.03, 'square', 0.95);
    }
    playSpecial() {
        this.playTone(420, 0.1, 0.05, 'triangle', 1.6);
        this.playTone(620, 0.15, 0.04, 'sine', 1.1);
    }
    playAmbiencePulse() {
        const level = this.ambienceLevel < 0 ? 0 : this.ambienceLevel;
        const baseFrequency = level === 0 ? 196 : level === 1 ? 184 : level === 2 ? 172 : 160;
        const pulseStrength = level === 0 ? 0.03 : level === 1 ? 0.04 : level === 2 ? 0.055 : 0.075;
        this.playTone(baseFrequency, 0.34, pulseStrength, 'sine', 0.25);
        this.playTone(baseFrequency * 1.5, 0.28, pulseStrength * 0.66, 'triangle', 0.4);
        if (level >= 2) {
            this.playTone(baseFrequency * 2, 0.16, pulseStrength * 0.45, 'square', 0.6);
        }
    }
    playLoadedSound(key, config) {
        if (!this.scene.cache.audio.exists(key)) {
            return;
        }
        this.scene.sound.play(key, config);
    }
    resume() {
        this.ensureContext();
        if (this.context !== null && this.context.state === 'suspended') {
            void this.context.resume();
        }
    }
    ensureContext() {
        if (this.context !== null && this.masterGain !== null) {
            return;
        }
        const audioContextClass = window.AudioContext ?? window.webkitAudioContext;
        if (audioContextClass === undefined) {
            return;
        }
        this.context = new audioContextClass();
        this.masterGain = this.context.createGain();
        this.masterGain.gain.value = 0.7;
        this.masterGain.connect(this.context.destination);
    }
    playTone(frequency, durationSeconds, gainAmount, type, detune) {
        this.resume();
        if (this.context === null || this.masterGain === null) {
            return;
        }
        const startAt = this.context.currentTime;
        const oscillator = this.context.createOscillator();
        const gain = this.context.createGain();
        const filter = this.context.createBiquadFilter();
        oscillator.type = type;
        oscillator.frequency.setValueAtTime(frequency, startAt);
        oscillator.detune.setValueAtTime(detune * 12, startAt);
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(type === 'square' ? 1600 : 2200, startAt);
        gain.gain.setValueAtTime(0.0001, startAt);
        gain.gain.exponentialRampToValueAtTime(gainAmount, startAt + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, startAt + durationSeconds);
        oscillator.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGain);
        oscillator.start(startAt);
        oscillator.stop(startAt + durationSeconds + 0.03);
        oscillator.onended = ()=>{
            oscillator.disconnect();
            filter.disconnect();
            gain.disconnect();
        };
    }
}
