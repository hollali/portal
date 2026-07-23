import dotenv from 'dotenv'
import path from 'path'
dotenv.config({ path: path.resolve(process.cwd(), '.env') })

import { PrismaClient } from '../src/generated/prisma/client'
import { PrismaNeon } from '@prisma/adapter-neon'
import fs from 'fs'

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

const SOURCE_URL = 'https://alumni.ug.edu.gh/alumni-spotlight'
const QUERY = 'Alban Sumana Kingsford Bagbin Alumni Spotlight'
const MEDIA_DIR = '/home/hollali/Projects/portal/public/media/alumni-spotlight'

async function migrateImages() {
  console.log('\n=== Migrating Images ===')
  
  const images = [
    {
      source: 'UGAA Alumni Spotlight',
      query: QUERY,
      url: 'https://alumni.ug.edu.gh/sites/default/files/2024-10/images%20%281%29.jpeg?fid=50',
      localPath: path.join(MEDIA_DIR, 'alban-bagbin-spotlight.jpeg'),
    },
    {
      source: 'UGAA Logo',
      query: 'UGAA Logo',
      url: 'https://alumni.ug.edu.gh/sites/default/files/LOGO_0%20%282%29.jpg',
      localPath: path.join(MEDIA_DIR, 'ugaa-logo.jpg'),
    },
  ]

  let count = 0
  for (const img of images) {
    try {
      const existing = await prisma.image.findUnique({ where: { url: img.url } })
      if (existing) {
        console.log(`  Skipped (exists): ${img.url}`)
        continue
      }

      await prisma.image.create({
        data: {
          source: img.source,
          query: img.query,
          url: img.url,
          localPath: img.localPath,
          collectedAt: new Date().toISOString(),
        }
      })
      count++
      console.log(`  Added: ${img.url}`)
    } catch (err: any) {
      console.error(`  Error adding ${img.url}: ${err.message}`)
    }
  }
  console.log(`  Done: ${count} new images`)
  return count
}

async function migrateNews() {
  console.log('\n=== Migrating Alumni Spotlight as News ===')
  
  const content = fs.readFileSync(path.join(MEDIA_DIR, 'alumni-spotlight-content.md'), 'utf-8')
  
  const existing = await prisma.news.findUnique({ where: { url: SOURCE_URL } })
  if (existing) {
    console.log('  Skipped (exists): Alumni Spotlight')
    return 0
  }

  await prisma.news.create({
    data: {
      source: 'UGAA Website',
      query: QUERY,
      title: 'Alumni Spotlight - Rt. Hon. Kingsford Alban Sumana Bagbin',
      url: SOURCE_URL,
      sourceName: 'University of Ghana Alumni Association',
      date: new Date().toISOString(),
      snippet: 'Alban Bagbin is the current Speaker of Parliament. Born on September 24, 1957 at Sombo in the Upper West Region...',
      localPath: path.join(MEDIA_DIR, 'alumni-spotlight-content.md'),
      collectedAt: new Date().toISOString(),
    }
  })
  console.log('  Added: Alumni Spotlight')
  return 1
}

async function main() {
  console.log('Starting Alumni Spotlight database migration...')
  
  const imageCount = await migrateImages()
  const newsCount = await migrateNews()
  
  console.log('\n' + '='.repeat(50))
  console.log('MIGRATION SUMMARY')
  console.log('='.repeat(50))
  console.log(`Images: +${imageCount} new`)
  console.log(`News:   +${newsCount} new`)
  
  const totals = {
    images: await prisma.image.count(),
    news: await prisma.news.count(),
  }
  console.log(`\nTotal images in DB: ${totals.images}`)
  console.log(`Total news in DB: ${totals.news}`)
  
  await prisma.$disconnect()
  console.log('Done!')
}

main().catch(err => { console.error(err); process.exit(1) })
