// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { bindSnapshotSelector } from '@deepseek-ai/dsh-client-web-react'
import { createSnapshotStore, type SessionListState, type WorkspaceListState } from '@deepseek-ai/dsh-client-runtime/client'
import { makeTranslate } from '@deepseek-ai/dsh-client-test-runtime'
import { EnterBehaviorRow } from '../src/client/settings/EnterBehaviorRow.tsx'
import type { EnterBehaviorRowProps } from '../src/client/settings/EnterBehaviorRow.tsx'
import { ComposerSubmissionPolicy } from '../src/client/input/submission-policy.ts'
import { en } from '../src/client/locales.ts'

afterEach(() => {
  cleanup()
  localStorage.clear()
})

function emptySessions() {
  return bindSnapshotSelector(createSnapshotStore<SessionListState>({
    ids: [], byId: {}, current: undefined, phase: 'ready', subagentsByParent: {}, jobsBySession: {}, currentAddress: undefined,
  }))
}

function emptyWorkspaces() {
  return bindSnapshotSelector(createSnapshotStore<WorkspaceListState>({
    items: [], archivedSessionIds: [], state: 'idle', phase: 'ready', error: null,
    baselinesReady: true, recentWorkspaceId: undefined,
  }))
}

function mount() {
  const policy = new ComposerSubmissionPolicy()
  const setBusyEnter = vi.fn((behavior: 'queue' | 'steer') => { policy.setBusyEnter(behavior) })
  const setEnterMode = vi.fn((mode: 'send' | 'newline') => { policy.setEnterMode(mode) })
  const props: EnterBehaviorRowProps = {
    useSessions: emptySessions(),
    useWorkspaces: emptyWorkspaces(),
    useBusyEnter: bindSnapshotSelector(policy.busyEnter),
    setBusyEnter,
    useEnterMode: bindSnapshotSelector(policy.enterMode),
    setEnterMode,
    t: makeTranslate(en),
  }
  render(<EnterBehaviorRow {...props} />)
  return { policy, setBusyEnter, setEnterMode }
}

describe('EnterBehaviorRow', () => {
  it('explains the busy-only scope and shows Queue by default', () => {
    mount()
    expect(screen.getByText('Enter behavior while busy')).toBeDefined()
    expect(screen.getByText('Busy only; Cmd/Ctrl+Enter uses the other behavior')).toBeDefined()
    expect(screen.getByRole('button', { name: /Queue/ }).getAttribute('aria-expanded')).toBe('false')
  })

  it('selects Steer, follows later preference changes, and closes outside', () => {
    const b = mount()
    const trigger = screen.getByRole('button', { name: /Queue/ })
    fireEvent.click(trigger)
    fireEvent.click(screen.getByRole('menuitem', { name: 'Steer' }))
    expect(b.setBusyEnter).toHaveBeenCalledWith('steer')
    expect(screen.getByRole('button', { name: /Steer/ })).toBeDefined()

    act(() => { b.policy.setBusyEnter('queue') })
    const queueTrigger = screen.getByRole('button', { name: /Queue/ })
    fireEvent.click(queueTrigger)
    expect(screen.getByRole('menuitem', { name: 'Steer' })).toBeDefined()
    fireEvent.pointerDown(document.body)
    expect(screen.queryByRole('menuitem', { name: 'Steer' })).toBeNull()
  })

  it('shows Send by default for idle Enter and selects Newline', () => {
    const b = mount()
    expect(screen.getByText('Enter behavior while idle')).toBeDefined()
    const trigger = screen.getByRole('button', { name: /Send/ })
    fireEvent.click(trigger)
    fireEvent.click(screen.getByRole('menuitem', { name: 'Newline' }))
    expect(b.setEnterMode).toHaveBeenCalledWith('newline')
    expect(screen.getByRole('button', { name: /Newline/ })).toBeDefined()
  })
})
