"use client";

/**
 * /ask integrations — the archive's stand-in for the reference app's plugin
 * (Integrations) page. Where the desktop app lists plugin capabilities, this
 * lists the collections /ask can draw on, so a reader can see at a glance what
 * the archive holds and where each one lives.
 */

import Link from "next/link";
import {
  AudioLines,
  Clapperboard,
  FileText,
  Image as ImageIcon,
  Milestone,
  Award,
  Newspaper,
  Search,
  Sparkles,
} from "lucide-react";

type Capability = {
  key: string;
  name: string;
  href: string;
  description: string;
  icon: React.ComponentType<{ size?: number; "aria-hidden"?: true | boolean }>;
  note?: string;
};

const CAPABILITIES: Capability[] = [
  {
    key: "documents",
    name: "Archive documents",
    href: "/archives",
    description: "Speeches, letters, papers, memos and interviews — the records /ask reads from.",
    icon: FileText,
  },
  {
    key: "milestones",
    name: "Milestones",
    href: "/archives/milestones",
    description: "A chronological rundown of the Speaker’s career, year by year.",
    icon: Milestone,
  },
  {
    key: "testimonials",
    name: "Testimonials",
    href: "/archives/testimonials",
    description: "What colleagues and contemporaries have said about him.",
    icon: Award,
  },
  {
    key: "news",
    name: "News archive",
    href: "/news",
    description: "Press clippings and reporting, cited with a link to the original paper.",
    icon: Newspaper,
  },
  {
    key: "videos",
    name: "Video",
    href: "/videos",
    description: "Recorded appearances and proceedings held in the media library.",
    icon: Clapperboard,
  },
  {
    key: "audio",
    name: "Audio",
    href: "/media?type=audio",
    description: "Recorded addresses and interviews.",
    icon: AudioLines,
  },
  {
    key: "search",
    name: "Full-text search",
    href: "/search",
    description: "Every collection at once, as a browsable result list.",
    icon: Search,
    note: "Open every match",
  },
  {
    key: "photos",
    name: "Photographs",
    href: "/archives/photos",
    description: "Browsable gallery. Uncaptioned and undated, so it is not searched.",
    icon: ImageIcon,
    note: "Browse only",
  },
];

export default function AskIntegrations() {
  return (
    <section className="ask-integrations-page" aria-label="Archive capabilities">
      <header className="ask-screen-heading">
        <span className="ask-eyebrow">Integrations</span>
        <h1 className="ask-screen-title">Collections &amp; capabilities</h1>
        <p className="ask-screen-subtitle">
          What the archive holds, and how /ask can draw on it.
        </p>
      </header>

      <ul className="ask-integrations-grid">
        {CAPABILITIES.map(({ key, name, href, description, icon: Icon, note }) => (
          <li key={key} className="ask-integration-card">
            <Link href={href} className="ask-integration-link" aria-label={`Open ${name}`}>
              <span className="ask-integration-icon" aria-hidden>
                <Icon size={18} />
              </span>
              <span className="ask-integration-copy">
                <strong>{name}</strong>
                <span>{description}</span>
              </span>
              <span className="ask-integration-status">
                <i aria-hidden />
                {note ?? "Available"}
              </span>
            </Link>
          </li>
        ))}
      </ul>

      <div className="ask-integrations-note">
        <Sparkles size={16} aria-hidden />
        <p>
          <strong>Ask the archive</strong> searches the published records above and
          links every answer back to the item it came from. Photographs are held and
          browsable, but are not searched because they carry no captions or dates.
        </p>
      </div>
    </section>
  );
}