/**
 * ModelSelect: the composer's named model seat (`conversation.input.model`).
 * The trigger opens a single-level, provider-grouped model list over the
 * shared directory. Thinking intensity is a separate always-visible slider
 * beside the trigger — one horizontal track with a discrete stop per
 * adapter-owned effort level, so changing the effort is a single drag/click
 * instead of a second drill-in menu. The slider shows only when the current
 * model exposes reasoning effort levels; its current value (and the model
 * name) come from the Host rather than a client-owned vocabulary. A rejected
 * selection announces through the shared transient Toast anchored to the
 * composer card; the in-menu strip with Retry remains the catalog-load surface.
 */
import {
  useEffect, useId, useMemo, useRef, useState, useSyncExternalStore,
  type KeyboardEvent, type FocusEvent, type PointerEvent,
} from 'react'
import clsx from 'clsx'
import type { ModelReasoningEffort, ModelSelection } from '@deepseek-ai/dsh-api-remotes/client'
import {
  IconCheckOutline16, IconChevronDownOutline14,
  IconWarningOutline16, Toast,
} from '@deepseek-ai/dsh-client-ui-primitives'
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import type { ModelSelectInjected } from './slots.ts'
import css from './ModelSelect.module.css'

/** One dynamic effort choice; undefined effort means preserve the provider default. */
interface EffortChoice {
  key: string
  effort: string | undefined
  label: string
  description?: string
}

/**
 * Render the composer model seat: the model trigger plus the always-visible
 * thinking-intensity slider, and, while open, the model list menu.
 * @param props - owner share (locked) + injected face (shared directory
 * store/verbs) + the standard locale seat.
 */
export function ModelSelect(
  { locked, available, directory, load, select, t }:
  ModelSelectInjected & { locked: boolean } & PropsLocale<'model'>,
) {
  const state = useSyncExternalStore(
    fn => directory.subscribe(fn),
    () => directory.getSnapshot(),
  )
  const [open, setOpen] = useState(false)
  // Preview stop while dragging (null when idle); the committed value derives
  // from the directory's reported effort below.
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const draggingRef = useRef(false)
  const lastActionRef = useRef<'load' | 'select'>('load')
  const [toast, setToast] = useState<{ seq: number; text: string } | null>(null)
  const toastSeq = useRef(0)
  const rootRef = useRef<HTMLDivElement | null>(null)
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const sliderTrackRef = useRef<HTMLDivElement | null>(null)
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([])
  const id = useId()

  const choices = useMemo(() => state.groups.flatMap(group =>
    group.models.map(model => ({
      group,
      model,
      selection: {
        provider: group.id,
        model: model.id,
        ...model.reasoning?.defaultEffort === undefined
          ? {}
          : { reasoningEffort: model.reasoning.defaultEffort },
      } satisfies ModelSelection,
    }))), [state.groups])
  const selectedIndex = state.current === null
    ? -1
    : choices.findIndex(c => c.selection.provider === state.current?.provider && c.selection.model === state.current.model)
  const currentChoice = choices[selectedIndex]
  const reasoning = currentChoice?.model.reasoning
  const effectiveEffort = state.current?.reasoningEffort ?? reasoning?.defaultEffort
  const effortChoices = useMemo<readonly EffortChoice[]>(() => reasoning === undefined
    ? []
    : [
      ...reasoning.defaultEffort === undefined
        ? [{ key: 'provider-default', effort: undefined, label: t('effort.providerDefault') }]
        : [],
      ...reasoning.efforts.map((effort: ModelReasoningEffort) => ({
        key: `effort:${effort.id}`,
        effort: effort.id,
        label: effort.name,
        ...effort.description === undefined ? {} : { description: effort.description },
      })),
    ], [reasoning, t])
  const activeIndex = Math.max(0, effortChoices.findIndex(c => c.effort === effectiveEffort))
  const thumbIndex = dragIndex ?? activeIndex
  const thumbChoice = effortChoices[thumbIndex]
  const busy = state.status === 'selecting'

  const reload = (): void => {
    lastActionRef.current = 'load'
    load()
  }

  // Mount-time load resolves the trigger label; every open refreshes.
  useEffect(() => {
    if (available) {
      lastActionRef.current = 'load'
      load()
    }
  }, [available, load])

  useEffect(() => {
    if (!open) return
    const closeOutside = (event: MouseEvent): void => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', closeOutside)
    return () => { document.removeEventListener('mousedown', closeOutside) }
  }, [open])

  if (!available) return null

  const show = (): void => {
    setOpen(true)
    reload()
  }

  const close = (restoreFocus = false): void => {
    setOpen(false)
    if (restoreFocus) queueMicrotask(() => { triggerRef.current?.focus() })
  }

  const moveFocus = (offset: number): void => {
    const items = itemRefs.current.filter(item => item !== null)
    if (items.length === 0) return
    const active = items.findIndex(item => item === document.activeElement)
    const next = (Math.max(active, 0) + offset + items.length) % items.length
    items[next]?.focus()
  }

  const onRootKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.key === 'Escape' && open) {
      event.preventDefault()
      close(true)
      return
    }
    if (!open) return
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      moveFocus(event.key === 'ArrowDown' ? 1 : -1)
    }
  }

  const onBlur = (event: FocusEvent<HTMLDivElement>): void => {
    if (event.relatedTarget instanceof Node && rootRef.current?.contains(event.relatedTarget)) return
    close()
  }

  const settleSelection = (accepted: boolean): void => {
    if (accepted) {
      if (rootRef.current !== null) close(true)
      return
    }
    const message = directory.getSnapshot().error
    if (message !== null) {
      toastSeq.current += 1
      setToast({ seq: toastSeq.current, text: t('error.action', { message }) })
    }
  }

  const choose = (selection: ModelSelection): void => {
    if (state.current?.provider === selection.provider && state.current.model === selection.model) {
      close(true)
      return
    }
    lastActionRef.current = 'select'
    void select(selection).then(settleSelection)
  }

  // Effort selection keeps the menu open (the slider is outside it) and only
  // announces a rejection; success is reflected by the Host-reported current.
  const selectEffort = (effort: string | undefined): void => {
    if (state.current === null || effectiveEffort === effort) return
    const selection: ModelSelection = {
      provider: state.current.provider,
      model: state.current.model,
      ...effort === undefined ? {} : { reasoningEffort: effort },
    }
    lastActionRef.current = 'select'
    void select(selection).then((accepted) => {
      if (accepted) return
      const message = directory.getSnapshot().error
      if (message !== null) {
        toastSeq.current += 1
        setToast({ seq: toastSeq.current, text: t('error.action', { message }) })
      }
    })
  }

  const sliderIndexFromEvent = (event: PointerEvent<HTMLDivElement>): number => {
    const rect = sliderTrackRef.current?.getBoundingClientRect()
    const count = effortChoices.length
    if (rect === undefined || count < 2) return 0
    const ratio = (event.clientX - rect.left) / rect.width
    return Math.max(0, Math.min(count - 1, Math.round(ratio * (count - 1))))
  }

  const onSliderPointerDown = (event: PointerEvent<HTMLDivElement>): void => {
    if (locked || busy || effortChoices.length < 2) return
    draggingRef.current = true
    // Pointer capture is absent in a few DOM hosts (including jsdom), even
    // though lib.dom declares it as required.
    const captureTarget: Partial<Pick<HTMLDivElement, 'setPointerCapture'>> = event.currentTarget
    captureTarget.setPointerCapture?.(event.pointerId)
    setDragIndex(sliderIndexFromEvent(event))
  }

  const onSliderPointerMove = (event: PointerEvent<HTMLDivElement>): void => {
    if (!draggingRef.current) return
    setDragIndex(sliderIndexFromEvent(event))
  }

  const onSliderPointerUp = (event: PointerEvent<HTMLDivElement>): void => {
    if (!draggingRef.current) return
    draggingRef.current = false
    const choice = effortChoices[sliderIndexFromEvent(event)]
    setDragIndex(null)
    if (choice !== undefined) selectEffort(choice.effort)
  }

  const onSliderPointerCancel = (): void => {
    draggingRef.current = false
    setDragIndex(null)
  }

  const onSliderKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
    event.preventDefault()
    event.stopPropagation()
    if (effortChoices.length < 2) return
    const next = Math.max(0, Math.min(effortChoices.length - 1, activeIndex + (event.key === 'ArrowRight' ? 1 : -1)))
    const choice = effortChoices[next]
    if (choice !== undefined) selectEffort(choice.effort)
  }

  const modelLabel = currentChoice?.model.name ?? t('trigger.fallback')
  const triggerLabel = modelLabel
  const triggerAria = currentChoice === undefined
    ? t('trigger.selectAria')
    : t('trigger.aria', { model: modelLabel })
  itemRefs.current = []
  let itemIndex = 0
  const itemRef = () => {
    const at = itemIndex++
    return (node: HTMLButtonElement | null) => { itemRefs.current[at] = node }
  }

  const stopRatio = (index: number): string => `${index * 100 / Math.max(1, effortChoices.length - 1)}%`

  return (
    <div ref={rootRef} className={css.root} onKeyDown={onRootKeyDown} onBlur={onBlur}>
      <button
        ref={triggerRef}
        type="button"
        className={css.trigger}
        aria-label={triggerAria}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? `${id}-menu` : undefined}
        title={triggerLabel}
        disabled={locked}
        onClick={() => {
          if (open) {
            close()
          } else {
            show()
          }
        }}
      >
        <span className={css.triggerLabel}>{modelLabel}</span>
        <IconChevronDownOutline14 className={clsx(css.chevron, open && css.chevronOpen)} />
      </button>

      {reasoning !== undefined && effortChoices.length > 0 && (
        <div className={css.effortSlider}>
          <div
            ref={sliderTrackRef}
            className={clsx(css.slider, dragIndex !== null && css.dragging)}
            role="slider"
            tabIndex={locked || effortChoices.length < 2 ? undefined : 0}
            aria-label={t('menu.effort')}
            aria-valuemin={0}
            aria-valuemax={effortChoices.length - 1}
            aria-valuenow={thumbIndex}
            aria-valuetext={thumbChoice?.label}
            title={thumbChoice?.label}
            onPointerDown={onSliderPointerDown}
            onPointerMove={onSliderPointerMove}
            onPointerUp={onSliderPointerUp}
            onPointerCancel={onSliderPointerCancel}
            onKeyDown={onSliderKeyDown}
          >
            <div className={css.sliderTrack}>
              <div className={css.sliderFill} style={{ width: stopRatio(thumbIndex) }} />
            </div>
            {effortChoices.map((choice, index) => (
              <span
                key={choice.key}
                className={clsx(css.sliderStop, index <= thumbIndex && css.sliderStopReached)}
                style={{ left: stopRatio(index) }}
              />
            ))}
            <div className={css.sliderThumb} style={{ left: stopRatio(thumbIndex) }} />
          </div>
          {thumbChoice !== undefined && (
            <span className={css.effortValue}>{thumbChoice.label}</span>
          )}
        </div>
      )}

      {open && (
        <div
          id={`${id}-menu`}
          className={css.menu}
          role="menu"
          aria-label={t('menu.aria')}
          aria-busy={state.status === 'loading' || busy}
        >
          {state.status === 'loading' && (
            <div className={css.status}>{t('status.loading')}</div>
          )}
          {state.error !== null && lastActionRef.current === 'load' && (
            <div className={css.error}>
              <span>{t('error.action', { message: state.error })}</span>
              <button type="button" className={css.retry} onClick={reload}>{t('retry')}</button>
            </div>
          )}
          {state.failures.map(failure => (
            <div className={css.warning} key={failure.id}>
              <span>{t('warning.groupLoad', { name: failure.name, message: failure.message })}</span>
              <button type="button" className={css.retry} onClick={reload}>{t('retry')}</button>
            </div>
          ))}
          <div className={clsx(css.groups, 'scrollable')}>
            {state.groups.map((group) => {
              const headingId = `${id}-${group.id}`
              return (
                <section role="group" aria-labelledby={headingId} className={css.group} key={group.id}>
                  <div className={css.groupTitle} id={headingId}>{group.name}</div>
                  {group.models.map((model) => {
                    const selected = state.current?.provider === group.id && state.current.model === model.id
                    return (
                      <button
                        ref={itemRef()}
                        type="button"
                        role="menuitemradio"
                        aria-checked={selected}
                        className={clsx(css.option, selected && css.selected)}
                        key={model.id}
                        title={model.name}
                        disabled={busy}
                        onClick={() => { choose({ provider: group.id, model: model.id }) }}
                      >
                        <span className={css.optionCopy}>
                          <span className={css.modelName}>{model.name}</span>
                          {model.description !== undefined && (
                            <span className={css.description}>{model.description}</span>
                          )}
                        </span>
                        <span className={css.check}>
                          {selected ? <IconCheckOutline16 /> : null}
                        </span>
                      </button>
                    )
                  })}
                </section>
              )
            })}
          </div>
          {state.status === 'ready' && choices.length === 0 && (
            <div className={css.empty}>{t('empty.models')}</div>
          )}
        </div>
      )}
      {toast !== null && (
        <Toast
          key={toast.seq}
          text={toast.text}
          icon={<IconWarningOutline16 />}
          anchor={rootRef.current?.closest<HTMLElement>('[data-composer-card]') ?? null}
          onDone={() => { setToast(null) }}
        />
      )}
    </div>
  )
}
