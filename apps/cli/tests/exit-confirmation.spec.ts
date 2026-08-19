import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  createExitConfirmation,
  EXIT_CONFIRMATION_TIMEOUT_MS,
} from '../src/exit-confirmation.ts'

function makeGate(timeoutMs?: number) {
  const write = vi.fn()
  const isInteractive = vi.fn(() => true)
  return {
    gate: createExitConfirmation({
      write,
      isInteractive,
      ...(timeoutMs === undefined ? {} : { timeoutMs }),
    }),
    write,
  }
}

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('exit confirmation', () => {
  it('arms a window on the first interactive SIGINT without proceeding', () => {
    const { gate, write } = makeGate()
    expect(gate.onInterrupt()).toBe(false)
    expect(write).toHaveBeenCalledOnce()
  })

  it('proceeds on the second SIGINT inside the window', () => {
    const { gate } = makeGate()
    gate.onInterrupt()
    expect(gate.onInterrupt()).toBe(true)
  })

  it('cancels and returns to idle when the window expires', () => {
    vi.useFakeTimers()
    const { gate, write } = makeGate()
    gate.onInterrupt()
    expect(write).toHaveBeenCalledTimes(1)

    vi.advanceTimersByTime(EXIT_CONFIRMATION_TIMEOUT_MS)
    expect(write).toHaveBeenCalledTimes(2)

    // A fresh first press after expiry re-arms rather than proceeding.
    expect(gate.onInterrupt()).toBe(false)
    expect(write).toHaveBeenCalledTimes(3)
  })

  it('honors a caller-supplied window length', () => {
    vi.useFakeTimers()
    const { gate, write } = makeGate(25)
    gate.onInterrupt()

    vi.advanceTimersByTime(24)
    expect(write).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(1)
    expect(write).toHaveBeenCalledTimes(2)
  })

  it('proceeds immediately when the process is not interactive', () => {
    const write = vi.fn()
    const gate = createExitConfirmation({ write, isInteractive: () => false })
    expect(gate.onInterrupt()).toBe(true)
    expect(write).not.toHaveBeenCalled()
  })

  it('forces later interrupts after shutdown has been handed off', () => {
    const { gate } = makeGate()
    gate.onInterrupt()
    expect(gate.onInterrupt()).toBe(true)

    // Once consumed, every further SIGINT proceeds without re-arming.
    expect(gate.onInterrupt()).toBe(true)
  })

  it('disarms a pending window without writing a cancel notice', () => {
    vi.useFakeTimers()
    const { gate, write } = makeGate()
    gate.onInterrupt()

    gate.dispose()
    vi.advanceTimersByTime(EXIT_CONFIRMATION_TIMEOUT_MS)
    expect(write).toHaveBeenCalledOnce()
  })
})
