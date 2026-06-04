import { GameConfig } from '../utils/GameConfig.js';
export class BattleManager {
    playerScore;
    rivalScore;
    playerSurgeSeconds;
    rivalSurgeSeconds;
    message;
    constructor(){
        this.playerScore = 0;
        this.rivalScore = 0;
        this.playerSurgeSeconds = 0;
        this.rivalSurgeSeconds = 0;
        this.message = 'READY';
    }
    reset() {
        this.playerScore = 0;
        this.rivalScore = 0;
        this.playerSurgeSeconds = 0;
        this.rivalSurgeSeconds = 0;
        this.message = 'READY';
        return this.getSnapshot(GameConfig.SESSION_SECONDS);
    }
    syncPlayerScore(scoreSnapshot, timeLeft) {
        this.playerScore = scoreSnapshot.score;
        return this.getSnapshot(timeLeft);
    }
    advanceClock(timeLeft, scoreSnapshot) {
        this.playerScore = scoreSnapshot.score;
        const phase = this.getPhase(timeLeft);
        let rivalGain = this.getBaseRivalGain(phase);
        rivalGain += this.getCatchUpAdjustment(scoreSnapshot.score);
        rivalGain += this.getTempoAdjustment(scoreSnapshot);
        rivalGain += this.getOscillation(timeLeft);
        if (this.playerSurgeSeconds > 0) {
            rivalGain -= 8;
            this.playerSurgeSeconds -= 1;
            this.message = 'PLAYER SURGE';
        } else if (this.rivalSurgeSeconds > 0) {
            rivalGain += 12;
            this.rivalSurgeSeconds -= 1;
            this.message = 'RIVAL SURGE';
        } else {
            this.message = this.getDefaultMessage(scoreSnapshot.score, timeLeft);
        }
        this.rivalScore += Math.max(10, rivalGain);
        return this.getSnapshot(timeLeft);
    }
    registerCrash(timeLeft) {
        this.rivalScore += GameConfig.BATTLE_RIVAL_CRASH_SWING;
        this.rivalSurgeSeconds = Math.max(this.rivalSurgeSeconds, GameConfig.BATTLE_RIVAL_SURGE_SECONDS);
        this.message = 'RIVAL BREAK';
        return this.getSnapshot(timeLeft);
    }
    registerBigPlay(timeLeft, kind) {
        if (kind === 'combo') {
            this.playerSurgeSeconds = Math.max(this.playerSurgeSeconds, 2);
            this.message = 'FLOW PUSH';
        } else if (kind === 'rescue') {
            this.playerSurgeSeconds = Math.max(this.playerSurgeSeconds, GameConfig.BATTLE_PLAYER_SURGE_SECONDS);
            this.message = 'SAVE BONUS';
        } else {
            this.playerSurgeSeconds = Math.max(this.playerSurgeSeconds, GameConfig.BATTLE_PLAYER_SURGE_SECONDS + 1);
            this.message = 'LOOP BONUS';
        }
        return this.getSnapshot(timeLeft);
    }
    getSnapshot(timeLeft) {
        const total = Math.max(1, this.playerScore + this.rivalScore);
        const scoreDiff = this.playerScore - this.rivalScore;
        const phase = this.getPhase(timeLeft);
        return {
            playerScore: this.playerScore,
            rivalScore: this.rivalScore,
            scoreDiff,
            state: this.getState(scoreDiff),
            phase,
            phaseLabel: this.getPhaseLabel(phase),
            message: this.message,
            playerGaugeRatio: this.playerScore / total,
            rivalGaugeRatio: this.rivalScore / total,
            momentum: this.playerSurgeSeconds - this.rivalSurgeSeconds,
            result: scoreDiff > 0 ? 'win' : scoreDiff < 0 ? 'lose' : 'draw'
        };
    }
    getPhase(timeLeft) {
        const progress = 1 - timeLeft / GameConfig.SESSION_SECONDS;
        if (progress >= 0.72) {
            return 'finale';
        }
        if (progress >= 0.34) {
            return 'middle';
        }
        return 'opening';
    }
    getPhaseLabel(phase) {
        if (phase === 'opening') {
            return 'OPENING HEAT';
        }
        if (phase === 'middle') {
            return 'MID TIDE';
        }
        return 'FINAL RUSH';
    }
    getBaseRivalGain(phase) {
        if (phase === 'opening') {
            return GameConfig.BATTLE_RIVAL_OPENING_POINTS;
        }
        if (phase === 'middle') {
            return GameConfig.BATTLE_RIVAL_MIDDLE_POINTS;
        }
        return GameConfig.BATTLE_RIVAL_FINALE_POINTS;
    }
    getCatchUpAdjustment(playerScore) {
        const diff = playerScore - this.rivalScore;
        if (diff >= 1500) {
            return 28;
        }
        if (diff >= 900) {
            return 20;
        }
        if (diff >= 450) {
            return 12;
        }
        if (diff <= -1500) {
            return -18;
        }
        if (diff <= -900) {
            return -12;
        }
        if (diff <= -450) {
            return -6;
        }
        return 0;
    }
    getTempoAdjustment(scoreSnapshot) {
        let adjustment = 0;
        if (scoreSnapshot.comboActive) {
            adjustment -= Math.min(12, scoreSnapshot.comboCount * 2);
        }
        if (scoreSnapshot.crashCount > 0 && scoreSnapshot.noMissMultiplier <= 1) {
            adjustment += 8;
        }
        if (scoreSnapshot.connectionMultiplier >= 1.32) {
            adjustment -= 6;
        }
        return adjustment;
    }
    getOscillation(timeLeft) {
        return (GameConfig.SESSION_SECONDS - timeLeft) * 11 % 8;
    }
    getDefaultMessage(playerScore, timeLeft) {
        const diff = playerScore - this.rivalScore;
        if (timeLeft <= 12 && Math.abs(diff) <= 120) {
            return 'PHOTO FINISH';
        }
        if (diff >= 480) {
            return 'HOLD LEAD';
        }
        if (diff <= -480) {
            return 'CHASE';
        }
        return 'CLASH';
    }
    getState(scoreDiff) {
        if (scoreDiff > 0) {
            return 'ahead';
        }
        if (scoreDiff < 0) {
            return 'behind';
        }
        return 'tied';
    }
}
