import {
  AudioLines,
  Award,
  Clapperboard,
  FileText,
  Image as ImageIcon,
  Landmark,
  Lightbulb,
  MessagesSquare,
  Mic,
  Milestone,
  Newspaper,
  ScrollText,
  Sparkles,
  UserRound,
  Video,
  type LucideIcon,
} from 'lucide-react'

/**
 * The site's navigation, defined once.
 *
 * This replaces four lists that had drifted apart: the header's `ARCHIVE_LINKS`
 * and `MEDIA_LINKS`, the header's separate `MOBILE_ICONS` href→icon map, and the
 * footer's hand-copied `FOOTER_COLS`. The drawer was visibly richer than the
 * desktop bar purely because it had its own icon map — a nav that is better on
 * a phone than on a desktop is a nav that is wrong twice.
 *
 * `man.ts` still owns `ARCHIVE_LINKS` for the two hub pages that render it as
 * cards with live counts. Those labels and descriptions are reused verbatim
 * below rather than retyped, because a third wording is exactly how a section
 * ends up called three different things.
 */

export interface NavLeaf {
  href: string
  label: string
  /** One line. Shown in the desktop panel, dropped in the drawer. */
  description: string
  icon: LucideIcon
}

export interface NavPanel {
  kind: 'panel'
  key: string
  label: string
  icon: LucideIcon
  /** The section's landing page, offered as the panel's own first row. */
  hub: string
  hubLabel: string
  hubDescription: string
  items: NavLeaf[]
}

export type NavEntry = { kind: 'link'; href: string; label: string; icon: LucideIcon } | NavPanel

const leaf = (href: string, label: string, description: string, icon: LucideIcon): NavLeaf => ({
  href,
  label,
  description,
  icon,
})

const ARCHIVES: NavPanel = {
  kind: 'panel',
  key: 'archives',
  label: 'Archives',
  icon: Landmark,
  hub: '/archives',
  hubLabel: 'Browse all collections',
  hubDescription: 'Every collection in one place, with live record counts.',
  items: [
    leaf('/archives/speeches', 'Speeches', 'Parliamentary and public addresses, in his own words.', Mic),
    leaf('/archives/papers', 'Public Papers', 'Policy essays, presentations and public writings.', FileText),
    leaf('/archives/interviews', 'Interviews', 'Interviews and press engagements on the issues of the day.', MessagesSquare),
    leaf('/archives/notes', 'Notes & Correspondence', 'Memos and letters on key national issues, including notices recalling Parliament.', ScrollText),
    leaf('/archives/milestones', 'Milestones', 'The landmark moments of a thirty-year public career.', Milestone),
    leaf('/archives/testimonials', 'Testimonials', 'What prominent figures in Ghana and the world have said of him.', Award),
    leaf('/archives/photos', 'Photo Library', 'Historical and current photographs, curated by year, event and theme.', ImageIcon),
    leaf('/parliament', 'Parliamentary Legacy', 'A thirty-year record in the House, in his own words.', Landmark),
    leaf('/themes', 'Themes & Ideas', 'The ideas that shaped the record, collected and cross-referenced.', Lightbulb),
    leaf('/news', 'News Clippings', 'Press coverage from across the Ghanaian and international media.', Newspaper),
  ],
}

const MEDIA: NavPanel = {
  kind: 'panel',
  key: 'media',
  label: 'Media',
  icon: Clapperboard,
  hub: '/media',
  hubLabel: 'Open the media hub',
  hubDescription: 'Every recording and clipping, filterable by year and theme.',
  items: [
    leaf('/videos', 'Videos', 'Speeches, interviews and moments captured on camera.', Video),
    leaf('/audio', 'Audio', 'Radio interviews and audio recordings.', AudioLines),
    leaf('/news', 'News Clippings', 'Press coverage from across the Ghanaian and international media.', Newspaper),
    leaf('/archives/photos', 'Photo Library', 'Historical and current photographs, curated by year, event and theme.', ImageIcon),
  ],
}

/**
 * No `Home` entry: the brand mark already links there, and a nav item that
 * duplicates the logo is the cheapest width to reclaim on the 768px band. The
 * pages it would have reached are the most-visited pages on the site, so they
 * are carried by the home page itself and the footer rather than the bar.
 */
export const PRIMARY_NAV: NavEntry[] = [
  { kind: 'link', href: '/the-man', label: 'The Man', icon: UserRound },
  ARCHIVES,
  MEDIA,
  { kind: 'link', href: '/timeline', label: 'Timeline', icon: Milestone },
]

/** The drawer's last row: the one page that searches the whole library. */
export const SEARCH_HREF = '/search'

/** Kept out of `PRIMARY_NAV` because it is an action, not a section. */
export const ASK_HREF = '/ask'
export const ASK_ICON = Sparkles

/** Href → icon, for the drawer rows that are not in `PRIMARY_NAV`. */
export const EXTRA_ICONS: Record<string, LucideIcon> = {
  '/': Landmark,
  '/ask': Sparkles,
  '/search': Clapperboard,
}