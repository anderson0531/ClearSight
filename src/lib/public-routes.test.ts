import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { isPublicApi, isPublicPage } from '@/lib/public-routes'

describe('public-routes', () => {
  it('allows welcome and auth pages without session', () => {
    assert.equal(isPublicPage('/welcome'), true)
    assert.equal(isPublicPage('/login'), true)
    assert.equal(isPublicPage('/signup'), true)
    assert.equal(isPublicPage('/forgot-password'), true)
    assert.equal(isPublicPage('/'), false)
    assert.equal(isPublicPage('/discover'), false)
    assert.equal(isPublicPage('/embed/abc'), false)
  })

  it('allows auth bootstrap APIs without session', () => {
    assert.equal(isPublicApi('/api/auth/login'), true)
    assert.equal(isPublicApi('/api/me'), true)
    assert.equal(isPublicApi('/api/stories/x'), false)
  })

  it('allows public channel intro GET for marketing hero', () => {
    assert.equal(isPublicApi('/api/channels/clearsight-brief/intro', 'GET'), true)
    assert.equal(isPublicApi('/api/channels/clearsight-brief/intro', 'POST'), false)
  })
})
