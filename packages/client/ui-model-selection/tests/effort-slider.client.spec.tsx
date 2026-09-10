// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { EffortSlider } from '../src/client/EffortSlider.tsx'

afterEach(cleanup)

function mount(disabled = false) {
  const onSelect = vi.fn()
  const props = { labels: ['Default', 'High', 'Max'], value: 0, disabled, label: 'Effort', onSelect }
  const view = render(<EffortSlider {...props} />)
  const slider = screen.getByRole('slider') as HTMLInputElement
  slider.setPointerCapture = vi.fn()
  return { slider, onSelect, view, props }
}

describe('discrete effort slider', () => {
  it('exposes named values and commits keyboard changes without a pointer', () => {
    const b = mount()
    expect(b.slider.getAttribute('aria-valuetext')).toBe('Default')
    fireEvent.change(b.slider, { target: { value: '2' } })
    expect(b.onSelect).toHaveBeenCalledExactlyOnceWith(2)
  })

  it('previews a drag and commits only the released choice', () => {
    const b = mount()
    fireEvent.pointerDown(b.slider, { pointerId: 1 })
    fireEvent.change(b.slider, { target: { value: '1' } })
    fireEvent.change(b.slider, { target: { value: '2' } })
    expect(b.slider.getAttribute('aria-valuetext')).toBe('Max')
    expect(b.onSelect).not.toHaveBeenCalled()
    fireEvent.pointerUp(b.slider, { pointerId: 1 })
    expect(b.onSelect).toHaveBeenCalledExactlyOnceWith(2)
    fireEvent.blur(b.slider)
    expect(b.onSelect).toHaveBeenCalledTimes(1)
  })

  it('cancels a drag without writing a selection', () => {
    const b = mount()
    fireEvent.pointerDown(b.slider)
    fireEvent.change(b.slider, { target: { value: '2' } })
    fireEvent.pointerCancel(b.slider)
    fireEvent.pointerUp(b.slider)
    expect(b.slider.value).toBe('0')
    expect(b.onSelect).not.toHaveBeenCalled()
  })

  it('discards pending drag when the owner changes the selected value', () => {
    const b = mount()
    fireEvent.pointerDown(b.slider)
    fireEvent.change(b.slider, { target: { value: '2' } })
    b.view.rerender(<EffortSlider {...b.props} value={1} />)
    fireEvent.pointerUp(b.slider)
    expect(b.onSelect).not.toHaveBeenCalled()
    expect(b.slider.value).toBe('1')
  })

  it('discards a drag when the control becomes disabled', () => {
    const b = mount()
    fireEvent.pointerDown(b.slider)
    fireEvent.change(b.slider, { target: { value: '2' } })
    b.view.rerender(<EffortSlider {...b.props} disabled />)
    fireEvent.pointerUp(b.slider)
    expect(b.onSelect).not.toHaveBeenCalled()
    expect(b.slider.disabled).toBe(true)
  })

  it('ignores disabled input and unchanged values', () => {
    const b = mount(true)
    fireEvent.pointerDown(b.slider)
    fireEvent.change(b.slider, { target: { value: '2' } })
    expect(b.onSelect).not.toHaveBeenCalled()
  })
})

it('commits a preview on blur and ignores an unchanged keyboard value', () => {
  const b = mount()
  fireEvent.change(b.slider, { target: { value: '0' } })
  expect(b.onSelect).not.toHaveBeenCalled()
  fireEvent.pointerDown(b.slider)
  fireEvent.change(b.slider, { target: { value: '1' } })
  fireEvent.blur(b.slider)
  expect(b.onSelect).toHaveBeenCalledExactlyOnceWith(1)
  fireEvent.keyDown(b.slider, { key: 'ArrowRight' })
})

it('marks an in-flight choice unavailable without removing native focusability', () => {
  const b = mount()
  b.view.rerender(<EffortSlider {...b.props} pending />)
  expect(b.slider.getAttribute('aria-disabled')).toBe('true')
  expect(b.slider.disabled).toBe(false)
  fireEvent.change(b.slider, { target: { value: '2' } })
  expect(b.onSelect).not.toHaveBeenCalled()
})
