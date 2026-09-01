import { describe, it, expect } from 'vitest'
import { classNames } from './utils'
import { parseError } from './errorHandler'

describe('classNames', () => {
  it('joins class names', () => {
    expect(classNames('foo', 'bar')).toBe('foo bar')
  })

  it('filters falsy values', () => {
    const falsy = false
    expect(classNames('foo', falsy && 'bar', 'baz')).toBe('foo baz')
  })
})

describe('parseError', () => {
  it('extracts Error.message', () => {
    expect(parseError(new Error('test'))).toBe('test')
  })

  it('returns string as-is', () => {
    expect(parseError('direct error')).toBe('direct error')
  })

  it('returns fallback for unknown', () => {
    expect(parseError(42)).toBe('Error desconocido')
  })
})
