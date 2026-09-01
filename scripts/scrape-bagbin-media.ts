import dotenv from 'dotenv'
import path from 'path'
dotenv.config({ path: path.resolve(process.cwd(), '.env') })

import { PrismaClient } from '../src/generated/prisma/client'
import { PrismaNeon } from '@prisma/adapter-neon'
import axios from 'axios'
import * as cheerio from 'cheerio'
import fs from 'fs'
import crypto from 'crypto'

const MEDIA_ROOT = '/home/hollali/Projects/portal/public/media'
const QUERY = 'Alban Sumana Kingsford Bagbin'
const DELAY_MS = 1500

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)) }

class RateLimiter {
  private queue: Array<{ resolve: () => void }> = []
  private processing = false

  constructor(private maxPerSecond: number = 5) {}

  async acquire() {
    return new Promise<void>(resolve => {
      this.queue.push({ resolve })
      this.process()
    })
  }

  private async process() {
    if (this.processing) return
    this.processing = true
    while (this.queue.length > 0) {
      const batch = this.queue.splice(0, this.maxPerSecond)
      batch.forEach(item => item.resolve())
      if (this.queue.length > 0) await sleep(1000)
    }
    this.processing = false
  }
}

const rateLimiter = new RateLimiter(3)

async function downloadFile(url: string, dest: string): Promise<boolean> {
  await rateLimiter.acquire()
  try {
    const res = await axios.get(url, {
      responseType: 'stream', timeout: 20000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': 'https://www.bing.com/',
      }
    })
    const writer = fs.createWriteStream(dest)
    res.data.pipe(writer)
    await new Promise<void>((resolve, reject) => {
      writer.on('finish', () => resolve())
      writer.on('error', reject)
    })
    const size = fs.statSync(dest).size
    if (size < 1024) { fs.unlinkSync(dest); return false }
    return true
  } catch { return false }
}

// ── Images via Bing ──────────────────────────────────────────────
async function scrapeImages() {
  console.log('\n=== Scraping Images from Bing ===')
  let count = 0

  const searchQueries = [
    QUERY,
    'Speaker of Parliament Alban Bagbin',
    'Alban Sumana Bagbin portrait',
    'Rt Hon Alban Kingsford Bagbin',
    'Alban Bagbin Ghana Parliament',
  ]

  for (const q of searchQueries) {
    await sleep(DELAY_MS * 2)
    try {
      const url = `https://www.bing.com/images/search?q=${encodeURIComponent(q)}&count=35&form=HDRSC2`
      const { data } = await axios.get(url, {
        timeout: 15000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept-Language': 'en-US,en;q=0.9',
        }
      })

      const $ = cheerio.load(data)
      const urls = new Set<string>()

      $('a.iusc').each((_, el) => {
        const m = $(el).attr('m')
        if (!m) return
        try {
          const parsed = JSON.parse(m.replace(/&quot;/g, '"').replace(/&#39;/g, "'"))
          if (parsed.murl) urls.add(parsed.murl)
        } catch {}
      })

      const text = data
      const murlRegex = /"murl"\s*:\s*"([^"]+)"/g
      let m
      while ((m = murlRegex.exec(text)) !== null) {
        urls.add(m[1].replace(/\\u0026/g, '&'))
      }

      console.log(`  Bing "${q.slice(0, 40)}": ${urls.size} URLs`)

      for (const imgUrl of [...urls].slice(0, 25)) {
        await sleep(DELAY_MS)
        const existing = await prisma.image.findUnique({ where: { url: imgUrl } })
        if (existing) continue

        const clean = imgUrl.split('?')[0].split('#')[0]
        const ext = path.extname(clean) || '.jpg'
        const hash = crypto.createHash('md5').update(imgUrl).digest('hex').slice(0, 10)
        const filename = `Bing_${hash}${ext}`
        const localPath = path.join(MEDIA_ROOT, 'images', filename)

        if (await downloadFile(imgUrl, localPath)) {
          await prisma.image.create({
            data: {
              source: 'Bing',
              query: q,
              url: imgUrl,
              localPath,
              collectedAt: new Date().toISOString(),
            }
          })
          count++
          process.stdout.write(`  [${count}] ✓\r`)
        }
      }
    } catch (err: unknown) {
      console.error(`  Error: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  console.log(`  Done: ${count} new images`)
  return count
}

// ── News via Bing ────────────────────────────────────────────────
async function scrapeNews() {
  console.log('\n=== Scraping News from Bing ===')
  let count = 0

  const newsQueries = [
    QUERY,
    'Speaker Alban Bagbin Ghana',
    'Alban Bagbin Parliament',
    'Alban Bagbin NDC',
  ]

  for (const q of newsQueries) {
    await sleep(DELAY_MS * 2)
    try {
      const url = `https://www.bing.com/news/search?q=${encodeURIComponent(q)}&count=20&format=rss`
      const { data } = await axios.get(url, {
        timeout: 15000,
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
      })

      const $ = cheerio.load(data, { xmlMode: true })
      const articles: Array<{ title: string; url: string; source: string; date: string; snippet: string }> = []

      $('item').each((_, el) => {
        const title = $(el).find('title').text().trim()
        const link = $(el).find('link').text().trim()
        const source = $(el).find('source').text().trim() || 'News'
        const pubDate = $(el).find('pubDate').text().trim()
        const desc = $(el).find('description').text().trim()
        if (title && link) {
          articles.push({ title, url: link, source, date: pubDate, snippet: desc })
        }
      })

      console.log(`  Bing News "${q.slice(0, 30)}": ${articles.length} articles`)

      for (const art of articles.slice(0, 15)) {
        await sleep(DELAY_MS)
        const existing = await prisma.news.findUnique({ where: { url: art.url } })
        if (existing) continue

        const filename = `${crypto.createHash('md5').update(art.url).digest('hex').slice(0, 10)}.html`
        const localPath = path.join(MEDIA_ROOT, 'news', filename)
        let snippet = art.snippet.replace(/<[^>]*>/g, '').slice(0, 300)

        try {
          const artRes = await axios.get(art.url, {
            timeout: 8000,
            headers: { 'User-Agent': 'Mozilla/5.0' }
          })
          fs.writeFileSync(localPath, artRes.data)
          const art$ = cheerio.load(artRes.data)
          art$('meta[name="description"]').each((_, el) => {
            const c = art$(el).attr('content') || ''
            if (c.length > snippet.length) snippet = c.replace(/<[^>]*>/g, '').slice(0, 300)
          })
          if (!snippet) {
            snippet = art$('p').first().text().slice(0, 300).trim()
          }
        } catch {
          fs.writeFileSync(localPath, JSON.stringify(art, null, 2))
          if (!snippet) snippet = art.title
        }

        await prisma.news.create({
          data: {
            source: 'Bing News',
            query: q,
            title: art.title,
            url: art.url,
            sourceName: art.source,
            date: art.date || new Date().toISOString(),
            snippet: snippet || art.title,
            localPath,
            collectedAt: new Date().toISOString(),
          }
        })
        count++
        console.log(`  [${count}] ${art.title.slice(0, 60)}`)
      }
    } catch (err: unknown) {
      console.error(`  Error: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  console.log(`  Done: ${count} new articles`)
  return count
}

// ── News via Google RSS ──────────────────────────────────────────
async function scrapeGoogleNews() {
  console.log('\n=== Scraping Google News RSS ===')
  let count = 0

  const rssFeeds = [
    `https://news.google.com/rss/search?q=${encodeURIComponent(QUERY)}&hl=en-GH&gl=GH`,
    `https://news.google.com/rss/search?q=${encodeURIComponent('Speaker Alban Bagbin')}&hl=en-GH&gl=GH`,
  ]

  for (const feedUrl of rssFeeds) {
    await sleep(DELAY_MS * 2)
    try {
      const { data } = await axios.get(feedUrl, {
        timeout: 15000,
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
      })

      const $ = cheerio.load(data, { xmlMode: true })
      const articles: Array<{ title: string; url: string; source: string; date: string; snippet: string }> = []

      $('item').each((_, el) => {
        const title = $(el).find('title').text().trim()
        const link = $(el).find('link').text().trim()
        const source = $(el).find('source').text().trim() || 'Google News'
        const pubDate = $(el).find('pubDate').text().trim()
        const desc = $(el).find('description').text().trim()
        if (title && link) {
          articles.push({ title, url: link, source, date: pubDate, snippet: desc })
        }
      })

      console.log(`  Google RSS: ${articles.length} articles`)

      for (const art of articles.slice(0, 20)) {
        await sleep(DELAY_MS)
        const existing = await prisma.news.findUnique({ where: { url: art.url } })
        if (existing) continue

        const filename = `${crypto.createHash('md5').update(art.url).digest('hex').slice(0, 10)}.html`
        const localPath = path.join(MEDIA_ROOT, 'news', filename)
        let snippet = art.snippet.replace(/<[^>]*>/g, '').slice(0, 300)

        try {
          const artRes = await axios.get(art.url, {
            timeout: 8000,
            headers: { 'User-Agent': 'Mozilla/5.0' }
          })
          fs.writeFileSync(localPath, artRes.data)
          const art$ = cheerio.load(artRes.data)
          art$('meta[name="description"]').each((_, el) => {
            const c = art$(el).attr('content') || ''
            if (c.length > snippet.length) snippet = c.replace(/<[^>]*>/g, '').slice(0, 300)
          })
          if (!snippet) {
            snippet = art$('p').first().text().slice(0, 300).trim()
          }
        } catch {
          fs.writeFileSync(localPath, JSON.stringify(art, null, 2))
          if (!snippet) snippet = art.title
        }

        await prisma.news.create({
          data: {
            source: 'Google News',
            query: QUERY,
            title: art.title,
            url: art.url,
            sourceName: art.source,
            date: art.date || new Date().toISOString(),
            snippet: snippet || art.title,
            localPath,
            collectedAt: new Date().toISOString(),
          }
        })
        count++
        console.log(`  [${count}] ${art.title.slice(0, 60)}`)
      }
    } catch (err: unknown) {
      console.error(`  Error: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  console.log(`  Done: ${count} new articles`)
  return count
}

// ── Main ─────────────────────────────────────────────────────────
async function main() {
  console.log('Starting Alban Bagbin media scraper (Bing + Google News)...')
  
  for (const dir of ['images', 'news', 'videos', 'audio']) {
    const p = path.join(MEDIA_ROOT, dir)
    if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true })
  }

  const startTotals = {
    images: await prisma.image.count(),
    news: await prisma.news.count(),
  }
  console.log(`Current DB totals:`, startTotals)

  const added = {
    images: await scrapeImages(),
    news: await scrapeNews() + await scrapeGoogleNews(),
  }

  console.log('\n' + '='.repeat(50))
  console.log('FINAL SUMMARY')
  console.log('='.repeat(50))

  const finalImages = await prisma.image.count()
  const finalNews = await prisma.news.count()
  
  console.log(`Images: +${added.images} new (${finalImages} total)`)
  console.log(`News:   +${added.news} new (${finalNews} total)`)
  
  await prisma.$disconnect()
  console.log('Done!')
}

main().catch(err => { console.error(err); process.exit(1) })
