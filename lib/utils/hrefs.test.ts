import { describe, expect, it } from 'vitest'
import { buildGroupHref } from './hrefs'

const path = { parentSlug: 'sigma-nu', orgSlug: 'epsilon-theta', groupSlug: 'chapter' }

describe('buildGroupHref', () => {
  it('joins the group path with the feature path', () => {
    expect(buildGroupHref(path, '/requirements')).toBe(
      '/sigma-nu/epsilon-theta/chapter/requirements'
    )
  })

  it('normalizes a missing leading slash', () => {
    expect(buildGroupHref(path, 'polls')).toBe('/sigma-nu/epsilon-theta/chapter/polls')
  })

  it('keeps nested feature paths intact', () => {
    expect(buildGroupHref(path, '/requirements/abc-123')).toBe(
      '/sigma-nu/epsilon-theta/chapter/requirements/abc-123'
    )
  })
})
