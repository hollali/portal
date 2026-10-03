/**
 * The questions /ask has to answer, and what a good answer has to contain.
 *
 * Every case is a question a reader would plausibly type into the box, and every
 * expectation was written by reading the record it names — not by recording what
 * the search currently returns. That distinction is the whole point: a fixture
 * built from the pipeline's own output passes forever and measures nothing.
 *
 * Where a recording exists as both a video and an audio row under one headline,
 * both are listed and either satisfies the case. The two are the same recording
 * on two media, and a reader who asked about it has been answered by either one
 * — insisting on the audio row specifically would be asserting an implementation
 * detail (`rankCandidates` collapses same-titled rows across collections) rather
 * than a reader-visible requirement.
 *
 * The corpus behind these is small and uneven on purpose. Eight curated
 * documents carry the real prose; the other ~840 rows are scraped titles, so
 * questions about speeches are answerable in depth and questions about media are
 * answerable only as far as a headline goes. The cases are grouped the same way,
 * which means the report says which half of the archive is weak instead of
 * averaging the two into one number.
 *
 * Measure it against the live archive, and re-freeze the CI fixture:
 *
 *   npx tsx scripts/ask-eval.ts report
 *   npx tsx scripts/ask-eval.ts snapshot
 */

import { expectKeys, type GoldenCase } from '@/lib/askEval'

const documents = (titles: string[]) => expectKeys('documents', titles)
const videos = (titles: string[]) => expectKeys('videos', titles)
const audio = (titles: string[]) => expectKeys('audio', titles)
const news = (titles: string[]) => expectKeys('news', titles)
const milestones = (titles: string[]) => expectKeys('milestones', titles)
const testimonials = (titles: string[]) => expectKeys('testimonials', titles)

export const ASK_GOLDEN: GoldenCase[] = [
  /* ---------------------------------------------------------------------- */
  /* Curated documents — where the archive has prose to answer with          */
  /* ---------------------------------------------------------------------- */
  {
    id: 'doc-poverty-strategy',
    question: 'What did he say about poverty reduction?',
    expect: documents(['Statement on the Ghana Poverty Reduction Strategy']),
    mode: 'all',
    note: 'The only record on the theme, so it must lead rather than merely appear.',
  },
  {
    id: 'doc-poverty-strategy-gprs',
    question: 'Ghana Poverty Reduction Strategy',
    expect: documents(['Statement on the Ghana Poverty Reduction Strategy']),
    mode: 'all',
    note: 'The reader knows the policy name and not the archive’s title for it.',
  },
  {
    id: 'doc-recall-notice',
    question: 'Find the notice recalling Parliament',
    expect: documents(['Notice Recalling Parliament from Recess']),
    mode: 'all',
    note: 'Cited verbatim by the suggested-questions list, so it has to work.',
  },
  {
    id: 'doc-independence-paper',
    question: 'What are the key speeches on parliamentary independence?',
    expect: documents(['The Legislature and the Imperative of Independence']),
    note: 'A four-record theme. Any of the four is a correct answer; returning none is not.',
  },
  {
    id: 'doc-legislature-independence',
    question: 'What did he say about the independence of the legislature?',
    expect: documents(['The Legislature and the Imperative of Independence']),
    note: 'Phrase should carry “legislature” and “independence” in the same strong field.',
  },
  {
    id: 'doc-opening-8th',
    question: 'His remarks at the opening of the second meeting of the 8th Parliament',
    expect: documents(['Remarks at the Opening of the 2nd Meeting of the 8th Parliament']),
    note: 'Digits against words: “2nd” against “second” is a vocabulary question, not a typo.',
  },
  {
    id: 'doc-national-security-letter',
    question: 'Letter to the President on national security',
    expect: documents(['Letter to the President on National Security']),
    mode: 'all',
    note: 'The President is named nowhere in this question and must not be needed.',
  },
  {
    id: 'doc-state-of-nation',
    question: 'Address on the state of the nation',
    expect: documents(['Address on the State of the Nation']),
    note: 'Every word of this is a stopword except “address” and “nation”.',
  },
  {
    id: 'doc-digital-democracy',
    question: 'What is the Speaker position on digitalisation?',
    expect: documents(['Digital Democracy and the Modern Parliament']),
    note: 'Stops at the alias table for digitalisation, so this case measures the alias layer.',
  },
  {
    id: 'doc-one-on-one',
    question: 'One-on-one interview on the 8th Parliament',
    expect: documents(['One-on-One with the Speaker on the 8th Parliament']),
  },

  /* ---------------------------------------------------------------------- */
  /* News — headlines only, and the largest collection of distinct subject    */
  /* ---------------------------------------------------------------------- */
  {
    id: 'news-lgbtq-bill',
    question: 'What did he say about the anti-LGBTQ bill?',
    expect: news([
      'Bagbin: Passage of anti-LGBTQ+ Bill surprising - CitiNewsroom.com',
      'Speaker directs Parliament to reconsider anti-LGBTQ+ Bill again - Ghanaian Times - 3 Jun',
      'Bagbin: Anti-LGBTQ+ Bill can be reconsidered despite passage - CitiNewsroom.com - 11 Jun',
      "Bagbin: Anti-LGBTQ bill: 'It's not true that Parliament cannot reconsider a passed bill' — Speaker Bagbin - Modern Ghana - 11 Jun",
    ]),
    note: 'Many rows cover this story. Any one of them is right; which of them leads decides the rank.',
  },
  {
    id: 'news-dual-citizenship',
    question: 'dual citizenship bill',
    expect: news([
      'Council of State advises Parliament against passage of dual citizenship bill - CitiNewsroom.com - 2 days ago - By Nii Ayikwei Okine',
      'Council of State advises Parliament against passage of dual citizenship bill - CitiNewsroom.com',
      'Council of State has advised against passage of dual citizenship Bill — Speaker tells Parliament - Modern Ghana - 2 days ago',
      'Council of State has advised against passage of dual citizenship Bill — Speaker tells Parliament - Modern Ghana',
      'Ghana’s Council of State Rejects Dual Citizenship Bill: A Test of Sovereignty Versus Diaspora Inclusion - Modern Ghana - 5 hours ago',
      'Council of State advises Parliament against passing dual citizenship amendment Bill',
    ]),
    note: 'Eleven rows cover this story and four of them are the same clipping with and without the scraper’s provenance suffix. One card each.',
  },
  {
    id: 'news-council-of-state',
    question: 'What did the Council of State advise Parliament?',
    expect: news([
      'Council of State advises Parliament against passage of dual citizenship bill - CitiNewsroom.com',
      'Council of State has advised against passage of dual citizenship Bill — Speaker tells Parliament - Modern Ghana',
      'Council of State advises Parliament against passing dual citizenship amendment Bill',
    ]),
  },
  {
    id: 'news-constitution-amendment',
    question: 'Constitution Amendment Bill committee',
    expect: news([
      'Bagbin refers Constitution Amendment Bill to committee - Graphic Online - 3 hours ago',
      "Bagbin refers constitutional amendment bill to committee following Council of State's advice - Modern Ghana - 1 hour ago",
    ]),
  },
  {
    id: 'news-presidential-directives',
    question: 'Presidential directives',
    expect: news(['Bagbin: I am not bound by Presidential directives - CitiNewsroom.com']),
    mode: 'all',
    note: 'One record. A partial answer here means the reader was shown the gap for a question with an exact answer.',
  },
  {
    id: 'news-ubids',
    question: 'UBIDS',
    expect: news([
      'Speaker Bagbin pledges government support for UBIDS - Ghana News Agency - 3 days ago - By Elsie Appiah-osei',
      'Speaker Bagbin pledges government support for UBIDS, backs bid to train lawyers - 3News - 3 days ago',
    ]),
    note: 'An acronym. Nothing expands it, so it can only be found literally.',
  },
  {
    id: 'news-security-arrest',
    question: 'security agencies arrest MPs',
    expect: news(['Security agencies need no permission to arrest MPs — Bagbin - Graphic Online - 22 May']),
  },
  {
    id: 'news-clean-up',
    question: 'national clean-up exercise',
    expect: news([
      'Parliament backs National General Cleaning Days - Ghana News Agency - 2 days ago - By Godwill Arthur-Mensah',
      'Join National general clean-up exercise – Bagbin to MPs - CitiNewsroom.com',
      'Parliament suspends sitting on Friday for MPs to participate in National Day of General Cleaning',
    ]),
  },
  {
    id: 'news-community-service',
    question: 'Community Service Bill',
    expect: news([
      'Parliament approves Community Service Bill to reduce custodial sentencing - CitiNewsroom.com',
    ]),
  },
  {
    id: 'news-supreme-court',
    question: 'Supreme Court anniversary lecture',
    expect: news([
      'Speaker to deliver lecture to commemorate 150th anniversary celebration of Ghana’s Supreme Court - Ghanaian Times - 12 Jun',
      'Speaker to deliver lecture to commemorate 150th anniversary celebration of Ghana’s Supreme Court - Ghanaian Times',
    ]),
    note: 'Two rows, one clipping: the scraper stored the same headline with and without its date suffix. One card, not two.',
  },
  {
    id: 'news-supreme-court-reform',
    question: 'Supreme Court judges appointment',
    expect: news([
      'Bagbin calls for reforms in appointment of Supreme Court judges - CitiNewsroom.com - 11 Jun',
      'Bagbin calls for reforms in appointment of Supreme Court judges - CitiNewsroom.com',
    ]),
  },
  {
    id: 'news-peace-mission',
    question: 'IPU peace mission Russia Ukraine',
    expect: news([
      'Speaker Bagbin to represent Ghana on IPU peace mission for Russia-Ukraine war - Graphic Online - 30 Oct 2025',
    ]),
    note: 'Three proper nouns in one headline. Each is a term; the record has to hold all of them.',
  },
  {
    id: 'news-globalisation',
    question: 'xenophobia and globalisation',
    expect: news([
      'Africa must defend values from globalisation, xenophobia — Bagbin - Graphic Online - 2 Jun',
    ]),
  },
  {
    id: 'news-inter-regional-trade',
    question: 'inter-regional trade',
    expect: news([
      'Ghana best placed to drive inter-regional trade — Bagbin',
      'Ghana ideal point for African, Euro, Gulf businesses - Bagbin woos investors at economic parliamentary forum - Graphic Online - 24 Jun',
      'Bagbin markets Ghana as “Gateway for Africa, Euro-Med & Gulf Trade” - Ghana News Agency',
    ]),
  },
  {
    id: 'news-black-stars',
    question: 'Black Stars',
    expect: news([
      'World Cup: We believe in you, make us proud – Bagbin to Black Stars - CitiNewsroom.com',
    ]),
  },
  {
    id: 'news-flood-clean-up',
    question: 'flood clean-up exercise',
    expect: news([
      'Bagbin suspends Friday sitting for MPs to join flood clean-up exercise - CitiNewsroom.com - 2 days ago - By Nii Ayikwei Okine',
      'Bagbin suspends Friday sitting for MPs to join flood clean-up exercise - CitiNewsroom.com',
      'Bagbin suspends Friday sitting for MPs to join flood clean-up exercise',
    ]),
    note: '“clean-up” has to survive the hyphen on both sides, and one headline stored three times is still one card.',
  },
  {
    id: 'news-mining',
    question: 'cryptocurrency mining',
    expect: news([
      'Mining must not become Upper East’s only dev’t strategy – Bagbin - CitiNewsroom.com',
      'Mining must not become Upper East’s only dev’t strategy - Bagbin - CitiNewsroom.com',
    ]),
    note: 'Not a false positive after all: the archive does hold a clipping with “mining” in the headline, and it should be returned.',
  },
  {
    id: 'news-world-cup',
    question: 'World Cup performance analysis',
    expect: news([
      'World Cup: We believe in you, make us proud – Bagbin to Black Stars - CitiNewsroom.com - 17 Jun',
      'World Cup: We believe in you, make us proud – Bagbin to Black Stars - CitiNewsroom.com',
    ]),
    note: 'Also answerable. The archive has World Cup rows, so refusing the question would be the bug.',
  },

  /* ---------------------------------------------------------------------- */
  /* Video — titles and categories only                                      */
  /* ---------------------------------------------------------------------- */
  {
    id: 'video-democracy-cup',
    question: 'Democracy Cup',
    expect: videos([
      'Alban Sumana Kingsford Bagbin’s speech at the launch of the #DemocracyCup in Parliament',
      "Speaker of Parliament Alban Sumana Kingsford Bagbin says he wants his initiative 'Democracy Cup' ",
      '#DemocracyCup: Trophy Presentation by the Speaker of Ghana’s Parl. Alban Sumana Kingsford Bagbin',
      'GFA & FORMALLY BLAKSTARS PLAYERS PRESENTED DEMOCRACY CUP SPK OF PARLIAMENT - RT. HON. ALBAN BAGBIN',
      'Rt Hon Alban S. K. Bagbin launches Democracy cup.',
    ]),
    note: 'Two spellings of one thing: “DemocracyCup” has to fold into “democracy” to find the launch speech.',
  },
  {
    id: 'video-vulture-award',
    question: 'Vulture Award',
    expect: videos(['Alban Bagbin unveils the Vulture Award—a bold move to expose corrupt public officials🦅']),
  },
  {
    id: 'video-tree-planting',
    question: 'national tree planting exercise',
    expect: videos([
      'RT. HON SPEAKER ALBAN SUMANA KINGSFORD BAGBIN TOOK PART IN THE NATIONAL TREE PLANTING EXERCISE',
    ]),
  },
  {
    id: 'video-emergency-care',
    question: 'Emergency Care Law',
    expect: videos([
      "Ghana's Emergency Response System:Alban Bagbin calls for immediate passage of Emergency Care Law",
    ]),
  },
  {
    id: 'video-service-personnel',
    question: 'service personnel errand boys',
    expect: [
      ...videos(['Don’t turn service personnel into errand boys and girls.-Alban Sumana Kingsford Bagbin']),
      ...audio(['Don’t turn service personnel into errand boys and girls.-Alban Sumana Kingsford Bagbin']),
    ],
    note: 'The same recording in two media. Either card answers the question.',
  },
  {
    id: 'video-fourth-republic',
    question: '25 years of the fourth republic',
    expect: [
      ...videos(['Alban Bagbin shares thought on 25 years of 4th Republic']),
      ...audio(['Alban Bagbin shares thought on 25 years of 4th Republic']),
    ],
    note: '“4th” against “fourth”. The headline writes the ordinal as a digit and the suffix folder cannot bridge it.',
  },

  /* ---------------------------------------------------------------------- */
  /* Audio — titles only, mostly sharing a headline with a video              */
  /* ---------------------------------------------------------------------- */
  {
    id: 'audio-elevy',
    question: 'E-Levy',
    expect: [
      ...videos([
        'Passing controversial E-Levy could cost NPP in 2024 polls - Alban Bagbin',
        'E-Levy: Finance Minister to meet speaker of Ghana’s parliament Alban Kingsford Sumana Bagbin',
      ]),
      ...audio([
        'Passing controversial E-Levy could cost NPP in 2024 polls - Alban Bagbin',
        'E-Levy: Finance Minister to meet speaker of Ghana’s parliament Alban Kingsford Sumana Bagbin',
        'Alban Bagbin in TROUBLE for allegedly betraying NDC to help pass the E-Levy',
      ]),
    ],
    note: 'A hyphenated term. The candidate pattern is [a-z0-9] only, so this is a known boundary.',
  },
  {
    id: 'audio-double-salary',
    question: 'double salary refund',
    expect: [
      ...videos(['I’ll sell whatever I have to refund the ‘double salary’ if it is proven -Alban Bagbin']),
      ...audio(['I’ll sell whatever I have to refund the ‘double salary’ if it is proven -Alban Bagbin']),
    ],
  },
  {
    id: 'audio-covid',
    question: 'COVID-19',
    expect: [
      ...videos(["COVID-19 Pandemic: Alban Bagbin urges Gov't  to put on TV evidence - Joy News Prime (19-5-20)"]),
      ...audio(["COVID-19 Pandemic: Alban Bagbin urges Gov't  to put on TV evidence - Joy News Prime (19-5-20)"]),
    ],
    note: 'Hyphenated again. “covid” alone still has to find it.',
  },
  {
    id: 'audio-legal-education',
    question: 'legal education',
    expect: [
      ...videos(['Alban Bagbin, blames ‘challenges’ in Ghana’s legal education on systemic failure.']),
      ...audio(['Alban Bagbin, blames ‘challenges’ in Ghana’s legal education on systemic failure.']),
    ],
  },
  {
    id: 'audio-unity-walk',
    question: 'Unity Walk',
    expect: [
      ...videos(['Alban Bagbin mocks NDC’s "Unity Walk"']),
      ...audio(['Alban Bagbin mocks NDC’s "Unity Walk"']),
    ],
  },
  {
    id: 'audio-minority-reshuffle',
    question: 'minority leadership reshuffle',
    expect: [
      ...videos([
        'Speaker Alban Bagbin vs Asiedu Nketia - Contrasting opinions over minority leadership reshuffle?',
      ]),
      ...audio([
        'Speaker Alban Bagbin vs Asiedu Nketia - Contrasting opinions over minority leadership reshuffle?',
      ]),
    ],
  },
  {
    id: 'audio-club-of-number-3s',
    question: 'Asamoah Gyan retirement',
    expect: [
      ...videos(['Alban Bagbin ‘inducts’ Asamoah Gyan into the ‘Club of Number 3s’ as he retires']),
      ...audio(['Alban Bagbin ‘inducts’ Asamoah Gyan into the ‘Club of Number 3s’ as he retires']),
    ],
  },
  {
    id: 'media-gospel-truth',
    question: 'gospel of truth',
    expect: [
      ...videos(["'I am here to preach the gospel of truth'-  Alban Bagbin. (17-08-18)"]),
      ...audio(["'I am here to preach the gospel of truth'-  Alban Bagbin. (17-08-18)"]),
    ],
    note: 'One recording in two media. Either card answers it.',
  },

  /* ---------------------------------------------------------------------- */
  /* Milestones and testimonials — short text, exact titles                   */
  /* ---------------------------------------------------------------------- */
  {
    id: 'ms-bar',
    question: 'When was he called to the bar?',
    expect: milestones(['Called to the Bar']),
    note: 'A date question. The year is in the milestone, and the answer still has to come from the search.',
  },
  {
    id: 'ms-legacy',
    question: 'University of Ghana Legon',
    expect: milestones(['University of Ghana, Legon']),
  },
  {
    id: 'ms-majority-leader',
    question: 'Majority Leader',
    expect: milestones(['Majority Leader']),
  },
  {
    id: 'ms-minority-leader',
    question: 'Minority Leader',
    expect: milestones(['Minority Leader']),
  },
  {
    id: 'ms-water-resources',
    question: 'Minister for Water Resources',
    expect: milestones(['Minister for Water Resources, Works and Housing']),
  },
  {
    id: 'ms-second-deputy',
    question: 'Second Deputy Speaker',
    expect: milestones(['Second Deputy Speaker']),
  },
  {
    id: 'ms-third-deputy',
    question: 'Third Deputy Speaker',
    expect: milestones(['Third Deputy Speaker']),
  },
  {
    id: 'ms-speaker-8th',
    question: 'When was he elected Speaker?',
    expect: milestones(['Speaker of the 8th Parliament']),
  },
  {
    id: 'ts-akufo-addo',
    question: 'What did Akufo-Addo say about his election?',
    expect: testimonials(['His Excellency Nana Addo Dankwa Akufo-Addo']),
    note: 'The President is a proper noun that must reach a testimonial, not a speech.',
  },
  {
    id: 'ts-sombo',
    question: 'Sombo',
    expect: testimonials(['People of Sombo']),
    mode: 'all',
    note: 'One testimonial mentions it. Two do not.',
  },
  {
    id: 'ts-bipartisan',
    question: 'bipartisan tribute to the Speaker',
    expect: testimonials(['Members of the 8th Parliament']),
    note: '“tribute” is the term that matters; the word “Speaker” is a stopword in every row.',
  },

  /* ---------------------------------------------------------------------- */
  /* Questions the archive cannot answer                                       */
  /*                                                                             */
  /* Split in two on purpose. The first three share no word with any published  */
  /* record and are refused today. The last three do share a word — "policy",   */
  /* "public", "north east" — and are answered anyway, because the pipeline has */
  /* no minimum-relevance threshold: one weak hit in one field is enough to put */
  /* a card in front of the reader. Those three fail today, and that is the     */
  /* case for a score floor.                                                    */
  /* ---------------------------------------------------------------------- */
  {
    id: 'none-beekeeping',
    question: 'beekeeping cooperatives in the Frafraha district',
    expectEmpty: true,
    note: 'No word of this appears in the archive. The answer must say so.',
  },
  {
    id: 'none-sediment',
    question: 'sediment yield of the Volta basin',
    expectEmpty: true,
    note: 'Hydrology, not politics.',
  },
  {
    id: 'none-agronomy',
    question: 'maize agronomy in the Guinea savanna',
    expectEmpty: true,
  },
  {
    id: 'false-positive-policy',
    question: 'quantum computing policy',
    expectEmpty: true,
    note: 'Answers with the Water Resources milestone, matched only on “policy” in its description.',
  },
  {
    id: 'false-positive-galamancy',
    question: 'galamancy and the public purse',
    expectEmpty: true,
    note: 'Ten results, led by “Partner at the Law Trust Company” on the word “public”. The archive says nothing about galamancy.',
  },
  {
    id: 'false-positive-ranching',
    question: 'cattle ranching in the North East',
    expectEmpty: true,
    note: 'Led by the Tamale Secondary School milestone, matched on “North East” as a place name.',
  },
]
