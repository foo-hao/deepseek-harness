/**
 * Composer submission policy. It owns the live busy-Enter
 * preference and resolves keyboard gestures into queue/steer delivery modes;
 * Host and Agent keep the actual delivery-window authority.
 */
import {
  createSnapshotStore, type SettingsScope, type SnapshotStore,
} from '@deepseek-ai/dsh-client-runtime/client'
import type {
  BusyEnterBehavior, ComposerSubmitGesture, EnterMode, InputSubmitMode,
} from '../contract/composer-submission.ts'
import {
  BUSY_ENTER_FIELD, DEFAULT_BUSY_ENTER_BEHAVIOR, DEFAULT_ENTER_MODE, ENTER_MODE_FIELD,
} from '../../submission-settings.ts'
import type { ConversationSettings } from '../../submission-settings.ts'

export { DEFAULT_BUSY_ENTER_BEHAVIOR, DEFAULT_ENTER_MODE } from '../../submission-settings.ts'

/**
 * Composer Enter policy used by both the composer inject face and its Settings
 * row: the busy-state delivery preference plus the idle-state plain-Enter mode.
 * Direct `steer` is intentionally best-effort: AgentLoop turns a closed-window
 * submission into the next waking Queue item.
 */
export class ComposerSubmissionPolicy {
  /** Reactive preference source for the Settings row. */
  readonly busyEnter: SnapshotStore<BusyEnterBehavior> = createSnapshotStore(DEFAULT_BUSY_ENTER_BEHAVIOR)
  /** Reactive idle-Enter mode source for the Settings row and the input bar. */
  readonly enterMode: SnapshotStore<EnterMode> = createSnapshotStore(DEFAULT_ENTER_MODE)
  private readonly host: SettingsScope<ConversationSettings> | undefined

  /**
   * @param host - durable preference scope owned by the providing plugin;
   * absent compositions stay process-local. The adoption subscription shares
   * the scope's plugin lifetime — a disposed scope never publishes again, so
   * the policy needs no release hook.
   */
  constructor(host?: SettingsScope<ConversationSettings>) {
    this.host = host
    if (host !== undefined) {
      host.subscribe(() => { this.adopt(host) })
      this.adopt(host)
    }
  }

  /**
   * Resolve one keyboard gesture without changing state.
   * @param running - whether the addressed agent currently reports busy.
   * @param gesture - plain Enter or the Cmd/Ctrl-accelerated chord.
   * @param steeringAvailable - whether this session transport supports steering.
   * @returns Queue outside steer-capable busy state; otherwise the preferred mode or its opposite.
   */
  resolve(
    running: boolean,
    gesture: ComposerSubmitGesture,
    steeringAvailable: boolean,
  ): InputSubmitMode {
    if (!running || !steeringAvailable) return 'queue'
    const preferred = this.busyEnter.getSnapshot()
    if (gesture === 'enter') return preferred
    return preferred === 'queue' ? 'steer' : 'queue'
  }

  /**
   * Change the plain-Enter behavior used during busy state; the live value
   * publishes before the durable write starts.
   * @param behavior - Queue or Steer.
   */
  setBusyEnter(behavior: BusyEnterBehavior): void {
    if (this.busyEnter.getSnapshot() === behavior) return
    this.busyEnter.set(behavior)
    void this.host?.set(BUSY_ENTER_FIELD, behavior)
  }

  /**
   * Change the plain-Enter mode used while the addressed agent is idle; the
   * live value publishes before the durable write starts.
   * @param mode - Native newline insertion or Send.
   */
  setEnterMode(mode: EnterMode): void {
    if (this.enterMode.getSnapshot() === mode) return
    this.enterMode.set(mode)
    void this.host?.set(ENTER_MODE_FIELD, mode)
  }

  /**
   * Adopt the scope's accepted durable behavior without writing it back.
   * @param host - the constructor-narrowed scope driving this adoption.
   */
  private adopt(host: SettingsScope<ConversationSettings>): void {
    const section = host.getSnapshot().value
    if (section === undefined) return
    if (this.busyEnter.getSnapshot() !== section.busyEnter) this.busyEnter.set(section.busyEnter)
    if (this.enterMode.getSnapshot() !== section.enterMode) this.enterMode.set(section.enterMode)
  }
}
