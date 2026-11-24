import React, { useEffect, useState } from 'react'

interface AnimatedCounterProps {
  value: number
  durationMs?: number
  prefix?: string
  suffix?: string
  formatFn?: (val: number) => string
}

export const AnimatedCounter: React.FC<AnimatedCounterProps> = ({
  value,
  durationMs = 900,
  prefix = '',
  suffix = '',
  formatFn,
}) => {
  const [displayValue, setDisplayValue] = useState(0)

  useEffect(() => {
    if (durationMs <= 0 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setDisplayValue(value)
      return
    }
    let startTimestamp: number | null = null
    const startVal = displayValue
    const endVal = value
    const change = endVal - startVal

    if (change === 0) return

    let animationFrameId: number

    const step = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp
      const progress = Math.min((timestamp - startTimestamp) / durationMs, 1)
      // Ease out cubic
      const easedProgress = 1 - Math.pow(1 - progress, 3)
      const current = Math.round(startVal + change * easedProgress)
      setDisplayValue(current)

      if (progress < 1) {
        animationFrameId = requestAnimationFrame(step)
      }
    }

    animationFrameId = requestAnimationFrame(step)
    return () => cancelAnimationFrame(animationFrameId)
  }, [value, durationMs])

  const formatted = formatFn ? formatFn(displayValue) : displayValue.toLocaleString('en-IN')

  return (
    <span className="animated-counter tabular-nums">
      {prefix}
      {formatted}
      {suffix}
    </span>
  )
}

export default AnimatedCounter
