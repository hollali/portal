import dotenv from 'dotenv'
import path from 'path'
dotenv.config({ path: path.resolve(process.cwd(), '.env') })

import { PrismaClient } from '../src/generated/prisma/client'
import { PrismaNeon } from '@prisma/adapter-neon'
import axios from 'axios'
import * as cheerio from 'cheerio'
import fs from 'fs'
import crypto from 'crypto'
import { execSync } from 'child_process'

const MEDIA_ROOT = '/home/hollali/Projects/WebScrapper/osint_bagbin_enhanced'
const QUERY = 'Alban Sumana Kingsford Bagbin'
const DELAY_MS = 1000

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)) }

async function downloadFile(url: string, dest: string): Promise<boolean> {
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
    await new Promise((resolve, reject) => {
      writer.on('finish', resolve)
      writer.on('error', reject)
    })
    const size = fs.statSync(dest).size
    if (size < 1024) { fs.unlinkSync(dest); return false }
    return true
  } catch { return false }
}

// ── Images via Bing ──────────────────────────────────────────────
async function scrapeImages() {
  console.log('\n=== Scraping Images ===')
  let count = 0

  const searchQueries = [
    QUERY,
    'Speaker of Parliament Alban Bagbin',
    'Alban Sumana Bagbin portrait',
    'Rt Hon Alban Kingsford Bagbin',
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

      // Method 1: Bing's iusc elements (same as Python scraper)
      $('a.iusc').each((_, el) => {
        const m = $(el).attr('m')
        if (!m) return
        try {
          const parsed = JSON.parse(m.replace(/&quot;/g, '"').replace(/&#39;/g, "'"))
          if (parsed.murl) urls.add(parsed.murl)
        } catch {}
      })

      // Method 2: JSON-LD
      $('script[type="application/ld+json"]').each((_, el) => {
        try {
          const parsed = JSON.parse($(el).text())
          const arr = Array.isArray(parsed) ? parsed : [parsed]
          for (const item of arr) {
            if (item.contentUrl) urls.add(item.contentUrl)
            if (item.thumbnailUrl) urls.add(item.thumbnailUrl)
          }
        } catch {}
      })

      // Method 3: Direct img src
      $('img').each((_, el) => {
        const src = $(el).attr('src')
        if (src && src.startsWith('http') && !src.includes('bing.net')) urls.add(src)
      })

      // Method 4: Parse inline JSON for murl patterns
      const text = data
      const murlRegex = /"murl"\s*:\s*"([^"]+)"/g
      let m
      while ((m = murlRegex.exec(text)) !== null) {
        urls.add(m[1].replace(/\\u0026/g, '&'))
      }

      console.log(`  Bing "${q.slice(0, 40)}": ${urls.size} URLs`)

      for (const imgUrl of [...urls].slice(0, 40)) {
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
    } catch (err: any) {
      console.error(`  Error: ${err.message}`)
    }
  }

  console.log(`  Done: ${count} new images`)
  return count
}

// ── News via RSS ─────────────────────────────────────────────────
async function scrapeNews() {
  console.log('\n=== Scraping News ===')
  let count = 0

  const rssFeeds = [
    `https://news.google.com/rss/search?q=${encodeURIComponent(QUERY)}&hl=en-GH&gl=GH`,
    `https://news.google.com/rss/search?q=${encodeURIComponent('Speaker Alban Bagbin')}&hl=en-GH&gl=GH`,
    `https://www.bing.com/news/search?q=${encodeURIComponent(QUERY)}&format=rss`,
    `https://www.bing.com/news/search?q=${encodeURIComponent('Speaker of Parliament Ghana Bagbin')}&format=rss`,
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
        const source = $(el).find('source').text().trim() || $(el).find('news\\:source').text().trim() || 'News'
        const pubDate = $(el).find('pubDate').text().trim()
        const desc = $(el).find('description').text().trim()
        if (title && link) {
          articles.push({ title, url: link, source, date: pubDate, snippet: desc })
        }
      })

      console.log(`  RSS: ${articles.length} articles`)

      for (const art of articles.slice(0, 20)) {
        await sleep(DELAY_MS)
        const existing = await prisma.news.findUnique({ where: { url: art.url } })
        if (existing) continue

        const filename = `${crypto.createHash('md5').update(art.url).digest('hex').slice(0, 10)}.html`
        const localPath = path.join(MEDIA_ROOT, 'news', filename)
        let snippet = art.snippet.slice(0, 300)

        try {
          const artRes = await axios.get(art.url, {
            timeout: 8000,
            headers: { 'User-Agent': 'Mozilla/5.0' }
          })
          fs.writeFileSync(localPath, artRes.data)
          const art$ = cheerio.load(artRes.data)
          art$('meta[name="description"]').each((_, el) => {
            const c = art$(el).attr('content') || ''
            if (c.length > snippet.length) snippet = c.slice(0, 300)
          })
          if (!snippet) {
            snippet = art$.find('p').first().text().slice(0, 300).trim()
          }
        } catch {
          fs.writeFileSync(localPath, JSON.stringify(art, null, 2))
          if (!snippet) snippet = art.title
        }

        await prisma.news.create({
          data: {
            source: 'RSS',
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
    } catch (err: any) {
      console.error(`  Error: ${err.message}`)
    }
  }

  console.log(`  Done: ${count} new articles`)
  return count
}

// ── Videos via yt-dlp ────────────────────────────────────────────
function ytSearch(query: string, maxResults: number = 30) {
  try {
    const cmd = `yt-dlp --flat-playlist --dump-json "ytsearch${maxResults}:${query}" 2>/dev/null`
    const out = execSync(cmd, { timeout: 30000, encoding: 'utf-8' })
    return out.trim().split('\n').filter(Boolean).map(line => {
      try { return JSON.parse(line) } catch { return null }
    }).filter(Boolean)
  } catch { return [] }
}

async function scrapeVideos() {
  console.log('\n=== Scraping Videos ===')
  let count = 0

  const queries = [
    QUERY,
    'Speaker of Parliament Alban Bagbin',
    'Alban Sumana Kingsford Bagbin interview',
    'Rt Hon Alban Kingsford Bagbin',
  ]

  for (const q of queries) {
    await sleep(DELAY_MS)
    console.log(`  Searching YouTube for: "${q.slice(0, 50)}"`)
    const results = ytSearch(q)
    console.log(`  Found ${results.length} results`)

    for (const v of results) {
      const url = `https://youtube.com/watch?v=${v.id}`
      if (!v.id || !v.title) continue

      const existing = await prisma.video.findUnique({ where: { url } })
      if (existing) continue

      await prisma.video.create({
        data: {
          source: 'YouTube',
          platform: 'youtube',
          title: v.title || 'Unknown',
          url,
          channel: v.channel || v.uploader || 'Unknown',
          views: v.view_count || 0,
          duration: v.duration || 0,
          collectedAt: new Date().toISOString(),
        }
      })
      count++
    }
    console.log(`  → ${count} new so far`)
  }

  console.log(`  Done: ${count} new videos`)
  return count
}

// ── Audio via yt-dlp ─────────────────────────────────────────────
async function scrapeAudio() {
  console.log('\n=== Scraping Audio ===')
  let count = 0

  const queries = [
    `"Alban Bagbin" interview audio`,
    `"Alban Sumana Bagbin" speech`,
    `"Speaker Bagbin" podcast`,
    `"Alban Kingsford Bagbin" press conference`,
  ]

  for (const q of queries) {
    await sleep(DELAY_MS)
    console.log(`  Searching audio for: "${q.slice(0, 50)}"`)
    const results = ytSearch(q)
    console.log(`  Found ${results.length} results`)

    for (const v of results) {
      const url = `https://youtube.com/watch?v=${v.id}`
      if (!v.id || !v.title) continue

      const existing = await prisma.audio.findUnique({ where: { url } })
      if (existing) continue

      await prisma.audio.create({
        data: {
          source: 'YouTube',
          query: q,
          title: v.title || 'Unknown',
          url,
          artist: v.channel || v.uploader || 'Unknown',
          duration: String(v.duration || 0),
          collectedAt: new Date().toISOString(),
        }
      })
      count++
    }
    console.log(`  → ${count} new so far`)
  }

  console.log(`  Done: ${count} new audio entries`)
  return count
}

// ── Main ─────────────────────────────────────────────────────────
async function main() {
  console.log('Starting Alban Bagbin media scraper (v2)...')
  for (const dir of ['images', 'news', 'videos', 'audio']) {
    const p = path.join(MEDIA_ROOT, dir)
    if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true })
  }

  const startTotals = {
    images: await prisma.image.count(),
    videos: await prisma.video.count(),
    news: await prisma.news.count(),
    audio: await prisma.audio.count(),
  }
  console.log(`Current DB totals:`, startTotals)

  const added = {
    images: await scrapeImages(),
    news: await scrapeNews(),
    videos: await scrapeVideos(),
    audio: await scrapeAudio(),
  }

  console.log('\n' + '=' * 50)
  console.log('FINAL SUMMARY')
  console.log('=' * 50)
  for (const [k, v] of Object.entries(added)) {
    const total = await (prisma as any)[k.substring(0, k.length - 1) === k ? k : k.replace(/s$/, '') === k ? k : (
      k === 'images' ? prisma.image :
      k === 'videos' ? prisma.video :
      k === 'news' ? prisma.news :
      k === 'audio' ? prisma.audio : null
    )].count()
    // a simpler approach:
  }

  for (const table of ['image', 'video', 'news', 'audio'] as const) {
    const total = await (prisma as any)[table].count()
    const key = table === 'image' ? 'images' : table === 'video' ? 'videos' : table + 's'
    console.log(`${key.padEnd(8)}: +${(added as any)[key]} new (${total} total)`)
  }

  await prisma.$disconnect()
  console.log('Done!')
}

main().catch(err => { console.error(err); process.exit(1) })
