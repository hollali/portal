import dotenv from 'dotenv'
import path from 'path'
dotenv.config({ path: path.resolve(process.cwd(), '.env') })

import { PrismaClient } from '../src/generated/prisma/client'
import { PrismaNeon } from '@prisma/adapter-neon'
import bcrypt from 'bcryptjs'
import Database from 'better-sqlite3'
import { DEFAULT_SECTIONS } from '../src/lib/content'
import { normalizeSlug } from '../src/lib/library'

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

type PrismaModel = {
  createMany: (args: { data: Record<string, unknown>[]; skipDuplicates?: boolean }) => Promise<unknown>
  create: (args: { data: Record<string, unknown> }) => Promise<unknown>
}

const SEED_ARCHIVE_ITEMS = [
  {
    kind: 'speech',
    title: 'Statement on the Ghana Poverty Reduction Strategy',
    date: '2003-06-19',
    year: 2003,
    event: 'Budget and poverty debate',
    location: 'Parliament House, Accra',
    institution: 'Parliament of Ghana',
    parliament: '3rd Parliament, 4th Republic',
    theme: 'Poverty reduction',
    venue: 'Chamber of Parliament',
    source: 'Hansard — Parliament of Ghana',
    excerpt: 'A parliamentary statement urging that poverty reduction strategy documents be matched with community-level implementation and accountability.',
    body: `## On poverty strategy

*Mr. Speaker*, it has become fashionable to speak of poverty-reduction strategies and comprehensive development frameworks. But a strategy is not a strategy when it lives only in a document.

The poor of Sombo do not read strategy papers. They feel the soil under their feet, they weigh the cost of their children's schoolbooks, and they measure government by the distance to the nearest clinic.

I propose that this House ask, not what the strategy says, but what has changed at the level of the community that is supposed to benefit.`,
    featured: true,
  },
  {
    kind: 'speech',
    title: 'Address on the State of the Nation',
    date: '2021-03-09',
    year: 2021,
    event: 'State of the Nation debate',
    location: 'Parliament House, Accra',
    institution: 'Parliament of Ghana',
    parliament: '8th Parliament, 4th Republic',
    theme: 'National development',
    venue: 'Chamber of Parliament',
    source: 'Hansard — Parliament of Ghana',
    excerpt: 'Speaker Bagbin alone has delivered messages on the state of the nation in the absence of the President, defending the constitutional balance between the Executive and Parliament.',
    body: `## The state of the nation

*Mr. Speaker*, in the absence of the President, the Constitution commits to this House the solemn duty of receiving a message on the state of the nation.

We take this duty seriously, not for ourselves, but for the people who sent us here. Their nation is not an abstraction — it is their farm, their school, their water tank, their hospital.`,
    featured: true,
  },
  {
    kind: 'speech',
    title: 'Remarks at the Opening of the 2nd Meeting of the 8th Parliament',
    date: '2022-02-17',
    year: 2022,
    event: 'Second sitting of the 8th Parliament',
    location: 'Parliament House, Accra',
    institution: 'Parliament of Ghana',
    parliament: '8th Parliament, 4th Republic',
    theme: 'Parliamentary independence',
    venue: 'Chamber of Parliament',
    source: 'Hansard — Parliament of Ghana',
    excerpt: 'The Speaker’s opening remarks on the independence of Parliament as a separate and equal arm of government.',
    body: `## An independent arm of government

*Mr. Speaker*, history will be kind to a Parliament that puts the interest of the people first.

Let our debates be robust and our disagreements public — but let nothing undermine the standing of this House as an independent branch of government, determined to hold every other arm of the state to account.`,
    featured: false,
  },
  {
    kind: 'paper',
    title: 'The Legislature and the Imperative of Independence',
    date: '2022-05-20',
    year: 2022,
    event: 'Commonwealth Parliamentary Association forum',
    location: 'Accra, Ghana',
    institution: 'Commonwealth Parliamentary Association',
    theme: 'Parliamentary independence',
    venue: 'CPA Africa Region Conference',
    source: 'CPA Africa Region',
    excerpt: 'A public address on the doctrine of separation of powers in the Westminster tradition and the financing of legislatures.',
    body: `## Financing the legislature

A legislature that depends on the goodwill of the Executive for its budget cannot fully exercise oversight over that same Executive.

The experience of our own 8th Parliament has illuminated this truth. Parliamentary reform must therefore begin with predictable, independent funding for the institution.`,
    featured: true,
  },
  {
    kind: 'paper',
    title: 'Digital Democracy and the Modern Parliament',
    date: '2023-09-12',
    year: 2023,
    event: 'Conference on technology and governance',
    location: 'Accra, Ghana',
    institution: 'Parliament of Ghana',
    theme: 'Governance & technology',
    venue: 'Parliament of Ghana',
    source: 'Parliament of Ghana',
    excerpt: 'Reflections on how digital tools can bring the citizen closer to the law-making process without eroding parliamentary procedure.',
    body: `## Technology and the people's House

The citizen who once followed our proceedings by radio now follows them on a phone. This is an opportunity, not a threat.

But technology must not replace procedure. It must widen the door of the people's House, not change the key.`,
    featured: false,
  },
  {
    kind: 'interview',
    title: 'One-on-One with the Speaker on the 8th Parliament',
    date: '2021-12-15',
    year: 2021,
    event: 'Year-end media engagement',
    location: 'Accra, Ghana',
    source: 'Graphic Online',
    sourceUrl: 'https://www.graphic.com.gh',
    theme: 'Parliamentary independence',
    venue: 'Parliament House, Accra',
    excerpt: 'An interview touching on the leadership of an unprecedented evenly-balanced Parliament and the duties of the Speaker.',
    body: `## The Speaker in his own words

**Interviewer:** You have described the 8th Parliament as unique in the history of the Fourth Republic. What does that uniqueness demand of you?

**Speaker Bagbin:** It demands that I be fair to every member, every caucus and every cause. The balance is not a difficulty to be managed away — it is the will of the people, and it must be respected.

**Interviewer:** Your ruling on the Speaker in the majority caucus was historic.

**Speaker Bagbin:** I did not make the ruling as Alban Bagbin. I made it as the servant of the Constitution and the standing orders of this House.`,
    featured: true,
  },
  {
    kind: 'note',
    title: 'Notice Recalling Parliament from Recess',
    date: '2022-11-29',
    year: 2022,
    event: 'Emergency recall of Parliament',
    location: 'Parliament House, Accra',
    institution: 'Parliament of Ghana',
    parliament: '8th Parliament, 4th Republic',
    theme: 'Parliamentary independence',
    venue: 'Chamber of Parliament',
    source: 'Parliament of Ghana',
    excerpt: 'The bare notice by which the Speaker recalled an adjourned House, and the constitutional doctrine behind a Speaker’s power to do so.',
    body: `## Recall of the House

By this notice, the Rt. Hon. Speaker recalls the House of the 8th Parliament of the Fourth Republic of Ghana from its adjournment.

The Constitution vests the power of recall in the Speaker as the head of the legislature. In exercising it, the Speaker acts on the authority of the House and for the business of the nation.`,
    featured: false,
  },
  {
    kind: 'letter',
    title: 'Letter to the President on National Security',
    date: '2022-12-06',
    year: 2022,
    event: 'Response to the President’s correspondence on national security',
    location: 'Accra, Ghana',
    institution: 'Presidency of Ghana',
    parliament: '8th Parliament, 4th Republic',
    theme: 'National security',
    source: 'Parliament of Ghana',
    excerpt: 'Historical letter exchanged between the Speaker and the President on national security matters, showing the constitutional dialogue between two arms of government.',
    body: `## On the national security agenda

Excellency, the House takes the security of the nation with the seriousness it deserves, and stands ready to consider expeditiously any matter committed to it.

Our letters reflect a healthy state: two arms of government, each committed to the Constitution, corresponding in the interest of the people.`,
    featured: false,
  },
]

const SEED_MILESTONES = [
  { year: '1957', category: 'early-life', title: 'Birth in the Upper West Region', description: 'Alban Sumana Kingsford Bagbin is born on 24 September 1957, fourth of nine children of Sansunni and Margaret Bagbin, in the Dagaaba community of the Upper West Region.', order: 1 },
  { year: '1969', category: 'education', title: 'Wa Secondary School', description: 'Begins secondary education at Wa Secondary School in his home region — where the story often told is that he was admitted into Form Two, out of awe of his size and age.', order: 1 },
  { year: '1973', category: 'education', title: 'Tamale Secondary School', description: 'Completes his secondary education at Tamale Secondary School in the Northern Region.', order: 2 },
  { year: '1977', category: 'education', title: 'University of Ghana, Legon', description: 'Admitted to the University of Ghana where he will read Law and English.', order: 3 },
  { year: '1980', category: 'education', title: 'Bachelor of Arts, Law & English', description: 'Graduates with a BA in Law and English, then proceeds to the Ghana School of Law in Makola, Accra.', order: 4 },
  { year: '1982', category: 'education', title: 'Called to the Bar', description: 'Admitted to the Ghanaian Bar after passing out of the Ghana School of Law, beginning a career in law and public service.', order: 5 },
  { year: '1983', category: 'career', title: 'Teaching in Tripoli, Libya', description: 'Serves as an English teacher in Tripoli (1983–86) before returning to private legal practice in Ghana.', order: 1 },
  { year: '1986', category: 'career', title: 'Joins Akyem Chambers', description: 'Returns to Ghana and joins Akyem Chambers, rising to become a partner in the Accra firm.', order: 2 },
  { year: '1993', category: 'career', title: 'Partner at the Law Trust Company', description: 'Becomes a partner at the Law Trust Company, practising corporate and commercial law alongside public duties.', order: 3 },
  { year: '1993', category: 'career', title: 'Elected to Parliament', description: 'First elected to the Parliament of Ghana as NDC MP for Nadowli, beginning a record of seven consecutive terms.', order: 4 },
  { year: '1997', category: 'career', title: 'Second term and growing influence', description: 'Re-elected; emerges as a leading voice in the House on governance, trade and the rights of the ordinary citizen.', order: 5 },
  { year: '1998', category: 'parliament', title: 'Majority Leader', description: 'Appointed Majority Leader of Parliament, leading the government’s business in the House.', order: 1 },
  { year: '2001', category: 'parliament', title: 'Minority Leader', description: 'Takes on the leadership of the Minority in Parliament after the change in government, sharpening his skills as a constitutional debater.', order: 2 },
  { year: '2009', category: 'career', title: 'Minister for Water Resources, Works and Housing', description: 'Appointed Minister and drives major reforms in water delivery and housing policy.', order: 6 },
  { year: '2010', category: 'career', title: 'Second Deputy Speaker', description: 'Elected Second Deputy Speaker of the 5th Parliament, returning to leadership within the House.', order: 7 },
  { year: '2017', category: 'parliament', title: 'Third Deputy Speaker', description: 'Elected Third Deputy Speaker of the 7th Parliament — a position he holds for the term.', order: 3 },
  { year: '2021', category: 'parliament', title: 'Speaker of the 8th Parliament', description: 'Elected Speaker of an unprecedented evenly-balanced 8th Parliament — a historic vindication of his independence and standing in the House.', order: 4 },
  { year: '2022', category: 'parliament', title: 'Ruling on the Speaker in the Majority Caucus', description: 'Resolves the leadership tussle in the House with a landmark ruling that the Speaker, when partisan, loses his presiding neutrality.', order: 5 },
  { year: '2023', category: 'parliament', title: 'Recalling Parliament and the Supreme Court', description: 'Exercises the power to recall an adjourned House — a first in the Fourth Republic — and offers the doormat of the sanctity of the House to the highest court.', order: 6 },
  { year: '2025', category: 'career', title: 'A statesman and a political figure', description: 'By this period the accumulated milestones of a thirty-year parliamentary record are consolidated in this digital library.', order: 8 },
]

const SEED_TESTIMONIALS = [
  { author: 'Rt. Hon. Alban S. K. Bagbin', role: 'Speaker of Parliament (self-assessment)', quote: 'I am not a politician who is about to leave. I am a servant of the Constitution and of the people of Ghana, and I will continue to speak for them as long as I have breath.', year: 2022, sortOrder: 1 },
  { author: 'His Excellency Nana Addo Dankwa Akufo-Addo', role: 'President of the Republic of Ghana', quote: 'The election of a Speaker in this manner is a statement of the maturity of our democracy and the depth of our parliamentarians’ commitment to the Constitution.', year: 2021, sortOrder: 2 },
  { author: 'Members of the 8th Parliament', role: 'Bipartisan tribute', quote: 'In the Speaker’s impartiality and fairness, the House recognises a defender of its own independence.', year: 2022, sortOrder: 3 },
  { author: 'People of Sombo', role: 'Nadowli Kaleo constituency', quote: 'He came from our village, went to school on our bare feet, and never forgot the farm. That is why he represents us — and we send him back, term after term.', year: 2020, sortOrder: 4 },
]

function slugify(title: string, id: number): string {
  return `${normalizeSlug(title)}-${id}`
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

  console.log('Seeding homepage content sections...')
  for (const [key, data] of Object.entries(DEFAULT_SECTIONS)) {
    await prisma.contentSection.upsert({
      where: { key },
      create: { key, title: key, data: JSON.stringify(data), status: 'published' },
      update: {},
    })
  }
  console.log(`  ${Object.keys(DEFAULT_SECTIONS).length} sections ensured (existing left untouched)`)

  const existingArchive = await prisma.archiveItem.count()
  if (existingArchive === 0) {
    console.log('Seeding Digital Library placeholder content...')

    const archiveData = SEED_ARCHIVE_ITEMS.map((item, i) => ({
      ...item,
      slug: slugify(item.title, i + 1),
      status: 'published' as const,
    }))
    await prisma.archiveItem.createMany({ data: archiveData })
    console.log(`  ${archiveData.length} archive items seeded`)

    await prisma.milestone.createMany({ data: SEED_MILESTONES as Array<Record<string, unknown>> })
    console.log(`  ${SEED_MILESTONES.length} milestones seeded`)

    await prisma.testimonial.createMany({ data: SEED_TESTIMONIALS as Array<Record<string, unknown>> })
    console.log(`  ${SEED_TESTIMONIALS.length} testimonials seeded`)
  } else {
    console.log('Skipping library seed: archive items already exist')
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
