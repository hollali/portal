"use client";

import {
  Fragment,
  useEffect,
  useRef,
  useState,
  useCallback,
  useMemo,
  Suspense,
} from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import PublicHeader from "@/components/PublicHeader";
import PublicFooter from "@/components/PublicFooter";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import {
  PHOTO_FACET_FIELDS,
  ARCHIVE_COLLECTION_NAV,
} from "@/lib/library";
import { jsonFetch } from "@/lib/jsonFetch";
import {
  Search,
  X,
  ChevronLeft,
  ChevronRight,
  ImageOff,
  Download,
  Share2,
  Check,
  SlidersHorizontal,
  LayoutGrid,
  Calendar,
  RotateCcw,
  ZoomIn,
  MapPin,
  Tag,
  ExternalLink,
} from "lucide-react";

export interface PhotoItem {
  id: number;
  src: string | null;
  year: number | null;
  event: string | null;
  location: string | null;
  person: string | null;
  institution: string | null;
  parliament: string | null;
  theme: string | null;
  caption: string | null;
  source: string | null;
  sourceUrl: string | null;
  query: string | null;
  collectedAt: string | null;
  dateTaken: string | null;
  notes: string | null;
  tags: string | null;
  curated: boolean;
  storedLocally: boolean;
  imageHash: string | null;
  faceDetected: number | null;
  faceCount: number | null;
  faceMatch: number | null;
  faceMatchScore: number | null;
  faceMatchDistance: number | null;
  bestReferencePath: string | null;
}

interface FacetOption {
  value: string;
  count: number;
}

interface PhotosData {
  items: PhotoItem[];
  total: number;
  facets: Record<string, FacetOption[]>;
  page?: number;
  perPage?: number;
}

type FilterMap = Record<string, string>;

type DetailRow = { label: string; value: React.ReactNode };

function parseTags(tags: string | null): string[] {
  return String(tags || "")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}

const mono = { fontFamily: "var(--font-mono), monospace" } as const;
const detailLabel = {
  fontFamily: "var(--font-mono), monospace",
  textTransform: "uppercase",
  fontSize: "0.625rem",
  letterSpacing: "0.06em",
  color: "var(--p-text-4)",
  fontWeight: 600,
} as const;

function isPresent(v: unknown): boolean {
  return v !== null && v !== undefined && v !== "";
}

function formatTimestamp(value: string | null): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function photoTitle(photo: PhotoItem): string {
  return photo.caption || photo.event || `Photograph #${photo.id}`;
}

function DetailGroup({ title, rows }: { title: string; rows: DetailRow[] }) {
  const present = rows.filter((r) => isPresent(r.value));
  if (present.length === 0) return null;
  return (
    <div style={{ marginBottom: "1.25rem" }}>
      <h3
        style={{
          ...mono,
          fontSize: "0.6875rem",
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: "var(--primary)",
          margin: "0 0 0.5rem",
          fontWeight: 700,
        }}
      >
        {title}
      </h3>
      <dl
        style={{
          display: "grid",
          gridTemplateColumns: "auto 1fr",
          gap: "0.45rem 1rem",
          margin: 0,
          fontSize: "0.85rem",
        }}
      >
        {present.map((r) => (
          <Fragment key={r.label}>
            <dt
              style={{
                ...detailLabel,
                alignSelf: "baseline",
                paddingTop: "0.1rem",
              }}
            >
              {r.label}
            </dt>
            <dd
              style={{
                margin: 0,
                color: "var(--p-text-1)",
                wordBreak: "break-word",
                lineHeight: 1.5,
              }}
            >
              {r.value}
            </dd>
          </Fragment>
        ))}
      </dl>
    </div>
  );
}

function PhotoDetails({ photo }: { photo: PhotoItem }) {
  const tags = parseTags(photo.tags);
  const num = (v: number | null | undefined, digits?: number) =>
    isPresent(v)
      ? digits !== undefined
        ? v!.toFixed(digits)
        : String(v)
      : null;

  const about: DetailRow[] = [
    { label: "Catalogue ID", value: `#${photo.id}` },
    { label: "Year", value: photo.year },
    { label: "Date taken", value: photo.dateTaken },
    { label: "Event", value: photo.event },
    { label: "Location", value: photo.location },
    { label: "Person", value: photo.person },
    { label: "Institution", value: photo.institution },
    { label: "Parliament", value: photo.parliament },
    { label: "Theme", value: photo.theme },
    { label: "Curated", value: photo.curated ? "Yes" : "No" },
  ];

  const provenance: DetailRow[] = [
    { label: "Source", value: photo.source },
    {
      label: "Original",
      value: photo.sourceUrl ? (
        <a
          href={photo.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: "var(--primary)", textDecoration: "underline" }}
        >
          View on the web
        </a>
      ) : null,
    },
    { label: "Collected", value: formatTimestamp(photo.collectedAt) },
    { label: "Search query", value: photo.query },
    {
      label: "Held in",
      value: photo.storedLocally
        ? "Local media store"
        : "Remote (original URL)",
    },
  ];

  const technical: DetailRow[] = [
    { label: "Image hash", value: photo.imageHash },
    { label: "Faces detected", value: num(photo.faceDetected) },
    { label: "Face count", value: num(photo.faceCount) },
    { label: "Face match", value: photo.faceMatch ? "Matched" : "No match" },
    { label: "Match score", value: num(photo.faceMatchScore, 3) },
    { label: "Match distance", value: num(photo.faceMatchDistance, 3) },
    { label: "Reference image", value: photo.bestReferencePath },
  ];

  const describedCount = about.filter((r) => isPresent(r.value)).length;

  return (
    <div>
      <DetailGroup title="About this photograph" rows={about} />
      {describedCount <= 2 && (
        <p
          style={{
            fontSize: "0.78rem",
            color: "var(--p-text-3)",
            margin: "-0.6rem 0 1.1rem",
          }}
        >
          Only the catalogue ID and curation status are recorded so far — this
          photograph has not been fully described.
        </p>
      )}
      <DetailGroup title="Provenance" rows={provenance} />

      {tags.length > 0 && (
        <div style={{ marginBottom: "1.25rem" }}>
          <h3
            style={{
              ...mono,
              fontSize: "0.6875rem",
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: "var(--primary)",
              margin: "0 0 0.5rem",
              fontWeight: 700,
            }}
          >
            Tags
          </h3>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem" }}>
            {tags.map((t) => (
              <span
                key={t}
                style={{
                  fontSize: "0.72rem",
                  color: "var(--p-text-2)",
                  border: "1px solid var(--p-border-2)",
                  background: "var(--p-surface-2)",
                  borderRadius: 999,
                  padding: "0.2rem 0.65rem",
                }}
              >
                #{t}
              </span>
            ))}
          </div>
        </div>
      )}

      {photo.notes && photo.notes !== photo.caption && (
        <div style={{ marginBottom: "1.25rem" }}>
          <h3
            style={{
              ...mono,
              fontSize: "0.6875rem",
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: "var(--primary)",
              margin: "0 0 0.4rem",
              fontWeight: 700,
            }}
          >
            Notes
          </h3>
          <p
            style={{
              fontSize: "0.85rem",
              lineHeight: 1.6,
              color: "var(--p-text-2)",
              margin: 0,
              background: "var(--p-surface-2)",
              padding: "0.75rem",
              borderRadius: 8,
              border: "1px solid var(--p-border-2)",
            }}
          >
            {photo.notes}
          </p>
        </div>
      )}

      <details
        style={{
          borderTop: "1px solid var(--p-border)",
          paddingTop: "0.75rem",
          marginTop: "1.25rem",
        }}
      >
        <summary
          style={{
            cursor: "pointer",
            fontSize: "0.75rem",
            ...mono,
            textTransform: "uppercase",
            letterSpacing: "0.1em",
            color: "var(--p-text-3)",
          }}
        >
          Technical details
        </summary>
        <div style={{ marginTop: "0.75rem" }}>
          <DetailGroup title="Ingest record" rows={technical} />
        </div>
      </details>
    </div>
  );
}

/**
 * Modern split-pane photo lightbox viewer:
 * - Left pane (65%): Full-bleed dark backdrop with centered photo and floating mid-height prev/next arrows.
 * - Right pane (35%): Dedicated archival context sidebar with quick action bar (Download, Share link, Source).
 */
export function PhotoLightbox({
  photo,
  index,
  total,
  onClose,
  onPrev,
  onNext,
}: {
  photo: PhotoItem;
  index: number;
  total: number;
  onClose: () => void;
  onPrev?: () => void;
  onNext?: () => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const [imgStatus, setImgStatus] = useState({
    id: photo.id,
    failed: false,
    loaded: false,
  });
  const [copied, setCopied] = useState(false);

  const imgFailed = imgStatus.failed && imgStatus.id === photo.id;
  const imgLoaded = imgStatus.loaded && imgStatus.id === photo.id;
  const setImgStatusFor = (patch: { failed?: boolean; loaded?: boolean }) =>
    setImgStatus({ id: photo.id, failed: false, loaded: false, ...patch });

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === "ArrowLeft" && index > 0 && onPrev) {
        e.preventDefault();
        onPrev();
        return;
      }
      if (e.key === "ArrowRight" && index < total - 1 && onNext) {
        e.preventDefault();
        onNext();
        return;
      }
      if (e.key !== "Tab") return;
      const node = dialogRef.current;
      if (!node) return;
      const focusable = node.querySelectorAll<HTMLElement>(
        'button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, onPrev, onNext, index, total]);

  useEffect(() => {
    const node = dialogRef.current;
    if (!node) return;
    const trigger = document.activeElement as HTMLElement | null;
    const target = node.querySelector<HTMLElement>("[data-autofocus]");
    if (target) target.focus();
    else node.focus();
    return () => trigger?.focus?.({ preventScroll: true });
  }, []);

  const title = photoTitle(photo);

  const handleCopyLink = () => {
    if (typeof window === "undefined") return;
    const url = `${window.location.origin}/archives/photos?photo=${photo.id}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    });
  };

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        background: "rgba(5, 7, 12, 0.88)",
        backdropFilter: "blur(10px)",
        WebkitBackdropFilter: "blur(10px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "clamp(0.5rem, 2vw, 1.5rem)",
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        style={{
          maxWidth: 1320,
          width: "100%",
          maxHeight: "94vh",
          height: "100%",
          background: "var(--p-surface)",
          border: "1px solid var(--p-border-3)",
          borderRadius: 20,
          overflow: "hidden",
          display: "grid",
          gridTemplateColumns: "minmax(0, 1.8fr) minmax(320px, 1.1fr)",
          boxShadow: "0 30px 100px -20px rgba(0,0,0,0.8)",
          outline: "none",
          position: "relative",
        }}
        className="photo-lightbox-modal"
      >
        {/* ── Left Pane: Dark Canvas & Centered Image ── */}
        <div
          style={{
            position: "relative",
            background: "#090a0f",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
            padding: "1.5rem",
            borderRight: "1px solid var(--p-border)",
          }}
        >
          {/* Centered Prev Button */}
          {index > 0 && onPrev && (
            <button
              onClick={onPrev}
              aria-label="Previous photo"
              style={{
                position: "absolute",
                left: "1.25rem",
                top: "50%",
                transform: "translateY(-50%)",
                zIndex: 10,
                width: 44,
                height: 44,
                borderRadius: "50%",
                background: "rgba(21, 23, 30, 0.75)",
                backdropFilter: "blur(8px)",
                WebkitBackdropFilter: "blur(8px)",
                border: "1px solid rgba(255, 255, 255, 0.15)",
                color: "#fff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                transition: "background 0.2s, transform 0.2s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "var(--primary)";
                e.currentTarget.style.color = "var(--primary-fg)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "rgba(21, 23, 30, 0.75)";
                e.currentTarget.style.color = "#fff";
              }}
            >
              <ChevronLeft size={22} />
            </button>
          )}

          {/* Centered Next Button */}
          {index < total - 1 && onNext && (
            <button
              onClick={onNext}
              aria-label="Next photo"
              style={{
                position: "absolute",
                right: "1.25rem",
                top: "50%",
                transform: "translateY(-50%)",
                zIndex: 10,
                width: 44,
                height: 44,
                borderRadius: "50%",
                background: "rgba(21, 23, 30, 0.75)",
                backdropFilter: "blur(8px)",
                WebkitBackdropFilter: "blur(8px)",
                border: "1px solid rgba(255, 255, 255, 0.15)",
                color: "#fff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                transition: "background 0.2s, transform 0.2s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "var(--primary)";
                e.currentTarget.style.color = "var(--primary-fg)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "rgba(21, 23, 30, 0.75)";
                e.currentTarget.style.color = "#fff";
              }}
            >
              <ChevronRight size={22} />
            </button>
          )}

          {/* Image Display */}
          <div
            style={{
              position: "relative",
              maxWidth: "100%",
              maxHeight: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {photo.src && !imgFailed ? (
              <img
                src={photo.src}
                alt={photo.caption || `Photograph #${photo.id}`}
                onError={() => setImgStatusFor({ failed: true })}
                onLoad={() => setImgStatusFor({ loaded: true })}
                style={{
                  maxWidth: "100%",
                  maxHeight: "82vh",
                  objectFit: "contain",
                  borderRadius: 8,
                  display: "block",
                  boxShadow: "0 10px 40px rgba(0,0,0,0.5)",
                }}
              />
            ) : (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: "0.75rem",
                  padding: "4rem 2rem",
                  color: "var(--p-text-3)",
                }}
              >
                <ImageOff size={36} />
                <span style={{ fontSize: "0.9rem" }}>Image unavailable</span>
                {photo.sourceUrl && (
                  <a
                    href={photo.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      fontSize: "0.82rem",
                      color: "var(--primary)",
                      textDecoration: "underline",
                    }}
                  >
                    Try the original source
                  </a>
                )}
              </div>
            )}
          </div>

          {!imgLoaded && !imgFailed && photo.src && (
            <div
              style={{
                position: "absolute",
                bottom: "1.25rem",
                ...mono,
                fontSize: "0.75rem",
                color: "var(--p-text-4)",
                background: "rgba(0,0,0,0.6)",
                padding: "0.3rem 0.8rem",
                borderRadius: 999,
              }}
            >
              Loading photograph…
            </div>
          )}
        </div>

        {/* ── Right Pane: Archival Context & Meta ── */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            overflowY: "auto",
            background: "var(--p-surface)",
          }}
        >
          {/* Header row */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "1.25rem 1.5rem",
              borderBottom: "1px solid var(--p-border)",
            }}
          >
            <span
              style={{
                ...mono,
                fontSize: "0.6875rem",
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: "var(--primary)",
              }}
            >
              Archival Record
            </span>
            <button
              onClick={onClose}
              data-autofocus
              aria-label="Close photo viewer"
              style={{
                background: "var(--p-surface-2)",
                border: "1px solid var(--p-border-3)",
                color: "var(--p-text-1)",
                borderRadius: "50%",
                width: 36,
                height: 36,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
              }}
            >
              <X size={18} />
            </button>
          </div>

          {/* Content Body */}
          <div style={{ padding: "1.5rem", flex: 1 }}>
            {/* Title / Caption */}
            <h2
              style={{
                fontFamily: "var(--font-display), sans-serif",
                fontSize: "1.35rem",
                lineHeight: 1.3,
                fontWeight: 700,
                margin: "0 0 0.35rem",
                color: "var(--p-text-1)",
              }}
            >
              {title}
            </h2>

            <div
              style={{
                fontSize: "0.75rem",
                color: "var(--p-text-3)",
                marginBottom: "0.85rem",
              }}
            >
              {photo.source ? `Source: ${photo.source}` : "Source not recorded"}
              {photo.year ? ` · ${photo.year}` : ""}
              {` · ${index + 1} of ${total}`}
            </div>

            {/* Quick badges */}
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "0.4rem",
                marginBottom: "1.25rem",
              }}
            >
              {photo.year && (
                <span
                  style={{
                    ...mono,
                    fontSize: "0.75rem",
                    fontWeight: 700,
                    background:
                      "color-mix(in srgb, var(--primary) 15%, transparent)",
                    color: "var(--primary)",
                    border:
                      "1px solid color-mix(in srgb, var(--primary) 30%, transparent)",
                    borderRadius: 999,
                    padding: "0.2rem 0.65rem",
                  }}
                >
                  {photo.year}
                </span>
              )}
              {photo.parliament && (
                <span
                  style={{
                    fontSize: "0.75rem",
                    color: "var(--p-text-2)",
                    background: "var(--p-surface-2)",
                    border: "1px solid var(--p-border-2)",
                    borderRadius: 999,
                    padding: "0.2rem 0.65rem",
                  }}
                >
                  {photo.parliament}
                </span>
              )}
              {photo.location && (
                <span
                  style={{
                    fontSize: "0.75rem",
                    color: "var(--p-text-3)",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "0.25rem",
                    background: "var(--p-surface-2)",
                    border: "1px solid var(--p-border-2)",
                    borderRadius: 999,
                    padding: "0.2rem 0.65rem",
                  }}
                >
                  <MapPin size={12} /> {photo.location}
                </span>
              )}
            </div>

            {/* Action Bar */}
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "0.5rem",
                marginBottom: "1.75rem",
                paddingBottom: "1.25rem",
                borderBottom: "1px solid var(--p-border)",
              }}
            >
              {photo.src && (
                <a
                  href={photo.src}
                  download={`bagbin-archive-photo-${photo.id}.jpg`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "0.4rem",
                    background: "var(--primary)",
                    color: "var(--primary-fg)",
                    borderRadius: 999,
                    padding: "0.45rem 1rem",
                    fontSize: "0.8rem",
                    fontWeight: 600,
                    textDecoration: "none",
                  }}
                >
                  <Download size={14} /> Download
                </a>
              )}

              <button
                onClick={handleCopyLink}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.4rem",
                  background: "var(--p-surface-2)",
                  border: "1px solid var(--p-border-3)",
                  color: "var(--p-text-1)",
                  borderRadius: 999,
                  padding: "0.45rem 0.95rem",
                  fontSize: "0.8rem",
                  fontWeight: 500,
                  cursor: "pointer",
                }}
              >
                {copied ? (
                  <Check size={14} style={{ color: "var(--success)" }} />
                ) : (
                  <Share2 size={14} />
                )}
                {copied ? "Link copied!" : "Share link"}
              </button>

              {photo.sourceUrl && (
                <a
                  href={photo.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "0.4rem",
                    background: "transparent",
                    border: "1px solid var(--p-border-2)",
                    color: "var(--p-text-2)",
                    borderRadius: 999,
                    padding: "0.45rem 0.85rem",
                    fontSize: "0.8rem",
                    textDecoration: "none",
                  }}
                >
                  Source <ExternalLink size={13} />
                </a>
              )}
            </div>

            {/* Structured Metadata */}
            <PhotoDetails photo={photo} />
          </div>
        </div>
      </div>
    </div>
  );
}

function PhotoLibraryContent() {
  const searchParams = useSearchParams();

  // Read initial values from URL query parameters
  const [q, setQ] = useState(searchParams.get("q") || "");
  const [page, setPage] = useState(
    parseInt(searchParams.get("page") || "1", 10) || 1,
  );
  const [viewMode, setViewMode] = useState<"grid" | "chronological">(
    (searchParams.get("view") as "grid" | "chronological") || "grid",
  );
  const [activePhotoId, setActivePhotoId] = useState<number | null>(
    searchParams.get("photo") ? parseInt(searchParams.get("photo")!, 10) : null,
  );
  const [showFilters, setShowFilters] = useState(false);

  // Filters map
  const [filters, setFilters] = useState<FilterMap>(() => {
    const map: FilterMap = {};
    for (const f of PHOTO_FACET_FIELDS) {
      const v = searchParams.get(f.key);
      if (v) map[f.key] = v;
    }
    return map;
  });

  const [data, setData] = useState<PhotosData | null>(null);
  const [loading, setLoading] = useState(true);
  const [standalonePhoto, setStandalonePhoto] = useState<PhotoItem | null>(
    null,
  );
  const PER_PAGE = 48;

  // Synchronize state with URL search params without triggering Next full navigation
  const syncUrl = useCallback(
    (
      newQ: string,
      newFilters: FilterMap,
      newPage: number,
      newView: string,
      newPhotoId: number | null,
    ) => {
      if (typeof window === "undefined") return;
      const sp = new URLSearchParams();
      if (newQ.trim()) sp.set("q", newQ.trim());
      for (const [k, v] of Object.entries(newFilters)) {
        if (v) sp.set(k, v);
      }
      if (newPage > 1) sp.set("page", String(newPage));
      if (newView !== "grid") sp.set("view", newView);
      if (newPhotoId !== null) sp.set("photo", String(newPhotoId));

      const qs = sp.toString();
      const newPath = qs ? `/archives/photos?${qs}` : "/archives/photos";
      window.history.replaceState(null, "", newPath);
    },
    [],
  );

  const load = useCallback((f: FilterMap, query: string, p: number) => {
    setLoading(true);
    const params = new URLSearchParams({
      page: String(p),
      perPage: String(PER_PAGE),
    });
    for (const [k, v] of Object.entries(f)) if (v) params.set(k, v);
    if (query) params.set("q", query);

    jsonFetch<PhotosData>(`/api/photos?${params.toString()}`)
      .then((d) => {
        if (d) setData(d);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const t = setTimeout(
      () => {
        load(filters, q, page);
        syncUrl(q, filters, page, viewMode, activePhotoId);
      },
      q ? 250 : 0,
    );
    return () => clearTimeout(t);
  }, [filters, q, page, viewMode, activePhotoId, load, syncUrl]);

  // Direct deep-link loader for specific photo if not currently on screen
  useEffect(() => {
    if (!activePhotoId || !data?.items) return;
    const isPresentInList = data.items.some((p) => p.id === activePhotoId);
    if (!isPresentInList) {
      jsonFetch<{ item: PhotoItem }>(`/api/photos?id=${activePhotoId}`)
        .then((res) => {
          if (res?.item) setStandalonePhoto(res.item);
        })
        .catch(() => {});
    }
  }, [activePhotoId, data]);

  const setFilter = (key: string, value: string) => {
    setPage(1);
    setFilters((prev) => {
      const next = { ...prev };
      if (value) next[key] = value;
      else delete next[key];
      return next;
    });
  };

  const clearAllFilters = () => {
    setQ("");
    setFilters({});
    setPage(1);
  };

  const removeSingleFilter = (key: string) => {
    if (key === "q") setQ("");
    else setFilter(key, "");
  };

  const changePage = (p: number) => {
    setPage(p);
    setActivePhotoId(null);
    setStandalonePhoto(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const openPhoto = (photoId: number) => {
    setActivePhotoId(photoId);
    syncUrl(q, filters, page, viewMode, photoId);
  };

  const closePhoto = () => {
    setActivePhotoId(null);
    setStandalonePhoto(null);
    syncUrl(q, filters, page, viewMode, null);
  };

  const activeItems = useMemo(() => data?.items ?? [], [data]);
  const activeIndex = useMemo(
    () =>
      activePhotoId === null
        ? -1
        : activeItems.findIndex((p) => p.id === activePhotoId),
    [activePhotoId, activeItems],
  );

  const activePhoto = useMemo(() => {
    if (activeIndex >= 0) return activeItems[activeIndex];
    return standalonePhoto;
  }, [activeIndex, activeItems, standalonePhoto]);

  // Active filters list for display tags
  const activeFilterEntries = useMemo(() => {
    const list: { key: string; label: string; value: string }[] = [];
    if (q) list.push({ key: "q", label: "Search", value: `“${q}”` });
    for (const [k, v] of Object.entries(filters)) {
      if (!v) continue;
      const meta = PHOTO_FACET_FIELDS.find((f) => f.key === k);
      list.push({ key: k, label: meta?.label || k, value: v });
    }
    return list;
  }, [q, filters]);

  const activeFilterCount = activeFilterEntries.length;

  // Chronological grouping
  const yearGroups = useMemo(() => {
    const map = new Map<string, PhotoItem[]>();
    for (const item of activeItems) {
      const yearKey = item.year ? String(item.year) : "Undated";
      if (!map.has(yearKey)) map.set(yearKey, []);
      map.get(yearKey)!.push(item);
    }
    return Array.from(map.entries()).map(([year, items]) => ({ year, items }));
  }, [activeItems]);

  const totalPages = Math.ceil((data?.total ?? 0) / PER_PAGE);

  // Popular quick facets: Year & Parliament
  const parliamentOptions = useMemo(
    () => data?.facets?.parliament ?? [],
    [data],
  );
  const yearOptions = useMemo(() => data?.facets?.year ?? [], [data]);

  return (
    <div
      style={{
        background: "var(--p-bg)",
        color: "var(--p-text-1)",
        minHeight: "100vh",
      }}
    >
      <PublicHeader />

      {/* ── Hero & Archive Cross-Navigation ── */}
      <section
        id="content"
        style={{
          position: "relative",
          overflow: "hidden",
          borderBottom: "1px solid var(--p-border)",
        }}
      >
        <div className="grid-bg" style={{ position: "absolute", inset: 0 }} />
        <div
          style={{
            position: "relative",
            maxWidth: 1180,
            margin: "0 auto",
            padding: "clamp(3rem, 6vw, 4.5rem) 1.5rem",
          }}
        >
          <Breadcrumbs
            tone="public"
            className="mb-4"
            crumbs={[
              { label: "Archives", href: "/archives" },
              { label: "Photo Library" },
            ]}
          />
          <span
            style={{
              ...mono,
              fontSize: "0.6875rem",
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: "var(--primary)",
            }}
          >
            Archive · Photo Library
          </span>
          <h1
            style={{
              fontFamily: "var(--font-display), sans-serif",
              fontSize: "clamp(2.25rem, 5vw, 3.25rem)",
              letterSpacing: "-0.03em",
              lineHeight: 1.05,
              margin: "0.75rem 0",
              color: "var(--p-text-1)",
            }}
          >
            The photo <span className="p-serif">library</span>
          </h1>
          <p
            style={{
              fontSize: "1.05rem",
              lineHeight: 1.6,
              color: "var(--p-text-2)",
              maxWidth: "42rem",
              margin: 0,
            }}
          >
            Official, parliamentary and historical photographs documenting Rt.
            Hon. Alban Bagbin’s thirty-year career in state service and
            international diplomacy.
          </p>

          {/* Unified Archive Collection Navigation Tabs */}
          <nav
            aria-label="Archive collections"
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "0.5rem",
              marginTop: "1.75rem",
            }}
          >
            {ARCHIVE_COLLECTION_NAV.map((l) => {
              const current = l.href === "/archives/photos";
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  aria-current={current ? "page" : undefined}
                  style={{
                    fontSize: "0.75rem",
                    ...mono,
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    color: current ? "var(--primary-fg)" : "var(--p-text-3)",
                    textDecoration: "none",
                    background: current ? "var(--primary)" : "var(--p-surface)",
                    border: `1px solid ${current ? "var(--primary)" : "var(--p-border)"}`,
                    borderRadius: 999,
                    padding: "0.35rem 0.85rem",
                    fontWeight: current ? 700 : undefined,
                  }}
                >
                  {l.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </section>

      {/* ── Main Library Exploration Section ── */}
      <section
        className="p-section"
        data-motion-entry
        style={{
          maxWidth: 1180,
          margin: "0 auto",
          padding: "clamp(2rem, 4vw, 3.5rem) 1.5rem",
        }}
      >
        {/* ── Search & View Control Toolbar ── */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: "0.75rem",
            marginBottom: "1.25rem",
          }}
        >
          {/* Search Bar */}
          <div
            style={{
              flex: "1 1 300px",
              position: "relative",
              display: "flex",
              alignItems: "center",
            }}
          >
            <Search
              size={16}
              style={{
                position: "absolute",
                left: "1rem",
                color: "var(--p-text-4)",
                pointerEvents: "none",
              }}
            />
            <input
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
              }}
              placeholder="Search captions, events, locations, dignitaries…"
              aria-label="Search photo collection"
              style={{
                width: "100%",
                background: "var(--p-surface)",
                border: "1px solid var(--p-border-3)",
                borderRadius: 999,
                padding: "0.65rem 2.5rem 0.65rem 2.6rem",
                color: "var(--p-text-1)",
                fontSize: "0.9rem",
                outline: "none",
                transition: "border-color 0.2s",
              }}
            />
            {q && (
              <button
                onClick={() => {
                  setQ("");
                  setPage(1);
                }}
                aria-label="Clear search text"
                style={{
                  position: "absolute",
                  right: "0.85rem",
                  background: "none",
                  border: "none",
                  color: "var(--p-text-4)",
                  cursor: "pointer",
                  padding: "0.2rem",
                }}
              >
                <X size={15} />
              </button>
            )}
          </div>

          {/* More Filters Toggle */}
          <button
            onClick={() => setShowFilters((prev) => !prev)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.45rem",
              background:
                activeFilterCount > 0
                  ? "color-mix(in srgb, var(--primary) 14%, transparent)"
                  : "var(--p-surface)",
              border: `1px solid ${activeFilterCount > 0 ? "var(--primary)" : "var(--p-border-3)"}`,
              color:
                activeFilterCount > 0 ? "var(--primary)" : "var(--p-text-1)",
              borderRadius: 999,
              padding: "0.65rem 1.15rem",
              fontSize: "0.85rem",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            <SlidersHorizontal size={15} />
            <span>Filters</span>
            {activeFilterCount > 0 && (
              <span
                style={{
                  ...mono,
                  fontSize: "0.7rem",
                  background: "var(--primary)",
                  color: "var(--primary-fg)",
                  borderRadius: 999,
                  padding: "0.1rem 0.45rem",
                  marginLeft: "0.2rem",
                }}
              >
                {activeFilterCount}
              </span>
            )}
          </button>

          {/* View Mode Toggle: Grid vs Chronological */}
          <div
            style={{
              display: "inline-flex",
              background: "var(--p-surface)",
              border: "1px solid var(--p-border-3)",
              borderRadius: 999,
              padding: "0.2rem",
            }}
          >
            <button
              onClick={() => {
                setViewMode("grid");
                syncUrl(q, filters, page, "grid", activePhotoId);
              }}
              title="Gallery Grid View"
              aria-label="Switch to Gallery Grid view"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.35rem",
                border: "none",
                background:
                  viewMode === "grid" ? "var(--primary)" : "transparent",
                color:
                  viewMode === "grid" ? "var(--primary-fg)" : "var(--p-text-3)",
                borderRadius: 999,
                padding: "0.45rem 0.85rem",
                fontSize: "0.78rem",
                fontWeight: 600,
                cursor: "pointer",
                transition: "background 0.2s, color 0.2s",
              }}
            >
              <LayoutGrid size={14} /> Gallery
            </button>
            <button
              onClick={() => {
                setViewMode("chronological");
                syncUrl(q, filters, page, "chronological", activePhotoId);
              }}
              title="Chronological Archive View"
              aria-label="Switch to Chronological Archive view"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.35rem",
                border: "none",
                background:
                  viewMode === "chronological"
                    ? "var(--primary)"
                    : "transparent",
                color:
                  viewMode === "chronological"
                    ? "var(--primary-fg)"
                    : "var(--p-text-3)",
                borderRadius: 999,
                padding: "0.45rem 0.85rem",
                fontSize: "0.78rem",
                fontWeight: 600,
                cursor: "pointer",
                transition: "background 0.2s, color 0.2s",
              }}
            >
              <Calendar size={14} /> By Year
            </button>
          </div>
        </div>

        {/* ── Quick Facet Pills Strip: Parliaments & Year ── */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "0.65rem",
            marginBottom: "1.25rem",
          }}
        >
          {parliamentOptions.length > 0 && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.4rem",
                overflowX: "auto",
                paddingBottom: "0.2rem",
              }}
            >
              <span
                style={{
                  ...mono,
                  fontSize: "0.65rem",
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  color: "var(--p-text-4)",
                  minWidth: "4.5rem",
                }}
              >
                Parliament
              </span>
              <button
                onClick={() => setFilter("parliament", "")}
                style={{
                  fontSize: "0.72rem",
                  ...mono,
                  textTransform: "uppercase",
                  border: `1px solid ${!filters.parliament ? "var(--primary)" : "var(--p-border)"}`,
                  background: !filters.parliament
                    ? "var(--primary)"
                    : "var(--p-surface)",
                  color: !filters.parliament
                    ? "var(--primary-fg)"
                    : "var(--p-text-3)",
                  borderRadius: 999,
                  padding: "0.25rem 0.65rem",
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                }}
              >
                All
              </button>
              {parliamentOptions.map((p) => {
                const active = filters.parliament === p.value;
                return (
                  <button
                    key={p.value}
                    onClick={() =>
                      setFilter("parliament", active ? "" : p.value)
                    }
                    style={{
                      fontSize: "0.72rem",
                      ...mono,
                      border: `1px solid ${active ? "var(--primary)" : "var(--p-border)"}`,
                      background: active
                        ? "var(--primary)"
                        : "var(--p-surface)",
                      color: active ? "var(--primary-fg)" : "var(--p-text-2)",
                      borderRadius: 999,
                      padding: "0.25rem 0.65rem",
                      cursor: "pointer",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {p.value} ({p.count})
                  </button>
                );
              })}
            </div>
          )}

          {yearOptions.length > 0 && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.4rem",
                overflowX: "auto",
                paddingBottom: "0.2rem",
              }}
            >
              <span
                style={{
                  ...mono,
                  fontSize: "0.65rem",
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  color: "var(--p-text-4)",
                  minWidth: "4.5rem",
                }}
              >
                Year
              </span>
              <button
                onClick={() => setFilter("year", "")}
                style={{
                  fontSize: "0.72rem",
                  ...mono,
                  textTransform: "uppercase",
                  border: `1px solid ${!filters.year ? "var(--primary)" : "var(--p-border)"}`,
                  background: !filters.year
                    ? "var(--primary)"
                    : "var(--p-surface)",
                  color: !filters.year
                    ? "var(--primary-fg)"
                    : "var(--p-text-3)",
                  borderRadius: 999,
                  padding: "0.25rem 0.65rem",
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                }}
              >
                All
              </button>
              {yearOptions.map((y) => {
                const active = filters.year === y.value;
                return (
                  <button
                    key={y.value}
                    onClick={() => setFilter("year", active ? "" : y.value)}
                    style={{
                      fontSize: "0.72rem",
                      ...mono,
                      border: `1px solid ${active ? "var(--primary)" : "var(--p-border)"}`,
                      background: active
                        ? "var(--primary)"
                        : "var(--p-surface)",
                      color: active ? "var(--primary-fg)" : "var(--p-text-2)",
                      borderRadius: 999,
                      padding: "0.25rem 0.65rem",
                      cursor: "pointer",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {y.value}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Expandable Secondary Filters Panel ── */}
        {showFilters && (
          <div
            style={{
              background: "var(--p-surface)",
              border: "1px solid var(--p-border-3)",
              borderRadius: 16,
              padding: "1.25rem",
              marginBottom: "1.5rem",
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: "0.85rem",
            }}
          >
            {PHOTO_FACET_FIELDS.filter(
              (f) => f.key !== "year" && f.key !== "parliament",
            ).map((f) => {
              const options = data?.facets[f.key] || [];
              return (
                <div key={f.key}>
                  <label
                    htmlFor={`filter-${f.key}`}
                    style={{
                      display: "block",
                      ...mono,
                      fontSize: "0.65rem",
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                      color: "var(--p-text-3)",
                      marginBottom: "0.35rem",
                    }}
                  >
                    {f.label}
                  </label>
                  <select
                    id={`filter-${f.key}`}
                    value={filters[f.key] || ""}
                    onChange={(e) => setFilter(f.key, e.target.value)}
                    style={{
                      width: "100%",
                      background: "var(--p-surface-2)",
                      border: "1px solid var(--p-border-3)",
                      borderRadius: 8,
                      padding: "0.5rem 0.75rem",
                      color: "var(--p-text-1)",
                      fontSize: "0.82rem",
                      outline: "none",
                    }}
                  >
                    <option value="">All {f.label.toLowerCase()}s</option>
                    {options.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.value} ({o.count})
                      </option>
                    ))}
                  </select>
                </div>
              );
            })}
          </div>
        )}

        {/* ── Active Filters Bar & Summary ── */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "0.75rem",
            marginBottom: "1.5rem",
          }}
        >
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              gap: "0.45rem",
            }}
          >
            <span
              style={{
                fontSize: "0.85rem",
                color: "var(--p-text-3)",
                marginRight: "0.35rem",
              }}
            >
              {loading
                ? "Searching archive…"
                : `${(data?.total ?? 0).toLocaleString()} photograph${data?.total === 1 ? "" : "s"} found`}
            </span>

            {activeFilterEntries.map((e) => (
              <span
                key={e.key}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.35rem",
                  fontSize: "0.72rem",
                  background: "var(--p-surface)",
                  border: "1px solid var(--p-border-3)",
                  color: "var(--p-text-1)",
                  borderRadius: 999,
                  padding: "0.2rem 0.6rem",
                }}
              >
                <span style={{ color: "var(--p-text-4)" }}>{e.label}:</span>
                <strong style={{ color: "var(--primary)" }}>{e.value}</strong>
                <button
                  onClick={() => removeSingleFilter(e.key)}
                  aria-label={`Remove filter for ${e.label}`}
                  style={{
                    background: "none",
                    border: "none",
                    color: "var(--p-text-3)",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    padding: 0,
                  }}
                >
                  <X size={12} />
                </button>
              </span>
            ))}
          </div>

          {activeFilterCount > 0 && (
            <button
              onClick={clearAllFilters}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.35rem",
                background: "none",
                border: "none",
                color: "var(--primary)",
                fontSize: "0.8rem",
                fontWeight: 600,
                cursor: "pointer",
                padding: "0.2rem 0.5rem",
              }}
            >
              <RotateCcw size={13} /> Reset filters
            </button>
          )}
        </div>

        {/* ── Content View (Skeleton vs Empty vs Gallery Grid vs Chronological) ── */}
        {loading && activeItems.length === 0 ? (
          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fill, minmax(min(100%, 260px), 1fr))",
              gap: "1.25rem",
            }}
          >
            {Array.from({ length: 12 }).map((_, i) => (
              <div
                key={i}
                style={{
                  borderRadius: 14,
                  border: "1px solid var(--p-border)",
                  background: "var(--p-surface)",
                  overflow: "hidden",
                  height: 320,
                  opacity: 0.7,
                }}
              >
                <div
                  style={{
                    aspectRatio: "4/3",
                    background: "var(--p-surface-2)",
                  }}
                />
                <div style={{ padding: "0.85rem" }}>
                  <div
                    style={{
                      width: "60%",
                      height: 14,
                      background: "var(--p-surface-2)",
                      borderRadius: 4,
                      marginBottom: "0.6rem",
                    }}
                  />
                  <div
                    style={{
                      width: "90%",
                      height: 12,
                      background: "var(--p-surface-2)",
                      borderRadius: 4,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        ) : activeItems.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              padding: "5rem 1.5rem",
              border: "1px dashed var(--p-border)",
              borderRadius: 20,
            }}
          >
            <Search
              size={36}
              style={{ color: "var(--p-text-4)", marginBottom: "1rem" }}
            />
            <h3
              style={{
                fontSize: "1.15rem",
                color: "var(--p-text-1)",
                margin: "0 0 0.5rem",
              }}
            >
              No photographs match your search
            </h3>
            <p
              style={{
                color: "var(--p-text-3)",
                fontSize: "0.9rem",
                maxWidth: "28rem",
                margin: "0 auto 1.5rem",
              }}
            >
              We could not find any photographs matching the selected criteria.
              Try removing some filters or searching with different terms.
            </p>
            <button
              onClick={clearAllFilters}
              style={{
                background: "var(--primary)",
                color: "var(--primary-fg)",
                border: "none",
                borderRadius: 999,
                padding: "0.6rem 1.4rem",
                fontSize: "0.85rem",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Clear all filters
            </button>
          </div>
        ) : viewMode === "grid" ? (
          /* ── View 1: Responsive Gallery Grid ── */
          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fill, minmax(min(100%, 260px), 1fr))",
              gap: "1.25rem",
            }}
          >
            {activeItems.map((p) => (
              <div
                key={p.id}
                role="button"
                tabIndex={0}
                onClick={() => openPhoto(p.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    openPhoto(p.id);
                  }
                }}
                className="p-card-lift"
                style={{
                  border: "1px solid var(--p-border)",
                  background: "var(--p-surface)",
                  borderRadius: 14,
                  overflow: "hidden",
                  cursor: "pointer",
                  display: "flex",
                  flexDirection: "column",
                  textAlign: "left",
                  position: "relative",
                }}
              >
                {/* Image Container with 4:3 Proportion */}
                <div
                  style={{
                    position: "relative",
                    aspectRatio: "4/3",
                    overflow: "hidden",
                    background: "var(--p-img-bg)",
                  }}
                >
                  {p.src && (
                    <img
                      src={p.src}
                      alt={p.caption || `Photograph #${p.id}`}
                      loading="lazy"
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                        transition: "transform 0.35s ease",
                      }}
                      className="photo-card-img"
                    />
                  )}
                  {/* Subtle zoom icon badge */}
                  <div
                    style={{
                      position: "absolute",
                      right: "0.65rem",
                      top: "0.65rem",
                      width: 30,
                      height: 30,
                      borderRadius: "50%",
                      background: "rgba(15, 17, 23, 0.75)",
                      backdropFilter: "blur(4px)",
                      color: "#fff",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      opacity: 0.85,
                    }}
                  >
                    <ZoomIn size={14} />
                  </div>
                </div>

                {/* Card Details */}
                <div
                  style={{
                    padding: "0.85rem 1rem",
                    display: "flex",
                    flexDirection: "column",
                    flex: 1,
                  }}
                >
                  {/* Date & Parliament Pill */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: "0.5rem",
                      marginBottom: "0.45rem",
                    }}
                  >
                    <span
                      style={{
                        ...mono,
                        fontSize: "0.72rem",
                        fontWeight: 700,
                        color: "var(--primary)",
                      }}
                    >
                      {p.year || "Undated"}
                    </span>
                    {p.parliament && (
                      <span
                        style={{
                          fontSize: "0.65rem",
                          color: "var(--p-text-4)",
                          ...mono,
                          textTransform: "uppercase",
                        }}
                      >
                        {p.parliament}
                      </span>
                    )}
                  </div>

                  {/* Caption */}
                  <h3
                    style={{
                      fontSize: "0.875rem",
                      fontWeight: 600,
                      color: "var(--p-text-1)",
                      lineHeight: 1.4,
                      margin: "0 0 0.5rem",
                      display: "-webkit-box",
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden",
                    }}
                  >
                    {p.caption || p.event || `Historical photograph #${p.id}`}
                  </h3>

                  {/* Context pills */}
                  <div
                    style={{
                      marginTop: "auto",
                      display: "flex",
                      flexWrap: "wrap",
                      gap: "0.3rem",
                    }}
                  >
                    {p.location && (
                      <span
                        style={{
                          fontSize: "0.65rem",
                          color: "var(--p-text-3)",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "0.2rem",
                        }}
                      >
                        <MapPin size={11} /> {p.location}
                      </span>
                    )}
                    {p.theme && (
                      <span
                        style={{
                          fontSize: "0.65rem",
                          color: "var(--p-text-4)",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "0.2rem",
                        }}
                      >
                        <Tag size={10} /> {p.theme}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* ── View 2: Chronological Archive by Year ── */
          <div
            style={{ display: "flex", flexDirection: "column", gap: "3rem" }}
          >
            {yearGroups.map((group) => (
              <section key={group.year} aria-label={`Year ${group.year}`}>
                {/* Year Header */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "baseline",
                    gap: "1rem",
                    marginBottom: "1.25rem",
                  }}
                >
                  <h3
                    style={{
                      margin: 0,
                      fontFamily: "var(--font-serif), Georgia, serif",
                      fontStyle: "italic",
                      fontWeight: 500,
                      fontSize: "2rem",
                      lineHeight: 1,
                      letterSpacing: "-0.01em",
                      color: "var(--p-text-1)",
                    }}
                  >
                    {group.year}
                  </h3>
                  <span
                    aria-hidden
                    style={{
                      flex: 1,
                      height: 1,
                      background: "var(--p-border)",
                    }}
                  />
                  <span
                    style={{
                      ...mono,
                      fontSize: "0.75rem",
                      letterSpacing: "0.08em",
                      color: "var(--p-text-4)",
                    }}
                  >
                    {group.items.length} photograph
                    {group.items.length === 1 ? "" : "s"}
                  </span>
                </div>

                {/* Photo grid for this year */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns:
                      "repeat(auto-fill, minmax(min(100%, 250px), 1fr))",
                    gap: "1rem",
                  }}
                >
                  {group.items.map((p) => (
                    <div
                      key={p.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => openPhoto(p.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          openPhoto(p.id);
                        }
                      }}
                      className="p-card-lift"
                      style={{
                        border: "1px solid var(--p-border)",
                        background: "var(--p-surface)",
                        borderRadius: 12,
                        overflow: "hidden",
                        cursor: "pointer",
                        display: "flex",
                        flexDirection: "column",
                      }}
                    >
                      <div
                        style={{
                          aspectRatio: "4/3",
                          overflow: "hidden",
                          background: "var(--p-img-bg)",
                        }}
                      >
                        {p.src && (
                          <img
                            src={p.src}
                            alt={p.caption || `Photograph #${p.id}`}
                            loading="lazy"
                            style={{
                              width: "100%",
                              height: "100%",
                              objectFit: "cover",
                            }}
                          />
                        )}
                      </div>
                      <div style={{ padding: "0.75rem 0.85rem" }}>
                        <div
                          style={{
                            fontSize: "0.82rem",
                            fontWeight: 600,
                            color: "var(--p-text-1)",
                            lineHeight: 1.35,
                            display: "-webkit-box",
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: "vertical",
                            overflow: "hidden",
                            marginBottom: "0.35rem",
                          }}
                        >
                          {p.caption || p.event || `Photograph #${p.id}`}
                        </div>
                        {p.event && (
                          <div
                            style={{
                              fontSize: "0.7rem",
                              color: "var(--p-text-3)",
                              ...mono,
                            }}
                          >
                            {p.event}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}

        {/* ── Project Standard Numbered Pagination ── */}
        {totalPages > 1 && (
          <nav
            aria-label="Pagination navigation"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "0.4rem",
              marginTop: "3rem",
              flexWrap: "wrap",
            }}
          >
            {(() => {
              const start = Math.max(1, Math.min(page - 4, totalPages - 9));
              const nums = Array.from(
                { length: Math.min(10, totalPages) },
                (_, i) => start + i,
              );
              const pageBtn = (
                label: React.ReactNode,
                target: number,
                opts?: {
                  active?: boolean;
                  disabled?: boolean;
                  key?: number | string;
                },
              ) => (
                <button
                  key={opts?.key}
                  disabled={opts?.disabled}
                  onClick={() => changePage(target)}
                  style={{
                    minWidth: 38,
                    height: 38,
                    borderRadius: 999,
                    cursor: opts?.disabled ? "not-allowed" : "pointer",
                    fontSize: "0.8rem",
                    fontFamily: "var(--font-mono), monospace",
                    border: "1px solid var(--p-border-3)",
                    background: opts?.active
                      ? "var(--primary)"
                      : "var(--p-surface)",
                    color: opts?.active
                      ? "var(--primary-fg)"
                      : opts?.disabled
                        ? "var(--p-text-4)"
                        : "var(--p-text-1)",
                    padding: "0 0.9rem",
                    transition:
                      "background 0.15s, color 0.15s, border-color 0.15s",
                  }}
                >
                  {label}
                </button>
              );
              return (
                <>
                  {pageBtn(
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "0.3rem",
                      }}
                    >
                      <ChevronLeft size={14} /> Prev
                    </span>,
                    page - 1,
                    { disabled: page <= 1, key: "prev" },
                  )}
                  {nums.map((p) =>
                    pageBtn(p, p, { active: p === page, key: p }),
                  )}
                  {pageBtn(
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "0.3rem",
                      }}
                    >
                      Next <ChevronRight size={14} />
                    </span>,
                    page + 1,
                    { disabled: page >= totalPages, key: "next" },
                  )}
                </>
              );
            })()}
          </nav>
        )}
      </section>

      {/* ── Lightbox Dialog ── */}
      {activePhoto && (
        <PhotoLightbox
          photo={activePhoto}
          index={activeIndex >= 0 ? activeIndex : 0}
          total={activeItems.length > 0 ? activeItems.length : 1}
          onClose={closePhoto}
          onPrev={
            activeIndex > 0
              ? () => openPhoto(activeItems[activeIndex - 1].id)
              : undefined
          }
          onNext={
            activeIndex < activeItems.length - 1
              ? () => openPhoto(activeItems[activeIndex + 1].id)
              : undefined
          }
        />
      )}

      <PublicFooter />
    </div>
  );
}

export default function PhotosPage() {
  return (
    <Suspense
      fallback={
        <div
          style={{
            background: "var(--p-bg)",
            color: "var(--p-text-1)",
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <span
            style={{ ...mono, fontSize: "0.85rem", color: "var(--p-text-3)" }}
          >
            Loading Photo Library…
          </span>
        </div>
      }
    >
      <PhotoLibraryContent />
    </Suspense>
  );
}
