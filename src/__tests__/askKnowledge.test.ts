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
