import Phaser from 'phaser'
/*
 * RobotSlideScene:
 * - 繝｡繧､繝ｳ縺ｮ繧ｲ繝ｼ繝 Scene縲・oardManager縲ゝurtleGrid縲ヾcoreManager縲、udioDirector 縺ｪ縺ｩ繧貞・譛溷喧縺励・ *   繧ｲ繝ｼ繝騾ｲ陦鯉ｼ医ち繧､繝槭・繝ｻ莠縺ｮ豁ｩ陦後・繧ｹ繝ｩ繧､繝牙・逅・ｼ峨→繧､繝吶Φ繝医・讖区ｸ｡縺励ｒ陦後≧縲・ * - UI 縺九ｉ縺ｯ tile 驕ｸ謚槭ｒ蜿励￠蜿悶ｊ BoardManager.moveTile 繧貞他縺ｳ蜃ｺ縺吶・ */
import type { BoardSnapshot } from '../models/BoardSnapshot.ts'
import type { BattleSnapshot } from '../models/BattleSnapshot.ts'
import type { Direction as DirectionValue } from '../models/Direction.ts'
import type { Position } from '../models/Position.ts'
import type { RouteRiskLevel } from '../models/RoutePreview.ts'
import { AudioDirector } from '../systems/AudioDirector.ts'
import { BattleManager } from '../systems/BattleManager.ts'
import { BoardManager } from '../systems/BoardManager.ts'
import { ScoreManager } from '../systems/ScoreManager.ts'
import { RobotGrid } from '../ui/RobotGrid.ts'
import { GameConfig } from '../utils/GameConfig.ts'
import { Random } from '../utils/Random.ts'

type RobotGameResult = {
    results: Array<{ player: number, score: number, missCount: number, travelCount: number }>
}

type RobotGameOptions = {
    settings?: {
        playerCount?: number
        difficulty?: string
        hudTarget?: EventTarget
    }
    hudTarget?: EventTarget | null
    onFinish?: (result: RobotGameResult) => void
    currentPlayerIndex?: number
    scores?: number[]
    playerStats?: Array<{ score: number, missCount: number, travelCount: number }>
}

export class RobotSlideScene extends Phaser.Scene {
    options: RobotGameOptions
    hudTarget: EventTarget | null
    onFinish: ((result: RobotGameResult) => void) | null
    finishSubmitted: boolean
    boardManager!: BoardManager
    battleManager!: BattleManager
    scoreManager!: ScoreManager
    robotGrid!: RobotGrid
    audioDirector!: AudioDirector
    timerEvent: Phaser.Time.TimerEvent | null
    robotEvent: Phaser.Time.TimerEvent | null
    retryEvent: Phaser.Time.TimerEvent | null
    jewelExpireEvent: Phaser.Time.TimerEvent | null
    timeLeft: number
    sessionEnded: boolean
    roundLive: boolean
    busy: boolean
    retryPending: boolean
    boosting: boolean
    speedLevel: number
    queuedTilePositions: Position[]
    latestBattleSnapshot: BattleSnapshot | null
    battleAnnouncementSignature: string
    stopSkillReady: boolean
    stopSkillActive: boolean
    stopSkillEvent?: Phaser.Time.TimerEvent | null
    stopSkillWindowHandler: (() => void) | null
    missionTarget: number
    missionCount: number
    missionEndTime: number
    missionReward: number
    missionLabel: string
    feverTriggered: boolean

    constructor() {
        super('RobotSlideScene')
        this.options = {}
        this.hudTarget = null
        this.onFinish = null
        this.finishSubmitted = false
        this.timerEvent = null
        this.robotEvent = null
        this.retryEvent = null
        this.jewelExpireEvent = null
        this.timeLeft = GameConfig.SESSION_SECONDS
        this.sessionEnded = false
        this.roundLive = false
        this.busy = false
        this.retryPending = false
        this.boosting = false
        this.stopSkillReady = true
        this.stopSkillActive = false
        this.stopSkillEvent?.remove()
        this.stopSkillEvent = null
        this.startMission()
        this.feverTriggered = false
        this.speedLevel = 0
        this.queuedTilePositions = []
        this.latestBattleSnapshot = null
        this.battleAnnouncementSignature = ''
        this.stopSkillReady = true
        this.stopSkillActive = false
        this.stopSkillEvent = null
        this.stopSkillWindowHandler = null
        this.missionTarget = 3
        this.missionCount = 0
        this.missionEndTime = 45
        this.missionReward = 5
        this.missionLabel = 'GET 3 JEWELS'
        this.feverTriggered = false
    }

    init(options: RobotGameOptions = {}): void {
        this.options = options
        this.hudTarget = options.hudTarget ?? options.settings?.hudTarget ?? null
        this.onFinish = options.onFinish ?? null
        this.finishSubmitted = false
    }

    create(): void {
        this.cameras.main.setBackgroundColor('#071f29')
        this.boardManager = new BoardManager()
        this.battleManager = new BattleManager()
        this.scoreManager = new ScoreManager()
        this.robotGrid = new RobotGrid(this, this.boardManager.getSnapshot())
        this.audioDirector = new AudioDirector(this)
        this.connectEvents()
        this.stopSkillWindowHandler = () => {
            this.activateStopSkill()
        }
        window.addEventListener('robot-slide-use-stop', this.stopSkillWindowHandler)

        this.input.keyboard?.on('keydown-SPACE', () => {
            this.activateStopSkill()
        })

        this.events.once('shutdown', () => {
            this.jewelExpireEvent?.remove()
            this.jewelExpireEvent = null
            this.stopSkillEvent?.remove()
            this.stopSkillEvent = null

            if (this.stopSkillWindowHandler !== null) {
                window.removeEventListener('robot-slide-use-stop', this.stopSkillWindowHandler)
                this.stopSkillWindowHandler = null
        this.missionTarget = 3
        this.missionCount = 0
        this.missionEndTime = 45
        this.missionReward = 5
        this.missionLabel = 'GET 3 JEWELS'
        this.feverTriggered = false
            }

            this.audioDirector.destroy()
        })
        this.startSession()
    }

    connectEvents(): void {
        this.scoreManager.onScoreUpdated((snapshot) => {
            this.applyBattleSnapshot(this.battleManager.syncPlayerScore(snapshot, this.timeLeft))
            this.robotGrid.updateScore(snapshot)
            this.refreshRobotSpeed(snapshot.speedLevel)
            this.emitHud(snapshot.score)
        })

        this.scoreManager.onComboChanged((snapshot) => {
            this.robotGrid.updateCombo(snapshot)
        })

        this.robotGrid.setBoostHandlers(
            () => {
                this.startBoost()
            },
            () => {
                this.endBoost()
            },
        )

        this.robotGrid.setTileSelectHandler((position) => {
            this.handleTileSelected(position)
        })

        this.robotGrid.setRestartHandler(() => {
            this.scene.restart(this.options)
        })
    }

    getFairBoardSeed(): number {
        const difficulty = this.options.settings?.difficulty ?? 'normal'
        const base = `${difficulty}:${GameConfig.BOARD_SIZE}:${GameConfig.BLANK_COUNT}`
        let hash = 2166136261

        for (const char of base) {
            hash ^= char.charCodeAt(0)
            hash = Math.imul(hash, 16777619)
        }

        return hash >>> 0
    }

    startSession(): void {
        Random.setSeed(this.getFairBoardSeed())
        this.timeLeft = GameConfig.SESSION_SECONDS
        this.sessionEnded = false
        this.roundLive = false
        this.busy = false
        this.retryPending = false
        this.boosting = false
        this.stopSkillReady = true
        this.stopSkillActive = false
        this.stopSkillEvent?.remove()
        this.stopSkillEvent = null
        this.startMission()
        this.feverTriggered = false
        this.speedLevel = 0
        this.queuedTilePositions = []
        this.battleAnnouncementSignature = ''
        this.boardManager.resetBoard(0)
        this.latestBattleSnapshot = this.battleManager.reset()
        this.scoreManager.reset()
        this.robotGrid.hideResult()
        this.robotGrid.hideRetryNotice()
        this.robotGrid.setInteractionEnabled(false)
        this.robotGrid.setBoostActive(false)
        this.audioDirector.setAmbience(0)
        this.startJewelExpireTimer()

        const snapshot = this.boardManager.getSnapshot()
        this.applyBattleSnapshot(this.latestBattleSnapshot, true)
        this.robotGrid.sync(snapshot, this.timeLeft)
        this.emitHud()
        this.beginRoundIntro(snapshot)
    }

    startClockTimer(): void {
        if (this.timerEvent !== null) {
            this.timerEvent.remove()
        }

        this.timerEvent = this.time.addEvent({
            delay: 1000,
            loop: true,
            callback: () => {
                this.tickClock()
            },
        })
    }

    startRobotTimer(): void {
        if (this.stopSkillActive) {
            return
        }

        if (this.robotEvent !== null) {
            this.robotEvent.remove()
        }

        this.robotEvent = this.time.addEvent({
            delay: this.getCurrentRobotDelay(this.speedLevel),
            loop: true,
            callback: () => {
                this.advanceRobot()
            },
        })
    }

    startJewelExpireTimer(): void {
        if (this.jewelExpireEvent !== null) {
            this.jewelExpireEvent.remove()
            this.jewelExpireEvent = null
        }

        if (GameConfig.JEWEL_EXPIRE_COUNT <= 0 || GameConfig.JEWEL_EXPIRE_SECONDS >= 900) {
            return
        }

        this.jewelExpireEvent = this.time.addEvent({
            delay: GameConfig.JEWEL_EXPIRE_SECONDS * 1000,
            loop: true,
            callback: () => {
                this.expireJewels()
            },
        })
    }

    expireJewels(): void {
        if (this.sessionEnded || this.retryPending || !this.roundLive) {
            return
        }

        const expiredJewels = this.boardManager.expireJewels(GameConfig.JEWEL_EXPIRE_COUNT)

        for (const jewel of expiredJewels) {
            this.robotGrid.emitJewelExpire(jewel.position, jewel.value)
        }

        if (expiredJewels.length > 0) {
            this.robotGrid.showCallout(
                'STONE SHUFFLE!',
                `${expiredJewels.length} STONES MOVED`,
                0x9ffbff,
                820,
            )
            this.audioDirector.playSpecial()
            this.cameras.main.flash(180, 110, 230, 255, false)
            this.cameras.main.shake(110, 0.0018)
            this.robotGrid.sync(this.boardManager.getSnapshot(), this.timeLeft)
        }
    }

    handleTileSelected(position: Position): void {
        if (this.sessionEnded || this.retryPending || !this.roundLive) {
            return
        }

        if (this.busy) {
            this.queuedTilePositions.push({
                row: position.row,
                col: position.col,
            })
            return
        }

        const beforeSnapshot = this.boardManager.getSnapshot()
        const moveResult = this.boardManager.moveTile(position)

        if (!moveResult.moved) {
            return
        }

        const afterSnapshot = this.boardManager.getSnapshot()
        const routeImproved = this.isRouteImproved(beforeSnapshot, afterSnapshot)
        const rescuedRoute = !this.isDangerRisk(afterSnapshot.routePreview.riskLevel)
            && this.isDangerRisk(beforeSnapshot.routePreview.riskLevel)
        const loopFormed = !beforeSnapshot.routePreview.loopDetected && afterSnapshot.routePreview.loopDetected

        this.busy = true
        this.scoreManager.registerSlide(
            beforeSnapshot.routePreview,
            afterSnapshot.routePreview,
            moveResult.carriedRobot,
            moveResult.movedTiles.length,
        )

        if (rescuedRoute) {
            this.applyBattleSnapshot(this.battleManager.registerBigPlay(this.timeLeft, 'rescue'))
        }

        if (loopFormed) {
            this.applyBattleSnapshot(this.battleManager.registerBigPlay(this.timeLeft, 'loop'))
        }

        this.audioDirector.playSlide(
            Math.max(
                Math.max(0, afterSnapshot.routePreview.safeStepCount - beforeSnapshot.routePreview.safeStepCount),
                moveResult.movedTiles.length,
            ),
            routeImproved,
        )

        if (routeImproved) {
            this.audioDirector.playRouteConnect()
        }

        this.robotGrid.renderSlide(afterSnapshot, moveResult, () => {
            if (routeImproved) {
                this.robotGrid.celebrateRouteConnect(afterSnapshot.routePreview.nextPosition ?? afterSnapshot.robotPosition)
                this.cameras.main.shake(70, 0.0012)
            }

            this.busy = false
            this.updateThreat(afterSnapshot)
            this.consumeQueuedTile()
        })
    }

    advanceRobot(): void {
        if (this.sessionEnded || this.busy || this.retryPending || !this.roundLive) {
            return
        }

        const stepResult = this.boardManager.stepRobot()

        if (!stepResult.moved) {
            this.handleCrash(stepResult.from, stepResult.blockedPosition, stepResult.direction)
            return
        }

        const afterSnapshot = this.boardManager.getSnapshot()
        this.busy = true
        this.scoreManager.registerRobotStep(afterSnapshot.routePreview, stepResult.triggeredCurrent)

        if (stepResult.triggeredCurrent) {
            this.audioDirector.playSpecial()
        }

        if (stepResult.collectedJewel) {
            const scoreSnapshot = this.scoreManager.registerJewelCollect(
                afterSnapshot.routePreview,
                stepResult.collectedJewelValue,
            )
            this.audioDirector.playJewel(stepResult.collectedJewelValue)
            this.cameras.main.shake(
                stepResult.collectedJewelValue >= 5 ? 180 : 80,
                stepResult.collectedJewelValue >= 5 ? 0.004 : 0.0015,
            )

            if (stepResult.collectedJewelValue >= 5) {
                this.robotGrid.showCallout('POWER GEM!', '+5 / STOP READY', 0xf1a8ff, 980)
                this.cameras.main.flash(220, 238, 160, 255, false)
            } else if (stepResult.collectedJewelValue >= 3) {
                this.robotGrid.showCallout('TIME GEM!', `+${stepResult.collectedJewelValue} / +2 SEC`, 0x9ed8ff, 720)
            } else if (scoreSnapshot.jewelCount > 0 && scoreSnapshot.jewelCount % 3 === 0) {
                this.robotGrid.showCallout(
                    'STONE STREAK!',
                    `${scoreSnapshot.jewelCount} COLLECTED`,
                    0xffd48f,
                    760,
                )
            }

            this.handleJewelEffect(stepResult.collectedJewelValue)
        }

        this.robotGrid.renderRobotStep(afterSnapshot, stepResult, () => {
            this.busy = false
            this.updateThreat(afterSnapshot)
            this.consumeQueuedTile()
        })
    }

    handleCrash(from: Position, blockedPosition: Position | null, direction: DirectionValue): void {
        if (this.sessionEnded || this.retryPending) {
            return
        }

        this.retryPending = true
        this.roundLive = false
        this.busy = false
        this.queuedTilePositions = []
        this.endBoost()
        this.boardManager.collapseRobot()
        this.scoreManager.registerCrash()
        this.timeLeft = Math.max(1, this.timeLeft - GameConfig.CRASH_TIME_PENALTY_SECONDS)
        this.applyBattleSnapshot(this.battleManager.registerCrash(this.timeLeft))
        this.robotGrid.setInteractionEnabled(false)
        this.robotGrid.showRouteClosure(from, blockedPosition, direction)
        this.robotGrid.sync(this.boardManager.getSnapshot(), this.timeLeft)
        this.robotGrid.showRetryNotice()
        this.audioDirector.playCrash()
        this.cameras.main.shake(150, 0.004)

        if (this.retryEvent !== null) {
            this.retryEvent.remove()
        }

        this.retryEvent = this.time.addEvent({
            delay: GameConfig.RETRY_DELAY_MS,
            callback: () => {
                this.restartBoardAfterCrash()
            },
        })
    }

    restartBoardAfterCrash(): void {
        this.retryEvent = null

        if (this.sessionEnded) {
            return
        }

        this.boardManager.resetBoard(0)
        this.retryPending = false
        this.roundLive = true
        this.busy = false
        this.queuedTilePositions = []
        this.endBoost()
        this.robotGrid.hideRetryNotice()
        this.robotGrid.setInteractionEnabled(true)
        const snapshot = this.boardManager.getSnapshot()
        this.robotGrid.sync(snapshot, this.timeLeft)
        this.startJewelExpireTimer()
        this.robotGrid.showCallout('RECOVER', 'SAME RULES', 0xffd8a1, 620)
        this.updateThreat(snapshot)
    }

    startMission(): void {
        const remaining = Math.max(1, this.timeLeft)
        this.missionTarget = remaining <= 18 ? 2 : 3
        this.missionCount = 0
        this.missionReward = remaining <= 18 ? 4 : 5
        this.missionEndTime = Math.max(0, this.timeLeft - 15)
        this.missionLabel = `GET ${this.missionTarget} JEWELS`
    }

    getMissionTimeLeft(): number {
        return Math.max(0, this.timeLeft - this.missionEndTime)
    }

    completeMission(): void {
        this.scoreManager.registerBonus('MISSION CLEAR', this.missionReward, `+${this.missionReward} / STOP READY`)
        this.stopSkillReady = true
        this.stopSkillActive = false
        this.robotGrid.showCallout('MISSION CLEAR!', `+${this.missionReward} / STOP READY`, 0xffe38f, 980)
        this.audioDirector.playSpecial()
        this.startMission()
        this.emitHud()
    }

    handleMissionTick(): void {
        if (this.missionCount >= this.missionTarget) {
            this.completeMission()
            return
        }

        if (this.getMissionTimeLeft() <= 0) {
            this.robotGrid.showCallout('NEW MISSION', 'TRY AGAIN', 0x9ed8ff, 620)
            this.startMission()
            this.emitHud()
        }
    }

    handleJewelEffect(jewelValue: number): void {
        this.missionCount += 1

        if (jewelValue >= 5) {
            this.stopSkillReady = true
            this.robotGrid.showCallout('POWER GEM!', 'STOP READY', 0xf1a8ff, 900)
            this.audioDirector.playSpecial()
        } else if (jewelValue >= 3) {
            this.timeLeft = Math.min(GameConfig.SESSION_SECONDS, this.timeLeft + 2)
            this.robotGrid.showCallout('TIME GEM!', '+2 SEC', 0x9ed8ff, 760)
        } else if (this.missionCount >= this.missionTarget) {
            this.completeMission()
            return
        }

        if (this.missionCount >= this.missionTarget) {
            this.completeMission()
        } else {
            this.emitHud()
        }
    }

    handleFeverCheck(): void {
        if (this.feverTriggered || this.timeLeft > 10) {
            return
        }

        this.feverTriggered = true
        this.stopSkillReady = true
        this.robotGrid.showCallout('FINAL FEVER!', 'STOP READY', 0xffd48f, 1040)
        this.cameras.main.flash(260, 255, 218, 130, false)
        this.audioDirector.playSpecial()
        this.emitHud()
    }

    activateStopSkill(): void {
        if (this.sessionEnded || this.retryPending || !this.roundLive || !this.stopSkillReady || this.stopSkillActive) {
            return
        }

        this.stopSkillReady = false
        this.stopSkillActive = true

        if (this.robotEvent !== null) {
            this.robotEvent.remove()
            this.robotEvent = null
        }

        this.robotGrid.showCallout('STOP!', '2.2s THINK TIME', 0xa9f6ff, 900)
        this.audioDirector.playSpecial()
        this.emitHud()

        this.stopSkillEvent = this.time.addEvent({
            delay: 2200,
            callback: () => {
                this.stopSkillActive = false
                this.stopSkillEvent = null
                this.startRobotTimer()
                this.emitHud()
            },
        })
    }

    startBoost(): void {
        if (this.sessionEnded || this.retryPending || this.boosting || !this.roundLive) {
            return
        }

        this.boosting = true
        this.robotGrid.setBoostActive(true)
        this.restartRobotTimerIfRunning()
    }

    endBoost(): void {
        if (!this.boosting) {
            this.robotGrid.setBoostActive(false)
            return
        }

        this.boosting = false
        this.robotGrid.setBoostActive(false)
        this.restartRobotTimerIfRunning()
    }

    tickClock(): void {
        if (this.sessionEnded || !this.roundLive) {
            return
        }

        this.timeLeft -= 1
        const snapshot = this.boardManager.getSnapshot()
        this.applyBattleSnapshot(this.battleManager.advanceClock(this.timeLeft, this.scoreManager.getSnapshot()))
        this.robotGrid.sync(snapshot, this.timeLeft)
        this.handleMissionTick()
        this.handleFeverCheck()
        this.emitHud()
        this.updateThreat(snapshot)

        if (this.timeLeft <= 0) {
            this.endSession()
        }
    }

    refreshRobotSpeed(nextSpeedLevel: number): void {
        if (this.speedLevel === nextSpeedLevel) {
            return
        }

        this.speedLevel = nextSpeedLevel
        this.restartRobotTimerIfRunning()
    }

    restartRobotTimerIfRunning(): void {
        if (this.sessionEnded || this.retryPending || this.stopSkillActive || this.robotEvent === null) {
            return
        }

        this.startRobotTimer()
    }

    getCurrentRobotDelay(speedLevel: number): number {
        const baseDelay = Math.max(
            GameConfig.MIN_ROBOT_STEP_MS,
            GameConfig.ROBOT_STEP_MS - speedLevel * GameConfig.ROBOT_STEP_ACCELERATION_MS,
        )

        if (!this.boosting) {
            return baseDelay
        }

        return Math.max(
            GameConfig.MIN_BOOST_ROBOT_STEP_MS,
            baseDelay - GameConfig.BOOST_ROBOT_STEP_REDUCTION_MS,
        )
    }

    endSession(): void {
        if (this.sessionEnded) {
            return
        }

        this.sessionEnded = true
        this.roundLive = false
        this.busy = false
        this.retryPending = false
        this.boosting = false
        this.stopSkillActive = false
        this.stopSkillEvent?.remove()
        this.stopSkillEvent = null
        this.queuedTilePositions = []
        this.robotGrid.hideRetryNotice()
        this.robotGrid.setInteractionEnabled(false)
        this.robotGrid.setBoostActive(false)
        this.audioDirector.setAmbience(0)

        if (this.timerEvent !== null) {
            this.timerEvent.remove()
            this.timerEvent = null
        }

        if (this.robotEvent !== null) {
            this.robotEvent.remove()
            this.robotEvent = null
        }

        if (this.retryEvent !== null) {
            this.retryEvent.remove()
            this.retryEvent = null
        }

        this.applyBattleSnapshot(this.battleManager.syncPlayerScore(this.scoreManager.getSnapshot(), this.timeLeft), true)

        if (this.latestBattleSnapshot !== null) {
            this.robotGrid.showResult(this.scoreManager.getSnapshot(), this.latestBattleSnapshot)
        }

        this.submitResult()
    }

    emitHud(score: number = this.scoreManager.getSnapshot().score): void {
        if (this.hudTarget === null) {
            return
        }

        const scoreSnapshot = this.scoreManager.getSnapshot()
        const playerCount = this.getPlayerCount()
        const currentPlayerIndex = this.getCurrentPlayerIndex()
        const scores: Array<number | null> = Array(playerCount).fill(null)

        for (let index = 0; index < playerCount; index += 1) {
            scores[index] = this.options.scores?.[index] ?? null
        }

        scores[currentPlayerIndex] = score

        this.hudTarget.dispatchEvent(new CustomEvent('game-hud-update', {
            detail: {
                currentPlayerIndex,
                playerCount,
                scores,
                currentScore: score,
                timeLeft: this.timeLeft,
                ruleName: 'Robot Slide',
                jewelCount: scoreSnapshot.jewelCount,
                missCount: scoreSnapshot.crashCount,
                chainCount: scoreSnapshot.comboCount,
                efficiency: scoreSnapshot.efficiency,
                lastEventLabel: scoreSnapshot.lastEventLabel,
                lastAward: scoreSnapshot.lastAward,
                lastAwardDetail: scoreSnapshot.lastAwardDetail,
                stopSkillReady: this.stopSkillReady,
                stopSkillActive: this.stopSkillActive,
                missionLabel: this.missionLabel,
                missionCount: this.missionCount,
                missionTarget: this.missionTarget,
                missionTimeLeft: this.getMissionTimeLeft(),
                feverActive: this.feverTriggered && this.timeLeft <= 10,
            },
        }))
    }

    getPlayerCount(): number {
        return Math.max(1, Math.trunc(this.options.settings?.playerCount ?? 1))
    }

    getCurrentPlayerIndex(): number {
        return Math.max(0, Math.min(this.getPlayerCount() - 1, Math.trunc(this.options.currentPlayerIndex ?? 0)))
    }

    submitResult(): void {
        if (this.finishSubmitted) {
            return
        }

        this.finishSubmitted = true
        const snapshot = this.scoreManager.getSnapshot()
        const score = snapshot.score
        const playerCount = this.getPlayerCount()
        const currentPlayerIndex = this.getCurrentPlayerIndex()
        const scores = Array.from({ length: playerCount }, (_, index) => this.options.scores?.[index] ?? 0)
        const playerStats = Array.from({ length: playerCount }, (_, index) => this.options.playerStats?.[index] ?? {
            score: this.options.scores?.[index] ?? 0,
            missCount: 0,
            travelCount: 0,
        })
        scores[currentPlayerIndex] = score
        playerStats[currentPlayerIndex] = {
            score,
            missCount: snapshot.crashCount,
            travelCount: snapshot.travelCount,
        }
        this.options.scores = scores
        this.options.playerStats = playerStats
        this.emitHud(score)

        if (currentPlayerIndex + 1 < playerCount) {
            this.options.currentPlayerIndex = currentPlayerIndex + 1
            this.time.delayedCall(2200, () => {
                this.scene.restart(this.options)
            })
            return
        }

        this.onFinish?.({
            results: playerStats.map((stats, index) => ({
                player: index + 1,
                score: stats.score,
                missCount: stats.missCount,
                travelCount: stats.travelCount,
            })),
        })
    }

    updateThreat(snapshot: BoardSnapshot): void {
        const dangerLevel = this.getDangerLevel(snapshot.routePreview.riskLevel, this.timeLeft, this.latestBattleSnapshot)
        this.audioDirector.setAmbience(dangerLevel)

        if (dangerLevel >= 2) {
            this.audioDirector.playWarning()
        }
    }

    getDangerLevel(riskLevel: RouteRiskLevel, timeLeft: number, battleSnapshot: BattleSnapshot | null): number {
        const routeLevel = riskLevel === 'critical'
            ? 3
            : riskLevel === 'danger'
                ? 2
                : riskLevel === 'warning'
                    ? 1
                    : 0
        const timeLevel = timeLeft <= GameConfig.TIME_DANGER_SECONDS
            ? 3
            : timeLeft <= GameConfig.TIME_WARNING_SECONDS
                ? 1
                : 0
        const battleLevel = battleSnapshot !== null && battleSnapshot.state === 'behind'
            ? timeLeft <= 12
                ? 2
                : timeLeft <= 22
                    ? 1
                    : 0
            : 0
        return Math.max(routeLevel, timeLevel, battleLevel)
    }

    isRouteImproved(beforeSnapshot: BoardSnapshot, afterSnapshot: BoardSnapshot): boolean {
        return afterSnapshot.routePreview.safeStepCount > beforeSnapshot.routePreview.safeStepCount
            || (!this.isDangerRisk(afterSnapshot.routePreview.riskLevel) && this.isDangerRisk(beforeSnapshot.routePreview.riskLevel))
            || (!beforeSnapshot.routePreview.loopDetected && afterSnapshot.routePreview.loopDetected)
    }

    isDangerRisk(riskLevel: RouteRiskLevel): boolean {
        return riskLevel === 'danger' || riskLevel === 'critical'
    }

    getSessionProgress(): number {
        return 1 - this.timeLeft / GameConfig.SESSION_SECONDS
    }

    beginRoundIntro(snapshot: BoardSnapshot): void {
        this.robotGrid.showCallout('ROUND START', 'COLLECT JEWELS', 0x8fe5eb, 640)
        this.time.delayedCall(760, () => {
            if (this.sessionEnded) {
                return
            }

            this.robotGrid.showCallout('DIVE', 'READ AHEAD', 0xf6e0a8, 520)
        })
        this.time.delayedCall(1320, () => {
            if (this.sessionEnded) {
                return
            }

            this.roundLive = true
            this.robotGrid.setInteractionEnabled(true)
            this.startClockTimer()
            this.startRobotTimer()
            this.updateThreat(snapshot)
        })
    }

    applyBattleSnapshot(snapshot: BattleSnapshot, silent: boolean = false): void {
        const previousSnapshot = this.latestBattleSnapshot
        this.latestBattleSnapshot = snapshot
        this.robotGrid.updateBattle(snapshot)

        if (silent || previousSnapshot === null) {
            return
        }

        this.maybeAnnounceBattleShift(previousSnapshot, snapshot)
    }

    maybeAnnounceBattleShift(previousSnapshot: BattleSnapshot, nextSnapshot: BattleSnapshot): void {
        let signature = ''
        let title = ''
        let body = ''
        let accentColor = 0x8fe5eb

        if (previousSnapshot.phase !== nextSnapshot.phase) {
            signature = `phase-${nextSnapshot.phase}`
            title = nextSnapshot.phase === 'middle' ? 'MID TIDE' : 'FINAL RUSH'
            body = nextSnapshot.phase === 'middle' ? 'READ THE BRANCHES' : 'LAST PUSH'
            accentColor = nextSnapshot.phase === 'middle' ? 0xbceeff : 0xffd48f
        } else if (previousSnapshot.state !== nextSnapshot.state) {
            signature = `state-${nextSnapshot.state}`

            if (nextSnapshot.state === 'ahead') {
                title = 'TARGET CLEAR'
                body = 'KEEP COLLECTING'
                accentColor = 0xbfeec6
            } else if (nextSnapshot.state === 'behind') {
                title = 'TARGET LEFT'
                body = 'COLLECT JEWELS'
                accentColor = 0xffc3b6
            } else {
                title = 'TARGET'
                body = 'ONE JEWEL CAN CLEAR'
                accentColor = 0xbceeff
            }
        } else if (this.timeLeft <= 10 && Math.abs(nextSnapshot.scoreDiff) <= 160) {
            signature = `photo-${this.timeLeft}`
            title = 'LAST CHANCE'
            body = 'ONE JEWEL CAN CLEAR'
            accentColor = 0xffe2a1
        }

        if (signature === '' || signature === this.battleAnnouncementSignature) {
            return
        }

        this.battleAnnouncementSignature = signature
        this.robotGrid.showCallout(title, body, accentColor, 760)
    }

    consumeQueuedTile(): void {
        if (this.busy || this.sessionEnded || this.retryPending || this.queuedTilePositions.length === 0) {
            return
        }

        const nextPosition = this.queuedTilePositions.shift()

        if (nextPosition === undefined) {
            return
        }

        this.time.delayedCall(0, () => {
            this.handleTileSelected(nextPosition)

            if (!this.busy && !this.sessionEnded && !this.retryPending && this.queuedTilePositions.length > 0) {
                this.consumeQueuedTile()
            }
        })
    }
}
