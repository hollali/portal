import { marked } from 'marked'
import sanitizeHtml from 'sanitize-html'

marked.setOptions({
  gfm: true,
  breaks: true,
})

const ALLOWED = {
  allowedTags: sanitizeHtml.defaults.allowedTags.concat(['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'img', 'figure', 'figcaption', 'del', 'sup', 'sub']),
  allowedAttributes: {
    a: ['href', 'name', 'target', 'rel'],
    img: ['src', 'alt', 'title', 'width', 'height'],
  },
  allowedSchemes: ['http', 'https', 'mailto', 'tel', 'data'],
  transformTags: {
    a: sanitizeHtml.simpleTransform('a', { rel: 'noopener noreferrer', target: '_blank' }),
  },
}

export function renderMarkdown(markdown: string): string {
  try {
    const result = marked.parse(markdown)
    const html = typeof result === 'string' ? result : markdown
    return sanitizeHtml(html, ALLOWED)
  } catch {
    return sanitizeHtml(markdown, ALLOWED)
  }
}