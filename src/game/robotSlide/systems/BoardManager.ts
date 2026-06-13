import type { BoardSnapshot } from '../models/BoardSnapshot.ts'
import { Direction, type Direction as DirectionValue } from '../models/Direction.ts'
import type { MoveResult } from '../models/MoveResult.ts'
import type { BranchBias, PathTileKind, PathTileSnapshot, TileFeature } from '../models/PathTileSnapshot.ts'
import type { Position } from '../models/Position.ts'
import type { RoutePreview, RouteRiskLevel } from '../models/RoutePreview.ts'
import type { RobotStepResult } from '../models/RobotStepResult.ts'
import { GameConfig } from '../utils/GameConfig.ts'
import { Random } from '../utils/Random.ts'

/**
 * BoardManager: central board logic.
 * - Manages tileIds, blankPosition, robot and tile catalog.
 * - Uses `boardSize` (constructor parameter) rather than hardcoded values.
 * - moveTile supports multi-tile slides and returns movedTiles[] for the UI to animate.
 * - Prefer `this.boardSize` / snapshot.boardSize over magic numbers (4, 16, etc.).
 * - If pointer alignment seems off, verify GameConfig origin/size and canvas scaling.
 */

interface RouteCandidate {
    direction: DirectionValue
    routeLength: number
    loopDetected: boolean
    junctionCount: number
}

interface LayoutSnapshot {
    tileIds: number[][]
    blankPositions: Position[]
    candidate: RouteCandidate
}

interface StepSimulation {
    moved: boolean
    to: Position | null
    direction: DirectionValue
    blockedPosition: Position | null
}

interface DifficultyProfile {
    key: 'calm' | 'current' | 'storm'
    label: string
    tileWeights: { item: PathTileKind, weight: number }[]
    currentFeatureChance: number
    allowStartingLoop: boolean
    targetRouteLength: number
    initialJewelCount: number
    priorityRouteJewelCount: number
}

export class BoardManager {
    boardSize: number
    tileIds: number[][]
    tileCatalog: Map<number, PathTileSnapshot>
    blankPosition: Position
    blankPositions: Position[]
    robotPosition: Position
    robotDirection: DirectionValue
    robotAlive: boolean
    jewelTileIds: Set<number>
    jewelValues: Map<number, number>
    currentDifficulty: DifficultyProfile

    constructor(boardSize: number = GameConfig.BOARD_SIZE) {
        this.boardSize = boardSize
        this.tileIds = []
        this.tileCatalog = new Map()
        this.blankPosition = { row: 0, col: 0 }
        this.blankPositions = [{ row: 0, col: 0 }, { row: 0, col: 1 }]
        this.robotPosition = { row: 0, col: 0 }
        this.robotDirection = Direction.Right
        this.robotAlive = true
        this.jewelTileIds = new Set()
        this.jewelValues = new Map()
        this.currentDifficulty = this.selectDifficulty(0)
        this.resetBoard()
    }

    /**
     * resetBoard: 逶､髱｢繧貞・譛溷喧縺吶ｋ縲・     * - 謖・ｮ壹＆繧後◆騾ｲ陦悟ｺｦ(progress)縺ｫ蝓ｺ縺･縺埼屮譏灘ｺｦ繧帝∈謚槭☆繧九・     * - 繧ｿ繧､繝ｫ繧ｫ繧ｿ繝ｭ繧ｰ繧貞・譛溷喧縺励√Λ繝ｳ繝繝繝ｬ繧､繧｢繧ｦ繝医ｒ逕滓・縺励※髢句ｧ九Ν繝ｼ繝医ｒ豎ゅａ繧九・     * - 蜿ｯ隗｣縺ｪ蛟呵｣懊′隕九▽縺九ｌ縺ｰ縺昴・繝ｫ繝ｼ繝医ｒ謗｡逕ｨ縺励∝ｮ晉浹繧帝・鄂ｮ縺吶ｋ縲・     * - 郢ｰ繧願ｿ斐＠隧ｦ陦後＠縺ｦ繝輔か繝ｼ繝ｫ繝舌ャ繧ｯ繧貞茜逕ｨ縺吶ｋ蜃ｦ逅・ｒ蜷ｫ繧縲・     */
    resetBoard(progress: number = 0): void {
        this.currentDifficulty = this.selectDifficulty(progress)
        this.initTileCatalog(this.currentDifficulty)

        let fallbackLayout: LayoutSnapshot | null = null

        for (let attempt = 0; attempt < GameConfig.MAX_LAYOUT_ATTEMPTS; attempt += 1) {
            this.createRandomLayout()
            const candidate = this.findStartRoute()

            if (candidate === null || !this.hasMovableTile()) {
                continue
            }

            if (fallbackLayout === null || this.isBetterCandidate(candidate, fallbackLayout.candidate)) {
                fallbackLayout = this.captureLayout(candidate)
            }

            if (candidate.routeLength >= this.currentDifficulty.targetRouteLength) {
                this.applyRouteCandidate(candidate)
                this.resetJewels()
                return
            }
        }

        if (fallbackLayout !== null) {
            this.restoreLayout(fallbackLayout)
            this.applyRouteCandidate(fallbackLayout.candidate)
            this.resetJewels()
            return
        }

        for (let attempt = 0; attempt < GameConfig.MAX_LAYOUT_ATTEMPTS; attempt += 1) {
            this.createRandomLayout()

            if (!this.hasMovableTile()) {
                continue
            }

            const candidate = this.findStartRoute()

            if (candidate !== null) {
                this.applyRouteCandidate(candidate)
                this.resetJewels()
                return
            }
        }

        this.createRandomLayout()
        this.robotPosition = { row: 0, col: 0 }
        this.robotDirection = Direction.Right
        this.robotAlive = true
        this.resetJewels()
    }

    /**
     * getSnapshot: 迴ｾ蝨ｨ縺ｮ逶､髱｢迥ｶ諷九ｒUI蜷代￠縺ｫ繧ｳ繝斐・縺励※霑斐☆縲・     * - tileIds 縺ｯ豺ｱ縺・さ繝斐・縺ｧ霑斐☆・・I縺檎峩謗･螟画峩縺励↑縺・◆繧・ｼ峨・     * - tileCatalog 縺ｯ謠冗判逕ｨ縺ｫ邁｡邏蛹悶＠縺滄・蛻励→縺励※霑斐☆縲・     */
    getSnapshot(): BoardSnapshot {
        const routePreview = this.robotAlive
            ? this.buildRoutePreview(this.robotPosition, this.robotDirection)
            : this.createDeadRoutePreview()

        return {
            boardSize: this.boardSize,
            tileIds: this.tileIds.map((row) => [...row]),
            tileCatalog: Array.from(this.tileCatalog.values()).map((tile) => ({
                id: tile.id,
                kind: tile.kind,
                rotation: tile.rotation,
                feature: tile.feature,
                branchBias: tile.branchBias,
                traits: [...tile.traits],
            })),
            blankPosition: this.clonePosition(this.blankPositions[0]),
            blankPositions: this.blankPositions.map((position) => this.clonePosition(position)),
            movablePositions: this.listMovablePositions(),
            robotPosition: this.clonePosition(this.robotPosition),
            robotDirection: this.robotDirection,
            robotAlive: this.robotAlive,
            jewelTileIds: [...this.jewelTileIds],
            jewelValues: Object.fromEntries(this.jewelValues),
            nextStepSafe: routePreview.safeStepCount > 0,
            routePreview,
            difficultyLabel: this.currentDifficulty.label,
        }
    }

    /**
     * canMoveTile: 謖・ｮ壻ｽ咲ｽｮ縺ｮ繧ｿ繧､繝ｫ縺檎ｩｺ逋ｽ縺ｾ縺ｧ蜷御ｸ陦後∪縺溘・蜷御ｸ蛻励〒繧ｹ繝ｩ繧､繝牙庄閭ｽ縺句愛螳壹☆繧九・     * - 蝗ｺ螳壹ち繧､繝ｫ・・raits 縺ｫ 'fixed' 繧貞性繧・峨・遘ｻ蜍穂ｸ榊庄縲・     * - 繧ｹ繝ｩ繧､繝臥ｵ瑚ｷｯ荳翫↓蝗ｺ螳壹ち繧､繝ｫ縺後≠繧後・荳榊庄縲・     */
    canMoveTile(position: Position): boolean {
        const tile = this.getTileAtPosition(position)

        if (tile === undefined || tile.traits.includes('fixed')) {
            return false
        }

        const pathPositions = this.getSlidePathPositions(position)

        if (pathPositions === null || pathPositions.length === 0) {
            return false
        }

        for (const pathPosition of pathPositions) {
            const pathTile = this.getTileAtPosition(pathPosition)

            if (pathTile === undefined || pathTile.traits.includes('fixed')) {
                return false
            }
        }

        return true
    }

    // Move a tile (possibly multiple tiles in the same row/column) toward the blank.
    // Returns detailed movedTiles so the UI can animate each tile from->to.
    /**
     * moveTile: 謖・ｮ壻ｽ咲ｽｮ縺九ｉ遨ｺ逋ｽ縺ｸ蜷代￠縺ｦ繧ｿ繧､繝ｫ鄒､繧偵せ繝ｩ繧､繝峨☆繧句・逅・・     * - getSlidePathPositions 縺ｮ霑斐☆鬆・ｺ擾ｼ磯∈謚樔ｽ咲ｽｮ竊堤ｩｺ逋ｽ逶ｴ蜑搾ｼ峨ｒ蜈・↓ movedTiles 繧堤函謌舌☆繧九・     * - 逶､髱｢譖ｴ譁ｰ縺ｯ荳頑嶌縺埼亟豁｢縺ｮ縺溘ａ reverse order 縺ｧ陦後＞縲∵怙邨ら噪縺ｫ this.tileIds 縺ｨ this.blankPosition 繧呈峩譁ｰ縺吶ｋ縲・     * - 謌ｻ繧雁､縺ｫ縺ｯ movedTiles 繧貞性繧√ゞI 縺ｯ縺薙ｌ繧剃ｽｿ縺｣縺ｦ蛟句挨縺ｫ繧｢繝九Γ繝ｼ繧ｷ繝ｧ繝ｳ縺吶ｋ諠ｳ螳壹・     */
    moveTile(position: Position): MoveResult {
        if (!this.canMoveTile(position)) {
            return {
                moved: false,
                tileId: 0,
                from: null,
                to: null,
                carriedRobot: false,
                movedTiles: [],
            }
        }

        const from = this.clonePosition(position)
        const tileId = this.tileIds[from.row][from.col]
        const targetBlank = this.findTargetBlank(position)
        const slideDirection = targetBlank === null ? null : this.getSlideDirectionToBlank(position, targetBlank)
        const pathPositions = targetBlank === null ? null : this.getSlidePathPositionsToBlank(position, targetBlank)

        if (targetBlank === null || slideDirection === null || pathPositions === null || pathPositions.length === 0) {
            return {
                moved: false,
                tileId: 0,
                from: null,
                to: null,
                carriedRobot: false,
                movedTiles: [],
            }
        }

        const step = this.getDirectionDelta(slideDirection)

        // Build list of moved tiles (in order from source toward blank)
        const movedTiles = pathPositions.map((sourcePosition) => {
            const destinationPosition = {
                row: sourcePosition.row + step.row,
                col: sourcePosition.col + step.col,
            }

            return {
                tileId: this.tileIds[sourcePosition.row][sourcePosition.col],
                from: this.clonePosition(sourcePosition),
                to: destinationPosition,
                carriedRobot: sourcePosition.row === this.robotPosition.row
                    && sourcePosition.col === this.robotPosition.col,
            }
        })

        const nextTileIds = this.tileIds.map((row) => [...row])
        let carriedRobot = false

        // Apply tiles from far end to blank to avoid overwrite
        for (const sourcePosition of [...pathPositions].reverse()) {
            const destinationPosition = {
                row: sourcePosition.row + step.row,
                col: sourcePosition.col + step.col,
            }
            const movedTileId = this.tileIds[sourcePosition.row][sourcePosition.col]

            nextTileIds[destinationPosition.row][destinationPosition.col] = movedTileId
            nextTileIds[sourcePosition.row][sourcePosition.col] = 0

            if (sourcePosition.row === this.robotPosition.row && sourcePosition.col === this.robotPosition.col) {
                this.robotPosition = this.clonePosition(destinationPosition)
                carriedRobot = true
            }
        }

        nextTileIds[from.row][from.col] = 0
        this.tileIds = nextTileIds
        this.replaceBlankPosition(targetBlank, from)

        return {
            moved: true,
            tileId,
            from,
            to: this.clonePosition({
                row: from.row + step.row,
                col: from.col + step.col,
            }),
            carriedRobot,
            movedTiles,
        }
    }

    /**
     * stepRobot: 繧ｫ繝｡縺ｮ荳豁ｩ繧偵す繝溘Η繝ｬ繝ｼ繝医＠縺ｦ螳滄圀縺ｫ菴咲ｽｮ/蜷代″繧呈峩譁ｰ縺吶ｋ縲・     * - simulateStep 縺ｫ繧医ｋ遘ｻ蜍募庄閭ｽ諤ｧ蛻､螳・竊・謌仙粥譎ゅ↓ robotPosition/robotDirection 繧呈峩譁ｰ
     * - 螳晉浹蝗槫庶繧・ｵ√ｌ・・urrent・峨ヨ繝ｪ繧ｬ繝ｼ縺ｮ蛻､螳壹ｒ陦後＞縲∫ｵ先棡繧定ｿ斐☆縲・     */
    stepRobot(): RobotStepResult {
        const from = this.clonePosition(this.robotPosition)

        if (!this.robotAlive) {
            return {
                moved: false,
                from,
                to: null,
                direction: this.robotDirection,
                alive: false,
                collectedJewel: false,
                collectedJewelValue: 0,
                triggeredCurrent: false,
                loopDetected: false,
                blockedPosition: null,
            }
        }

        const simulation = this.simulateStep(this.robotPosition, this.robotDirection)

        if (!simulation.moved || simulation.to === null) {
            return {
                moved: false,
                from,
                to: null,
                direction: this.robotDirection,
                alive: true,
                collectedJewel: false,
                collectedJewelValue: 0,
                triggeredCurrent: false,
                loopDetected: false,
                blockedPosition: simulation.blockedPosition,
            }
        }

        this.robotPosition = simulation.to
        this.robotDirection = simulation.direction
        const currentTile = this.getTileAtPosition(this.robotPosition)
        const triggeredCurrent = currentTile?.feature === 'current'
        const collectedJewelValue = this.collectJewelAtPosition(this.robotPosition)
        const routePreview = this.buildRoutePreview(this.robotPosition, this.robotDirection)

        return {
            moved: true,
            from,
            to: this.clonePosition(this.robotPosition),
            direction: this.robotDirection,
            alive: true,
            collectedJewel: collectedJewelValue > 0,
            collectedJewelValue,
            triggeredCurrent,
            loopDetected: routePreview.loopDetected,
            blockedPosition: routePreview.blockedPosition,
        }
    }

    isRobotAlive(): boolean {
        return this.robotAlive
    }

    collapseRobot(): void {
        this.robotAlive = false
    }

    peekNextStepSafe(): boolean {
        if (!this.robotAlive) {
            return false
        }

        return this.buildRoutePreview(this.robotPosition, this.robotDirection).safeStepCount > 0
    }

    /**
     * initTileCatalog: boardSize 縺ｫ蝓ｺ縺･縺・tileCatalog 繧堤函謌舌☆繧九・     * - 繧ｿ繧､繝ｫ謨ｰ縺ｯ boardSize*boardSize-1 縺ｨ縺励・..N 縺ｮ ID 繧呈険繧九・     * - 蝗櫁ｻ｢繧・feature 繧偵Λ繝ｳ繝繝縺ｫ險ｭ螳壹☆繧九・     */
    initTileCatalog(profile: DifficultyProfile): void {
        const tileCount = this.boardSize * this.boardSize - GameConfig.BLANK_COUNT
        this.tileCatalog.clear()

        for (let id = 1; id <= tileCount; id += 1) {
            const kind = Random.weightedPick(profile.tileWeights)
            const feature: TileFeature = Math.random() < profile.currentFeatureChance ? 'current' : 'none'
            const branchBias: BranchBias = Math.random() < 0.5 ? 'left' : 'right'

            this.tileCatalog.set(id, {
                id,
                kind,
                rotation: Math.floor(Math.random() * 4),
                feature,
                branchBias,
                traits: [],
            })
        }

        this.ensureRepresentativeSet()
    }

    ensureRepresentativeSet(): void {
        const requiredKinds: PathTileKind[] = ['straight', 'corner', 'cross', 'tee', 'branch']
        const reusableIds = Random.shuffle(Array.from(this.tileCatalog.keys()))

        for (const kind of requiredKinds) {
            const exists = Array.from(this.tileCatalog.values()).some((tile) => tile.kind === kind)

            if (exists) {
                continue
            }

            const tileId = reusableIds.pop()

            if (tileId === undefined) {
                break
            }

            const tile = this.tileCatalog.get(tileId)

            if (tile === undefined) {
                continue
            }

            tile.kind = kind
            tile.rotation = Math.floor(Math.random() * 4)
        }

        const hasCurrentTile = Array.from(this.tileCatalog.values()).some((tile) => tile.feature === 'current')

        if (hasCurrentTile) {
            return
        }

        const fallbackId = Array.from(this.tileCatalog.keys())[0]
        const fallbackTile = this.tileCatalog.get(fallbackId)

        if (fallbackTile !== undefined) {
            fallbackTile.feature = 'current'
        }
    }

    selectDifficulty(progress: number): DifficultyProfile {
        if (progress >= 0.67) {
            return {
                key: 'storm',
                label: 'STORM CHANNEL',
                tileWeights: [
                    { item: 'straight', weight: 14 },
                    { item: 'corner', weight: 24 },
                    { item: 'cross', weight: 18 },
                    { item: 'tee', weight: 24 },
                    { item: 'branch', weight: 20 },
                ],
                currentFeatureChance: 0.22,
                allowStartingLoop: true,
                targetRouteLength: 16,
                initialJewelCount: 14,
                priorityRouteJewelCount: 5,
            }
        }

        if (progress >= 0.34) {
            return {
                key: 'current',
                label: 'CURRENT MAZE',
                tileWeights: [
                    { item: 'straight', weight: 22 },
                    { item: 'corner', weight: 28 },
                    { item: 'cross', weight: 14 },
                    { item: 'tee', weight: 22 },
                    { item: 'branch', weight: 14 },
                ],
                currentFeatureChance: 0.16,
                allowStartingLoop: false,
                targetRouteLength: 14,
                initialJewelCount: 13,
                priorityRouteJewelCount: 4,
            }
        }

        return {
            key: 'calm',
            label: 'CALM REEF',
            tileWeights: [
                { item: 'straight', weight: 32 },
                { item: 'corner', weight: 34 },
                { item: 'cross', weight: 8 },
                { item: 'tee', weight: 16 },
                { item: 'branch', weight: 10 },
            ],
            currentFeatureChance: 0.12,
            allowStartingLoop: false,
            targetRouteLength: 12,
            initialJewelCount: 12,
            priorityRouteJewelCount: 4,
        }
    }

    /**
     * createRandomLayout: 迴ｾ蝨ｨ縺ｮ tileCatalog 繧偵Λ繝ｳ繝繝縺ｫ繧ｷ繝｣繝・ヵ繝ｫ縺励※ tileIds 繧貞・譛溷喧縺吶ｋ縲・     * - 遨ｺ逋ｽ菴咲ｽｮ縺ｯ繝ｩ繝ｳ繝繝縺ｫ豎ｺ螳壹☆繧九・     */
    createRandomLayout(): void {
        const tileIds = Random.shuffle(Array.from(this.tileCatalog.keys()))
        const totalCells = this.boardSize * this.boardSize
        const blankIndexes = Random.shuffle(Array.from({ length: totalCells }, (_, index) => index)).slice(0, GameConfig.BLANK_COUNT)
        const blankIndexSet = new Set(blankIndexes)
        this.tileIds = []
        this.blankPositions = blankIndexes.map((boardIndex) => ({
            row: Math.floor(boardIndex / this.boardSize),
            col: boardIndex % this.boardSize,
        }))
        this.blankPosition = this.clonePosition(this.blankPositions[0])
        let tileIndex = 0

        for (let row = 0; row < this.boardSize; row += 1) {
            const line: number[] = []

            for (let col = 0; col < this.boardSize; col += 1) {
                const boardIndex = row * this.boardSize + col

                if (blankIndexSet.has(boardIndex)) {
                    line.push(0)
                    continue
                }

                line.push(tileIds[tileIndex])
                tileIndex += 1
            }

            this.tileIds.push(line)
        }
    }

    findStartRoute(): RouteCandidate | null {
        const start = { row: 0, col: 0 }
        const startTile = this.getTileAtPosition(start)

        if (startTile === undefined) {
            return null
        }

        let bestCandidate: RouteCandidate | null = null

        for (const direction of this.getConnections(startTile)) {
            const preview = this.buildRoutePreview(start, direction)

            if (preview.safeStepCount === 0) {
                continue
            }

            if (preview.loopDetected && !this.currentDifficulty.allowStartingLoop) {
                continue
            }

            const candidate: RouteCandidate = {
                direction,
                routeLength: preview.safeStepCount,
                loopDetected: preview.loopDetected,
                junctionCount: this.countPreviewJunctions(preview),
            }

            if (bestCandidate === null || this.isBetterCandidate(candidate, bestCandidate)) {
                bestCandidate = candidate
            }
        }

        return bestCandidate
    }

    isBetterCandidate(nextCandidate: RouteCandidate, currentBest: RouteCandidate): boolean {
        const nextScore = nextCandidate.routeLength
            + nextCandidate.junctionCount * 0.45
            + (nextCandidate.loopDetected ? 1.6 : 0)
        const bestScore = currentBest.routeLength
            + currentBest.junctionCount * 0.45
            + (currentBest.loopDetected ? 1.6 : 0)

        return nextScore > bestScore
    }

    applyRouteCandidate(candidate: RouteCandidate): void {
        this.robotPosition = { row: 0, col: 0 }
        this.robotDirection = candidate.direction
        this.robotAlive = true
    }

    /**
     * listMovablePositions: 迴ｾ蝨ｨ繧ｹ繝ｩ繧､繝牙庄閭ｽ縺ｪ菴咲ｽｮ繧偵☆縺ｹ縺ｦ蛻玲嫌縺励※霑斐☆縲・     * - UI 縺ｮ繝励Ξ繝薙Η繝ｼ繧・ワ繧､繝ｩ繧､繝医↓菴ｿ縺・・     */
    listMovablePositions(): Position[] {
        const movablePositions: Position[] = []

        for (let row = 0; row < this.boardSize; row += 1) {
            for (let col = 0; col < this.boardSize; col += 1) {
                const nextPosition = { row, col }

                if (this.canMoveTile(nextPosition)) {
                    movablePositions.push(nextPosition)
                }
            }
        }

        return movablePositions
    }

    /**
     * getSlideDirection: 驕ｸ謚槭＠縺溘・繧ｹ縺ｨ遨ｺ逋ｽ繝槭せ縺ｮ逶ｸ蟇ｾ髢｢菫ゅ°繧峨せ繝ｩ繧､繝画婿蜷代ｒ蛻､螳壹☆繧九・     * - 蜷御ｸ陦後∪縺溘・蜷御ｸ蛻励〒遨ｺ逋ｽ縺ｫ蜷代°縺｣縺ｦ縺・ｌ縺ｰ Direction 繧定ｿ斐☆縲・     * - 遨ｺ逋ｽ縺ｨ蜷御ｽ咲ｽｮ縺ｧ縺ｪ縺・√∪縺溘・譁懊ａ髢｢菫ゅ↑繧・null 繧定ｿ斐☆縲・     */
    getSlideDirection(position: Position): DirectionValue | null {
        const targetBlank = this.findTargetBlank(position)

        if (targetBlank === null) {
            return null
        }

        return this.getSlideDirectionToBlank(position, targetBlank)
    }

    /**
     * getSlidePathPositions: 驕ｸ謚槭・繧ｹ縺九ｉ遨ｺ逋ｽ縺ｾ縺ｧ縺ｮ繝代せ荳翫・蠎ｧ讓咎・蛻励ｒ霑斐☆・育ｩｺ逋ｽ縺ｯ蜷ｫ繧√↑縺・ｼ峨・     * - 霑斐ｊ蛟､縺ｮ鬆・ｺ上・ source -> ... -> 遨ｺ逋ｽ逶ｴ蜑・縺ｧ縲ゞI 縺ｨ BoardManager 縺ｮ蜿梧婿縺悟酔縺倬・ｺ上ｒ蛻ｩ逕ｨ縺吶ｋ縲・     */
    getSlidePathPositions(position: Position): Position[] | null {
        const targetBlank = this.findTargetBlank(position)

        if (targetBlank === null) {
            return null
        }

        return this.getSlidePathPositionsToBlank(position, targetBlank)
    }

    hasMovableTile(): boolean {
        return this.listMovablePositions().length > 0
    }

    captureLayout(candidate: RouteCandidate): LayoutSnapshot {
        return {
            tileIds: this.tileIds.map((row) => [...row]),
            blankPositions: this.blankPositions.map((position) => this.clonePosition(position)),
            candidate: {
                direction: candidate.direction,
                routeLength: candidate.routeLength,
                loopDetected: candidate.loopDetected,
                junctionCount: candidate.junctionCount,
            },
        }
    }

    restoreLayout(layout: LayoutSnapshot): void {
        this.tileIds = layout.tileIds.map((row) => [...row])
        this.blankPositions = layout.blankPositions.map((position) => this.clonePosition(position))
        this.blankPosition = this.clonePosition(this.blankPositions[0])
    }

    resetJewels(): void {
        this.jewelTileIds.clear()
        this.jewelValues.clear()
        this.fillInitialJewels()
    }

    fillInitialJewels(): void {
        this.fillPriorityRouteJewels()

        for (const tileId of Random.shuffle(this.listJewelEligibleTileIds())) {
            if (this.jewelTileIds.size >= this.currentDifficulty.initialJewelCount) {
                return
            }

            this.addJewel(tileId)
        }
    }

    fillPriorityRouteJewels(): void {
        const routeTileIds = this.traceReachableRouteTileIds(2)
        const fallbackRouteTileIds = routeTileIds.length > 0 ? routeTileIds : this.traceReachableRouteTileIds()
        const candidateRouteTileIds = routeTileIds.length > 0 ? routeTileIds : fallbackRouteTileIds
        const routeTarget = Math.min(this.currentDifficulty.priorityRouteJewelCount, candidateRouteTileIds.length)
        let routeJewelCount = 0

        for (const tileId of candidateRouteTileIds) {
            if (this.jewelTileIds.has(tileId)) {
                routeJewelCount += 1
            }
        }

        for (const tileId of candidateRouteTileIds) {
            if (this.jewelTileIds.size >= this.currentDifficulty.initialJewelCount || routeJewelCount >= routeTarget) {
                return
            }

            if (this.jewelTileIds.has(tileId)) {
                continue
            }

            this.addJewel(tileId)
            routeJewelCount += 1
        }
    }

    listJewelEligibleTileIds(): number[] {
        const currentTileId = this.tileIds[this.robotPosition.row][this.robotPosition.col]
        const tileIds: number[] = []

        for (const row of this.tileIds) {
            for (const tileId of row) {
                if (tileId === 0 || tileId === currentTileId || this.jewelTileIds.has(tileId)) {
                    continue
                }

                tileIds.push(tileId)
            }
        }

        return tileIds
    }

    traceReachableRouteTileIds(minDistance: number = 1): number[] {
        const preview = this.buildRoutePreview(this.robotPosition, this.robotDirection)
        return preview.segments
            .filter((segment) => segment.distance >= minDistance)
            .map((segment) => segment.tileId)
    }

    collectJewelAtPosition(position: Position): number {
        const tileId = this.tileIds[position.row][position.col]

        if (!this.jewelTileIds.has(tileId)) {
            return 0
        }

        const value = this.jewelValues.get(tileId) ?? 1
        this.jewelTileIds.delete(tileId)
        this.jewelValues.delete(tileId)
        this.refillCollectedJewel()
        return value
    }

    refillCollectedJewel(): void {
        if (this.jewelTileIds.size >= this.currentDifficulty.initialJewelCount) {
            return
        }

        const preview = this.buildRoutePreview(this.robotPosition, this.robotDirection)
        const routeTileIds = new Set(this.traceReachableRouteTileIds())
        const eligibleTileIds = Random.shuffle(this.listJewelEligibleTileIds())
        const offRouteTileIds = eligibleTileIds.filter((tileId) => !routeTileIds.has(tileId))
        const candidateTileId = offRouteTileIds[0]

        if (candidateTileId !== undefined) {
            this.addJewel(candidateTileId)
            return
        }

        if (!preview.loopDetected) {
            const routeCandidateId = eligibleTileIds.find((tileId) => routeTileIds.has(tileId))

            if (routeCandidateId !== undefined) {
                this.addJewel(routeCandidateId)
                return
            }
        }

        const fallbackTileId = eligibleTileIds[0]

        if (fallbackTileId !== undefined) {
            this.addJewel(fallbackTileId)
        }
    }

    addJewel(tileId: number): void {
        this.jewelTileIds.add(tileId)
        this.jewelValues.set(tileId, this.pickJewelValue())
    }

    pickJewelValue(): number {
        return Random.weightedPick([
            { item: 1, weight: 48 },
            { item: 2, weight: 28 },
            { item: 3, weight: 17 },
            { item: 5, weight: 7 },
        ])
    }

    expireJewels(count: number): Array<{ position: Position, value: number }> {
        const expired: Array<{ position: Position, value: number }> = []
        const currentTileId = this.tileIds[this.robotPosition.row][this.robotPosition.col]
        const candidates = Random.shuffle([...this.jewelTileIds].filter((tileId) => tileId !== currentTileId))

        for (const tileId of candidates.slice(0, count)) {
            const position = this.findTilePosition(tileId)

            if (position === null) {
                continue
            }

            expired.push({
                position,
                value: this.jewelValues.get(tileId) ?? 1,
            })
            this.jewelTileIds.delete(tileId)
            this.jewelValues.delete(tileId)
        }

        while (this.jewelTileIds.size < this.currentDifficulty.initialJewelCount) {
            const beforeSize = this.jewelTileIds.size
            this.refillCollectedJewel()

            if (this.jewelTileIds.size === beforeSize) {
                break
            }
        }

        return expired
    }

    findTilePosition(tileId: number): Position | null {
        for (let row = 0; row < this.tileIds.length; row += 1) {
            for (let col = 0; col < this.tileIds[row].length; col += 1) {
                if (this.tileIds[row][col] === tileId) {
                    return { row, col }
                }
            }
        }

        return null
    }

    simulateStep(position: Position, direction: DirectionValue): StepSimulation {
        const tile = this.getTileAtPosition(position)

        if (tile === undefined) {
            return {
                moved: false,
                to: null,
                direction,
                blockedPosition: null,
            }
        }

        const connections = this.getConnections(tile)

        if (!connections.includes(direction)) {
            return {
                moved: false,
                to: null,
                direction,
                blockedPosition: null,
            }
        }

        const nextPosition = this.getNextPosition(position, direction)

        if (nextPosition === null) {
            return {
                moved: false,
                to: null,
                direction,
                blockedPosition: null,
            }
        }

        const nextTile = this.getTileAtPosition(nextPosition)

        if (nextTile === undefined) {
            return {
                moved: false,
                to: null,
                direction,
                blockedPosition: this.clonePosition(nextPosition),
            }
        }

        const oppositeDirection = this.getOppositeDirection(direction)
        const nextConnections = this.getConnections(nextTile)

        if (!nextConnections.includes(oppositeDirection)) {
            return {
                moved: false,
                to: null,
                direction,
                blockedPosition: this.clonePosition(nextPosition),
            }
        }

        const nextDirection = this.selectOutgoingDirection(direction, oppositeDirection, nextTile, nextConnections)

        if (nextDirection === undefined) {
            return {
                moved: false,
                to: null,
                direction,
                blockedPosition: this.clonePosition(nextPosition),
            }
        }

        return {
            moved: true,
            to: nextPosition,
            direction: nextDirection,
            blockedPosition: null,
        }
    }

    selectOutgoingDirection(
        currentDirection: DirectionValue,
        oppositeDirection: DirectionValue,
        tile: PathTileSnapshot,
        nextConnections: DirectionValue[],
    ): DirectionValue | undefined {
        const candidates = nextConnections.filter((candidateDirection) => candidateDirection !== oppositeDirection)

        if (candidates.length === 0) {
            return undefined
        }

        const straightDirection = candidates.find((candidateDirection) => candidateDirection === currentDirection)

        if (straightDirection !== undefined) {
            return straightDirection
        }

        const rightDirection = this.getRightDirection(currentDirection)
        const leftDirection = this.getLeftDirection(currentDirection)

        if (tile.kind === 'branch') {
            const preferredTurn = tile.branchBias === 'left' ? leftDirection : rightDirection
            const alternateTurn = tile.branchBias === 'left' ? rightDirection : leftDirection

            return candidates.find((candidateDirection) => candidateDirection === preferredTurn)
                ?? candidates.find((candidateDirection) => candidateDirection === alternateTurn)
                ?? candidates[0]
        }

        return candidates.find((candidateDirection) => candidateDirection === rightDirection)
            ?? candidates.find((candidateDirection) => candidateDirection === leftDirection)
            ?? candidates[0]
    }

    buildRoutePreview(position: Position, direction: DirectionValue): RoutePreview {
        const currentTileId = this.tileIds[position.row][position.col]
        const connectedTileIds: number[] = currentTileId === 0 ? [] : [currentTileId]
        const segments = []
        const visited = new Set()
        let currentPosition = this.clonePosition(position)
        let currentDirection = direction
        let blockedPosition: Position | null = null
        let nextPosition: Position | null = null
        let nextDirection: DirectionValue | null = null
        let nextJewelDistance: number | null = null
        let loopDetected = false

        while (segments.length < GameConfig.ROUTE_PREVIEW_LIMIT) {
            const visitKey = `${currentPosition.row}-${currentPosition.col}-${currentDirection}`

            if (visited.has(visitKey)) {
                loopDetected = true
                break
            }

            visited.add(visitKey)
            const simulation = this.simulateStep(currentPosition, currentDirection)

            if (segments.length === 0) {
                nextPosition = simulation.to === null ? null : this.clonePosition(simulation.to)
                nextDirection = simulation.moved ? simulation.direction : null
            }

            if (!simulation.moved || simulation.to === null) {
                blockedPosition = simulation.blockedPosition === null ? null : this.clonePosition(simulation.blockedPosition)
                break
            }

            const nextTile = this.getTileAtPosition(simulation.to)

            if (nextTile === undefined) {
                blockedPosition = this.clonePosition(simulation.to)
                break
            }

            connectedTileIds.push(nextTile.id)
            segments.push({
                tileId: nextTile.id,
                position: this.clonePosition(simulation.to),
                entryDirection: this.getOppositeDirection(currentDirection),
                exitDirection: simulation.direction,
                distance: segments.length + 1,
                feature: nextTile.feature,
            })

            if (nextJewelDistance === null && this.jewelTileIds.has(nextTile.id)) {
                nextJewelDistance = segments[segments.length - 1].distance
            }

            currentPosition = simulation.to
            currentDirection = simulation.direction
        }

        const safeStepCount = segments.length
        const riskLevel = this.getRiskLevel(safeStepCount, loopDetected)
        const dangerTileIds = loopDetected
            ? []
            : connectedTileIds.slice(-Math.min(connectedTileIds.length, safeStepCount <= 1 ? 2 : 3))

        return {
            safeStepCount,
            nextPosition,
            nextDirection,
            nextJewelDistance,
            blockedPosition,
            riskLevel,
            loopDetected,
            connectedTileIds,
            dangerTileIds,
            segments,
        }
    }

    createDeadRoutePreview(): RoutePreview {
        const currentTileId = this.tileIds[this.robotPosition.row][this.robotPosition.col]

        return {
            safeStepCount: 0,
            nextPosition: null,
            nextDirection: null,
            nextJewelDistance: null,
            blockedPosition: null,
            riskLevel: 'critical',
            loopDetected: false,
            connectedTileIds: currentTileId === 0 ? [] : [currentTileId],
            dangerTileIds: currentTileId === 0 ? [] : [currentTileId],
            segments: [],
        }
    }

    countPreviewJunctions(preview: RoutePreview): number {
        let junctionCount = 0

        for (const tileId of preview.connectedTileIds) {
            const tile = this.tileCatalog.get(tileId)

            if (tile === undefined) {
                continue
            }

            if (this.getConnections(tile).length >= 3) {
                junctionCount += 1
            }
        }

        return junctionCount
    }

    getRiskLevel(safeStepCount: number, loopDetected: boolean): RouteRiskLevel {
        if (loopDetected) {
            return 'loop'
        }

        if (safeStepCount <= 0) {
            return 'critical'
        }

        if (safeStepCount <= GameConfig.DANGER_ROUTE_STEPS) {
            return 'danger'
        }

        if (safeStepCount <= GameConfig.WARNING_ROUTE_STEPS) {
            return 'warning'
        }

        return 'safe'
    }

    getConnections(tile: PathTileSnapshot): DirectionValue[] {
        if (tile.kind === 'straight') {
            return tile.rotation % 2 === 0
                ? [Direction.Up, Direction.Down]
                : [Direction.Left, Direction.Right]
        }

        if (tile.kind === 'cross') {
            return [Direction.Up, Direction.Right, Direction.Down, Direction.Left]
        }

        if (tile.kind === 'tee' || tile.kind === 'branch') {
            if (tile.rotation === 0) {
                return [Direction.Up, Direction.Right, Direction.Left]
            }

            if (tile.rotation === 1) {
                return [Direction.Up, Direction.Right, Direction.Down]
            }

            if (tile.rotation === 2) {
                return [Direction.Right, Direction.Down, Direction.Left]
            }

            return [Direction.Up, Direction.Down, Direction.Left]
        }

        if (tile.rotation === 0) {
            return [Direction.Up, Direction.Right]
        }

        if (tile.rotation === 1) {
            return [Direction.Right, Direction.Down]
        }

        if (tile.rotation === 2) {
            return [Direction.Down, Direction.Left]
        }

        return [Direction.Left, Direction.Up]
    }

    getNextPosition(position: Position, direction: DirectionValue): Position | null {
        const delta = this.getDirectionDelta(direction)
        const nextRow = position.row + delta.row
        const nextCol = position.col + delta.col

        if (!this.isInsideBoard({ row: nextRow, col: nextCol })) {
            return null
        }

        return {
            row: nextRow,
            col: nextCol,
        }
    }

    getDirectionDelta(direction: DirectionValue): Position {
        if (direction === Direction.Up) {
            return { row: -1, col: 0 }
        }

        if (direction === Direction.Right) {
            return { row: 0, col: 1 }
        }

        if (direction === Direction.Down) {
            return { row: 1, col: 0 }
        }

        return { row: 0, col: -1 }
    }

    getOppositeDirection(direction: DirectionValue): DirectionValue {
        return (direction + 2) % 4 as DirectionValue
    }

    getRightDirection(direction: DirectionValue): DirectionValue {
        return (direction + 1) % 4 as DirectionValue
    }

    getLeftDirection(direction: DirectionValue): DirectionValue {
        return (direction + 3) % 4 as DirectionValue
    }

    getTileAtPosition(position: Position): PathTileSnapshot | undefined {
        const tileId = this.tileIds[position.row]?.[position.col]

        if (tileId === undefined || tileId === 0) {
            return undefined
        }

        return this.tileCatalog.get(tileId)
    }

    clonePosition(position: Position): Position {
        return {
            row: position.row,
            col: position.col,
        }
    }

    clonePositions(positions: Position[]): Position[] {
        return positions.map((position) => this.clonePosition(position))
    }

    samePosition(left: Position, right: Position): boolean {
        return left.row === right.row && left.col === right.col
    }

    findTargetBlank(position: Position): Position | null {
        let bestBlank: Position | null = null
        let bestDistance = Number.POSITIVE_INFINITY

        for (const blank of this.blankPositions) {
            if (position.row !== blank.row && position.col !== blank.col) {
                continue
            }

            const distance = Math.abs(position.row - blank.row) + Math.abs(position.col - blank.col)

            if (distance === 0 || distance >= bestDistance) {
                continue
            }

            const pathPositions = this.getSlidePathPositionsToBlank(position, blank)

            if (pathPositions === null || pathPositions.length === 0) {
                continue
            }

            bestBlank = blank
            bestDistance = distance
        }

        return bestBlank === null ? null : this.clonePosition(bestBlank)
    }

    getSlideDirectionToBlank(position: Position, blank: Position): DirectionValue | null {
        if (position.row === blank.row) {
            if (position.col < blank.col) {
                return Direction.Right
            }

            if (position.col > blank.col) {
                return Direction.Left
            }
        }

        if (position.col === blank.col) {
            if (position.row < blank.row) {
                return Direction.Down
            }

            if (position.row > blank.row) {
                return Direction.Up
            }
        }

        return null
    }

    getSlidePathPositionsToBlank(position: Position, blank: Position): Position[] | null {
        const direction = this.getSlideDirectionToBlank(position, blank)

        if (direction === null) {
            return null
        }

        const delta = this.getDirectionDelta(direction)
        const positions: Position[] = []
        let cursor = this.clonePosition(position)

        while (!this.samePosition(cursor, blank)) {
            positions.push(this.clonePosition(cursor))
            cursor = {
                row: cursor.row + delta.row,
                col: cursor.col + delta.col,
            }
        }

        return positions
    }

    replaceBlankPosition(previousBlank: Position, newBlank: Position): void {
        const nextBlankPositions = this.blankPositions.map((position) => this.clonePosition(position))
        const blankIndex = nextBlankPositions.findIndex((position) => this.samePosition(position, previousBlank))

        if (blankIndex >= 0) {
            nextBlankPositions[blankIndex] = this.clonePosition(newBlank)
        } else {
            nextBlankPositions.push(this.clonePosition(newBlank))
        }

        this.blankPositions = nextBlankPositions
        this.blankPosition = this.clonePosition(this.blankPositions[0])
    }

    isInsideBoard(position: Position): boolean {
        return position.row >= 0
            && position.row < this.boardSize
            && position.col >= 0
            && position.col < this.boardSize
    }
}
