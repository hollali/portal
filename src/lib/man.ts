export interface ManSubItem {
  title: string
  text: string
}

export interface ManSection {
  id: string
  eyebrow: string
  title: string
  intro: string
  items: ManSubItem[]
}

export const MAN_SECTIONS: ManSection[] = [
  {
    id: 'early-life',
    eyebrow: '01',
    title: 'Early Life',
    intro:
      'Born into a farming family in the Upper West Region, Alban Bagbin’s beginnings were modest, but his home taught him the values of hard work, family and community that have defined his public life.',
    items: [
      {
        title: 'Birth',
        text: 'Alban Sumana Kingsford Bagbin was born on 24 September 1957 in the Upper West Region of Ghana.',
      },
      {
        title: 'Family background',
        text: 'He is the fourth of nine children of Sansunni Bagbin and Margaret B. Bagbin, both peasant farmers. He is a member of the Dagaaba ethnic group.',
      },
      {
        title: 'Childhood',
        text: 'Growing up in a large farming household, he learned early the disciplines of chores, school and community — and the dignity of rural life that he has championed throughout his career.',
      },
      {
        title: 'Sombo',
        text: 'He hails from Sombo, a rural community in the Upper West Region, which he has consistently represented and served in Parliament for seven consecutive terms.',
      },
      {
        title: 'Early education',
        text: 'His early schooling laid the foundations for a distinguished academic path, beginning with his enrolment at Wa Secondary School.',
      },
    ],
  },
  {
    id: 'education',
    eyebrow: '02',
    title: 'Education',
    intro:
      'A scholar as much as a statesman, Bagbin’s education moved him from the Upper West Region to the highest institutions of legal and governance training in Ghana.',
    items: [
      {
        title: 'Wa Secondary School',
        text: 'Bagbin began his senior secondary education at Wa Secondary School, in the Upper West Region.',
      },
      {
        title: 'Tamale Secondary School',
        text: 'He continued at Tamale Secondary School in the Northern Region, completing his secondary education there.',
      },
      {
        title: 'University of Ghana',
        text: 'In 1980 he earned a Bachelor of Arts degree in Law and English at the University of Ghana, Legon.',
      },
      {
        title: 'Ghana School of Law',
        text: 'He proceeded to the Ghana School of Law at Makola, Accra, and was called to the Bar in 1982.',
      },
      {
        title: 'GIMPA',
        text: 'Later in his career he completed an Executive Master’s in Governance and Leadership at the Ghana Institute of Management and Public Administration (GIMPA).',
      },
    ],
  },
  {
    id: 'professional-life',
    eyebrow: '03',
    title: 'Professional Life',
    intro:
      'Before and alongside Parliament, Bagbin has been a lawyer in private practice, with an early career in the public service that sharpened his managerial instincts.',
    items: [
      {
        title: 'Legal career',
        text: 'Called to the Bar in 1982, he combined an early public-service career — acting secretary to the Statistical Service Board (1980–82), personnel manager at the State Hotels Corporation (1982–83) and an English teacher in Tripoli, Libya (1983–86) — with the practice of law.',
      },
      {
        title: 'Akyem Chambers',
        text: 'On his return from Tripoli in 1986, he joined Akyem Chambers as an attorney, rising to become a partner in the firm.',
      },
      {
        title: 'Law Trust',
        text: 'Since 1993 he has been a partner at the Law Trust Company, where he has practised corporate and commercial law alongside his parliamentary duties.',
      },
    ],
  },
  {
    id: 'values',
    eyebrow: '04',
    title: 'Personal Values',
    intro:
      'The convictions that have guided thirty years at the centre of Ghanaian democracy — articulated in his own words as legislator, minister and Speaker.',
    items: [
      {
        title: 'Leadership philosophy',
        text: 'Bagbin believes leadership is service — that the people’s agenda, not the leader’s ambition, must come first, and that institutions outlive individuals.',
      },
      {
        title: 'Democracy',
        text: 'His entire parliamentary career has been anchored on the protection of the people’s mandate, free and fair elections, and the supremacy of the Constitution.',
      },
      {
        title: 'Justice',
        text: 'From his legal practice to his rulings in the Speaker’s chair, he has insisted that fairness, due process and equity underpin every decision.',
      },
      {
        title: 'Parliamentary independence',
        text: 'A defining theme of his Speakership is the independence of Parliament as a separate arm of government, exercising its own authority over the executive.',
      },
      {
        title: 'National development',
        text: 'His vision of development is rooted in the rural communities he came from — in health, education, water, housing and opportunity for the least advantaged citizen.',
      },
    ],
  },
]

export interface ArchiveLink {
  href: string
  label: string
  description: string
  count: string
}

export const ARCHIVE_LINKS: ArchiveLink[] = [
  { href: '/archives/speeches', label: 'Speeches', description: 'Parliamentary and public addresses, in his own words.', count: 'speeches' },
  { href: '/archives/papers', label: 'Public Papers', description: 'Policy essays, presentations and public writings.', count: 'papers' },
  { href: '/archives/interviews', label: 'Interviews', description: 'Interviews and press engagements on the issues of the day.', count: 'interviews' },
  { href: '/archives/notes', label: 'Notes & Correspondence', description: 'Memos and letters on key national issues, including notices recalling Parliament.', count: 'notes' },
  { href: '/archives/milestones', label: 'Milestones', description: 'The landmark moments of a thirty-year public career.', count: 'milestones' },
  { href: '/archives/testimonials', label: 'Testimonials', description: 'What prominent figures in Ghana and the world have said of him.', count: 'testimonials' },
  { href: '/archives/photos', label: 'Photo Library', description: 'Historical and current photographs, curated by year, event and theme.', count: 'photos' },
  { href: '/news', label: 'News Clippings', description: 'Press coverage from across the Ghanaian and international media.', count: 'news' },
  { href: '/videos', label: 'Videos', description: 'Speeches, interviews and moments captured on camera.', count: 'videos' },
  { href: '/audio', label: 'Audio', description: 'Radio interviews and audio recordings.', count: 'audio' },
]

export const SOCIAL_LINKS = [
  { label: 'Facebook', href: 'https://web.facebook.com/askbagbinofficial' },
  { label: 'X (Twitter)', href: 'https://twitter.com/askbagbin' },
  { label: 'Instagram', href: 'https://www.instagram.com/askbagbin' },
  { label: 'YouTube', href: 'https://www.youtube.com/@askbagbin' },
]