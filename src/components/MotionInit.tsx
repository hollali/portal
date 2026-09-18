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
    const els = document.querySelectorAll<HTMLElement>('[data-motion-entry]')
    els.forEach(el => observer.observe(el))
    return () => observer.disconnect()
  }, [])
  return null
}