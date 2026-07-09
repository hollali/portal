import dotenv from 'dotenv'
import path from 'path'
dotenv.config({ path: path.resolve(process.cwd(), '.env') })

import { PrismaClient } from '../src/generated/prisma/client'
import { PrismaNeon } from '@prisma/adapter-neon'
import bcrypt from 'bcryptjs'
import Database from 'better-sqlite3'

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

type PrismaModel = {
  createMany: (args: { data: Record<string, unknown>[]; skipDuplicates?: boolean }) => Promise<unknown>
  create: (args: { data: Record<string, unknown> }) => Promise<unknown>
}

async function main() {
  console.log('Seeding database...')

  const existing = await prisma.user.findUnique({ where: { username: 'admin' } })
  if (!existing) {
    const password = await bcrypt.hash('admin123', 12)
    await prisma.user.create({
      data: { username: 'admin', email: 'admin@example.com', password, isAdmin: true },
    })
    console.log('Admin user created: admin / admin123')
  } else {
    console.log('Admin user already exists')
  }

  const sqlitePath = path.resolve(process.cwd(), '../WebScrapper/osint_bagbin_enhanced/osint_enhanced.db')
  try {
    const sqlite = new Database(sqlitePath)
    console.log('Migrating data from SQLite...')

    const tables = ['images', 'videos', 'news', 'audio'] as const
    for (const table of tables) {
      const rows = sqlite.prepare(`SELECT * FROM ${table}`).all() as Record<string, unknown>[]
      if (rows.length === 0) {
        console.log(`  ${table}: 0 rows (skipping)`)
        continue
      }

      const modelMap: Record<string, PrismaModel> = { images: prisma.image, videos: prisma.video, news: prisma.news, audio: prisma.audio }
      const model = modelMap[table]

      const batch: Record<string, unknown>[] = []
      for (const row of rows) {
        const data: Record<string, unknown> = {}
        for (const [key, val] of Object.entries(row)) {
          if (key === 'id') continue
          const camelKey = key.replace(/_([a-z])/g, (_, c) => c.toUpperCase())
          data[camelKey] = val
        }
        batch.push(data)
      }

      const BATCH_SIZE = 100
      let imported = 0
      for (let i = 0; i < batch.length; i += BATCH_SIZE) {
        const chunk = batch.slice(i, i + BATCH_SIZE)
        try {
          await model.createMany({ data: chunk, skipDuplicates: true })
          imported += chunk.length
        } catch {
          for (const item of chunk) {
            try { await model.create({ data: item }); imported++ } catch { }
          }
        }
      }
      console.log(`  ${table}: ${imported}/${rows.length} rows imported`)
    }

    sqlite.close()
  } catch (err) {
    console.log('No SQLite database found or error reading it:', err)
  }

  console.log('Done!')
  await prisma.$disconnect()
}

main().catch(console.error)
