import { GameConfig } from '../utils/GameConfig.js';
export class ScoreManager {
    score;
    slideCount;
    travelCount;
    jewelCount;
    comboCount;
    comboActive;
    comboRemainingMs;
    crashCount;
    longestSafeRoute;
    rescueCount;
    loopCount;
    lastAward;
    lastEventLabel;
    connectionChain;
    jewelsSinceCrash;
    slidesSinceLastJewel;
    efficientCollectTotal;
    scoreUpdatedListeners;
    comboChangedListeners;
    constructor(){
        this.score = 0;
        this.slideCount = 0;
        this.travelCount = 0;
        this.jewelCount = 0;
        this.comboCount = 0;
        this.comboActive = false;
        this.comboRemainingMs = 0;
        this.crashCount = 0;
        this.longestSafeRoute = 0;
        this.rescueCount = 0;
        this.loopCount = 0;
        this.lastAward = 0;
        this.lastEventLabel = 'READY';
        this.connectionChain = 0;
        this.jewelsSinceCrash = 0;
        this.slidesSinceLastJewel = 0;
        this.efficientCollectTotal = 0;
        this.scoreUpdatedListeners = new Set();
        this.comboChangedListeners = new Set();
    }
    reset() {
        this.score = 0;
        this.slideCount = 0;
        this.travelCount = 0;
        this.jewelCount = 0;
        this.comboCount = 0;
        this.comboActive = false;
        this.comboRemainingMs = 0;
        this.crashCount = 0;
        this.longestSafeRoute = 0;
        this.rescueCount = 0;
        this.loopCount = 0;
        this.lastAward = 0;
        this.lastEventLabel = 'READY';
        this.connectionChain = 0;
        this.jewelsSinceCrash = 0;
        this.slidesSinceLastJewel = 0;
        this.efficientCollectTotal = 0;
        this.notifyScoreUpdated();
        this.notifyComboChanged();
    }
    registerSlide(beforePreview, afterPreview, carriedTurtle) {
        this.slideCount += 1;
        this.slidesSinceLastJewel += 1;
        const routeGrowth = Math.max(0, afterPreview.safeStepCount - beforePreview.safeStepCount);
        const shorterRouteBonus = this.getShorterRouteBonus(beforePreview, afterPreview);
        const rescued = this.isDangerRisk(beforePreview) && !this.isDangerRisk(afterPreview);
        const formedLoop = !beforePreview.loopDetected && afterPreview.loopDetected;
        let award = routeGrowth * 10 + shorterRouteBonus;
        if (rescued) {
            this.rescueCount += 1;
            award += 70;
        }
        if (formedLoop) {
            this.loopCount += 1;
            award += 90;
        }
        if (carriedTurtle && award > 0) {
            award += 20;
        }
        this.longestSafeRoute = Math.max(this.longestSafeRoute, afterPreview.safeStepCount);
        if (formedLoop) {
            this.setLastEvent('LOOP BUILT', award);
        } else if (rescued) {
            this.setLastEvent('ROUTE SAVED', award);
        } else if (shorterRouteBonus > 0) {
            this.setLastEvent('SHORT ROUTE', award);
        } else if (routeGrowth > 0) {
            this.setLastEvent('LONG ROUTE', award);
        } else {
            this.setLastEvent('SLIDE', 0);
        }
        this.score += award;
        this.notifyScoreUpdated();
        return this.getSnapshot();
    }
    registerTurtleStep(afterPreview, triggeredCurrent) {
        this.travelCount += 1;
        this.longestSafeRoute = Math.max(this.longestSafeRoute, afterPreview.safeStepCount);
        if (afterPreview.safeStepCount > 0 || afterPreview.loopDetected) {
            this.connectionChain += 1;
        } else {
            this.connectionChain = 0;
        }
        if (triggeredCurrent) {
            this.score += 10;
            this.setLastEvent('CURRENT RIDE', 10);
        }
        this.notifyScoreUpdated();
        return this.getSnapshot();
    }
    registerJewelCollect(routePreview) {
        this.jewelCount += 1;
        this.jewelsSinceCrash += 1;
        if (this.comboActive) {
            this.comboCount = Math.min(GameConfig.MAX_FLOW_COUNT, this.comboCount + 1);
        } else {
            this.comboCount = 1;
        }
        this.comboActive = true;
        this.comboRemainingMs = GameConfig.COMBO_WINDOW_MS;
        const comboMultiplier = this.getComboMultiplier();
        const noMissMultiplier = this.getNoMissMultiplier();
        const connectionMultiplier = this.getConnectionMultiplier();
        const longRouteBonus = Math.max(0, routePreview.safeStepCount - 4) * 6;
        const pressureBonus = this.isDangerRisk(routePreview) ? 24 : 0;
        const loopBonus = routePreview.loopDetected ? 20 : 0;
        const efficiencyAward = this.getEfficiencyAward();
        const baseScore = GameConfig.JEWEL_SCORE + longRouteBonus + pressureBonus + loopBonus + efficiencyAward;
        const totalAward = Math.round(baseScore * comboMultiplier * noMissMultiplier * connectionMultiplier);
        this.efficientCollectTotal += efficiencyAward;
        this.slidesSinceLastJewel = 0;
        this.score += totalAward;
        this.setLastEvent(`GEM x${this.comboCount}`, totalAward);
        this.notifyScoreUpdated();
        this.notifyComboChanged();
        return this.getSnapshot();
    }
    registerCrash() {
        this.crashCount += 1;
        this.connectionChain = 0;
        this.jewelsSinceCrash = 0;
        this.slidesSinceLastJewel = 0;
        this.clearCombo();
        this.setLastEvent('CRASH', 0);
        this.notifyScoreUpdated();
        this.notifyComboChanged();
        return this.getSnapshot();
    }
    advanceComboTimer(elapsedMs) {
        if (!this.comboActive) {
            return;
        }
        this.comboRemainingMs = Math.max(0, this.comboRemainingMs - elapsedMs);
        if (this.comboRemainingMs > 0) {
            return;
        }
        this.clearCombo();
        this.notifyComboChanged();
    }
    getSnapshot() {
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
            efficiency: this.jewelCount === 0 ? 100 : Math.max(40, Math.min(100, Math.round(this.efficientCollectTotal / this.jewelCount)))
        };
    }
    onScoreUpdated(listener) {
        this.scoreUpdatedListeners.add(listener);
    }
    offScoreUpdated(listener) {
        this.scoreUpdatedListeners.delete(listener);
    }
    onComboChanged(listener) {
        this.comboChangedListeners.add(listener);
    }
    offComboChanged(listener) {
        this.comboChangedListeners.delete(listener);
    }
    getShorterRouteBonus(beforePreview, afterPreview) {
        if (beforePreview.nextJewelDistance === null || afterPreview.nextJewelDistance === null) {
            return 0;
        }
        const distanceGain = beforePreview.nextJewelDistance - afterPreview.nextJewelDistance;
        return Math.max(0, distanceGain) * 18;
    }
    getEfficiencyAward() {
        if (this.slidesSinceLastJewel <= 1) {
            return 44;
        }
        if (this.slidesSinceLastJewel <= 3) {
            return 34;
        }
        if (this.slidesSinceLastJewel <= 5) {
            return 24;
        }
        return 14;
    }
    getComboMultiplier() {
        const comboMultipliers = [
            1,
            1.15,
            1.3,
            1.45,
            1.58,
            1.7,
            1.78,
            1.86
        ];
        return comboMultipliers[Math.max(0, this.comboCount - 1)] ?? comboMultipliers[comboMultipliers.length - 1];
    }
    getNoMissMultiplier() {
        return 1 + Math.min(0.72, Math.floor(this.jewelsSinceCrash / 2) * 0.12);
    }
    getConnectionMultiplier() {
        return 1 + Math.min(0.8, Math.floor(this.connectionChain / 4) * 0.16);
    }
    isDangerRisk(preview) {
        return preview.riskLevel === 'danger' || preview.riskLevel === 'critical';
    }
    clearCombo() {
        this.comboActive = false;
        this.comboCount = 0;
        this.comboRemainingMs = 0;
    }
    setLastEvent(label, award) {
        this.lastEventLabel = label;
        this.lastAward = award;
    }
    notifyScoreUpdated() {
        const snapshot = this.getSnapshot();
        for (const listener of this.scoreUpdatedListeners){
            listener(snapshot);
        }
    }
    notifyComboChanged() {
        const snapshot = this.getSnapshot();
        for (const listener of this.comboChangedListeners){
            listener(snapshot);
        }
    }
}
