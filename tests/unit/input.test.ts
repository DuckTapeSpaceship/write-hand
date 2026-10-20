import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { classifyPress, LONG_PRESS_MS, LongPressTracker } from '../../src/lib/input/longpress'
import { touchPolicyFor } from '../../src/lib/input/mode.svelte'

describe('long-press vs tap', () => {
  it('classifies presses', () => {
    expect(classifyPress(80, 0, true)).toBe('tap') // the dot on an i
    expect(classifyPress(300, 2, true)).toBe('tap')
    expect(classifyPress(600, 3, false)).toBe('long')
    expect(classifyPress(600, 3, true)).toBe('tap') // lifted before the timer saw it
    expect(classifyPress(600, 10, false)).toBe('drag')
    expect(classifyPress(100, 20, true)).toBe('drag')
  })

  describe('tracker', () => {
    beforeEach(() => vi.useFakeTimers())
    afterEach(() => vi.useRealTimers())

    it('fires after the hold time when the pointer stays put', () => {
      const fire = vi.fn()
      const t = new LongPressTracker(fire)
      t.start(10, 10, 0)
      t.move(12, 13)
      vi.advanceTimersByTime(LONG_PRESS_MS - 1)
      expect(fire).not.toHaveBeenCalled()
      vi.advanceTimersByTime(1)
      expect(fire).toHaveBeenCalledOnce()
      expect(t.end(LONG_PRESS_MS + 50)).toBe('long')
    })

    it('does not fire when the pointer moves (a stroke)', () => {
      const fire = vi.fn()
      const t = new LongPressTracker(fire)
      t.start(0, 0, 0)
      t.move(10, 0)
      vi.advanceTimersByTime(1000)
      expect(fire).not.toHaveBeenCalled()
      expect(t.end(1000)).toBe('drag')
    })

    it('a quick lift is a tap and never fires', () => {
      const fire = vi.fn()
      const t = new LongPressTracker(fire)
      t.start(0, 0, 0)
      expect(t.end(90)).toBe('tap')
      vi.advanceTimersByTime(1000)
      expect(fire).not.toHaveBeenCalled()
    })
  })
})

describe('input mode rule', () => {
  it('maps devices to finger behaviour', () => {
    expect(touchPolicyFor({ penSeen: false, phone: true, finger: 'auto' })).toBe('tap')
    expect(touchPolicyFor({ penSeen: false, phone: false, finger: 'auto' })).toBe('draw')
    expect(touchPolicyFor({ penSeen: true, phone: false, finger: 'auto' })).toBe('tap')
    expect(touchPolicyFor({ penSeen: true, phone: false, finger: 'draw' })).toBe('draw')
    expect(touchPolicyFor({ penSeen: false, phone: false, finger: 'view' })).toBe('tap')
  })
})
