import assert from 'node:assert/strict'
import test from 'node:test'
import {
  STUCK_GENERATION_ILLUSTRATIONS_MS,
  STUCK_GENERATION_QUEUED_MS,
  STUCK_GENERATION_RUNNING_MS,
  isStuckGeneration,
  stuckGenerationReason,
} from '@/lib/generation-stuck-constants'

test('stuckGenerationReason flags queued jobs waiting too long', () => {
  const now = Date.now()
  const row = {
    status: 'QUEUED',
    stage: 'queued',
    createdAt: new Date(now - STUCK_GENERATION_QUEUED_MS - 1000),
    updatedAt: new Date(now - STUCK_GENERATION_QUEUED_MS - 1000),
  }
  assert.equal(stuckGenerationReason(row), 'stuck_queued')
  assert.equal(isStuckGeneration(row), true)
})

test('stuckGenerationReason flags running jobs with stale updates', () => {
  const now = Date.now()
  const row = {
    status: 'RUNNING',
    stage: 'audio',
    createdAt: new Date(now - STUCK_GENERATION_RUNNING_MS - 60_000),
    updatedAt: new Date(now - STUCK_GENERATION_RUNNING_MS - 1000),
  }
  assert.equal(stuckGenerationReason(row), 'stuck_running')
})

test('stuckGenerationReason flags illustration passes with stale updates', () => {
  const now = Date.now()
  const row = {
    status: 'COMPLETED',
    stage: 'illustrations',
    createdAt: new Date(now - STUCK_GENERATION_ILLUSTRATIONS_MS - 120_000),
    updatedAt: new Date(now - STUCK_GENERATION_ILLUSTRATIONS_MS - 1000),
  }
  assert.equal(stuckGenerationReason(row), 'stuck_illustrations')
})

test('stuckGenerationReason ignores active running jobs', () => {
  const now = Date.now()
  assert.equal(
    stuckGenerationReason({
      status: 'RUNNING',
      stage: 'script',
      createdAt: new Date(now - 60_000),
      updatedAt: new Date(now - 30_000),
    }),
    null
  )
})
