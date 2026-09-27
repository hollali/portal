// Scroll reveals are driven by CSS `animation-timeline: view()` in
// globals.css — see the "Scroll reveal" block there. This component used
// to run an IntersectionObserver that set `data-motion-reveal` directly on
// the rendered nodes.
//
// That was a hydration hazard: on routes whose archive content streams in
// inside a <Suspense> boundary, the observer's first callback landed before
// React finished hydrating that boundary, so React found an attribute on the
// DOM that it had never rendered and reported a mismatch. Keeping the effect
// purely declarative in CSS removes the race, the MutationObserver, and the
// per-element JS work, and it keeps working for entries added by client-side
// navigation without any rescan.
//
// The flag itself is set by the `motion-init` inline script in src/app/layout.tsx
// so that the hero keyframes stay inert when JavaScript is unavailable.
export default function MotionInit() {
  return null
}
