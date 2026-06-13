/*
 * BattleManager:
 * - 蟇ｾ謌ｦ逕ｨ縺ｮ繧ｹ繧ｳ繧｢騾ｲ陦後Ο繧ｸ繝・け繧堤ｮ｡逅・☆繧九け繝ｩ繧ｹ縲・ * - 譎る俣邨碁℃縺ｫ蠢懊§縺溘ヵ繧ｧ繝ｼ繧ｺ蛻､螳壹∵雰繧ｹ繧ｳ繧｢縺ｮ閾ｪ蜍募｢怜・縲√け繝ｩ繝・す繝･繧・､ｧ謚縺ｫ繧医ｋ螟牙虚繧定ｨ育ｮ励＠縺ｦ Snapshot 繧定ｿ斐☆縲・ */
import type { BattlePhase, BattleSnapshot, BattleState } from '../models/BattleSnapshot.ts'
import type { ScoreSnapshot } from '../models/ScoreSnapshot.ts'
import { GameConfig } from '../utils/GameConfig.ts'

export class BattleManager {
    playerScore: number
    rivalScore: number
    playerSurgeSeconds: number
    rivalSurgeSeconds: number
    message: string

    constructor() {
        this.playerScore = 0
        this.rivalScore = 0
        this.playerSurgeSeconds = 0
        this.rivalSurgeSeconds = 0
        this.message = 'READY'
    }

    reset(): BattleSnapshot {
        this.playerScore = 0
        this.rivalScore = GameConfig.TARGET_SCORE
        this.playerSurgeSeconds = 0
        this.rivalSurgeSeconds = 0
        this.message = 'TARGET'
        return this.getSnapshot(GameConfig.SESSION_SECONDS)
    }

    syncPlayerScore(scoreSnapshot: ScoreSnapshot, timeLeft: number): BattleSnapshot {
        this.playerScore = scoreSnapshot.score
        return this.getSnapshot(timeLeft)
    }

    advanceClock(timeLeft: number, scoreSnapshot: ScoreSnapshot): BattleSnapshot {
        this.playerScore = scoreSnapshot.score
        this.rivalScore = GameConfig.TARGET_SCORE
        this.message = this.getDefaultMessage(scoreSnapshot.score, timeLeft)
        return this.getSnapshot(timeLeft)
    }

    registerCrash(timeLeft: number): BattleSnapshot {
        this.rivalScore = GameConfig.TARGET_SCORE
        this.message = 'MISS'
        return this.getSnapshot(timeLeft)
    }

    registerBigPlay(timeLeft: number, kind: 'combo' | 'rescue' | 'loop'): BattleSnapshot {
        this.message = kind === 'rescue'
            ? 'ROUTE SAFE'
            : kind === 'loop'
                ? 'LOOP'
                : 'JEWEL'

        return this.getSnapshot(timeLeft)
    }

    getSnapshot(timeLeft: number): BattleSnapshot {
        const targetScore = GameConfig.TARGET_SCORE
        const scoreDiff = this.playerScore - targetScore
        const phase = this.getPhase(timeLeft)
        const playerGaugeRatio = Math.max(0, Math.min(1, this.playerScore / targetScore))

        return {
            playerScore: this.playerScore,
            rivalScore: targetScore,
            scoreDiff,
            state: this.getState(scoreDiff),
            phase,
            phaseLabel: this.getPhaseLabel(phase),
            message: this.message,
            playerGaugeRatio,
            rivalGaugeRatio: 1 - playerGaugeRatio,
            momentum: 0,
            result: scoreDiff >= 0 ? 'win' : 'lose',
        }
    }

    getPhase(timeLeft: number): BattlePhase {
        const progress = 1 - timeLeft / GameConfig.SESSION_SECONDS

        if (progress >= 0.72) {
            return 'finale'
        }

        if (progress >= 0.34) {
            return 'middle'
        }

        return 'opening'
    }

    getPhaseLabel(phase: BattlePhase): string {
        if (phase === 'opening') {
            return 'START'
        }

        if (phase === 'middle') {
            return 'MIDDLE'
        }

        return 'FINAL'
    }

    getDefaultMessage(playerScore: number, timeLeft: number): string {
        const remaining = GameConfig.TARGET_SCORE - playerScore

        if (remaining <= 0) {
            return 'CLEAR'
        }

        if (timeLeft <= 12) {
            return 'FINAL'
        }

        if (remaining <= GameConfig.JEWEL_SCORE * 2) {
            return 'ALMOST'
        }

        return 'TARGET'
    }

    getState(scoreDiff: number): BattleState {
        if (scoreDiff >= 0) {
            return 'ahead'
        }

        if (scoreDiff < 0) {
            return 'behind'
        }

        return 'tied'
    }
}
