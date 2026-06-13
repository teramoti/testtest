import clickSound from '../../../assets/bkue_ghost/audio/click.mp3'

export function playClickSound() {
  const audio = new Audio(clickSound)
  audio.loop = false
  void audio.play().catch(() => {
    // 効果音を再生できない環境では操作を妨げない。
  })
}
