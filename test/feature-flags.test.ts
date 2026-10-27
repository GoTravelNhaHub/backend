import assert from 'node:assert/strict'
import { test } from 'node:test'
import { communityEnabled, flagEnabled } from '../src/shared/utils/feature-flags'

test('missing or blank flags use the fallback', () => {
  assert.equal(flagEnabled(undefined, false), false)
  assert.equal(flagEnabled(null, true), true)
  assert.equal(flagEnabled('  ', false), false)
})

test('off-like strings disable, anything else enables', () => {
  for (const value of ['false', 'FALSE', '0', 'off', ' no ']) assert.equal(flagEnabled(value, true), false, value)
  for (const value of ['true', '1', 'on', 'yes']) assert.equal(flagEnabled(value, false), true, value)
  assert.equal(flagEnabled(true, false), true)
  assert.equal(flagEnabled(false, true), false)
})

test('community is off unless explicitly enabled', () => {
  assert.equal(communityEnabled(undefined), false)
  assert.equal(communityEnabled({}), false)
  assert.equal(communityEnabled({ enableCommunity: 'false' }), false)
  assert.equal(communityEnabled({ enableCommunity: 'true' }), true)
})
