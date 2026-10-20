import { describe, expect, it } from 'vitest'
import { POST } from '@/app/(public)/api/ask/link/route'

const post = async (body: unknown) =>
  POST(
    new Request('https://example.test/api/ask/link', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }) as never,
  )

describe('POST /api/ask/link', () => {
  it.each([null, [], { url: 42 }])('rejects malformed body %j', async body => {
    const response = await post(body)
    expect(response.status).toBe(400)
  })

  it('rejects a private address rather than fetching it', async () => {
    const response = await post({ url: 'http://127.0.0.1/' })
    expect(response.status).toBe(400)
    expect((await response.json()).error).toMatch(/public web page/i)
  })

  it('rejects a non-web scheme', async () => {
    const response = await post({ url: 'file:///etc/passwd' })
    expect(response.status).toBe(400)
    expect((await response.json()).error).toMatch(/http and https/i)
  })
})
