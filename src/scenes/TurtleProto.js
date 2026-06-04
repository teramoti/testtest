import type { BoardSnapshot } from '../models/BoardSnapshot.js'
import type { BattleSnapshot } from '../models/BattleSnapshot.js'
import type { Position } from '../models/Position.js'
import type { RouteRiskLevel } from '../models/RoutePreview.js'
import { AudioDirector } from '../systems/AudioDirector.js'
import { BattleManager } from '../systems/BattleManager.js'
import { BoardManager } from '../systems/BoardManager.js'
import { ScoreManager } from '../systems/ScoreManager.js'
import { TurtleGrid } from '../ui/TurtleGrid.js'
import { GameConfig } from '../utils/GameConfig.js'

export class TurtleProto extends Phaser.Scene {
    boardManager!: BoardManager
    battleManager!: BattleManager
    scoreManager!: ScoreManager
    turtleGrid!: TurtleGrid
    audioDirector!: AudioDirector
    timerEvent: Phaser.TimeEvent | null
    turtleEvent: Phaser.TimeEvent | null
    retryEvent: Phaser.TimeEvent | null
    timeLeft: number
    sessionEnded: boolean
    roundLive: boolean
    busy: boolean
    retryPending: boolean
    boosting: boolean
    speedLevel: number
    queuedTilePosition: Position | null
    latestBattleSnapshot: BattleSnapshot | null
    battleAnnouncementSignature: string

    constructor() {
        super('TurtleProto')
        this.timerEvent = null
        this.turtleEvent = null
        this.retryEvent = null
        this.timeLeft = GameConfig.SESSION_SECONDS
        this.sessionEnded = false
        this.roundLive = false
        this.busy = false
        this.retryPending = false
        this.boosting = false
        this.speedLevel = 0
        this.queuedTilePosition = null
        this.latestBattleSnapshot = null
        this.battleAnnouncementSignature = ''
    }

    create(): void {
        this.cameras.main.setBackgroundColor('#071f29')
        this.boardManager = new BoardManager()
        this.battleManager = new BattleManager()
        this.scoreManager = new ScoreManager()
        this.turtleGrid = new TurtleGrid(this, this.boardManager.getSnapshot())
        this.audioDirector = new AudioDirector(this)
        this.connectEvents()
        this.events.once('shutdown', () => {
            this.audioDirector.destroy()
        })
        this.startSession()
    }

    connectEvents(): void {
        this.scoreManager.onScoreUpdated((snapshot) => {
            this.applyBattleSnapshot(this.battleManager.syncPlayerScore(snapshot, this.timeLeft))
            this.turtleGrid.updateScore(snapshot)
            this.refreshTurtleSpeed(snapshot.speedLevel)
        })

        this.scoreManager.onComboChanged((snapshot) => {
            this.turtleGrid.updateCombo(snapshot)
        })

        this.turtleGrid.setBoostHandlers(
            () => {
                this.startBoost()
            },
            () => {
                this.endBoost()
            },
        )

        this.turtleGrid.setTileSelectHandler((position) => {
            this.handleTileSelected(position)
        })

        this.turtleGrid.setRestartHandler(() => {
            this.scene.restart()
        })
    }

    startSession(): void {
        this.timeLeft = GameConfig.SESSION_SECONDS
        this.sessionEnded = false
        this.roundLive = false
        this.busy = false
        this.retryPending = false
        this.boosting = false
        this.speedLevel = 0
        this.queuedTilePosition = null
        this.battleAnnouncementSignature = ''
        this.boardManager.resetBoard(0)
        this.latestBattleSnapshot = this.battleManager.reset()
        this.scoreManager.reset()
        this.turtleGrid.hideResult()
        this.turtleGrid.hideRetryNotice()
        this.turtleGrid.setInteractionEnabled(false)
        this.turtleGrid.setBoostActive(false)
        this.audioDirector.setAmbience(0)

        const snapshot = this.boardManager.getSnapshot()
        this.applyBattleSnapshot(this.latestBattleSnapshot, true)
        this.turtleGrid.sync(snapshot, this.timeLeft)
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

    startTurtleTimer(): void {
        if (this.turtleEvent !== null) {
            this.turtleEvent.remove()
        }

        this.turtleEvent = this.time.addEvent({
            delay: this.getCurrentTurtleDelay(this.speedLevel),
            loop: true,
            callback: () => {
                this.advanceTurtle()
            },
        })
    }

    handleTileSelected(position: Position): void {
        if (this.sessionEnded || this.retryPending || !this.roundLive) {
            return
        }

        if (this.busy) {
            this.queuedTilePosition = {
                row: position.row,
                col: position.col,
            }
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
        this.scoreManager.registerSlide(beforeSnapshot.routePreview, afterSnapshot.routePreview, moveResult.carriedTurtle)

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

        this.turtleGrid.renderSlide(afterSnapshot, moveResult, () => {
            if (routeImproved) {
                this.turtleGrid.celebrateRouteConnect(afterSnapshot.routePreview.nextPosition ?? afterSnapshot.turtlePosition)
                this.cameras.main.shake(70, 0.0012)
            }

            this.busy = false
            this.updateThreat(afterSnapshot)
            this.consumeQueuedTile()
        })
    }

    advanceTurtle(): void {
        if (this.sessionEnded || this.busy || this.retryPending || !this.roundLive) {
            return
        }

        const stepResult = this.boardManager.stepTurtle()

        if (!stepResult.moved) {
            this.handleCrash(stepResult.from, stepResult.blockedPosition, stepResult.direction)
            return
        }

        const afterSnapshot = this.boardManager.getSnapshot()
        this.busy = true
        this.scoreManager.registerTurtleStep(afterSnapshot.routePreview, stepResult.triggeredCurrent)

        if (stepResult.triggeredCurrent) {
            this.audioDirector.playSpecial()
        }

        if (stepResult.collectedJewel) {
            const scoreSnapshot = this.scoreManager.registerJewelCollect(afterSnapshot.routePreview)

            if (scoreSnapshot.comboCount >= GameConfig.FLOW_BIG_PLAY_COUNT) {
                this.applyBattleSnapshot(this.battleManager.registerBigPlay(this.timeLeft, 'combo'))
            }

            this.audioDirector.playJewel(scoreSnapshot.comboCount)
            this.cameras.main.shake(80, 0.0015)
        }

        this.turtleGrid.renderTurtleStep(afterSnapshot, stepResult, () => {
            this.busy = false
            this.updateThreat(afterSnapshot)
            this.consumeQueuedTile()
        })
    }

    handleCrash(from: Position, blockedPosition: Position | null, direction: number): void {
        if (this.sessionEnded || this.retryPending) {
            return
        }

        this.retryPending = true
        this.roundLive = false
        this.busy = false
        this.queuedTilePosition = null
        this.endBoost()
        this.boardManager.collapseTurtle()
        this.scoreManager.registerCrash()
        this.timeLeft = Math.max(1, this.timeLeft - GameConfig.CRASH_TIME_PENALTY_SECONDS)
        this.applyBattleSnapshot(this.battleManager.registerCrash(this.timeLeft))
        this.turtleGrid.setInteractionEnabled(false)
        this.turtleGrid.showRouteClosure(from, blockedPosition, direction)
        this.turtleGrid.sync(this.boardManager.getSnapshot(), this.timeLeft)
        this.turtleGrid.showRetryNotice()
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

        this.boardManager.resetBoard(this.getSessionProgress())
        this.retryPending = false
        this.roundLive = true
        this.busy = false
        this.queuedTilePosition = null
        this.endBoost()
        this.turtleGrid.hideRetryNotice()
        this.turtleGrid.setInteractionEnabled(true)
        const snapshot = this.boardManager.getSnapshot()
        this.turtleGrid.sync(snapshot, this.timeLeft)
        this.turtleGrid.showCallout('RECOVER', 'KEEP SCORING', 0xffd8a1, 620)
        this.updateThreat(snapshot)
    }

    startBoost(): void {
        if (this.sessionEnded || this.retryPending || this.boosting || !this.roundLive) {
            return
        }

        this.boosting = true
        this.turtleGrid.setBoostActive(true)
        this.restartTurtleTimerIfRunning()
    }

    endBoost(): void {
        if (!this.boosting) {
            this.turtleGrid.setBoostActive(false)
            return
        }

        this.boosting = false
        this.turtleGrid.setBoostActive(false)
        this.restartTurtleTimerIfRunning()
    }

    tickClock(): void {
        if (this.sessionEnded || !this.roundLive) {
            return
        }

        this.timeLeft -= 1
        this.scoreManager.advanceComboTimer(1000)
        const snapshot = this.boardManager.getSnapshot()
        this.applyBattleSnapshot(this.battleManager.advanceClock(this.timeLeft, this.scoreManager.getSnapshot()))
        this.turtleGrid.sync(snapshot, this.timeLeft)
        this.updateThreat(snapshot)

        if (this.timeLeft <= 0) {
            this.endSession()
        }
    }

    refreshTurtleSpeed(nextSpeedLevel: number): void {
        if (this.speedLevel === nextSpeedLevel) {
            return
        }

        this.speedLevel = nextSpeedLevel
        this.restartTurtleTimerIfRunning()
    }

    restartTurtleTimerIfRunning(): void {
        if (this.sessionEnded || this.retryPending || this.turtleEvent === null) {
            return
        }

        this.startTurtleTimer()
    }

    getCurrentTurtleDelay(speedLevel: number): number {
        const baseDelay = Math.max(
            GameConfig.MIN_TURTLE_STEP_MS,
            GameConfig.TURTLE_STEP_MS - speedLevel * GameConfig.TURTLE_STEP_ACCELERATION_MS,
        )

        if (!this.boosting) {
            return baseDelay
        }

        return Math.max(
            GameConfig.MIN_BOOST_TURTLE_STEP_MS,
            baseDelay - GameConfig.BOOST_TURTLE_STEP_REDUCTION_MS,
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
        this.queuedTilePosition = null
        this.turtleGrid.hideRetryNotice()
        this.turtleGrid.setInteractionEnabled(false)
        this.turtleGrid.setBoostActive(false)
        this.audioDirector.setAmbience(0)

        if (this.timerEvent !== null) {
            this.timerEvent.remove()
            this.timerEvent = null
        }

        if (this.turtleEvent !== null) {
            this.turtleEvent.remove()
            this.turtleEvent = null
        }

        if (this.retryEvent !== null) {
            this.retryEvent.remove()
            this.retryEvent = null
        }

        this.applyBattleSnapshot(this.battleManager.syncPlayerScore(this.scoreManager.getSnapshot(), this.timeLeft), true)

        if (this.latestBattleSnapshot !== null) {
            this.turtleGrid.showResult(this.scoreManager.getSnapshot(), this.latestBattleSnapshot)
        }
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
        this.turtleGrid.showCallout('ROUND START', 'BEAT THE RIVAL', 0x8fe5eb, 640)
        this.time.delayedCall(760, () => {
            if (this.sessionEnded) {
                return
            }

            this.turtleGrid.showCallout('DIVE', 'READ AHEAD', 0xf6e0a8, 520)
        })
        this.time.delayedCall(1320, () => {
            if (this.sessionEnded) {
                return
            }

            this.roundLive = true
            this.turtleGrid.setInteractionEnabled(true)
            this.startClockTimer()
            this.startTurtleTimer()
            this.updateThreat(snapshot)
        })
    }

    applyBattleSnapshot(snapshot: BattleSnapshot, silent: boolean = false): void {
        const previousSnapshot = this.latestBattleSnapshot
        this.latestBattleSnapshot = snapshot
        this.turtleGrid.updateBattle(snapshot)

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
                title = 'TURNAROUND'
                body = 'YOU TOOK THE LEAD'
                accentColor = 0xbfeec6
            } else if (nextSnapshot.state === 'behind') {
                title = 'RIVAL LEAD'
                body = 'REBUILD THE ROUTE'
                accentColor = 0xffc3b6
            } else {
                title = 'EVEN BATTLE'
                body = 'ONE MOVE CAN SWING IT'
                accentColor = 0xbceeff
            }
        } else if (this.timeLeft <= 10 && Math.abs(nextSnapshot.scoreDiff) <= 160) {
            signature = `photo-${this.timeLeft}`
            title = 'PHOTO FINISH'
            body = 'ONE JEWEL FOR THE WIN'
            accentColor = 0xffe2a1
        }

        if (signature === '' || signature === this.battleAnnouncementSignature) {
            return
        }

        this.battleAnnouncementSignature = signature
        this.turtleGrid.showCallout(title, body, accentColor, 760)
    }

    consumeQueuedTile(): void {
        if (this.busy || this.sessionEnded || this.retryPending || this.queuedTilePosition === null) {
            return
        }

        const nextPosition = this.queuedTilePosition
        this.queuedTilePosition = null
        this.time.delayedCall(0, () => {
            this.handleTileSelected(nextPosition)
        })
    }
}
