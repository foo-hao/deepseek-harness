// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ModelSelection } from '@deepseek-ai/dsh-api-remotes/client'
import { createSnapshotStore } from '@deepseek-ai/dsh-client-runtime/client'
import type { ComponentProps } from 'react'
import type { ModelDirectoryState } from '../src/client/directory.ts'
import { ModelSelect } from '../src/client/ModelSelect.tsx'
import { zh } from '../src/client/locales.ts'
import { zh as commonZh } from '@deepseek-ai/dsh-client-locale/src/locales/zh.ts'

// The seat's key domain is model ∪ common; the stub mirrors the real lookup
// chain: package dictionary, then common vocabulary, then the key.
const t: ComponentProps<typeof ModelSelect>['t'] = (key, params) => {
  const template = (zh as Record<string, string>)[key]
    ?? (commonZh as Record<string, string>)[key]
    ?? key
  return params === undefined
    ? template
    : template.replace(/\{(\w+)\}/g, (match, name: string) => name in params ? String(params[name]) : match)
}

const reasoning = {
  efforts: [
    { id: 'off', name: 'Off' },
    { id: 'high', name: 'High' },
    { id: 'max', name: 'Max', description: 'Largest budget' },
  ],
  defaultEffort: 'high',
}

function state(overrides: Partial<ModelDirectoryState> = {}): ModelDirectoryState {
  return {
    current: { provider: 'deepseek-official', model: 'deepseek-v4-flash' },
    routable: true,
    groups: [{
      id: 'deepseek-official',
      name: 'DeepSeek',
      models: [{ id: 'deepseek-v4-flash', name: 'DeepSeek-V4-Flash', reasoning }],
    }],
    failures: [],
    status: 'ready',
    error: null,
    ...overrides,
  }
}

afterEach(cleanup)

// The slider maps a pointer x onto discrete stops via the track rect; jsdom
// reports a zero rect, so the mapping test pins one that treats the track as
// 100px wide (clientX 99 → last stop, clientX 1 → first stop).
let rectSpy: ReturnType<typeof vi.spyOn> | null = null

function mockTrackRect(): void {
  rectSpy = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect')
    .mockReturnValue({
      left: 0, top: 0, right: 100, bottom: 20, width: 100, height: 20, x: 0, y: 0,
      toJSON: () => ({}),
    } as DOMRect)
}

afterEach(() => {
  rectSpy?.mockRestore()
  rectSpy = null
})

describe('ModelSelect reasoning effort slider', () => {
  it('renders a discrete slider for the current model and submits the committed stop', async () => {
    mockTrackRect()
    const directory = createSnapshotStore<ModelDirectoryState>(state())
    const select = vi.fn(async (selection: ModelSelection) => {
      directory.set(state({ current: selection }))
      return true
    })
    render(<ModelSelect
      locked={false}
      available
      directory={directory}
      load={vi.fn()}
      select={select}
      t={t}
    />)

    // The trigger names the model only; intensity lives on the slider beside it.
    const trigger = screen.getByRole('button', { name: '选择模型，当前 DeepSeek-V4-Flash' })
    const slider = screen.getByRole('slider', { name: '推理等级' })
    expect(slider.getAttribute('aria-valuemin')).toBe('0')
    expect(slider.getAttribute('aria-valuemax')).toBe('2')
    expect(slider.getAttribute('aria-valuenow')).toBe('1')
    expect(slider.getAttribute('aria-valuetext')).toBe('High')
    expect(screen.getByText('High')).toBeTruthy()

    // Drag to the last stop: the preview moves first, then the commit lands.
    fireEvent.pointerDown(slider, { clientX: 99 })
    expect(slider.getAttribute('aria-valuenow')).toBe('2')
    expect(screen.getByText('Max')).toBeTruthy()
    fireEvent.pointerUp(slider, { clientX: 99 })
    await waitFor(() => {
      expect(select).toHaveBeenCalledWith({
        provider: 'deepseek-official',
        model: 'deepseek-v4-flash',
        reasoningEffort: 'max',
      })
      expect(trigger.getAttribute('aria-label')).toBe('选择模型，当前 DeepSeek-V4-Flash')
    })
  })

  it('steps the effort with the arrow keys and commits each step', async () => {
    const directory = createSnapshotStore<ModelDirectoryState>(state())
    const select = vi.fn(async (selection: ModelSelection) => {
      directory.set(state({ current: selection }))
      return true
    })
    render(<ModelSelect
      locked={false}
      available
      directory={directory}
      load={vi.fn()}
      select={select}
      t={t}
    />)

    const slider = screen.getByRole('slider', { name: '推理等级' })
    slider.focus()
    fireEvent.keyDown(slider, { key: 'ArrowRight' })
    await waitFor(() => {
      expect(select).toHaveBeenLastCalledWith({
        provider: 'deepseek-official',
        model: 'deepseek-v4-flash',
        reasoningEffort: 'max',
      })
      expect(slider.getAttribute('aria-valuenow')).toBe('2')
    })
    fireEvent.keyDown(slider, { key: 'ArrowLeft' })
    await waitFor(() => {
      expect(select).toHaveBeenLastCalledWith({
        provider: 'deepseek-official',
        model: 'deepseek-v4-flash',
        reasoningEffort: 'high',
      })
      expect(slider.getAttribute('aria-valuenow')).toBe('1')
    })
  })

  it('offers the provider-default entry only when the adapter sets no model default', async () => {
    mockTrackRect()
    const directory = createSnapshotStore(state({
      groups: [{
        id: 'provider',
        name: 'Provider',
        models: [{
          id: 'model',
          name: 'Model',
          reasoning: { efforts: [{ id: 'standard', name: 'Standard' }] },
        }],
      }],
      current: { provider: 'provider', model: 'model' },
    }))
    const select = vi.fn(async (selection: ModelSelection) => {
      directory.set(state({ current: selection }))
      return true
    })
    render(<ModelSelect
      locked={false}
      available
      directory={directory}
      load={vi.fn()}
      select={select}
      t={t}
    />)

    const slider = screen.getByRole('slider', { name: '推理等级' })
    expect(slider.getAttribute('aria-valuemax')).toBe('1')
    expect(slider.getAttribute('aria-valuetext')).toBe('Default')
    fireEvent.pointerDown(slider, { clientX: 99 })
    fireEvent.pointerUp(slider, { clientX: 99 })
    await waitFor(() => {
      expect(select).toHaveBeenCalledWith({
        provider: 'provider',
        model: 'model',
        reasoningEffort: 'standard',
      })
    })
  })

  it('renders no slider for a model without reasoning metadata', () => {
    const directory = createSnapshotStore(state({
      groups: [{
        id: 'deepseek-official',
        name: 'DeepSeek',
        models: [{ id: 'deepseek-v4-flash', name: 'DeepSeek-V4-Flash' }],
      }],
    }))
    render(<ModelSelect
      locked={false}
      available
      directory={directory}
      load={vi.fn()}
      select={vi.fn().mockResolvedValue(true)}
      t={t}
    />)

    expect(screen.queryByRole('slider')).toBeNull()
    expect(screen.queryByText('推理等级')).toBeNull()
  })

  it('keeps the slider inert while locked', () => {
    const directory = createSnapshotStore(state())
    render(<ModelSelect
      locked
      available
      directory={directory}
      load={vi.fn()}
      select={vi.fn().mockResolvedValue(true)}
      t={t}
    />)

    const slider = screen.getByRole('slider', { name: '推理等级' })
    expect(slider.tabIndex).toBe(-1)
    expect(screen.getByRole<HTMLButtonElement>('button', { name: '选择模型，当前 DeepSeek-V4-Flash' }).disabled).toBe(true)
  })

  it('announces a rejected effort selection as a transient toast', async () => {
    const directory = createSnapshotStore<ModelDirectoryState>(state())
    const select = vi.fn(async () => {
      directory.set(state({ status: 'error', error: 'model-unavailable: effort rejected' }))
      return false
    })
    render(<ModelSelect
      locked={false}
      available
      directory={directory}
      load={vi.fn()}
      select={select}
      t={t}
    />)

    const slider = screen.getByRole('slider', { name: '推理等级' })
    fireEvent.pointerDown(slider, { clientX: 99 })
    fireEvent.pointerUp(slider, { clientX: 99 })
    const toast = await screen.findByRole('alert')
    expect(toast.textContent).toContain('模型操作失败：model-unavailable: effort rejected')
  })

  it('prompts for a selection when the current model is no longer advertised', () => {
    const directory = createSnapshotStore(state({
      current: { provider: 'deepseek-official', model: 'removed-model' },
    }))
    const select = vi.fn().mockResolvedValue(true)
    render(<ModelSelect
      locked={false}
      available
      directory={directory}
      load={vi.fn()}
      select={select}
      t={t}
    />)

    const trigger = screen.getByRole('button', { name: '选择模型' })
    expect(trigger.textContent).toContain('选择模型')
    expect(screen.queryByRole('slider')).toBeNull()
    fireEvent.click(trigger)
    expect(screen.getByRole('menuitemradio', { name: 'DeepSeek-V4-Flash' })).toBeTruthy()
  })

  it('renders no Agent-bound control for an addressed subagent session', () => {
    const load = vi.fn()
    render(<ModelSelect
      locked={false}
      available={false}
      directory={createSnapshotStore(state())}
      load={load}
      select={vi.fn().mockResolvedValue(false)}
      t={t}
    />)

    expect(screen.queryByRole('button')).toBeNull()
    expect(screen.queryByRole('slider')).toBeNull()
    expect(load).not.toHaveBeenCalled()
  })
})
