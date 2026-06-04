import type { RoutePreview } from '../models/RoutePreview.js'
import type { ScoreSnapshot } from '../models/ScoreSnapshot.js'
import { GameConfig } from '../utils/GameConfig.js'

type ScoreUpdatedListener = (snapshot: ScoreSnapshot) => void
type ComboChangedListener = (snapshot: ScoreSnapshot) => void

export class ScoreManager {
    score: number
    slideCount: number
    travelCount: number
    jewelCount: number
    comboCount: number
    comboActive: boolean
    comboRemainingMs: number
    crashCount: number
    longestSafeRoute: number
    rescueCount: number
    loopCount: number
    lastAward: number
    lastEventLabel: string
    lastAwardDetail: string
    connectionChain: number
    jewelsSinceCrash: number
    slidesSinceLastJewel: number
    efficientCollectTotal: number
    scoreUpdatedListeners: Set<ScoreUpdatedListener>
    comboChangedListeners: Set<ComboChangedListener>

    constructor() {
        this.score = 0
        this.slideCount = 0
        this.travelCount = 0
        this.jewelCount = 0
        this.comboCount = 0
        this.comboActive = false
        this.comboRemainingMs = 0
        this.crashCount = 0
        this.longestSafeRoute = 0
        this.rescueCount = 0
        this.loopCount = 0
        this.lastAward = 0
        this.lastEventLabel = 'READY'
        this.lastAwardDetail = ''
        this.connectionChain = 0
        this.jewelsSinceCrash = 0
        this.slidesSinceLastJewel = 0
        this.efficientCollectTotal = 0
        this.scoreUpdatedListeners = new Set<ScoreUpdatedListener>()
        this.comboChangedListeners = new Set<ComboChangedListener>()
    }

    reset(): void {
        this.score = 0
        this.slideCount = 0
        this.travelCount = 0
        this.jewelCount = 0
        this.comboCount = 0
        this.comboActive = false
        this.comboRemainingMs = 0
        this.crashCount = 0
        this.longestSafeRoute = 0
        this.rescueCount = 0
        this.loopCount = 0
        this.lastAward = 0
        this.lastEventLabel = 'READY'
        this.lastAwardDetail = ''
        this.connectionChain = 0
        this.jewelsSinceCrash = 0
        this.slidesSinceLastJewel = 0
        this.efficientCollectTotal = 0
        this.notifyScoreUpdated()
        this.notifyComboChanged()
    }

    registerSlide(beforePreview: RoutePreview, afterPreview: RoutePreview, carriedTurtle: boolean): ScoreSnapshot {
        this.slideCount += 1
        this.slidesSinceLastJewel += 1

        const routeGrowth = Math.max(0, afterPreview.safeStepCount - beforePreview.safeStepCount)
        const shorterRouteBonus = this.getShorterRouteBonus(beforePreview, afterPreview)
        const rescued = this.isDangerRisk(beforePreview) && !this.isDangerRisk(afterPreview)
        const formedLoop = !beforePreview.loopDetected && afterPreview.loopDetected
        const routeGrowthPoints = routeGrowth * 12
        const rescuePoints = rescued ? 80 : 0
        const loopPoints = formedLoop ? 110 : 0
        const carryPoints = carriedTurtle ? 18 : 0
        const awardBeforeCarry = routeGrowthPoints + shorterRouteBonus + rescuePoints + loopPoints
        const award = awardBeforeCarry + (carriedTurtle && awardBeforeCarry > 0 ? carryPoints : 0)
        const detailParts = []

        if (routeGrowthPoints > 0) {
            detailParts.push(`ROUTE +${routeGrowthPoints}`)
        }

        if (shorterRouteBonus > 0) {
            detailParts.push(`READ +${shorterRouteBonus}`)
        }

        if (rescuePoints > 0) {
            this.rescueCount += 1
            detailParts.push(`RESCUE +${rescuePoints}`)
        }

        if (loopPoints > 0) {
            this.loopCount += 1
            detailParts.push(`LOOP +${loopPoints}`)
        }

        if (carryPoints > 0 && awardBeforeCarry > 0) {
            detailParts.push(`CARRY +${carryPoints}`)
        }

        this.longestSafeRoute = Math.max(this.longestSafeRoute, afterPreview.safeStepCount)

        if (formedLoop) {
            this.setLastEvent('LOOP BUILT', award, detailParts.join(' / '))
        } else if (rescued) {
            this.setLastEvent('ROUTE SAVED', award, detailParts.join(' / '))
        } else if (shorterRouteBonus > 0) {
            this.setLastEvent('SHORT ROUTE', award, detailParts.join(' / '))
        } else if (routeGrowth > 0) {
            this.setLastEvent('LONG ROUTE', award, detailParts.join(' / '))
        } else {
            this.setLastEvent('SLIDE', 0, 'NO BONUS')
        }

        this.score += award
        this.notifyScoreUpdated()
        return this.getSnapshot()
    }

    registerTurtleStep(afterPreview: RoutePreview, triggeredCurrent: boolean): ScoreSnapshot {
        this.travelCount += 1
        this.longestSafeRoute = Math.max(this.longestSafeRoute, afterPreview.safeStepCount)

        if (afterPreview.safeStepCount > 0 || afterPreview.loopDetected) {
            this.connectionChain += 1
        } else {
            this.connectionChain = 0
        }

        const routePoints = afterPreview.safeStepCount > 0
            ? Math.min(12, afterPreview.safeStepCount * 2)
            : 0
        const currentPoints = triggeredCurrent ? 10 : 0
        const award = routePoints + currentPoints
        const detailParts = []

        if (routePoints > 0) {
            detailParts.push(`ROUTE +${routePoints}`)
        }

        if (currentPoints > 0) {
            detailParts.push(`CURRENT +${currentPoints}`)
        }

        if (award > 0) {
            this.score += award
            this.setLastEvent(
                currentPoints > 0 ? 'CURRENT RIDE' : 'TURTLE STEP',
                award,
                detailParts.join(' / '),
            )
        }

        this.notifyScoreUpdated()
        return this.getSnapshot()
    }

    registerJewelCollect(routePreview: RoutePreview): ScoreSnapshot {
        this.jewelCount += 1
        this.jewelsSinceCrash += 1

        if (this.comboActive) {
            this.comboCount = Math.min(GameConfig.MAX_FLOW_COUNT, this.comboCount + 1)
        } else {
            this.comboCount = 1
        }

        this.comboActive = true
        this.comboRemainingMs = GameConfig.COMBO_WINDOW_MS

        const routeBonus = Math.min(48, routePreview.safeStepCount * 4)
        const pressureBonus = this.isDangerRisk(routePreview) ? 20 : 0
        const loopBonus = routePreview.loopDetected ? 24 : 0
        const paceBonus = this.getEfficiencyAward()
        const comboMultiplier = this.getComboMultiplier()
        const noMissMultiplier = this.getNoMissMultiplier()
        const connectionMultiplier = this.getConnectionMultiplier()
        const baseScore = GameConfig.JEWEL_SCORE + routeBonus + pressureBonus + loopBonus + paceBonus
        const totalAward = Math.round(baseScore * comboMultiplier * noMissMultiplier * connectionMultiplier)
        const detailParts = [
            `BASE ${GameConfig.JEWEL_SCORE}`,
        ]

        if (routeBonus > 0) {
            detailParts.push(`ROUTE +${routeBonus}`)
        }

        if (pressureBonus > 0) {
            detailParts.push(`RISK +${pressureBonus}`)
        }

        if (loopBonus > 0) {
            detailParts.push(`LOOP +${loopBonus}`)
        }

        if (paceBonus > 0) {
            detailParts.push(`PACE +${paceBonus}`)
        }

        this.efficientCollectTotal += paceBonus
        this.slidesSinceLastJewel = 0
        this.score += totalAward
        this.setLastEvent(
            `GEM x${this.comboCount}`,
            totalAward,
            `${detailParts.join(' / ')}  x${comboMultiplier.toFixed(2)} x${noMissMultiplier.toFixed(2)} x${connectionMultiplier.toFixed(2)}`,
        )
        this.notifyScoreUpdated()
        this.notifyComboChanged()
        return this.getSnapshot()
    }

    registerCrash(): ScoreSnapshot {
        this.crashCount += 1
        this.connectionChain = 0
        this.jewelsSinceCrash = 0
        this.slidesSinceLastJewel = 0
        this.clearCombo()
        this.setLastEvent('CRASH', 0, 'LOSS 0')
        this.notifyScoreUpdated()
        this.notifyComboChanged()
        return this.getSnapshot()
    }

    advanceComboTimer(elapsedMs: number): void {
        if (!this.comboActive) {
            return
        }

        this.comboRemainingMs = Math.max(0, this.comboRemainingMs - elapsedMs)

        if (this.comboRemainingMs > 0) {
            return
        }

        this.clearCombo()
        this.notifyComboChanged()
    }

    getSnapshot(): ScoreSnapshot {
        return {
            score: this.score,
            slideCount: this.slideCount,
            travelCount: this.travelCount,
            jewelCount: this.jewelCount,
            comboCount: this.comboCount,
            comboActive: this.comboActive,
            speedLevel: Math.floor(this.score / GameConfig.SPEED_SCORE_STEP),
            crashCount: this.crashCount,
            noMissMultiplier: this.getNoMissMultiplier(),
            connectionMultiplier: this.getConnectionMultiplier(),
            longestSafeRoute: this.longestSafeRoute,
            rescueCount: this.rescueCount,
            loopCount: this.loopCount,
            lastAward: this.lastAward,
            lastEventLabel: this.lastEventLabel,
            lastAwardDetail: this.lastAwardDetail,
            efficiency: this.jewelCount === 0
                ? 100
                : Math.max(40, Math.min(100, Math.round(this.efficientCollectTotal / this.jewelCount))),
        }
    }

    onScoreUpdated(listener: ScoreUpdatedListener): void {
        this.scoreUpdatedListeners.add(listener)
    }

    offScoreUpdated(listener: ScoreUpdatedListener): void {
        this.scoreUpdatedListeners.delete(listener)
    }

    onComboChanged(listener: ComboChangedListener): void {
        this.comboChangedListeners.add(listener)
    }

    offComboChanged(listener: ComboChangedListener): void {
        this.comboChangedListeners.delete(listener)
    }

    getShorterRouteBonus(beforePreview: RoutePreview, afterPreview: RoutePreview): number {
        if (beforePreview.nextJewelDistance === null || afterPreview.nextJewelDistance === null) {
            return 0
        }

        const distanceGain = beforePreview.nextJewelDistance - afterPreview.nextJewelDistance
        return Math.max(0, distanceGain) * 18
    }

    getEfficiencyAward(): number {
        if (this.slidesSinceLastJewel <= 1) {
            return 44
        }

        if (this.slidesSinceLastJewel <= 3) {
            return 34
        }

        if (this.slidesSinceLastJewel <= 5) {
            return 24
        }

        return 14
    }

    getComboMultiplier(): number {
        const comboMultipliers = [1, 1.15, 1.3, 1.45, 1.58, 1.7, 1.78, 1.86]
        return comboMultipliers[Math.max(0, this.comboCount - 1)] ?? comboMultipliers[comboMultipliers.length - 1]
    }

    getNoMissMultiplier(): number {
        return 1 + Math.min(0.72, Math.floor(this.jewelsSinceCrash / 2) * 0.12)
    }

    getConnectionMultiplier(): number {
        return 1 + Math.min(0.8, Math.floor(this.connectionChain / 4) * 0.16)
    }

    isDangerRisk(preview: RoutePreview): boolean {
        return preview.riskLevel === 'danger' || preview.riskLevel === 'critical'
    }

    clearCombo(): void {
        this.comboActive = false
        this.comboCount = 0
        this.comboRemainingMs = 0
    }

    setLastEvent(label: string, award: number, detail: string = ''): void {
        this.lastEventLabel = label
        this.lastAward = award
        this.lastAwardDetail = detail
    }

    notifyScoreUpdated(): void {
        const snapshot = this.getSnapshot()

        for (const listener of this.scoreUpdatedListeners) {
            listener(snapshot)
        }
    }

    notifyComboChanged(): void {
        const snapshot = this.getSnapshot()

        for (const listener of this.comboChangedListeners) {
            listener(snapshot)
        }
    }
}
