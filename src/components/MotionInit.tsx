'use client'

import { useEffect } from 'react'

export default function MotionInit() {
  useEffect(() => {
    const root = document.documentElement
    root.dataset.motionReady = '1'
    const observer = new IntersectionObserver(
      entries => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            ;(entry.target as HTMLElement).dataset.motionReveal = 'true'
            observer.unobserve(entry.target)
          }
        }
      },
      { threshold: 0.12, rootMargin: '0px 0px -10% 0px' },
    )

    const scan = () => {
      document
        .querySelectorAll<HTMLElement>('[data-motion-entry]:not([data-motion-reveal])')
        .forEach(el => observer.observe(el))
    }

    const mutation = new MutationObserver(mutations => {
      for (const m of mutations) {
        if (m.type !== 'childList') continue
        const hasEntry = Array.from(m.addedNodes).some(
          node =>
            node instanceof HTMLElement &&
            (node.hasAttribute('data-motion-entry') || node.querySelector('[data-motion-entry]')),
        )
        if (hasEntry) {
          scan()
          return
        }
      }
    })
    mutation.observe(document.body, { childList: true, subtree: true })

    scan()
    return () => {
      observer.disconnect()
      mutation.disconnect()
    }
  }, [])
  return null
}