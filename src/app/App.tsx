import { lazy, Suspense, useState } from 'react'
import StartScreen from './screens/StartScreen/StartScreen'
import ResultScreen from './screens/ResultScreen/ResultScreen'

const GameScreen = lazy(() => import('./screens/GameScreen/GameScreen'))

type Screen = 'start' | 'game' | 'result'

export type GameSettings = {
  playerCount: number
  difficulty?: 'easy' | 'normal' | 'hard'
}

export type PlayerResult = {
  player: number
  score: number
}

export type GameResult = {
  results: PlayerResult[]
}

type RawResultEntry = {
  player?: number
  playerNumber?: number
  score: number
}

type RawGameResult = GameResult | {
  scores?: number[]
  results?: unknown[]
}

function isRawResultEntry(entry: unknown): entry is RawResultEntry {
  if (typeof entry !== 'object' || entry === null) return false
  return typeof (entry as { score?: unknown }).score === 'number'
}

function getResultEntries(result: RawGameResult): RawResultEntry[] | null {
  if (!('results' in result) || !Array.isArray(result.results)) return null
  return (result.results as unknown[]).filter(isRawResultEntry)
}

function getScores(result: RawGameResult): number[] | null {
  if (!('scores' in result) || !Array.isArray(result.scores)) return null
  return result.scores
}

function sortResults(results: PlayerResult[]): PlayerResult[] {
  return [...results].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    return a.player - b.player
  })
}

export default function App() {
  const [screen, setScreen] = useState<Screen>('start')
  const [settings, setSettings] = useState<GameSettings | null>(null)
  const [result, setResult] = useState<GameResult | null>(null)

  const handleStart = (nextSettings: GameSettings) => {
    setSettings(nextSettings)
    setScreen('game')
  }

  const handleFinish = (rawResult: RawGameResult) => {
    const resultEntries = getResultEntries(rawResult)

    if (resultEntries !== null) {
      setResult({
        results: sortResults(resultEntries.map((entry, index) => ({
          player: entry.player ?? entry.playerNumber ?? index + 1,
          score: entry.score,
        }))),
      })
      setScreen('result')
      return
    }

    const scores = getScores(rawResult)

    setResult({
      results: sortResults((scores ?? []).map((score, index) => ({
        player: index + 1,
        score,
      }))),
    })
    setScreen('result')
  }

  const handleBack = () => {
    setSettings(null)
    setResult(null)
    setScreen('start')
  }

  return (
    <>
      {screen === 'start' && (
        <StartScreen onStart={handleStart} />
      )}

      {screen === 'game' && settings && (
        <Suspense fallback={<div>Loading game...</div>}>
          <GameScreen settings={settings} onFinish={handleFinish} />
        </Suspense>
      )}

      {screen === 'result' && result && (
        <ResultScreen
          result={result}
          onBack={handleBack}
        />
      )}
    </>
  )
}
