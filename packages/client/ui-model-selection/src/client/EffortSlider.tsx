import { useEffect, useRef, useState } from 'react'
import css from './ModelSelect.module.css'

/** A native discrete range: pointer drags preview locally and commit on release. */
export function EffortSlider({ labels, value, disabled, pending: selecting = false, label, onSelect }: {
  labels: readonly string[]
  value: number
  disabled: boolean
  pending?: boolean
  label: string
  onSelect: (index: number) => void
}) {
  const blocked = disabled || selecting
  const [preview, setPreview] = useState<number | null>(null)
  const dragging = useRef(false)
  const pending = useRef<number | null>(null)
  const reset = (): void => {
    dragging.current = false
    pending.current = null
    setPreview(null)
  }
  useEffect(() => { reset() }, [value, blocked])
  const commit = (): void => {
    const next = pending.current
    reset()
    if (!blocked && next !== null && next !== value) onSelect(next)
  }
  return (
    <input
      className={css.effortSlider}
      type="range"
      min={0}
      max={labels.length - 1}
      step={1}
      value={preview ?? value}
      disabled={disabled}
      aria-disabled={blocked || undefined}
      aria-label={label}
      aria-valuetext={labels[preview ?? value]}
      title={labels[preview ?? value]}
      onPointerDown={(event) => {
        if (blocked) return
        dragging.current = true
        event.currentTarget.setPointerCapture(event.pointerId)
      }}
      onChange={(event) => {
        const next = Number(event.currentTarget.value)
        if (blocked) return
        if (!dragging.current) {
          onSelect(next)
          return
        }
        pending.current = next
        setPreview(next)
      }}
      onPointerUp={commit}
      onPointerCancel={reset}
      onBlur={commit}
      onKeyDown={(event) => { event.stopPropagation() }}
    />
  )
}
