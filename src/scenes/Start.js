const SYMBOLS = ['○', '△', '□', '☆', '◇', '♡', '♣', '♠', '＋', '×', '☀', '♪']

const CELL_SIZE = 62
const GRID_SIZE = 6

const LEFT_START_X = 40
const RIGHT_START_X = 660
const START_Y = 130

const randomInt = (max) => Math.floor(Math.random() * max)

const createBaseGrid = () => {
    const grid = []

    for (let row = 0; row < GRID_SIZE; row++) {
        const line = []

        for (let col = 0; col < GRID_SIZE; col++) {
            line.push(SYMBOLS[randomInt(SYMBOLS.length)])
        }

        grid.push(line)
    }

    return grid
}

const rotateGrid90 = (grid) => {
    const rotated = []

    for (let row = 0; row < GRID_SIZE; row++) {
        const line = []

        for (let col = 0; col < GRID_SIZE; col++) {
            line.push(grid[GRID_SIZE - 1 - col][row])
        }

        rotated.push(line)
    }

    return rotated
}

const rotateGrid180 = (grid) => rotateGrid90(rotateGrid90(grid))
const rotateGrid270 = (grid) => rotateGrid90(rotateGrid180(grid))

const flipGridVertical = (grid) => {
    const flipped = []

    for (let row = 0; row < GRID_SIZE; row++) {
        const line = []

        for (let col = 0; col < GRID_SIZE; col++) {
            line.push(grid[GRID_SIZE - 1 - row][col])
        }

        flipped.push(line)
    }

    return flipped
}

const flipGridHorizontal = (grid) => {
    const flipped = []

    for (let row = 0; row < GRID_SIZE; row++) {
        const line = []

        for (let col = 0; col < GRID_SIZE; col++) {
            line.push(grid[row][GRID_SIZE - 1 - col])
        }

        flipped.push(line)
    }

    return flipped
}

const transformGrid = (grid, pattern) => {
    if (pattern === '90°回転') {
        return rotateGrid90(grid)
    }

    if (pattern === '180°回転') {
        return rotateGrid180(grid)
    }

    if (pattern === '270°回転') {
        return rotateGrid270(grid)
    }

    if (pattern === '上下反転') {
        return flipGridVertical(grid)
    }

    return flipGridHorizontal(grid)
}

const cloneGrid = (grid) => grid.map((row) => [...row])

const createPuzzle = () => {
    const leftGrid = createBaseGrid()
    const patterns = ['90°回転', '180°回転', '270°回転', '上下反転', '左右反転']
    const pattern = patterns[randomInt(patterns.length)]

    const rightGrid = cloneGrid(transformGrid(leftGrid, pattern))

    const wrongCount = randomInt(7) + 4
    const wrongPositions = []
    const used = new Set()

    while (wrongPositions.length < wrongCount) {
        const row = randomInt(GRID_SIZE)
        const col = randomInt(GRID_SIZE)
        const key = `${row}-${col}`

        if (used.has(key)) {
            continue
        }

        used.add(key)
        wrongPositions.push({ row, col })

        const current = rightGrid[row][col]
        const candidates = SYMBOLS.filter((symbol) => symbol !== current)
        rightGrid[row][col] = candidates[randomInt(candidates.length)]
    }

    return {
        leftGrid,
        rightGrid,
        pattern,
        wrongPositions,
    }
}

class Start extends Phaser.Scene {
    constructor() {
        super('Start')

        this.puzzle = null
        this.selectedKeys = []
        this.answerChecked = false
        this.statusText = null
        this.resultText = null
        this.selectionMarks = {}
    }

    preload() {
    }

    create() {
        this.cameras.main.setBackgroundColor('#ffffff')

        this.puzzle = createPuzzle()
        this.selectedKeys = []
        this.answerChecked = false
        this.selectionMarks = {}

        this.add.text(40, 24, '左', {
            fontSize: '28px',
            color: '#000000',
        })

        this.add.text(660, 24, '右', {
            fontSize: '28px',
            color: '#000000',
        })

        this.add.text(660, 64, `変換: ${this.puzzle.pattern}`, {
            fontSize: '20px',
            color: '#000000',
        })

        this.statusText = this.add.text(40, 64, '', {
            fontSize: '20px',
            color: '#000000',
        })

        this.resultText = this.add.text(1120, 90, '', {
            fontSize: '34px',
            color: '#008000',
        }).setOrigin(0.5)

        this.drawGrid(this.puzzle.leftGrid, LEFT_START_X, START_Y, false)
        this.drawGrid(this.puzzle.rightGrid, RIGHT_START_X, START_Y, true)

        this.updateStatus()

        const answerButton = this.add.text(1120, 24, '回答', {
            fontSize: '22px',
            color: '#0000ff',
            backgroundColor: '#eeeeee',
            padding: { left: 10, right: 10, top: 6, bottom: 6 },
        })

        answerButton.setInteractive({ useHandCursor: true })
        answerButton.on('pointerdown', () => {
            this.checkAnswer()
        })
    }

    drawGrid(grid, startX, startY, interactive) {
        for (let row = 0; row < GRID_SIZE; row++) {
            for (let col = 0; col < GRID_SIZE; col++) {
                const x = startX + (col * CELL_SIZE)
                const y = startY + (row * CELL_SIZE)

                const rect = this.add.rectangle(x, y, 56, 56)
                rect.setOrigin(0)
                rect.setStrokeStyle(2, 0x000000)
                rect.setFillStyle(0xffffff)

                const text = this.add.text(x + 28, y + 28, grid[row][col], {
                    fontSize: '30px',
                    color: '#000000',
                })

                text.setOrigin(0.5)

                if (interactive) {
                    rect.setInteractive({ useHandCursor: true })

                    rect.on('pointerdown', () => {
                        this.toggleSelection(row, col, x, y)
                    })
                }
            }
        }
    }

    toggleSelection(row, col, x, y) {
        if (this.answerChecked) {
            return
        }

        const key = `${row}-${col}`

        if (this.selectedKeys.includes(key)) {
            this.selectedKeys = this.selectedKeys.filter((selectedKey) => selectedKey !== key)

            if (this.selectionMarks[key]) {
                this.selectionMarks[key].destroy()
                delete this.selectionMarks[key]
            }

            this.updateStatus()
            return
        }

        this.selectedKeys.push(key)

        const mark = this.add.circle(x + 28, y + 28, 24)
        mark.setStrokeStyle(4, 0x0000ff)
        this.selectionMarks[key] = mark

        this.updateStatus()
    }

    checkAnswer() {
        if (this.answerChecked) {
            return
        }

        this.answerChecked = true

        const correctKeys = this.puzzle.wrongPositions.map((position) => `${position.row}-${position.col}`)
        const correctKeySet = new Set(correctKeys)
        const selectedKeySet = new Set(this.selectedKeys)

        let score = 0

        this.selectedKeys.forEach((key) => {
            if (correctKeySet.has(key)) {
                score += 2
            } else {
                score -= 1
            }
        })

        correctKeys.forEach((key) => {
            if (!selectedKeySet.has(key)) {
                score -= 2
            }
        })

        this.resultText.setColor('#000000')
        this.resultText.setText(`得点: ${score}`)

        this.puzzle.wrongPositions.forEach((position) => {
            const key = `${position.row}-${position.col}`

            if (this.selectionMarks[key]) {
                this.selectionMarks[key].setStrokeStyle(4, 0x008000)
                return
            }

            const x = RIGHT_START_X + (position.col * CELL_SIZE)
            const y = START_Y + (position.row * CELL_SIZE)

            const mark = this.add.circle(x + 28, y + 28, 24)
            mark.setStrokeStyle(4, 0xff0000)
        })

        this.selectedKeys.forEach((key) => {
            if (correctKeySet.has(key)) {
                return
            }

            if (this.selectionMarks[key]) {
                this.selectionMarks[key].setStrokeStyle(4, 0xff0000)
            }
        })
    }

    updateStatus() {
        this.statusText.setText(`選択数: ${this.selectedKeys.length}`)
    }
}

const config = {
    type: Phaser.AUTO,
    width: 1280,
    height: 720,
    scene: [Start],
}

new Phaser.Game(config)