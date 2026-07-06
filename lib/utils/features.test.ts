import { describe, expect, it } from 'vitest'
import { isEnabled } from './features'

describe('isEnabled', () => {
  it('returns true for enabled features', () => {
    const org = { features: { members: true, budget: true } }
    expect(isEnabled(org, 'members')).toBe(true)
    expect(isEnabled(org, 'budget')).toBe(true)
  })

  it('returns false for disabled features', () => {
    const org = { features: { members: true, rush: false } }
    expect(isEnabled(org, 'rush')).toBe(false)
  })

  it('returns false for missing features', () => {
    const org = { features: { members: true } }
    expect(isEnabled(org, 'elections')).toBe(false)
  })

  it('returns false for empty features', () => {
    const org = { features: {} }
    expect(isEnabled(org, 'members')).toBe(false)
  })
})
