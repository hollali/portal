import dotenv from 'dotenv'
import path from 'path'
dotenv.config({ path: path.resolve(process.cwd(), '.env') })

import { PrismaClient } from '../src/generated/prisma/client'
import { PrismaNeon } from '@prisma/adapter-neon'

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

const OCCASIONS: Record<string, string> = {
  'Statement on the Ghana Poverty Reduction Strategy': 'Budget debate',
  'Address on the State of the Nation': 'State of the Nation address',
  'Remarks at the Opening of the 2nd Meeting of the 8th Parliament': 'Opening of Parliament',
  'The Legislature and the Imperative of Independence': 'International conference',
  'Digital Democracy and the Modern Parliament': 'Conference address',
  'One-on-One with the Speaker on the 8th Parliament': 'Media engagement',
  'Notice Recalling Parliament from Recess': 'Official notice',
  'Letter to the President on National Security': 'Official correspondence',
}

const VIDEO_CATEGORIES = ['Parliamentary speeches', 'Interviews', 'International engagements', 'Conferences', 'Parliamentary events', 'Documentaries']
const AUDIO_CATEGORIES = ['Speeches', 'Interviews', 'Radio programmes', 'Parliamentary addresses']

function classify(text: string, primary: string, extra: { re: RegExp; cat: string }[]): string {
  const t = (text || '').toLowerCase()
  for (const { re, cat } of extra) {
    if (re.test(t)) return cat
  }
  return primary
}

const VIDEO_RULES = [
  { re: /interview|one-on-one|one on one|conversation|chat with/i, cat: 'Interviews' },
  { re: /documentary|profile|the story of|biography/i, cat: 'Documentaries' },
  { re: /conference|summit|seminar|workshop|cpa|ipu|annual meeting/i, cat: 'Conferences' },
  { re: /visit to|official visit|in (nigeria|south africa|kenya|the uk|foreign|benin|togo)/i, cat: 'International engagements' },
  { re: /speaker|parliament|parliamentary|session|address|statement|debate|opening|house/i, cat: 'Parliamentary speeches' },
]

const AUDIO_RULES = [
  { re: /radio|fm|morning|programme|program|show/i, cat: 'Radio programmes' },
  { re: /interview|one-on-one|one on one|conversation|chat with/i, cat: 'Interviews' },
  { re: /address|statement|parliament|parliamentary|speech|debate/i, cat: 'Parliamentary addresses' },
]

async function main() {
  let u = 0
  for (const [title, occ] of Object.entries(OCCASIONS)) {
    const res = await prisma.archiveItem.updateMany({ where: { title }, data: { occasion: occ } })
    u += res.count
  }
  console.log(`Archive occasions backfilled: ${u} rows`)

  const videos = await prisma.video.findMany({ where: { category: null }, select: { id: true, title: true } })
  for (const v of videos) {
    const cat = classify(v.title || '', 'Parliamentary events', VIDEO_RULES)
    await prisma.video.update({ where: { id: v.id }, data: { category: cat } })
  }
  console.log(`Videos categorised: ${videos.length}`)

  const audio = await prisma.audio.findMany({ where: { category: null }, select: { id: true, title: true } })
  for (const a of audio) {
    const cat = classify(a.title || '', 'Speeches', AUDIO_RULES)
    await prisma.audio.update({ where: { id: a.id }, data: { category: cat } })
  }
  console.log(`Audio categorised: ${audio.length}`)

  await prisma.$disconnect()
}

main().catch(e => { console.error(e); process.exit(1) })