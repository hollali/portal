import { marked } from 'marked'

marked.setOptions({
  gfm: true,
  breaks: true,
})

export function renderMarkdown(markdown: string): string {
  try {
    const result = marked.parse(markdown)
    return typeof result === 'string' ? result : markdown
  } catch {
    return markdown
  }
}