import {
  Award,
  Clapperboard,
  FileText,
  Image as ImageIcon,
  Mic,
  MessagesSquare,
  Milestone,
  Newspaper,
  ScrollText,
  AudioLines,
  type LucideIcon,
} from 'lucide-react'

/**
 * One icon per archive kind, shared by every surface that renders a record
 * chip. Media and news kinds are here too: /ask cites photographs, videos and
 * clippings, and without them every non-document citation fell back to a
 * generic document icon and looked like a broken thumbnail.
 */
export const KIND_ICON: Record<string, LucideIcon> = {
  // Curated documents.
  speech: Mic,
  paper: FileText,
  interview: MessagesSquare,
  note: ScrollText,
  letter: ScrollText,
  memo: ScrollText,
  // Media and press.
  image: ImageIcon,
  video: Clapperboard,
  audio: AudioLines,
  news: Newspaper,
  // Reference collections.
  milestone: Milestone,
  testimonial: Award,
}
