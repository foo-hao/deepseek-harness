/** General Settings rows for the Composer's busy-state and idle-state Enter preferences. */
import { useState } from 'react'
import type { SnapshotStore } from '@deepseek-ai/dsh-client-runtime/client'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import { IconChevronDownOutline14, Menu } from '@deepseek-ai/dsh-client-ui-primitives'
import type { BusyEnterBehavior, EnterMode } from '../contract/composer-submission.ts'
import type { ConversationKey } from '../locales.ts'
import css from './EnterBehaviorRow.module.css'

/** Registration-side preference face. */
export interface EnterBehaviorRowInjected {
  hooks: {
    /** Persisted busy-state preference bound as useBusyEnter. */
    busyEnter: SnapshotStore<BusyEnterBehavior>
    /** Persisted idle-state mode bound as useEnterMode. */
    enterMode: SnapshotStore<EnterMode>
  }
  /** Change the busy-state plain-Enter behavior. */
  setBusyEnter: (behavior: BusyEnterBehavior) => void
  /** Change the idle-state plain-Enter mode. */
  setEnterMode: (mode: EnterMode) => void
}

/** Full Settings-row props. */
export type EnterBehaviorRowProps =
  PropsRuntime<'settings.general.item'>
  & PropsLocale<'conversation'>
  & InjectFace<EnterBehaviorRowInjected>

const BUSY_OPTIONS: readonly {
  id: BusyEnterBehavior
  label: ConversationKey
}[] = [
  { id: 'queue', label: 'settings.enter.queue' },
  { id: 'steer', label: 'settings.enter.steer' },
]

const IDLE_OPTIONS: readonly {
  id: EnterMode
  label: ConversationKey
}[] = [
  { id: 'send', label: 'settings.enterMode.send' },
  { id: 'newline', label: 'settings.enterMode.newline' },
]

/**
 * Render the busy-state and idle-state Enter behavior selectors.
 * @param props - composed Settings slot props.
 * @returns the preference rows.
 */
export function EnterBehaviorRow({
  useBusyEnter, setBusyEnter, useEnterMode, setEnterMode, t,
}: EnterBehaviorRowProps) {
  const behavior = useBusyEnter(value => value)
  const mode = useEnterMode(value => value)
  const [busyOpen, setBusyOpen] = useState(false)
  const [idleOpen, setIdleOpen] = useState(false)

  return (
    <>
      <div className={css.row}>
        <div className={css.rowText}>
          <div className={css.title}>{t('settings.enter.title')}</div>
          <div className={css.desc}>{t('settings.enter.description')}</div>
        </div>
        <Menu
          open={busyOpen}
          onClose={() => { setBusyOpen(false) }}
          items={BUSY_OPTIONS.map(option => ({ id: option.id, label: t(option.label) }))}
          selectedId={behavior}
          onSelect={(id) => {
            setBusyOpen(false)
            setBusyEnter(id as BusyEnterBehavior)
          }}
          align="end"
          portal
          anchor={(
            <button
              type="button"
              className={css.selector}
              aria-haspopup="menu"
              aria-expanded={busyOpen}
              onClick={() => { setBusyOpen(value => !value) }}
            >
              {t(behavior === 'queue' ? 'settings.enter.queue' : 'settings.enter.steer')}
              <IconChevronDownOutline14 className={css.chevron} />
            </button>
          )}
        />
      </div>
      <div className={css.row}>
        <div className={css.rowText}>
          <div className={css.title}>{t('settings.enterMode.title')}</div>
          <div className={css.desc}>{t('settings.enterMode.description')}</div>
        </div>
        <Menu
          open={idleOpen}
          onClose={() => { setIdleOpen(false) }}
          items={IDLE_OPTIONS.map(option => ({ id: option.id, label: t(option.label) }))}
          selectedId={mode}
          onSelect={(id) => {
            setIdleOpen(false)
            setEnterMode(id as EnterMode)
          }}
          align="end"
          portal
          anchor={(
            <button
              type="button"
              className={css.selector}
              aria-haspopup="menu"
              aria-expanded={idleOpen}
              onClick={() => { setIdleOpen(value => !value) }}
            >
              {t(mode === 'send' ? 'settings.enterMode.send' : 'settings.enterMode.newline')}
              <IconChevronDownOutline14 className={css.chevron} />
            </button>
          )}
        />
      </div>
    </>
  )
}
