import type { BoardSnapshot } from '../models/BoardSnapshot.js'
import { Direction, type Direction as DirectionValue } from '../models/Direction.js'
import type { MoveResult, TileSlideMove } from '../models/MoveResult.js'
import type { BranchBias, PathTileKind, PathTileSnapshot, TileFeature } from '../models/PathTileSnapshot.js'
import type { Position } from '../models/Position.js'
import type { RoutePreview, RouteRiskLevel } from '../models/RoutePreview.js'
import type { TurtleStepResult } from '../models/TurtleStepResult.js'
import { GameConfig } from '../utils/GameConfig.js'
import { Random } from '../utils/Random.js'

interface RouteCandidate {
    direction: DirectionValue
    routeLength: number
    loopDetected: boolean
    junctionCount: number
}

interface LayoutSnapshot {
    tileIds: number[][]
    blankPosition: Position
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
    turtlePosition: Position
    turtleDirection: DirectionValue
    turtleAlive: boolean
    jewelTileIds: Set<number>
    currentDifficulty: DifficultyProfile

    constructor(boardSize: number = GameConfig.BOARD_SIZE) {
        this.boardSize = boardSize
        this.tileIds = []
        this.tileCatalog = new Map<number, PathTileSnapshot>()
        this.blankPosition = { row: 0, col: 0 }
        this.turtlePosition = { row: 0, col: 0 }
        this.turtleDirection = Direction.Right
        this.turtleAlive = true
        this.jewelTileIds = new Set<number>()
        this.currentDifficulty = this.selectDifficulty(0)
        this.resetBoard()
    }

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
        this.turtlePosition = { row: 0, col: 0 }
        this.turtleDirection = Direction.Right
        this.turtleAlive = true
        this.resetJewels()
    }

    getSnapshot(): BoardSnapshot {
        const routePreview = this.turtleAlive
            ? this.buildRoutePreview(this.turtlePosition, this.turtleDirection)
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
            blankPosition: this.clonePosition(this.blankPosition),
            movablePositions: this.listMovablePositions(),
            turtlePosition: this.clonePosition(this.turtlePosition),
            turtleDirection: this.turtleDirection,
            turtleAlive: this.turtleAlive,
            jewelTileIds: [...this.jewelTileIds],
            nextStepSafe: routePreview.safeStepCount > 0,
            routePreview,
            difficultyLabel: this.currentDifficulty.label,
        }
    }

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

    moveTile(position: Position): MoveResult {
        if (!this.canMoveTile(position)) {
            return {
                moved: false,
                tileId: 0,
                from: null,
                to: null,
                carriedTurtle: false,
                movedTiles: [],
            }
        }

        const from = this.clonePosition(position)
        const tileId = this.tileIds[from.row][from.col]
        const slideDirection = this.getSlideDirection(position)
        const pathPositions = this.getSlidePathPositions(position)

        if (slideDirection === null || pathPositions === null || pathPositions.length === 0) {
            return {
                moved: false,
                tileId: 0,
                from: null,
                to: null,
                carriedTurtle: false,
                movedTiles: [],
            }
        }

        const step = this.getDirectionDelta(slideDirection)
        const movedTiles = pathPositions.map((sourcePosition) => {
            const destinationPosition = {
                row: sourcePosition.row + step.row,
                col: sourcePosition.col + step.col,
            }

            return {
                tileId: this.tileIds[sourcePosition.row][sourcePosition.col],
                from: this.clonePosition(sourcePosition),
                to: destinationPosition,
                carriedTurtle: sourcePosition.row === this.turtlePosition.row
                    && sourcePosition.col === this.turtlePosition.col,
            }
        })
        const nextTileIds = this.tileIds.map((row) => [...row])
        let carriedTurtle = false

        for (const sourcePosition of [...pathPositions].reverse()) {
            const destinationPosition = {
                row: sourcePosition.row + step.row,
                col: sourcePosition.col + step.col,
            }
            const movedTileId = this.tileIds[sourcePosition.row][sourcePosition.col]

            nextTileIds[destinationPosition.row][destinationPosition.col] = movedTileId
            nextTileIds[sourcePosition.row][sourcePosition.col] = 0

            if (sourcePosition.row === this.turtlePosition.row && sourcePosition.col === this.turtlePosition.col) {
                this.turtlePosition = this.clonePosition(destinationPosition)
                carriedTurtle = true
            }
        }

        nextTileIds[from.row][from.col] = 0
        this.tileIds = nextTileIds
        this.blankPosition = from

        return {
            moved: true,
            tileId,
            from,
            to: this.clonePosition({
                row: from.row + step.row,
                col: from.col + step.col,
            }),
            carriedTurtle,
            movedTiles,
        }
    }

    stepTurtle(): TurtleStepResult {
        const from = this.clonePosition(this.turtlePosition)

        if (!this.turtleAlive) {
            return {
                moved: false,
                from,
                to: null,
                direction: this.turtleDirection,
                alive: false,
                collectedJewel: false,
                triggeredCurrent: false,
                loopDetected: false,
                blockedPosition: null,
            }
        }

        const simulation = this.simulateStep(this.turtlePosition, this.turtleDirection)

        if (!simulation.moved || simulation.to === null) {
            return {
                moved: false,
                from,
                to: null,
                direction: this.turtleDirection,
                alive: true,
                collectedJewel: false,
                triggeredCurrent: false,
                loopDetected: false,
                blockedPosition: simulation.blockedPosition,
            }
        }

        this.turtlePosition = simulation.to
        this.turtleDirection = simulation.direction
        const currentTile = this.getTileAtPosition(this.turtlePosition)
        const triggeredCurrent = currentTile?.feature === 'current'
        const collectedJewel = this.collectJewelAtPosition(this.turtlePosition)
        const routePreview = this.buildRoutePreview(this.turtlePosition, this.turtleDirection)

        return {
            moved: true,
            from,
            to: this.clonePosition(this.turtlePosition),
            direction: this.turtleDirection,
            alive: true,
            collectedJewel,
            triggeredCurrent,
            loopDetected: routePreview.loopDetected,
            blockedPosition: routePreview.blockedPosition,
        }
    }

    isTurtleAlive(): boolean {
        return this.turtleAlive
    }

    collapseTurtle(): void {
        this.turtleAlive = false
    }

    peekNextStepSafe(): boolean {
        if (!this.turtleAlive) {
            return false
        }

        return this.buildRoutePreview(this.turtlePosition, this.turtleDirection).safeStepCount > 0
    }

    initTileCatalog(profile: DifficultyProfile): void {
        const tileCount = this.boardSize * this.boardSize - 1
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
                targetRouteLength: 14,
                initialJewelCount: 10,
                priorityRouteJewelCount: 4,
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
                targetRouteLength: 12,
                initialJewelCount: 9,
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
            targetRouteLength: 10,
            initialJewelCount: 8,
            priorityRouteJewelCount: 3,
        }
    }

    createRandomLayout(): void {
        const tileCount = this.boardSize * this.boardSize - 1
        const tileIds = Random.shuffle(Array.from(this.tileCatalog.keys()))
        const blankIndex = Math.floor(Math.random() * tileCount) + 1
        this.tileIds = []
        let tileIndex = 0

        for (let row = 0; row < this.boardSize; row += 1) {
            const line: number[] = []

            for (let col = 0; col < this.boardSize; col += 1) {
                const boardIndex = row * this.boardSize + col

                if (boardIndex === blankIndex) {
                    line.push(0)
                    this.blankPosition = { row, col }
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
        this.turtlePosition = { row: 0, col: 0 }
        this.turtleDirection = candidate.direction
        this.turtleAlive = true
    }

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

    getSlideDirection(position: Position): DirectionValue | null {
        if (position.row === this.blankPosition.row) {
            if (position.col < this.blankPosition.col) {
                return Direction.Right
            }

            if (position.col > this.blankPosition.col) {
                return Direction.Left
            }
        }

        if (position.col === this.blankPosition.col) {
            if (position.row < this.blankPosition.row) {
                return Direction.Down
            }

            if (position.row > this.blankPosition.row) {
                return Direction.Up
            }
        }

        return null
    }

    getSlidePathPositions(position: Position): Position[] | null {
        const direction = this.getSlideDirection(position)

        if (direction === null) {
            return null
        }

        const delta = this.getDirectionDelta(direction)
        const positions: Position[] = []
        let cursor = this.clonePosition(position)

        while (cursor.row !== this.blankPosition.row || cursor.col !== this.blankPosition.col) {
            positions.push(this.clonePosition(cursor))
            cursor = {
                row: cursor.row + delta.row,
                col: cursor.col + delta.col,
            }
        }

        return positions
    }

    hasMovableTile(): boolean {
        return this.listMovablePositions().length > 0
    }

    captureLayout(candidate: RouteCandidate): LayoutSnapshot {
        return {
            tileIds: this.tileIds.map((row) => [...row]),
            blankPosition: this.clonePosition(this.blankPosition),
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
        this.blankPosition = this.clonePosition(layout.blankPosition)
    }

    resetJewels(): void {
        this.jewelTileIds.clear()
        this.fillInitialJewels()
    }

    fillInitialJewels(): void {
        this.fillPriorityRouteJewels()

        for (const tileId of Random.shuffle(this.listJewelEligibleTileIds())) {
            if (this.jewelTileIds.size >= this.currentDifficulty.initialJewelCount) {
                return
            }

            this.jewelTileIds.add(tileId)
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

            this.jewelTileIds.add(tileId)
            routeJewelCount += 1
        }
    }

    listJewelEligibleTileIds(): number[] {
        const currentTileId = this.tileIds[this.turtlePosition.row][this.turtlePosition.col]
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
        const preview = this.buildRoutePreview(this.turtlePosition, this.turtleDirection)
        return preview.segments
            .filter((segment) => segment.distance >= minDistance)
            .map((segment) => segment.tileId)
    }

    collectJewelAtPosition(position: Position): boolean {
        const tileId = this.tileIds[position.row][position.col]

        if (!this.jewelTileIds.has(tileId)) {
            return false
        }

        this.jewelTileIds.delete(tileId)
        this.refillCollectedJewel()
        return true
    }

    refillCollectedJewel(): void {
        if (this.jewelTileIds.size >= this.currentDifficulty.initialJewelCount) {
            return
        }

        const preview = this.buildRoutePreview(this.turtlePosition, this.turtleDirection)
        const routeTileIds = new Set(this.traceReachableRouteTileIds())
        const eligibleTileIds = Random.shuffle(this.listJewelEligibleTileIds())
        const offRouteTileIds = eligibleTileIds.filter((tileId) => !routeTileIds.has(tileId))
        const candidateTileId = offRouteTileIds[0]

        if (candidateTileId !== undefined) {
            this.jewelTileIds.add(candidateTileId)
            return
        }

        if (!preview.loopDetected) {
            const routeCandidateId = eligibleTileIds.find((tileId) => routeTileIds.has(tileId))

            if (routeCandidateId !== undefined) {
                this.jewelTileIds.add(routeCandidateId)
                return
            }
        }

        const fallbackTileId = eligibleTileIds[0]

        if (fallbackTileId !== undefined) {
            this.jewelTileIds.add(fallbackTileId)
        }
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
        const visited = new Set<string>()
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
        const currentTileId = this.tileIds[this.turtlePosition.row][this.turtlePosition.col]

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

    isInsideBoard(position: Position): boolean {
        return position.row >= 0
            && position.row < this.boardSize
            && position.col >= 0
            && position.col < this.boardSize
    }
}
