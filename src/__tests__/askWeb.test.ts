import { describe, expect, it, vi } from 'vitest'
import { WebFetchError, isPrivateAddress, pageTerms, pinnedLookup, validatePublicUrl } from '@/lib/askWeb'

describe('SSRF guard for reader-supplied links', () => {
  it.each([
    '127.0.0.1',
    '10.1.2.3',
    '172.16.0.1',
    '192.168.1.1',
    '169.254.169.254',
    '100.64.0.1',
    '224.0.0.1',
    '::1',
    'fc00::1',
    'fe80::1',
    '::ffff:127.0.0.1',
    '0:0:0:0:0:ffff:7f00:1',
    '64:ff9b::127.0.0.1',
  ])('refuses private address %s', address => {
    expect(isPrivateAddress(address)).toBe(true)
  })

  it.each(['8.8.8.8', '1.1.1.1', '2606:4700:4700::1111'])('allows public address %s', address => {
    expect(isPrivateAddress(address)).toBe(false)
  })

  it.each([
    'http://localhost/admin',
    'http://127.0.0.1:80/',
    'http://169.254.169.254/latest/meta-data',
    'http://[::1]/',
    'file:///etc/passwd',
    'ftp://example.com/file',
    'https://user:pass@example.com/',
    'http://example.com:8080/',
  ])('refuses unsafe link %s', async url => {
    await expect(validatePublicUrl(url)).rejects.toBeInstanceOf(WebFetchError)
  })
})


describe('pinnedLookup', () => {
  it('returns an array when caller asks for all addresses', () => {
    const callback = vi.fn()
    pinnedLookup('1.2.3.4', 4)('example.com', { all: true }, callback)
    expect(callback).toHaveBeenCalledWith(null, [{ address: '1.2.3.4', family: 4 }])
  })

  it('returns a single address otherwise', () => {
    const callback = vi.fn()
    pinnedLookup('1.2.3.4', 4)('example.com', {}, callback)
    expect(callback).toHaveBeenCalledWith(null, '1.2.3.4', 4)
  })
})


describe('pageTerms', () => {
  it('keeps content words that the archive treats as collection names', () => {
    expect(pageTerms('Who is the Speaker?')).toEqual(['speaker'])
  })

  it('drops question words and filler', () => {
    expect(pageTerms('What does this page say about education?')).toEqual(['education'])
  })
})
