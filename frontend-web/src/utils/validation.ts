// web/src/utils/validation.ts

/**
 * URL validation - checks if string is a valid URL
 */
export function isValidUrl(url: string): boolean {
  if (!url || url.trim() === '') return false

  try {
    const urlObj = new URL(url.trim())
    return ['http:', 'https:'].includes(urlObj.protocol)
  } catch {
    return false
  }
}

/**
 * Domain validation - checks if string is a valid domain
 */
export function isValidDomain(domain: string): boolean {
  if (!domain || domain.trim() === '') return false

  const trimmed = domain.trim().toLowerCase()

  // Simple domain validation regex
  const domainRegex = /^([a-z0-9]+(-[a-z0-9]+)*\.)+[a-z]{2,}$/

  // Allow localhost
  if (trimmed === 'localhost') return true
  if (trimmed === 'localhost:3001') return true

  // Allow IP addresses
  const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/
  if (ipRegex.test(trimmed)) {
    const parts = trimmed.split('.').map(Number)
    return parts.every(part => part >= 0 && part <= 255)
  }

  return domainRegex.test(trimmed)
}

/**
 * Validate whitelist - array of domains/URLs
 */
export function validateWhitelist(value: string): { valid: boolean; domains: string[]; error?: string } {
  if (!value || value.trim() === '') {
    return { valid: true, domains: [] }
  }

  const domains = value
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)

  const invalidDomains = domains.filter(d => !isValidDomain(d) && !isValidUrl(d))

  if (invalidDomains.length > 0) {
    return {
      valid: false,
      domains,
      error: `Invalid domains: ${invalidDomains.join(', ')}`
    }
  }

  return { valid: true, domains }
}

/**
 * Validate number input
 */
export function validateNumber(value: string, min?: number, max?: number): { valid: boolean; value: number; error?: string } {
  if (!value || value.trim() === '') {
    return { valid: false, value: 0, error: 'Value is required' }
  }

  const num = parseInt(value, 10)

  if (isNaN(num)) {
    return { valid: false, value: 0, error: 'Must be a valid number' }
  }

  if (min !== undefined && num < min) {
    return { valid: false, value: num, error: `Must be at least ${min}` }
  }

  if (max !== undefined && num > max) {
    return { valid: false, value: num, error: `Must be at most ${max}` }
  }

  return { valid: true, value: num }
}

/**
 * Validate API key format
 */
export function validateApiKey(key: string): { valid: boolean; error?: string } {
  if (!key || key.trim() === '') {
    return { valid: false, error: 'API key is required' }
  }

  const trimmed = key.trim()

  // Check minimum length
  if (trimmed.length < 10) {
    return { valid: false, error: 'API key is too short' }
  }

  // Check for suspicious patterns
  if (trimmed.includes(' ') || trimmed.includes('\n') || trimmed.includes('\t')) {
    return { valid: false, error: 'API key contains invalid characters' }
  }

  return { valid: true }
}

/**
 * Validate provider selection
 */
export function validateProvider(provider: string, allowedProviders: string[]): { valid: boolean; error?: string } {
  if (!provider || !allowedProviders.includes(provider)) {
    return { valid: false, error: 'Invalid provider' }
  }

  return { valid: true }
}
