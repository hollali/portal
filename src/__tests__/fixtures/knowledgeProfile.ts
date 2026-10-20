import type { KnowledgeProfile } from '@/lib/askKnowledge'

export const knowledgeProfile: KnowledgeProfile = {
  hero: {
    eyebrow: 'Rt. Hon. · Speaker of the Parliament of Ghana',
    name: 'Alban Sumana Kingsford Bagbin',
    displayName: 'Rt. Hon. Alban Bagbin',
    description:
      'Ghanaian lawyer, statesman and legislator — elected Speaker of the 8th Parliament in 2021 and re-elected in 2025.',
    portraitUrl: '/images/bagbin-speaker.jpg',
    portraitAlt: 'Alban Bagbin',
    profileLabel: 'Incumbent since',
    profileValue: '7 January 2021',
    facts: [{ value: '7 terms', label: 'Member of Parliament' }],
  },
  biography: {
    heading: 'A legislator for seven parliaments.',
    intro:
      'Alban Sumana Kingsford Bagbin was born on 24 September 1957 to Sansunni Bagbin and Margaret B. Bagbin, both peasant farmers — the fourth of nine children. A member of the Dagaaba ethnic group, he hails from Sombo in the Upper West Region of Ghana.',
    cards: [
      {
        tag: 'Education',
        text: 'Attended Wa Secondary School and Tamale Secondary School. Earned a Bachelor of Arts in Law and English at the University of Ghana (1980), trained at the Ghana School of Law, and was called to the bar in 1982.',
      },
      {
        tag: 'Career',
        text: 'Acting secretary to the Statistical Service Board (1980–82), English teacher in Tripoli, Libya, and a partner at the Law Trust company since 1993.',
      },
      {
        tag: 'Personal life',
        text: 'Married to Alice Adjua Yornas Bagbin, a Programme Officer at the UNICEF Office in Ghana. He is a Christian and worships as a Roman Catholic.',
      },
    ],
  },
  timeline: {
    heading: 'Thirty years of parliamentary service.',
    subheading: 'From constituency MP to the Speaker’s chair.',
    entries: [
      { year: '1992', title: 'Elected to Parliament', text: 'Won the Nadowli North seat on the NDC ticket.' },
      { year: '2001', title: 'Minority Leader', text: 'Served as Minority Leader from 2001 to 2009.' },
      { year: '2021', title: 'Speaker of Parliament', text: 'Elected Speaker of the 8th Parliament.' },
      { year: '2025', title: 'Re-elected Speaker', text: 'Retained as Speaker of the 9th Parliament.' },
    ],
  },
  man: {
    heroTitleA: 'The life of a',
    heroTitleAccent: 'servant-leader',
    heroIntro: 'Four chapters trace the man behind the Speaker’s chair.',
    heroQuote: 'Born a fourth of nine children to peasant farmers.',
    sections: [
      {
        id: 'early-life',
        eyebrow: '01',
        title: 'Early Life',
        intro: 'Born into a farming family in the Upper West Region.',
        items: [
          { title: 'Childhood', text: 'Growing up in a large farming household, he learned the disciplines of chores, school and community.' },
          { title: 'Sombo', text: 'He hails from Sombo, a rural community in the Upper West Region.' },
        ],
      },
      {
        id: 'values',
        eyebrow: '04',
        title: 'Personal Values',
        intro: 'The convictions that have guided his public life.',
        items: [
          { title: 'Leadership philosophy', text: 'Bagbin believes leadership is service and that institutions outlive individuals.' },
        ],
      },
    ],
  },
  rulings: {
    items: [
      { tag: 'Independence', title: 'A Speaker for the whole House', note: 'He declared himself the servant of the entire membership.' },
      { tag: 'Constitutional power', title: 'Recalling the House', note: 'Recalled an adjourned Parliament under Article 112(3).' },
    ],
  },
  themes: [
    {
      slug: 'parliamentary-independence',
      name: 'Parliamentary Independence',
      motto: 'The House belongs to the people.',
      description: 'A defining theme of his Speakership.',
    },
  ],
  institutions: ['Parliament of Ghana', 'National Democratic Congress', 'University of Ghana'],
  subject: {
    party: 'National Democratic Congress (NDC)',
    constituency: 'Nadowli West',
    role: 'Speaker of Parliament of Ghana',
    roleStart: '2021-01-07',
  },
  milestones: [
    { year: '1957', title: 'Birth in the Upper West Region', description: 'Born on 24 September 1957.', category: 'early-life' },
  ],
  testimonials: [],
  events: [
    {
      startDate: '2025-10-19',
      type: 'IPU Africa Group Chairperson election',
      description: 'Elected Chairperson of the IPU Africa Group.',
      attribution: 'Speaker',
    },
  ],
  researchSourceCount: 61,
  researchEventCount: 48,
}
