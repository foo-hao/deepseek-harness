/**
 * Interactive SIGINT confirmation for the `dsh` launcher.
 *
 * A long-lived surface (`dsh web`, a future TUI profile) runs agent sessions
 * whose work a stray Ctrl+C would destroy. The first SIGINT in an interactive
 * terminal therefore arms a short confirmation window instead of beginning
 * teardown: only a second SIGINT within that window proceeds, and the window
 * expiring cancels the exit. SIGTERM (a supervisor's ordinary stop request)
 * bypasses confirmation entirely, and non-interactive (non-TTY) processes keep
 * the single-signal behavior.
 * @module @deepseek-ai/dsh/exit-confirmation
 */

/** Default confirmation window: how long a second Ctrl+C may follow the first. */
export const EXIT_CONFIRMATION_TIMEOUT_MS = 3_000

/** One interactive SIGINT confirmation gate. */
export interface ExitConfirmation {
  /**
   * Feed one SIGINT.
   * @returns true when the caller should begin (or force) shutdown, false when a confirmation window was just armed.
   */
  onInterrupt(): boolean
  /** Permanently disarm: shutdown is already proceeding (SIGTERM, or a confirmed SIGINT). */
  dispose(): void
}

/** Injectable confirmation dependencies. */
export interface ExitConfirmationOptions {
  /** Write one prompt/notice line (stderr), replaceable by tests. */
  write: (text: string) => void
  /** Whether the current process runs on an interactive terminal. */
  isInteractive: () => boolean
  /** Confirmation window length in milliseconds, replaceable by tests. */
  timeoutMs?: number
}

/**
 * Create one confirmation gate.
 * @param options - output, interactivity probe, and window length.
 * @returns the gate.
 */
export function createExitConfirmation(options: ExitConfirmationOptions): ExitConfirmation {
  const timeoutMs = options.timeoutMs ?? EXIT_CONFIRMATION_TIMEOUT_MS
  let timer: ReturnType<typeof setTimeout> | undefined
  let consumed = false

  const clearTimer = (): void => {
    if (timer !== undefined) {
      clearTimeout(timer)
      timer = undefined
    }
  }

  return {
    onInterrupt() {
      if (consumed || !options.isInteractive()) return true
      if (timer !== undefined) {
        // Second press inside the window: confirm and hand shutdown to the launcher.
        clearTimer()
        consumed = true
        return true
      }
      options.write('dsh: exit requested; press Ctrl+C again to confirm, or wait to cancel\n')
      timer = setTimeout(() => {
        timer = undefined
        options.write('dsh: exit cancelled\n')
      }, timeoutMs)
      return false
    },
    dispose() {
      clearTimer()
      consumed = true
    },
  }
}
