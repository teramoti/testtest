import { useEffect, useMemo, useRef, useState } from 'react'
import './ResultScreen.css'
import type { GameResult } from '../../App'
import resultBgm from '../../../../assets/bkue_ghost/audio/result.mp3'
import { playClickSound } from '../../audio/playClickSound'
import resultBackground from '../../../../assets/Image/result/background.png'

type Props = {
  result: GameResult
  onBack: () => void
}

function compareResult(a: GameResult['results'][number], b: GameResult['results'][number]) {
  if (b.score !== a.score) return b.score - a.score
  if ((a.missCount ?? 0) !== (b.missCount ?? 0)) {
    return (a.missCount ?? 0) - (b.missCount ?? 0)
  }
  if ((b.travelCount ?? 0) !== (a.travelCount ?? 0)) {
    return (b.travelCount ?? 0) - (a.travelCount ?? 0)
  }
  return a.player - b.player
}

function isSameRank(a: GameResult['results'][number], b: GameResult['results'][number]) {
  return a.score === b.score
    && (a.missCount ?? 0) === (b.missCount ?? 0)
    && (a.travelCount ?? 0) === (b.travelCount ?? 0)
}

export default function ResultScreen({ result, onBack }: Props) {
  const [isRankingAnimationStarted, setIsRankingAnimationStarted] = useState(false)
  const [isConfettiVisible, setIsConfettiVisible] = useState(false)
  const [isBackButtonVisible, setIsBackButtonVisible] = useState(false)
  const rankingTimerRef = useRef<number | null>(null)
  const confettiTimerRef = useRef<number | null>(null)
  const backButtonTimerRef = useRef<number | null>(null)
  const resultBgmRef = useRef<HTMLAudioElement | null>(null)
  const rankedResults = useMemo(
    () => [...result.results].sort(compareResult),
    [result.results]
  )
  const displayedRanks = useMemo(() => {
    return rankedResults.map((entry) =>
      rankedResults.findIndex((candidate) => isSameRank(candidate, entry)) + 1
    )
  }, [rankedResults])
  const topScore = rankedResults[0]?.score ?? 0
  const bestScore = useMemo(() => {
    const currentBest = Number(window.localStorage.getItem('robotSlideBestScore') ?? 0)
    const nextBest = Math.max(currentBest, topScore)
    window.localStorage.setItem('robotSlideBestScore', String(nextBest))
    return nextBest
  }, [topScore])

  useEffect(() => {
    const audio = new Audio(resultBgm)
    audio.loop = true
    resultBgmRef.current = audio

    const playBgm = () => {
      void audio.play().catch(() => {
        // ブラウザの自動再生制限時は、次のユーザー操作で再試行します。
      })
    }

    playBgm()
    window.addEventListener('pointerdown', playBgm, { once: true })
    window.addEventListener('keydown', playBgm, { once: true })

    return () => {
      window.removeEventListener('pointerdown', playBgm)
      window.removeEventListener('keydown', playBgm)
      audio.pause()
      audio.currentTime = 0
      resultBgmRef.current = null
    }
  }, [])

  useEffect(() => {
    rankingTimerRef.current = window.setTimeout(() => {
      setIsRankingAnimationStarted(true)
      rankingTimerRef.current = null
    }, 350)

    const revealDelay = 350 + (rankedResults.length * 450) + 700

    confettiTimerRef.current = window.setTimeout(() => {
      setIsConfettiVisible(true)
      confettiTimerRef.current = null
    }, revealDelay)

    backButtonTimerRef.current = window.setTimeout(() => {
      setIsBackButtonVisible(true)
      backButtonTimerRef.current = null
    }, revealDelay)

    return () => {
      if (rankingTimerRef.current !== null) {
        window.clearTimeout(rankingTimerRef.current)
        rankingTimerRef.current = null
      }
      if (confettiTimerRef.current !== null) {
        window.clearTimeout(confettiTimerRef.current)
        confettiTimerRef.current = null
      }
      if (backButtonTimerRef.current !== null) {
        window.clearTimeout(backButtonTimerRef.current)
        backButtonTimerRef.current = null
      }
    }
  }, [rankedResults.length])

  const handleBack = () => {
    playClickSound()

    const resultsByPlayer = [...result.results].sort((a, b) => a.player - b.player)
    const rank = resultsByPlayer.map((entry) =>
      displayedRanks[rankedResults.findIndex((candidate) => candidate.player === entry.player)]
    )

    window.parent.postMessage(
      {
        type: 'GameClear',
        rank,
      },
      '*'
    )

    onBack()
  }

  return (
    <div className="resultBackColor rankingBackground" style={{ backgroundImage: `url(${resultBackground})` }}>
      <div className="resultScreen rankingScreen">
        {isConfettiVisible && (
          <div className="confettiLayer" aria-hidden="true">
            {Array.from({ length: 48 }, (_, index) => (
              <span
                className={`confettiPiece confettiColor${index % 6}`}
                key={index}
                style={{
                  left: `${(index * 73 + 11) % 100}%`,
                  width: `${7 + ((index * 17) % 8)}px`,
                  height: `${12 + ((index * 29) % 14)}px`,
                  animationDelay: `${(index * 137) % 1800}ms`,
                  animationDuration: `${2600 + ((index * 211) % 2200)}ms`,
                  '--confetti-drift': `${-120 + ((index * 47) % 240)}px`,
                  '--confetti-rotation': `${540 + ((index * 89) % 900)}deg`,
                } as React.CSSProperties}
              />
            ))}
          </div>
        )}

        <header className="resultHeader rankingHeader">
          <p className="resultKicker">TIME UP</p>
          <h1 className="rankTitle">
            Result
          </h1>
          <p className="resultSubTitle">
            Best Score <strong>{bestScore}</strong>
          </p>
        </header>

        <section className="rankingArea">
          <ul className="rankList">
            {rankedResults.map((entry, index) => {
              const isFirstPlace = displayedRanks[index] === 1

              return (
                <li
                  className={`rankItem rankItemWaiting ${isFirstPlace ? 'rankItemFirst' : ''} ${isRankingAnimationStarted ? 'animatedRankItem' : ''}`}
                  key={entry.player}
                  style={{ animationDelay: `${index * 450}ms` }}
                >
                  <div className="rankLeft">
                    <span className="rankNo">
                      {displayedRanks[index]}
                    </span>
                    <span
                      className={`rankDecoration ${isFirstPlace ? 'rankStar' : 'rankTriangle'}`}
                      aria-hidden="true"
                    >
                      {isFirstPlace ? <>&#9733;</> : <>&#9650;</>}
                    </span>
                  </div>

                  <div className="rankCenter">
                    <span className="rankPlayer">
                      Player {entry.player}
                    </span>
                  </div>

                  <div className="rankRight">
                    <span className="rankScore">
                      SCORE : {entry.score}
                    </span>
                  </div>
                </li>
              )
            })}
          </ul>
        </section>

        <footer className="resultFooter">
          <button
            className={`backButton rankingBackButton ${isBackButtonVisible ? 'rankingBackButtonVisible' : ''}`}
            hidden={!isBackButtonVisible}
            type="button"
            onClick={handleBack}
          >
            Title
          </button>
        </footer>
      </div>
    </div>
  )
}
