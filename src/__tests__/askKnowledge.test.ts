import { describe, expect, it } from 'vitest'
import { answerFromProfile, detectKnowledgeTopic } from '@/lib/askKnowledge'
import { knowledgeProfile } from './fixtures/knowledgeProfile'

describe('detectKnowledgeTopic', () => {
  it.each([
    ['Who is Alban Bagbin?', 'overview'],
    ['Tell me about his life', 'overview'],
    ['Where was he born?', 'birth'],
    ['Who are his parents?', 'birth'],
    ['What is his education?', 'education'],
    ['Which law school did he attend?', 'education'],
    ['What did he do before politics?', 'career'],
    ['When did he enter Parliament?', 'political'],
    ['How did his political career begin?', 'political'],
    ['How did he become Speaker?', 'speakership'],
    ['What are his key rulings?', 'speakership'],
    ['Who is he married to?', 'personal'],
    ['What is his timeline?', 'timeline'],
    ['What are his milestones?', 'timeline'],
    ['What does he stand for?', 'values'],
    ['What are his international roles?', 'international'],
    ['Which university did he attend?', 'education'],
    ['What does he do for a living?', 'career'],
    ['Is he a lawyer?', 'career'],
    ['How many times has he been elected?', 'political'],
    ['How long has he been an MP?', 'political'],
    ['When did he become a lawyer?', 'career'],
    ['Where does he live?', 'birth'],
    ['What is his job?', 'career'],
  ])('routes %s to %s', (question, topic) => {
    expect(detectKnowledgeTopic(question)).toBe(topic)
  })

  it.each([
    'What did he say about education?',
    'What are the key speeches on parliamentary independence?',
    'Find the notice recalling Parliament',
    'What are the milestones?',
    'What are the milestones about poverty?',
    'Any videos?',
    'Any testimonials?',
    'What happened in 2026?',
  ])('leaves archive question %s to search', question => {
    expect(detectKnowledgeTopic(question)).toBeNull()
  })
})

describe('answerFromProfile', () => {
  it('answers an overview from the person rows and cites the biography', () => {
    const result = answerFromProfile('overview', knowledgeProfile)
    expect(result.match).toBe('all')
    expect(result.conversation?.kind).toBe('profile')
    expect(result.summary).toContain('Alban Bagbin')
    expect(result.summary).toContain('24 September 1957')
    expect(result.summary).toContain('University of Ghana')
    expect(result.citations.map(c => c.href)).toContain('/the-man')
    expect(result.citations.map(c => c.href)).toContain('/speaker-record')
  })

  it('answers birth, education and personal questions from their stored paragraphs', () => {
    expect(answerFromProfile('birth', knowledgeProfile).summary).toContain('Sombo')
    expect(answerFromProfile('education', knowledgeProfile).summary).toContain('Ghana School of Law')
    expect(answerFromProfile('personal', knowledgeProfile).summary).toContain('Alice Adjua Yornas Bagbin')
  })

  it('answers a narrow fact question with the fact itself, not the topic block', () => {
    const result = answerFromProfile('birth', knowledgeProfile, 'What is his age?')
    expect(result.summary).toMatch(
      /^He is \d+ years old — born on 24 September 1957, and he hails from Sombo, Upper West Region\.$/,
    )
    expect(result.citations.map(c => c.href)).toContain('/the-man#early-life')
    expect(result.summary).not.toContain('fourth of nine')
  })

  it('answers the date of birth, parents and siblings as single sentences', () => {
    expect(answerFromProfile('birth', knowledgeProfile, 'When was he born?').summary).toContain('born on 24 September 1957')
    const parents = answerFromProfile('birth', knowledgeProfile, 'Who are his parents?').summary
    expect(parents).toContain('Sansunni Bagbin and Margaret B. Bagbin')
    expect(parents).toContain('peasant farmers')
    expect(answerFromProfile('birth', knowledgeProfile, 'How many siblings does he have?').summary).toContain(
      'fourth of nine children',
    )
  })

  it('answers name and speaker questions straight through', () => {
    expect(answerFromProfile('overview', knowledgeProfile, 'What is his full name?').summary).toBe(
      'His full name is Alban Sumana Kingsford Bagbin.',
    )
    expect(answerFromProfile('speakership', knowledgeProfile, 'When did he become Speaker?').summary).toContain(
      'He currently serves as Speaker of Parliament of Ghana',
    )
    expect(
      answerFromProfile('speakership', knowledgeProfile, 'When did he become Speaker?').summary,
    ).toContain('since 7 January 2021')
  })

  it('answers personal facts from the personal card sentences', () => {
    expect(answerFromProfile('personal', knowledgeProfile, 'Who is he married to?').summary).toContain(
      'married to Alice Adjua Yornas Bagbin',
    )
    expect(answerFromProfile('personal', knowledgeProfile, 'What is his religion?').summary).toContain(
      'Roman Catholic',
    )
    expect(answerFromProfile('personal', knowledgeProfile, 'Does he have children?').summary).toContain(
      'does not record whether he has children',
    )
  })

  it('falls back to the topic block when the fact cannot be extracted', () => {
    const withoutNames = {
      ...knowledgeProfile,
      biography: {
        ...knowledgeProfile.biography,
        intro: 'A long record of service in the public eye.',
      },
    }
    const result = answerFromProfile('birth', withoutNames, 'Who are his parents?')
    expect(result.match).toBe('all')
    expect(result.citations.map(c => c.href)).toContain('/timeline')
  })

  it('keeps party and constituency questions to their recorded facts', () => {
    expect(answerFromProfile('political', knowledgeProfile, 'What is his party?').summary).toContain(
      'National Democratic Congress (NDC)',
    )
    expect(answerFromProfile('political', knowledgeProfile, 'What is his constituency?').summary).toContain(
      'Nadowli West',
    )
  })

  it('answers schooling facts as single sentences from the education card', () => {
    expect(answerFromProfile('education', knowledgeProfile, 'Which school did he attend?').summary).toBe(
      'He attended Wa Secondary School and Tamale Secondary School.',
    )
    expect(
      answerFromProfile('education', knowledgeProfile, 'Which university did he attend?').summary,
    ).toBe('He earned a Bachelor of Arts in Law and English at the University of Ghana in 1980.')
    expect(answerFromProfile('education', knowledgeProfile, 'When was he called to the bar?').summary).toBe(
      'He was called to the bar in 1982.',
    )
    expect(
      answerFromProfile('education', knowledgeProfile, 'Where did he study law?').summary,
    ).toContain('He trained at the Ghana School of Law')
    expect(
      answerFromProfile('education', knowledgeProfile, 'What did he study at GIMPA?').summary,
    ).toContain('Governance and Leadership at GIMPA')
  })

  it('answers profession and chambers questions directly', () => {
    const profession = answerFromProfile('career', knowledgeProfile, 'What does he do for a living?').summary
    expect(profession).toContain('He currently serves as Speaker of Parliament of Ghana')
    expect(profession).toContain('called to the bar in 1982')
    expect(answerFromProfile('career', knowledgeProfile, 'When did he become a lawyer?').summary).toContain(
      'called to the bar in 1982',
    )
    expect(answerFromProfile('career', knowledgeProfile, 'Which chambers does he belong to?').summary).toContain(
      'His career:',
    )
    expect(
      answerFromProfile('career', knowledgeProfile, 'What did he do before politics?').summary,
    ).toContain('Statistical Service Board')
  })

  it('answers the parliamentary record as facts', () => {
    expect(
      answerFromProfile('political', knowledgeProfile, 'When did he enter Parliament?').summary,
    ).toContain('He first entered Parliament in 1992')
    expect(
      answerFromProfile('political', knowledgeProfile, 'How many times has he been elected?').summary,
    ).toContain('elected to Parliament seven times')
    expect(answerFromProfile('political', knowledgeProfile, 'How long has he been an MP?').summary).toContain(
      'sat in Parliament since 1992',
    )
  })

  it('answers Speaker-history questions as facts', () => {
    expect(
      answerFromProfile('speakership', knowledgeProfile, 'Did he come back as Speaker?').summary,
    ).toContain('He was re-elected in 2025')
    expect(
      answerFromProfile('speakership', knowledgeProfile, 'Is he the first opposition speaker?').summary,
    ).toBe('He is the first Speaker chosen from the opposition in Ghana’s history.')
    expect(
      answerFromProfile('speakership', knowledgeProfile, 'What were his leadership roles?').summary,
    ).toContain('2001 — Minority Leader')
  })

  it('answers named international-body questions from the research events', () => {
    expect(answerFromProfile('international', knowledgeProfile, 'What is his IPU role?').summary).toContain(
      'October 2025 — Elected Chairperson of the IPU Africa Group',
    )
  })

  it('says plainly when the record does not hold an asked-for fact', () => {
    expect(answerFromProfile('birth', knowledgeProfile, 'Where does he live?').summary).toBe(
      'The published biography does not record where he currently lives.',
    )
  })

  it('answers the chronology without repeating the parliamentary timeline', () => {
    const summary = answerFromProfile('timeline', knowledgeProfile).summary
    expect(summary).toContain('1957')
    expect(summary).toContain('2025')
    expect(summary.match(/1992/g)).toHaveLength(1)
  })

  it('uses research events for international roles', () => {
    const result = answerFromProfile('international', knowledgeProfile)
    expect(result.summary).toContain('IPU Africa Group')
    expect(result.citations.length).toBeGreaterThan(0)
  })

  it('uses values and rulings for what he stands for', () => {
    const result = answerFromProfile('values', knowledgeProfile)
    expect(result.summary).toContain('leadership is service')
    expect(result.summary).toContain('Parliamentary Independence')
    expect(result.summary).toContain('A Speaker for the whole House')
  })

  it('offers follow-up questions rather than a dead end', () => {
    const result = answerFromProfile('overview', knowledgeProfile)
    expect(result.suggested.length).toBeGreaterThan(0)
    expect(result.suggested).toContain('Where was he born?')
    expect(result.totalMatched).toBe(result.citations.length)
  })
})
