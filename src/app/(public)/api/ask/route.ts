import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { archiveRouteForKind } from '@/lib/library'

export const dynamic = 'force-dynamic'

interface Citation {
  kind: string
  title: string
  slug: string
  route: string
  year: number | null
  excerpt: string | null
}

const SUGGESTED = [
  'What has the Speaker said about democracy and the Constitution?',
  'What are the key speeches on parliamentary independence?',
  'Find the notice recalling Parliament',
  'What has been said about education and the youth?',
  'Speeches on health and social protection',
  'What is the Speaker\u2019s position on digitalisation?',
]

function snippet(text: string, max = 180): string {
  const clean = text.replace(/\s+/g, ' ').trim()
  if (clean.length <= max) return clean
  return clean.slice(0, max).replace(/\s+\S*$/, '') + '\u2026'
}

export async function POST(request: NextRequest) {
  let body: { messages?: { role?: string; content?: string }[] } = {}
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const last = [...(body.messages || [])].reverse().find(m => m.role === 'user')?.content
  const query = (last || '').trim().slice(0, 500)
  if (!query) {
    return NextResponse.json({ reply: 'Ask me anything about the archive \u2014 a speech, a letter, a theme or a period of the Speaker\u2019s career.', citations: [], suggested: SUGGESTED })
  }

  const where = {
    status: 'published',
    OR: [
      { title: { contains: query, mode: 'insensitive' as const } },
      { excerpt: { contains: query, mode: 'insensitive' as const } },
      { body: { contains: query, mode: 'insensitive' as const } },
      { event: { contains: query, mode: 'insensitive' as const } },
      { occasion: { contains: query, mode: 'insensitive' as const } },
      { location: { contains: query, mode: 'insensitive' as const } },
      { theme: { contains: query, mode: 'insensitive' as const } },
      { parliament: { contains: query, mode: 'insensitive' as const } },
    ],
  }

  const [docs, testimonials, milestones] = await Promise.all([
    prisma.archiveItem.findMany({ where, orderBy: [{ year: 'desc' }, { updatedAt: 'desc' }], take: 6 }),
    prisma.testimonial.findMany({
      where: { status: 'published', OR: [{ quote: { contains: query, mode: 'insensitive' } }, { author: { contains: query, mode: 'insensitive' } }] },
      orderBy: [{ sortOrder: 'asc' }, { year: 'desc' }],
      take: 3,
    }),
    prisma.milestone.findMany({
      where: { status: 'published', OR: [{ title: { contains: query, mode: 'insensitive' } }, { description: { contains: query, mode: 'insensitive' } }] },
      orderBy: [{ year: 'asc' }],
      take: 3,
    }),
  ])

  const citations: Citation[] = docs.map(d => ({
    kind: d.kind,
    title: d.title,
    slug: d.slug,
    route: archiveRouteForKind(d.kind),
    year: d.year,
    excerpt: snippet(d.excerpt || d.body || d.title),
  }))

  const docLines = docs.map((d, i) =>
    `\n${i + 1}. **${d.title}**${d.year ? ` (${d.year})` : ''} \u2014 see /archives/${archiveRouteForKind(d.kind)}/${d.slug}`
  ).join('')

  const testiLines = testimonials.map(t => `\n- \u201c${snippet(t.quote, 120)}\u201d \u2014 ${t.author}${t.role ? `, ${t.role}` : ''}`).join('')
  const mileLines = milestones.map(m => `\n- **${m.year}** \u2014 ${m.title}`).join('')

  const totalHits = docs.length + testimonials.length + milestones.length

  let reply: string
  if (totalHits === 0) {
    reply = `I searched the live archive for \u201c${query}\u201d and could not find a direct match yet. The library is still being digitised. Try a single topic \u2014 democracy, the Constitution, Parliament, governance, education, youth, women, health, Africa or digitalisation \u2014 or browse the collections under /archives.`
  } else {
    const sections: string[] = []
    if (docs.length) sections.push(`Here is what the archive holds on \u201c${query}\u201d:${docLines}`)
    if (milestones.length) sections.push(`\nFrom the timeline:${mileLines}`)
    if (testimonials.length) sections.push(`\nWhat others have said:${testiLines}`)
    if (docs.some(d => d.body)) sections.push(`\nSelect any item above to read its full transcript, watch related video, listen to the audio or download the PDF.`)
    else sections.push(`\nFull transcripts are being digitised. Each item above links to the archive index where it lives.`)
    reply = sections.join('\n')
  }

  return NextResponse.json({ reply, citations, suggested: SUGGESTED })
}