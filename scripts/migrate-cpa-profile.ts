import dotenv from 'dotenv'
import path from 'path'
dotenv.config({ path: path.resolve(process.cwd(), '.env') })

import { PrismaClient } from '../src/generated/prisma/client'
import { PrismaNeon } from '@prisma/adapter-neon'
import fs from 'fs'

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

const SOURCE_URL = 'https://www.cpaafricaregion.or.tz/profile.php?d=63'
const QUERY = 'Alban Bagbin CPA Africa Region Member Profile'
const MEDIA_DIR = '/home/hollali/Projects/portal/public/media/news'

async function migrateNews() {
  console.log('\n=== Migrating CPA Africa Region Profile as News ===')

  const contentPath = path.join(MEDIA_DIR, 'cpa-africa-region-profile.md')
  const content = fs.readFileSync(contentPath, 'utf-8')

  const existing = await prisma.news.findUnique({ where: { url: SOURCE_URL } })
  if (existing) {
    console.log('  Skipped (exists): CPA Africa Region Profile')
    return 0
  }

  await prisma.news.create({
    data: {
      source: 'CPA Africa Region',
      query: QUERY,
      title: 'CPA Africa Region Member Profile - Rt. Hon. Alban Bagbin',
      url: SOURCE_URL,
      sourceName: 'Commonwealth Parliamentary Association - Africa Region',
      date: new Date().toISOString(),
      snippet: 'Rt. Hon. Alban Bagbin, Rep. West Africa. Responsibility: CSPOC Standing Committee. Branch: Ghana (West Africa).',
      localPath: contentPath,
      collectedAt: new Date().toISOString(),
    }
  })
  console.log('  Added: CPA Africa Region Profile')
  return 1
}

async function main() {
  console.log('Starting CPA Africa Region profile migration...')

  const newsCount = await migrateNews()

  console.log('\n' + '='.repeat(50))
  console.log('MIGRATION SUMMARY')
  console.log('='.repeat(50))
  console.log(`News:   +${newsCount} new`)

  const totals = {
    news: await prisma.news.count(),
  }
  console.log(`\nTotal news in DB: ${totals.news}`)

  await prisma.$disconnect()
  console.log('Done!')
}

main().catch(err => { console.error(err); process.exit(1) })
