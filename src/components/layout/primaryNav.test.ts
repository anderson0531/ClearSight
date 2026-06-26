import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { buildPrimaryNav } from '@/components/layout/primaryNav'

describe('buildPrimaryNav', () => {
  it('shows Premium upgrade for Free plan', () => {
    const keys = buildPrimaryNav('FREE').map((item) => item.key)
    assert.deepEqual(keys, ['navHome', 'navSearch', 'navLibrary', 'navPremium'])
  })

  it('shows On-Demand for Premium plan', () => {
    const keys = buildPrimaryNav('PREMIUM').map((item) => item.key)
    assert.deepEqual(keys, ['navHome', 'navSearch', 'navLibrary', 'navOnDemand'])
  })

  it('shows On-Demand and Studio for Creator plan', () => {
    const keys = buildPrimaryNav('CREATOR').map((item) => item.key)
    assert.deepEqual(keys, [
      'navHome',
      'navSearch',
      'navLibrary',
      'navOnDemand',
      'navStudio',
    ])
  })
})
