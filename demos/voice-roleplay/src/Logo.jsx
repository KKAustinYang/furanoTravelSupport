let uid = 0
// 汎用ロゴ：音声の波形（AI 応対トレーニング）
export default function Logo() {
  const id = `lg-${uid++}`
  const bars = [8, 14, 22, 12, 18, 9]
  return (
    <svg viewBox="0 0 60 30" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#2f9bd8" />
          <stop offset="1" stopColor="#0F8C7E" />
        </linearGradient>
      </defs>
      {bars.map((h, i) => <rect key={i} x={11 + i * 6.6} y={15 - h / 2} width="3.8" height={h} rx="1.9" fill={`url(#${id})`} />)}
    </svg>
  )
}
