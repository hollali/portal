import 'dotenv/config'
import fs from 'fs'
import path from 'path'
import { prisma } from '/home/hollali/Projects/portal/src/lib/prisma'

const NEWS_DIR = path.join(process.cwd(), 'public/media/news')

async function main() {
  const rows = await prisma.news.findMany({
    where: { localPath: { not: null } },
    select: { id: true, localPath: true, url: true, title: true, rawHtml: true },
  })

  let stored = 0
  let already = 0
  let missing = 0

  for (const row of rows) {
    if (!row.localPath || !row.localPath.includes(`${path.sep}media${path.sep}news`)) continue
    if (row.rawHtml) {
      already++
      continue
    }
    const full = path.isAbsolute(row.localPath) ? row.localPath : path.join(process.cwd(), row.localPath)
    if (!fs.existsSync(full)) {
      missing++
      console.log(`SKIP missing file: #${row.id} ${row.localPath}`)
      continue
    }
    const content = fs.readFileSync(full, 'utf8')
    await prisma.news.update({ where: { id: row.id }, data: { rawHtml: content } })
    stored++
  }

  const files = fs.readdirSync(NEWS_DIR).filter(f => f.endsWith('.html'))
  const fileRows = rows.filter(r => r.rawHtml || (r.localPath && files.includes(path.basename(r.localPath))))
  console.log(`News rows pointing into media/news: ${fileRows.length}`)
  console.log(`stored rawHtml: ${stored}`)
  console.log(`already had rawHtml: ${already}`)
  console.log(`skipped (file missing): ${missing}`)
}

main().finally(() => prisma.$disconnect())