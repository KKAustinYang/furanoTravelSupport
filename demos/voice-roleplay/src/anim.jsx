import { useState, useEffect, useRef } from 'react'

// なめらかな減速イージング（プロっぽい "ススッ" と止まる感じ）
const easeOutCubic = t => 1 - Math.pow(1 - t, 3)

// 数字をカウントアップ表示するコンポーネント
export function CountUp({ end, decimals = 0, duration = 1200, delay = 0, prefix = '', suffix = '' }) {
  const [val, setVal] = useState(0)
  const raf = useRef(0)
  useEffect(() => {
    let start = null
    const timer = setTimeout(() => {
      const step = ts => {
        if (start === null) start = ts
        const p = Math.min((ts - start) / duration, 1)
        setVal(end * easeOutCubic(p))
        if (p < 1) raf.current = requestAnimationFrame(step)
        else setVal(end)
      }
      raf.current = requestAnimationFrame(step)
    }, delay)
    return () => { clearTimeout(timer); cancelAnimationFrame(raf.current) }
  }, [end, duration, delay])
  return <>{prefix}{val.toFixed(decimals)}{suffix}</>
}
