// web/src/utils/__tests__/validation.test.ts
import { describe, it, expect } from 'vitest'
import {
  isValidUrl,
  isValidDomain,
  validateWhitelist,
  validateNumber,
  validateApiKey,
  validateProvider
} from '../validation'

describe('isValidUrl', () => {
  it('should return true for valid http URLs', () => {
    expect(isValidUrl('http://example.com')).toBe(true)
    expect(isValidUrl('http://example.com/path')).toBe(true)
  })

  it('should return true for valid https URLs', () => {
    expect(isValidUrl('https://example.com')).toBe(true)
    expect(isValidUrl('https://example.com/path')).toBe(true)
  })

  it('should return false for invalid URLs', () => {
    expect(isValidUrl('')).toBe(false)
    expect(isValidUrl('ftp://example.com')).toBe(false)
    expect(isValidUrl('example.com')).toBe(false)
    expect(isValidUrl('not a url')).toBe(false)
  })

  it('should return false for empty or whitespace strings', () => {
    expect(isValidUrl('')).toBe(false)
    expect(isValidUrl('   ')).toBe(false)
  })
})

describe('isValidDomain', () => {
  it('should return true for valid domains', () => {
    expect(isValidDomain('example.com')).toBe(true)
    expect(isValidDomain('sub.example.com')).toBe(true)
    expect(isValidDomain('test.co.uk')).toBe(true)
  })

  it('should return true for localhost', () => {
    expect(isValidDomain('localhost')).toBe(true)
    expect(isValidDomain('localhost:3001')).toBe(true)
  })

  it('should return true for valid IP addresses', () => {
    expect(isValidDomain('192.168.1.1')).toBe(true)
    expect(isValidDomain('10.0.0.1')).toBe(true)
    expect(isValidDomain('127.0.0.1')).toBe(true)
  })

  it('should return false for invalid domains', () => {
    expect(isValidDomain('')).toBe(false)
    expect(isValidDomain('not a domain')).toBe(false)
    expect(isValidDomain('example')).toBe(false)
    expect(isValidDomain('256.256.256.256')).toBe(false)
  })

  it('should handle case sensitivity', () => {
    expect(isValidDomain('EXAMPLE.COM')).toBe(true)
    expect(isValidDomain('Example.Com')).toBe(true)
  })
})

describe('validateWhitelist', () => {
  it('should return valid for empty string', () => {
    const result = validateWhitelist('')
    expect(result.valid).toBe(true)
    expect(result.domains).toEqual([])
  })

  it('should return valid for whitespace-only string', () => {
    const result = validateWhitelist('   ')
    expect(result.valid).toBe(true)
    expect(result.domains).toEqual([])
  })

  it('should validate single domain', () => {
    const result = validateWhitelist('example.com')
    expect(result.valid).toBe(true)
    expect(result.domains).toEqual(['example.com'])
  })

  it('should validate multiple domains', () => {
    const result = validateWhitelist('example.com, api.example.com, test.com')
    expect(result.valid).toBe(true)
    expect(result.domains).toEqual(['example.com', 'api.example.com', 'test.com'])
  })

  it('should handle extra whitespace', () => {
    const result = validateWhitelist(' example.com , api.example.com , test.com ')
    expect(result.valid).toBe(true)
    expect(result.domains).toEqual(['example.com', 'api.example.com', 'test.com'])
  })

  it('should include URLs as well as domains', () => {
    const result = validateWhitelist('https://api.example.com, example.com')
    expect(result.valid).toBe(true)
    expect(result.domains).toEqual(['https://api.example.com', 'example.com'])
  })

  it('should return invalid for invalid domain', () => {
    const result = validateWhitelist('example.com, not-a-domain, test.com')
    expect(result.valid).toBe(false)
    expect(result.error).toContain('Invalid domains')
  })
})

describe('validateNumber', () => {
  it('should return valid for valid numbers', () => {
    const result = validateNumber('42')
    expect(result.valid).toBe(true)
    expect(result.value).toBe(42)
  })

  it('should return invalid for empty string', () => {
    const result = validateNumber('')
    expect(result.valid).toBe(false)
    expect(result.error).toBe('Value is required')
  })

  it('should return invalid for non-numeric string', () => {
    const result = validateNumber('not a number')
    expect(result.valid).toBe(false)
    expect(result.error).toBe('Must be a valid number')
  })

  it('should enforce minimum value', () => {
    const result = validateNumber('5', 10)
    expect(result.valid).toBe(false)
    expect(result.error).toBe('Must be at least 10')
  })

  it('should enforce maximum value', () => {
    const result = validateNumber('100', 1, 50)
    expect(result.valid).toBe(false)
    expect(result.error).toBe('Must be at most 50')
  })

  it('should accept numbers within range', () => {
    const result = validateNumber('25', 10, 50)
    expect(result.valid).toBe(true)
    expect(result.value).toBe(25)
  })

  it('should handle negative numbers', () => {
    const result = validateNumber('-5')
    expect(result.valid).toBe(true)
    expect(result.value).toBe(-5)
  })

  it('should handle decimal numbers', () => {
    const result = validateNumber('3.14')
    expect(result.valid).toBe(true)
    expect(result.value).toBe(3) // parseInt is used
  })
})

describe('validateApiKey', () => {
  it('should return valid for valid API key', () => {
    const result = validateApiKey('sk-1234567890abcdef')
    expect(result.valid).toBe(true)
  })

  it('should return invalid for empty string', () => {
    const result = validateApiKey('')
    expect(result.valid).toBe(false)
    expect(result.error).toBe('API key is required')
  })

  it('should return invalid for whitespace-only string', () => {
    const result = validateApiKey('   ')
    expect(result.valid).toBe(false)
    expect(result.error).toBe('API key is required')
  })

  it('should return invalid for short API key', () => {
    const result = validateApiKey('short')
    expect(result.valid).toBe(false)
    expect(result.error).toBe('API key is too short')
  })

  it('should return invalid for API key with spaces', () => {
    const result = validateApiKey('sk-123 456')
    expect(result.valid).toBe(false)
    expect(result.error).toBe('API key contains invalid characters')
  })

  it('should return invalid for API key with newlines', () => {
    const result = validateApiKey('sk-123\n456')
    expect(result.valid).toBe(false)
    expect(result.error).toBe('API key contains invalid characters')
  })

  it('should return invalid for API key with tabs', () => {
    const result = validateApiKey('sk-123\t456')
    expect(result.valid).toBe(false)
    expect(result.error).toBe('API key contains invalid characters')
  })
})

describe('validateProvider', () => {
  it('should return valid for allowed provider', () => {
    const result = validateProvider('anthropic', ['anthropic', 'openai', 'ollama'])
    expect(result.valid).toBe(true)
  })

  it('should return invalid for disallowed provider', () => {
    const result = validateProvider('invalid', ['anthropic', 'openai', 'ollama'])
    expect(result.valid).toBe(false)
    expect(result.error).toBe('Invalid provider')
  })

  it('should return invalid for empty provider', () => {
    const result = validateProvider('', ['anthropic', 'openai'])
    expect(result.valid).toBe(false)
  })

  it('should be case-sensitive', () => {
    const result = validateProvider('Anthropic', ['anthropic', 'openai'])
    expect(result.valid).toBe(false)
  })

  it('should handle single allowed provider', () => {
    const result = validateProvider('openai', ['openai'])
    expect(result.valid).toBe(true)
  })
})
