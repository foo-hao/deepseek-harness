// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { stubSettingsScope } from '@deepseek-ai/dsh-client-test-runtime'
import {
  ComposerSubmissionPolicy, DEFAULT_BUSY_ENTER_BEHAVIOR, DEFAULT_ENTER_MODE,
} from '../src/client/input/submission-policy.ts'
import type { ConversationSettings } from '../src/submission-settings.ts'

describe('ComposerSubmissionPolicy', () => {
  it('defaults to Queue and only applies the preference while running', () => {
    const policy = new ComposerSubmissionPolicy()
    expect(policy.busyEnter.getSnapshot()).toBe(DEFAULT_BUSY_ENTER_BEHAVIOR)
    expect(policy.enterMode.getSnapshot()).toBe(DEFAULT_ENTER_MODE)
    expect(policy.resolve(false, 'enter', true)).toBe('queue')
    expect(policy.resolve(false, 'accelerated', true)).toBe('queue')
    expect(policy.resolve(true, 'enter', true)).toBe('queue')
    expect(policy.resolve(true, 'accelerated', true)).toBe('steer')
    expect(policy.resolve(true, 'enter', false)).toBe('queue')
    expect(policy.resolve(true, 'accelerated', false)).toBe('queue')

    const changed = vi.fn()
    policy.busyEnter.subscribe(changed)
    policy.setBusyEnter('steer')
    expect(changed).toHaveBeenCalledTimes(1)
    expect(policy.resolve(true, 'enter', true)).toBe('steer')
    expect(policy.resolve(true, 'accelerated', true)).toBe('queue')
    expect(policy.resolve(false, 'enter', true)).toBe('queue')
    expect(policy.resolve(false, 'accelerated', true)).toBe('queue')
  })

  it('writes an explicit change through the scope after publishing it locally', () => {
    const host = stubSettingsScope<ConversationSettings>()
    const observed: string[] = []
    let liveBehavior = (): string => 'unconstructed'
    const scope: typeof host.scope = {
      ...host.scope,
      set: (field, value) => {
        observed.push(`${field}=${String(value)}:${liveBehavior()}`)
        return host.scope.set(field, value)
      },
    }
    const policy = new ComposerSubmissionPolicy(scope)
    liveBehavior = () => policy.busyEnter.getSnapshot()
    policy.setBusyEnter('steer')
    expect(observed).toEqual(['busyEnter=steer:steer'])
    expect(host.set).toHaveBeenCalledWith('busyEnter', 'steer')
    expect(host.set).toHaveBeenCalledOnce()
  })

  it('adopts a Host preference without writing it back and leaves an identical write untouched', () => {
    const host = stubSettingsScope<ConversationSettings>()
    const policy = new ComposerSubmissionPolicy(host.scope)
    host.publish({ status: 'ready', value: { busyEnter: 'steer', enterMode: 'send' }, revision: 1, writable: true })
    expect(policy.busyEnter.getSnapshot()).toBe('steer')
    policy.setBusyEnter('steer')
    expect(host.set).not.toHaveBeenCalled()
    host.publish({ value: { busyEnter: 'steer', enterMode: 'send' }, revision: 2 })
    expect(policy.busyEnter.getSnapshot()).toBe('steer')
  })

  it('adopts a section already standing at construction', () => {
    const host = stubSettingsScope<ConversationSettings>()
    host.publish({ status: 'ready', value: { busyEnter: 'steer', enterMode: 'send' }, revision: 1, writable: true })
    const policy = new ComposerSubmissionPolicy(host.scope)
    expect(policy.busyEnter.getSnapshot()).toBe('steer')
  })

  it('defaults idle Enter to Send and publishes an explicit mode change', () => {
    const policy = new ComposerSubmissionPolicy()
    expect(policy.enterMode.getSnapshot()).toBe(DEFAULT_ENTER_MODE)
    const changed = vi.fn()
    policy.enterMode.subscribe(changed)
    policy.setEnterMode('newline')
    expect(changed).toHaveBeenCalledTimes(1)
    expect(policy.enterMode.getSnapshot()).toBe('newline')
  })

  it('writes an idle-mode change through the scope after publishing it locally', () => {
    const host = stubSettingsScope<ConversationSettings>()
    const observed: string[] = []
    let liveMode = (): string => 'unconstructed'
    const scope: typeof host.scope = {
      ...host.scope,
      set: (field, value) => {
        observed.push(`${field}=${String(value)}:${liveMode()}`)
        return host.scope.set(field, value)
      },
    }
    const policy = new ComposerSubmissionPolicy(scope)
    liveMode = () => policy.enterMode.getSnapshot()
    policy.setEnterMode('newline')
    expect(observed).toEqual(['enterMode=newline:newline'])
    expect(host.set).toHaveBeenCalledWith('enterMode', 'newline')
  })

  it('adopts the idle mode from a Host preference and leaves an identical write untouched', () => {
    const host = stubSettingsScope<ConversationSettings>()
    const policy = new ComposerSubmissionPolicy(host.scope)
    host.publish({ status: 'ready', value: { busyEnter: 'queue', enterMode: 'newline' }, revision: 1, writable: true })
    expect(policy.enterMode.getSnapshot()).toBe('newline')
    policy.setEnterMode('newline')
    expect(host.set).not.toHaveBeenCalled()
  })
})
