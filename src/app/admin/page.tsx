"use client";

import {
  useEffect,
  useState,
  useCallback,
  FormEvent,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Eye,
  Trash2,
  ExternalLink,
  Plus,
  Download,
  Music,
  Play,
  FileText,
  Search,
  ChevronDown,
  LayoutDashboard,
  Pencil,
  Monitor,
  Image as ImageIcon,
  Video,
  Newspaper,
  Headphones,
  Save,
  ListPlus,
  Tags,
  FileInput,
  type LucideIcon,
} from "lucide-react";
import {
  Modal,
  AnimBtn,
  AnimLink,
  Toast,
  SkeletonTable,
  EmptyState,
} from "@/components/ui";
import { Pagination } from "@/components/ui/Pagination";
import { localToMediaUrl, isYouTubeUrl, getYouTubeEmbedUrl } from "@/lib/media";

interface MediaItem {
  id: number;
  source?: string;
  query?: string;
  url?: string;
  localPath?: string | null;
  title?: string;
  channel?: string;
  platform?: string;
  views?: number | null;
  duration?: number | null;
  artist?: string;
  sourceName?: string;
  date?: string;
  snippet?: string;
  faceCount?: number | null;
  faceMatch?: number | null;
  collectedAt?: string | null;
  [key: string]: unknown;
}

interface AdminData {
  items: MediaItem[];
  total: number;
  page: number;
  perPage: number;
  sources: string[];
}

interface SourceCount {
  source: string;
  count: number;
}

interface TrendPoint {
  date: string;
  count: number;
}

interface StatsData {
  counts: {
    images: number;
    videos: number;
    news: number;
    audio: number;
    total: number;
  };
  images: { withFaces: number; faceMatches: number };
  sources: {
    images: SourceCount[];
    videos: SourceCount[];
    news: SourceCount[];
    audio: SourceCount[];
  };
  recent: {
    images: MediaItem[];
    videos: MediaItem[];
    news: MediaItem[];
    audio: MediaItem[];
  };
  trend: {
    images: TrendPoint[];
    videos: TrendPoint[];
    news: TrendPoint[];
    audio: TrendPoint[];
    labels: string[];
  };
  activity: { username: string; count: number }[];
}

type Tab = "dashboard" | "images" | "videos" | "news" | "audio";
type ViewMode = "details" | "edit" | "public";

const TAB_ICONS: Record<Exclude<Tab, "dashboard">, LucideIcon> = {
  images: ImageIcon,
  videos: Video,
  news: Newspaper,
  audio: Headphones,
};

const TAB_LABELS: Record<Exclude<Tab, "dashboard">, string> = {
  images: "Images",
  videos: "Videos",
  news: "News",
  audio: "Audio",
};

function getMediaUrl(item: {
  localPath?: string | null;
  url?: string | null;
}): string | null {
  if (item.localPath) {
    const rel = item.localPath.replace(
      "/home/hollali/Projects/portal/public",
      "",
    );
    return rel;
  }
  return item.url || null;
}

function formatDuration(duration?: number | null): string {
  if (!duration) return "";
  const m = Math.floor(duration / 60);
  const s = duration % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function AdminPage() {
  const router = useRouter();
  const [data, setData] = useState<AdminData | null>(null);
  const [tab, setTab] = useState<Tab>("dashboard");
  const [page, setPage] = useState(1);
  const [showAdd, setShowAdd] = useState(false);
  const [toast, setToast] = useState<{
    message: string;
    type?: "success" | "error";
  } | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [viewItem, setViewItem] = useState<MediaItem | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("details");
  const [deleting, setDeleting] = useState(false);
  const [search, setSearch] = useState("");
  const [source, setSource] = useState("");
  const [tags, setTags] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState("id");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [stats, setStats] = useState<StatsData | null>(null);
  const [editing, setEditing] = useState(false);
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [bulkImporting, setBulkImporting] = useState(false);
  const [showCsvImport, setShowCsvImport] = useState(false);
  const [csvImporting, setCsvImporting] = useState(false);
  const [showBulkOps, setShowBulkOps] = useState(false);
  const [bulkTagMode, setBulkTagMode] = useState<"add" | "remove">("add");
  const [bulkTagValue, setBulkTagValue] = useState("");
  const [bulkReassignValue, setBulkReassignValue] = useState("");
  const [bulkOperating, setBulkOperating] = useState(false);

  const buildParams = useCallback(
    () =>
      new URLSearchParams({
        type: tab,
        page: String(page),
        perPage: "20",
        search,
        source,
        tags,
        dateFrom,
        dateTo,
        sort,
        dir: sortDir,
      }),
    [tab, page, search, source, tags, dateFrom, dateTo, sort, sortDir],
  );

  const fetchData = useCallback(async () => {
    const res = await fetch(`/api/admin/${tab}?${buildParams()}`);
    const d: AdminData = await res.json();
    setData(d);
  }, [tab, buildParams]);

  const fetchStats = useCallback(async () => {
    const res = await fetch("/api/admin/stats");
    if (res.ok) {
      const d = await res.json();
      setStats(d);
    }
  }, []);

  useEffect(() => {
    fetch("/api/me")
      .then((r) => r.json())
      .then((d) => {
        if (!d.isAdmin) {
          router.push("/login");
          return;
        }
        setIsAdmin(true);
        fetchStats();
      });
  }, [router, fetchStats]);

  useEffect(() => {
    if (!isAdmin || tab === "dashboard") return;
    let active = true;
    (async () => {
      try {
        const res = await fetch(`/api/admin/${tab}?${buildParams()}`);
        const d: AdminData = await res.json();
        if (active) setData(d);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [isAdmin, tab, buildParams]);

  const filterKey = `${tab}|${search}|${source}|${tags}|${dateFrom}|${dateTo}`;
  const [prevFilterKey, setPrevFilterKey] = useState(filterKey);
  if (prevFilterKey !== filterKey) {
    setPrevFilterKey(filterKey);
    setPage(1);
    setSelected(new Set());
  }

  const toggleSelect = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (!data) return;
    const currentIds = data.items.map((i) => i.id);
    const allSelected = currentIds.every((id: number) => selected.has(id));
    if (allSelected) {
      setSelected((prev) => {
        const next = new Set(prev);
        currentIds.forEach((id: number) => next.delete(id));
        return next;
      });
    } else {
      setSelected((prev) => {
        const next = new Set(prev);
        currentIds.forEach((id: number) => next.add(id));
        return next;
      });
    }
  };

  const handleDeleteSelected = async () => {
    if (selected.size === 0) return;
    if (!confirm(`Delete ${selected.size} selected item(s)?`)) return;
    setDeleting(true);
    const formData = new FormData();
    formData.set("action", "delete_image");
    formData.set("pks", Array.from(selected).join(","));
    formData.set("type", tab);
    const res = await fetch(`/api/admin/${tab}`, {
      method: "POST",
      body: formData,
    });
    setDeleting(false);
    if (res.ok) {
      setToast({ message: `Deleted ${selected.size} item(s)` });
      setSelected(new Set());
      fetchData();
      fetchStats();
    } else {
      setToast({ message: "Failed to delete", type: "error" });
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this item?")) return;
    const formData = new FormData();
    formData.set("action", "delete_image");
    formData.set("pks", String(id));
    formData.set("type", tab);
    const res = await fetch(`/api/admin/${tab}`, {
      method: "POST",
      body: formData,
    });
    if (res.ok) {
      setToast({ message: "Item deleted" });
      setViewItem(null);
      fetchData();
      fetchStats();
    } else {
      setToast({ message: "Failed to delete", type: "error" });
    }
  };

  const handleBulkImport = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setBulkImporting(true);
    const form = e.currentTarget;
    const formData = new FormData(form);
    formData.set("action", "bulk_import");
    formData.set("type", tab);
    const res = await fetch(`/api/admin/${tab}`, {
      method: "POST",
      body: formData,
    });
    const d = await res.json();
    setBulkImporting(false);
    if (res.ok) {
      setToast({
        message: `Imported ${d.created} record(s), skipped ${d.skipped} duplicate(s)`,
      });
      setShowBulkImport(false);
      fetchData();
      fetchStats();
    } else {
      setToast({ message: d.error || "Failed to import", type: "error" });
    }
  };

  const handleDeleteFiltered = async () => {
    if (!data || data.total === 0) return;
    if (
      !confirm(
        `This will delete ALL ${data.total} currently filtered ${tab} record(s). This cannot be undone. Continue?`,
      )
    )
      return;
    setDeleting(true);
    const formData = new FormData();
    formData.set("action", "delete_filtered");
    formData.set("type", tab);
    formData.set("search", search);
    formData.set("source", source);
    formData.set("tags", tags);
    formData.set("dateFrom", dateFrom);
    formData.set("dateTo", dateTo);
    const res = await fetch(`/api/admin/${tab}`, {
      method: "POST",
      body: formData,
    });
    const d = await res.json();
    setDeleting(false);
    if (res.ok) {
      setToast({ message: `Deleted ${d.deleted} record(s)` });
      setSelected(new Set());
      fetchData();
      fetchStats();
    } else {
      setToast({ message: d.error || "Failed to delete", type: "error" });
    }
  };

  const handleBulkTag = async () => {
    if (selected.size === 0 || !bulkTagValue.trim()) return;
    setBulkOperating(true);
    const formData = new FormData();
    formData.set("action", "bulk_tag");
    formData.set("type", tab);
    formData.set("pks", Array.from(selected).join(","));
    formData.set("tags", bulkTagValue);
    formData.set("mode", bulkTagMode);
    const res = await fetch(`/api/admin/${tab}`, {
      method: "POST",
      body: formData,
    });
    const d = await res.json();
    setBulkOperating(false);
    if (res.ok) {
      setToast({ message: `Updated tags on ${d.updated} item(s)` });
      setShowBulkOps(false);
      setBulkTagValue("");
      setSelected(new Set());
      fetchData();
    } else {
      setToast({ message: d.error || "Failed to update tags", type: "error" });
    }
  };

  const handleBulkReassign = async () => {
    if (selected.size === 0 || !bulkReassignValue.trim()) return;
    setBulkOperating(true);
    const formData = new FormData();
    formData.set("action", "bulk_reassign");
    formData.set("type", tab);
    formData.set("pks", Array.from(selected).join(","));
    formData.set("source", bulkReassignValue);
    const res = await fetch(`/api/admin/${tab}`, {
      method: "POST",
      body: formData,
    });
    const d = await res.json();
    setBulkOperating(false);
    if (res.ok) {
      setToast({ message: `Reassigned source on ${d.updated} item(s)` });
      setShowBulkOps(false);
      setBulkReassignValue("");
      setSelected(new Set());
      fetchData();
    } else {
      setToast({ message: d.error || "Failed to reassign", type: "error" });
    }
  };

  const handleCsvImport = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setCsvImporting(true);
    const form = e.currentTarget;
    const formData = new FormData(form);
    formData.set("action", "csv_import");
    formData.set("type", tab);
    const res = await fetch(`/api/admin/${tab}`, {
      method: "POST",
      body: formData,
    });
    const d = await res.json();
    setCsvImporting(false);
    if (res.ok) {
      setToast({
        message: `Imported ${d.created} record(s)${d.failed ? `, ${d.failed} failed` : ""}`,
      });
      setShowCsvImport(false);
      fetchData();
      fetchStats();
    } else {
      setToast({ message: d.error || "Failed to import", type: "error" });
    }
  };

  const handleExportSelected = (format: "json" | "csv") => {
    if (selected.size === 0) return;
    const items = (data?.items || []).filter((i) => selected.has(i.id));
    let blob: Blob;
    if (format === "json") {
      blob = new Blob([JSON.stringify(items, null, 2)], {
        type: "application/json",
      });
    } else {
      const fields = Object.keys(items[0] || {});
      const rows = [
        fields.join(","),
        ...items.map((it: MediaItem) =>
          fields
            .map((f) => `"${String(it[f] ?? "").replace(/"/g, '""')}"`)
            .join(","),
        ),
      ];
      blob = new Blob([rows.join("\n")], { type: "text/csv" });
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${tab}_selected_${Date.now()}.${format}`;
    a.click();
    URL.revokeObjectURL(url);
    setToast({ message: `Exported ${items.length} selected item(s)` });
  };

  const handleAdd = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);
    formData.set("action", "add");
    formData.set("type", tab);
    const res = await fetch(`/api/admin/${tab}`, {
      method: "POST",
      body: formData,
    });
    if (res.ok) {
      setToast({ message: "Item added" });
      setShowAdd(false);
      fetchData();
      fetchStats();
    } else {
      setToast({ message: "Failed to add", type: "error" });
    }
  };

  const handleEdit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!viewItem) return;
    setEditing(true);
    const form = e.currentTarget;
    const formData = new FormData(form);
    formData.set("action", "edit");
    formData.set("type", tab);
    formData.set("id", String(viewItem.id));
    const res = await fetch(`/api/admin/${tab}`, {
      method: "POST",
      body: formData,
    });
    setEditing(false);
    if (res.ok) {
      const d = await res.json();
      setToast({ message: `Updated #${viewItem.id}` });
      setViewItem(d.item);
      setViewMode("details");
      fetchData();
    } else {
      const d = await res.json();
      setToast({ message: d.error || "Failed to update", type: "error" });
    }
  };

  const handleExport = (format: "json" | "csv") => {
    const params = new URLSearchParams({
      type: tab,
      export: format,
      search,
      source,
      tags,
      dateFrom,
      dateTo,
    });
    window.open(`/api/admin/${tab}?${params}`, "_blank");
  };

  const handleSort = (field: string) => {
    if (sort === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSort(field);
      setSortDir("desc");
    }
  };

  const openView = (item: MediaItem) => {
    setViewItem(item);
    setViewMode("details");
  };

  const allIds = data?.items.map((i) => i.id) || [];
  const allSelected =
    allIds.length > 0 && allIds.every((id: number) => selected.has(id));
  const totalPages = data ? Math.ceil(data.total / 20) : 1;

  if (!isAdmin)
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <SkeletonTable rows={5} cols={5} />
      </div>
    );

  return (
    <div className="page-enter">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl font-bold mb-1">Admin Panel</h1>
          <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
            Manage all collected media — dashboard, edit, preview, and delete
            records.
          </p>
        </div>
        {tab !== "dashboard" && (
          <div className="flex items-center gap-2">
            {selected.size > 0 && (
              <>
                <AnimBtn
                  onClick={() => handleExportSelected("json")}
                  title="Export only selected rows"
                  style={{
                    padding: "0.5rem 0.75rem",
                    background: "var(--card)",
                    border: "1px solid var(--primary)",
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    gap: "0.25rem",
                    color: "var(--primary)",
                  }}
                >
                  <Download size={12} /> Sel. JSON
                </AnimBtn>
                <AnimBtn
                  onClick={() => handleExportSelected("csv")}
                  title="Export only selected rows"
                  style={{
                    padding: "0.5rem 0.75rem",
                    background: "var(--card)",
                    border: "1px solid var(--primary)",
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    gap: "0.25rem",
                    color: "var(--primary)",
                  }}
                >
                  <Download size={12} /> Sel. CSV
                </AnimBtn>
              </>
            )}
            <AnimBtn
              onClick={() => handleExport("json")}
              style={{
                padding: "0.5rem 0.75rem",
                background: "var(--card)",
                border: "1px solid var(--border)",
                fontSize: "0.75rem",
                fontWeight: 600,
                gap: "0.25rem",
              }}
            >
              <Download size={12} /> JSON
            </AnimBtn>
            <AnimBtn
              onClick={() => handleExport("csv")}
              style={{
                padding: "0.5rem 0.75rem",
                background: "var(--card)",
                border: "1px solid var(--border)",
                fontSize: "0.75rem",
                fontWeight: 600,
                gap: "0.25rem",
              }}
            >
              <Download size={12} /> CSV
            </AnimBtn>
          </div>
        )}
      </div>

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      {/* Tabs */}
      <div className="flex gap-2 mb-4 flex-wrap">
        <AnimBtn
          onClick={() => setTab("dashboard")}
          style={{
            padding: "0.5rem 1rem",
            background: tab === "dashboard" ? "var(--primary)" : "var(--card)",
            color:
              tab === "dashboard" ? "var(--primary-fg)" : "var(--foreground)",
            fontWeight: 600,
            fontSize: "0.875rem",
            gap: "0.375rem",
            border: tab === "dashboard" ? "none" : "1px solid var(--border)",
          }}
        >
          <LayoutDashboard size={14} /> Dashboard
        </AnimBtn>
        {(
          ["images", "videos", "news", "audio"] as Exclude<Tab, "dashboard">[]
        ).map((t) => {
          const Icon = TAB_ICONS[t];
          return (
            <AnimBtn
              key={t}
              onClick={() => setTab(t)}
              style={{
                padding: "0.5rem 1rem",
                background: tab === t ? "var(--primary)" : "var(--card)",
                color: tab === t ? "var(--primary-fg)" : "var(--foreground)",
                fontWeight: 600,
                fontSize: "0.875rem",
                gap: "0.375rem",
                border: tab === t ? "none" : "1px solid var(--border)",
              }}
            >
              <Icon size={14} /> {TAB_LABELS[t]} (
              {tab === t && data
                ? data.total
                : (stats ? stats.counts[t] : 0) || 0}
              )
            </AnimBtn>
          );
        })}
        {tab !== "dashboard" && (
          <>
            <AnimBtn
              onClick={() => setShowAdd(true)}
              style={{
                padding: "0.5rem 1rem",
                background: "var(--primary)",
                color: "var(--primary-fg)",
                fontWeight: 600,
                fontSize: "0.875rem",
                gap: "0.375rem",
              }}
            >
              <Plus size={14} /> Add New
            </AnimBtn>
            <AnimBtn
              onClick={() => setShowBulkImport(true)}
              style={{
                padding: "0.5rem 1rem",
                background: "var(--card)",
                border: "1px solid var(--border)",
                color: "var(--foreground)",
                fontWeight: 600,
                fontSize: "0.875rem",
                gap: "0.375rem",
              }}
            >
              <ListPlus size={14} /> Bulk Import
            </AnimBtn>
            <AnimBtn
              onClick={() => setShowCsvImport(true)}
              style={{
                padding: "0.5rem 1rem",
                background: "var(--card)",
                border: "1px solid var(--border)",
                color: "var(--foreground)",
                fontWeight: 600,
                fontSize: "0.875rem",
                gap: "0.375rem",
              }}
            >
              <FileInput size={14} /> CSV Import
            </AnimBtn>
            {selected.size > 0 && (
              <AnimBtn
                onClick={() => setShowBulkOps(true)}
                style={{
                  padding: "0.5rem 1rem",
                  background: "var(--card)",
                  border: "1px solid var(--border)",
                  color: "var(--primary)",
                  fontWeight: 600,
                  fontSize: "0.875rem",
                  gap: "0.375rem",
                }}
              >
                <Tags size={14} /> Bulk Actions ({selected.size})
              </AnimBtn>
            )}
            {data && data.total > 0 && (
              <AnimBtn
                onClick={handleDeleteFiltered}
                disabled={deleting}
                style={{
                  padding: "0.5rem 1rem",
                  background: "var(--danger)",
                  color: "white",
                  fontWeight: 600,
                  fontSize: "0.875rem",
                  gap: "0.375rem",
                }}
              >
                <Trash2 size={14} /> Delete All Filtered ({data.total})
              </AnimBtn>
            )}
            {selected.size > 0 && (
              <AnimBtn
                onClick={handleDeleteSelected}
                disabled={deleting}
                style={{
                  padding: "0.5rem 1rem",
                  background: "var(--danger)",
                  color: "white",
                  fontWeight: 600,
                  fontSize: "0.875rem",
                  gap: "0.375rem",
                }}
              >
                <Trash2 size={14} /> Delete ({selected.size})
              </AnimBtn>
            )}
          </>
        )}
      </div>

      {tab === "dashboard" ? (
        <DashboardView stats={stats} onBrowse={(t) => setTab(t as Tab)} />
      ) : (
        <>
          {/* Search & Filter */}
          <div className="flex flex-wrap gap-2 mb-4">
            <div className="relative flex-1 min-w-50 max-w-md">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 opacity-50"
              />
              <input
                type="text"
                placeholder="Search..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-lg border py-2 pl-9 pr-3 text-sm transition-colors focus:ring-(--primary)"
                style={{
                  background: "var(--card)",
                  borderColor: "var(--border)",
                  color: "var(--foreground)",
                }}
              />
            </div>
            {data?.sources && data.sources.length > 0 && (
              <div className="relative">
                <select
                  value={source}
                  onChange={(e) => setSource(e.target.value)}
                  className="appearance-none rounded-lg border py-2 pl-3 pr-8 text-sm cursor-pointer"
                  style={{
                    background: "var(--card)",
                    borderColor: "var(--border)",
                    color: "var(--foreground)",
                  }}
                >
                  <option value="">All Sources</option>
                  {data.sources.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  size={14}
                  className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none opacity-50"
                />
              </div>
            )}
            {tab !== "images" && (
              <input
                type="text"
                placeholder="Tags (comma separated)"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                className="rounded-lg border px-3 py-2 text-sm max-w-52"
                style={{
                  background: "var(--card)",
                  borderColor: "var(--border)",
                  color: "var(--foreground)",
                }}
              />
            )}
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              title="Collected from"
              className="rounded-lg border px-3 py-2 text-sm"
              style={{
                background: "var(--card)",
                borderColor: "var(--border)",
                color: "var(--foreground)",
              }}
            />
            <span
              className="self-center text-xs"
              style={{ color: "var(--muted-foreground)" }}
            >
              to
            </span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              title="Collected to"
              className="rounded-lg border px-3 py-2 text-sm"
              style={{
                background: "var(--card)",
                borderColor: "var(--border)",
                color: "var(--foreground)",
              }}
            />
            {(dateFrom || dateTo || tags) && (
              <AnimBtn
                onClick={() => {
                  setDateFrom("");
                  setDateTo("");
                  setTags("");
                }}
                style={{
                  padding: "0.4rem 0.75rem",
                  background: "var(--card)",
                  border: "1px solid var(--border)",
                  fontSize: "0.75rem",
                  color: "var(--danger)",
                }}
              >
                Clear
              </AnimBtn>
            )}
          </div>

          {/* Table */}
          {loading ? (
            <SkeletonTable rows={8} cols={5} />
          ) : !data || data.items.length === 0 ? (
            <EmptyState
              message={`No ${tab} found.`}
              icon={<FileText size={48} />}
            />
          ) : (
            <>
              <div className="card overflow-x-auto">
                <table
                  style={{ minWidth: tab === "images" ? "600px" : "800px" }}
                >
                  <thead>
                    <tr>
                      <th style={{ width: "40px" }}>
                        <input
                          type="checkbox"
                          checked={allSelected}
                          onChange={toggleSelectAll}
                          className="cursor-pointer"
                        />
                      </th>
                      <th style={{ width: "50px" }}>
                        <button
                          onClick={() => handleSort("id")}
                          className="flex items-center gap-1 hover:underline"
                        >
                          ID {sort === "id" && (sortDir === "asc" ? "↑" : "↓")}
                        </button>
                      </th>
                      <th style={{ width: "80px" }}>Preview</th>
                      <th>Details</th>
                      <th style={{ width: "150px", textAlign: "right" }}>
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.items.map((item) => (
                      <tr
                        key={item.id}
                        className="stagger-item"
                        style={{
                          background: selected.has(item.id)
                            ? "rgba(var(--primary-rgb, 21,61,108), 0.08)"
                            : undefined,
                        }}
                      >
                        <td>
                          <input
                            type="checkbox"
                            checked={selected.has(item.id)}
                            onChange={() => toggleSelect(item.id)}
                            className="cursor-pointer"
                          />
                        </td>
                        <td className="font-semibold">{item.id}</td>
                        <td>
                          {tab === "images" && (
                            <div
                              onClick={() => openView(item)}
                              className="w-16 h-16 rounded-lg overflow-hidden cursor-pointer transition-transform hover:scale-105 hover:shadow-lg"
                              style={{ background: "var(--muted)" }}
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={getMediaUrl(item) || ""}
                                alt=""
                                width={64}
                                height={64}
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).style.display =
                                    "none";
                                }}
                              />
                            </div>
                          )}
                          {tab === "videos" && (
                            <AnimBtn
                              onClick={() => openView(item)}
                              title="View video"
                              style={{
                                width: "64px",
                                height: "48px",
                                background: "var(--muted)",
                                padding: 0,
                              }}
                            >
                              <Play size={20} />
                            </AnimBtn>
                          )}
                          {tab === "audio" && (
                            <AnimBtn
                              onClick={() => openView(item)}
                              title="View audio"
                              style={{
                                width: "64px",
                                height: "48px",
                                background: "var(--muted)",
                                padding: 0,
                              }}
                            >
                              <Music size={20} />
                            </AnimBtn>
                          )}
                          {tab === "news" && (
                            <AnimBtn
                              onClick={() => openView(item)}
                              title="View article"
                              style={{
                                width: "64px",
                                height: "48px",
                                background: "var(--muted)",
                                padding: 0,
                              }}
                            >
                              <FileText size={20} />
                            </AnimBtn>
                          )}
                        </td>
                        <td className="text-sm leading-relaxed">
                          {tab === "images" && (
                            <div>
                              <div className="font-semibold">
                                Source: {item.source || "-"}
                              </div>
                              <div
                                className="text-xs truncate max-w-62.5"
                                style={{ color: "var(--muted-foreground)" }}
                              >
                                {item.url ? (
                                  <a
                                    href={item.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-(--primary) no-underline"
                                  >
                                    {item.url.slice(0, 60)}...
                                  </a>
                                ) : (
                                  "-"
                                )}
                              </div>
                              {item.query && (
                                <div
                                  className="text-xs"
                                  style={{ color: "var(--muted-foreground)" }}
                                >
                                  Query: {item.query}
                                </div>
                              )}
                            </div>
                          )}
                          {tab === "videos" && (
                            <div>
                              <div
                                className="font-semibold cursor-pointer hover:underline"
                                onClick={() => openView(item)}
                              >
                                {item.title?.slice(0, 80) || "Untitled"}
                              </div>
                              <div style={{ color: "var(--muted-foreground)" }}>
                                {item.channel && (
                                  <span>Channel: {item.channel}</span>
                                )}
                                {item.views != null && (
                                  <span>
                                    {" "}
                                    · {item.views.toLocaleString()} views
                                  </span>
                                )}
                                {item.duration ? (
                                  <span>
                                    {" "}
                                    · {formatDuration(item.duration)}
                                  </span>
                                ) : (
                                  ""
                                )}
                              </div>
                            </div>
                          )}
                          {tab === "news" && (
                            <div>
                              <div
                                className="font-semibold cursor-pointer hover:underline"
                                onClick={() => openView(item)}
                              >
                                {item.title?.slice(0, 80) || "Untitled"}
                              </div>
                              {item.sourceName && (
                                <div
                                  className="text-xs"
                                  style={{ color: "var(--muted-foreground)" }}
                                >
                                  {item.sourceName}
                                </div>
                              )}
                              {item.snippet && (
                                <div
                                  className="text-xs truncate max-w-62.5 mt-0.5"
                                  style={{ color: "var(--muted-foreground)" }}
                                >
                                  {item.snippet
                                    .replace(/<[^>]*>/g, "")
                                    .slice(0, 100)}
                                  ...
                                </div>
                              )}
                            </div>
                          )}
                          {tab === "audio" && (
                            <div>
                              <div
                                className="font-semibold cursor-pointer hover:underline"
                                onClick={() => openView(item)}
                              >
                                {item.title?.slice(0, 80) || "Untitled"}
                              </div>
                              {item.artist && (
                                <div
                                  className="text-xs"
                                  style={{ color: "var(--muted-foreground)" }}
                                >
                                  Artist: {item.artist}
                                </div>
                              )}
                            </div>
                          )}
                        </td>
                        <td>
                          <div className="flex gap-1 justify-end">
                            <AnimBtn
                              onClick={() => openView(item)}
                              title="View"
                              style={{
                                padding: "0.375rem",
                                background: "var(--card)",
                                border: "1px solid var(--border)",
                                color: "var(--foreground)",
                              }}
                            >
                              <Eye size={14} />
                            </AnimBtn>
                            <AnimBtn
                              onClick={() => {
                                setViewItem(item);
                                setViewMode("edit");
                              }}
                              title="Edit"
                              style={{
                                padding: "0.375rem",
                                background: "var(--card)",
                                border: "1px solid var(--border)",
                                color: "var(--primary)",
                              }}
                            >
                              <Pencil size={14} />
                            </AnimBtn>
                            <AnimBtn
                              onClick={() => {
                                setViewItem(item);
                                setViewMode("public");
                              }}
                              title="Public preview"
                              style={{
                                padding: "0.375rem",
                                background: "var(--card)",
                                border: "1px solid var(--border)",
                                color: "var(--success)",
                              }}
                            >
                              <Monitor size={14} />
                            </AnimBtn>
                            {item.url && (
                              <AnimLink
                                href={item.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                title="Source"
                                style={{
                                  padding: "0.375rem",
                                  background: "var(--card)",
                                  border: "1px solid var(--border)",
                                  color: "var(--primary)",
                                }}
                              >
                                <ExternalLink size={14} />
                              </AnimLink>
                            )}
                            <AnimBtn
                              onClick={() => handleDelete(item.id)}
                              title="Delete"
                              style={{
                                padding: "0.375rem",
                                background: "var(--danger)",
                                color: "white",
                              }}
                            >
                              <Trash2 size={14} />
                            </AnimBtn>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination
                page={page}
                totalPages={totalPages}
                onPageChange={setPage}
              />
            </>
          )}

          {/* Add Modal */}
          <Modal
            open={showAdd}
            onClose={() => setShowAdd(false)}
            maxWidth="600px"
          >
            <div className="p-6">
              <h2 className="text-lg font-bold mb-4">
                Add New {tab.slice(0, -1)}
              </h2>
              <form onSubmit={handleAdd}>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                  {[
                    "source",
                    "query",
                    "url",
                    ...(tab === "videos"
                      ? ["platform", "title", "channel", "duration", "views"]
                      : []),
                    ...(tab === "news"
                      ? ["title", "sourceName", "date", "snippet"]
                      : []),
                    ...(tab === "audio" ? ["title", "artist", "duration"] : []),
                  ]
                    .filter((v, i, a) => a.indexOf(v) === i)
                    .map((f) => (
                      <div key={f}>
                        <label className="block text-xs font-semibold mb-1">
                          {f
                            .replace(/([A-Z])/g, " $1")
                            .replace(/^./, (s) => s.toUpperCase())}
                        </label>
                        <input
                          name={f}
                          className="w-full rounded-lg border px-3 py-2 text-sm"
                          style={{
                            background: "var(--background)",
                            borderColor: "var(--border)",
                            color: "var(--foreground)",
                          }}
                        />
                      </div>
                    ))}
                </div>
                <div className="flex gap-2 justify-end">
                  <AnimBtn
                    onClick={() => setShowAdd(false)}
                    style={{
                      padding: "0.5rem 1rem",
                      background: "var(--card)",
                      border: "1px solid var(--border)",
                      fontWeight: 600,
                      fontSize: "0.875rem",
                    }}
                  >
                    Cancel
                  </AnimBtn>
                  <button
                    type="submit"
                    className="inline-flex items-center gap-1 rounded-lg px-4 py-2 text-sm font-semibold"
                    style={{
                      background: "var(--primary)",
                      color: "var(--primary-fg)",
                      cursor: "pointer",
                      border: "none",
                    }}
                  >
                    <Plus size={14} /> Add Item
                  </button>
                </div>
              </form>
            </div>
          </Modal>
        </>
      )}

      {/* Bulk Import (URL) Modal */}
      <Modal
        open={showBulkImport}
        onClose={() => setShowBulkImport(false)}
        maxWidth="600px"
      >
        <div className="p-6">
          <h2 className="text-lg font-bold mb-2 flex items-center gap-2">
            <ListPlus size={16} /> Bulk Import by URL
          </h2>
          <p
            className="text-xs mb-4"
            style={{ color: "var(--muted-foreground)" }}
          >
            Paste one URL per line. Duplicates are automatically skipped.
          </p>
          <form onSubmit={handleBulkImport}>
            <div className="grid grid-cols-1 gap-3 mb-4">
              <div>
                <label className="block text-xs font-semibold mb-1">
                  Source
                </label>
                <input
                  name="source"
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                  style={{
                    background: "var(--background)",
                    borderColor: "var(--border)",
                    color: "var(--foreground)",
                  }}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">
                  Query (optional)
                </label>
                <input
                  name="query"
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                  style={{
                    background: "var(--background)",
                    borderColor: "var(--border)",
                    color: "var(--foreground)",
                  }}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">URLs</label>
                <textarea
                  name="urls"
                  rows={8}
                  placeholder={
                    "https://example.com/one.jpg\nhttps://example.com/two.jpg"
                  }
                  className="w-full rounded-lg border px-3 py-2 text-sm font-mono"
                  style={{
                    background: "var(--background)",
                    borderColor: "var(--border)",
                    color: "var(--foreground)",
                  }}
                  required
                />
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <AnimBtn
                onClick={() => setShowBulkImport(false)}
                style={{
                  padding: "0.5rem 1rem",
                  background: "var(--card)",
                  border: "1px solid var(--border)",
                  fontWeight: 600,
                  fontSize: "0.875rem",
                }}
              >
                Cancel
              </AnimBtn>
              <button
                type="submit"
                disabled={bulkImporting}
                className="inline-flex items-center gap-1 rounded-lg px-4 py-2 text-sm font-semibold"
                style={{
                  background: "var(--primary)",
                  color: "var(--primary-fg)",
                  cursor: bulkImporting ? "not-allowed" : "pointer",
                  border: "none",
                }}
              >
                <ListPlus size={14} />{" "}
                {bulkImporting ? "Importing..." : "Import"}
              </button>
            </div>
          </form>
        </div>
      </Modal>

      {/* CSV Import Modal */}
      <Modal
        open={showCsvImport}
        onClose={() => setShowCsvImport(false)}
        maxWidth="600px"
      >
        <div className="p-6">
          <h2 className="text-lg font-bold mb-2 flex items-center gap-2">
            <FileInput size={16} /> CSV Import
          </h2>
          <p
            className="text-xs mb-4"
            style={{ color: "var(--muted-foreground)" }}
          >
            One row per line. Columns: <strong>url, title, notes, tags</strong>.
            Duplicate URLs are skipped.
          </p>
          <form onSubmit={handleCsvImport}>
            <div className="grid grid-cols-1 gap-3 mb-4">
              <div>
                <label className="block text-xs font-semibold mb-1">
                  Source (applies to all rows)
                </label>
                <input
                  name="source"
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                  style={{
                    background: "var(--background)",
                    borderColor: "var(--border)",
                    color: "var(--foreground)",
                  }}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">
                  CSV Data
                </label>
                <textarea
                  name="csv"
                  rows={8}
                  placeholder={
                    "https://example.com/a.jpg,Title A,note,tag1\nhttps://example.com/b.jpg,Title B,,tag2"
                  }
                  className="w-full rounded-lg border px-3 py-2 text-sm font-mono"
                  style={{
                    background: "var(--background)",
                    borderColor: "var(--border)",
                    color: "var(--foreground)",
                  }}
                  required
                />
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <AnimBtn
                onClick={() => setShowCsvImport(false)}
                style={{
                  padding: "0.5rem 1rem",
                  background: "var(--card)",
                  border: "1px solid var(--border)",
                  fontWeight: 600,
                  fontSize: "0.875rem",
                }}
              >
                Cancel
              </AnimBtn>
              <button
                type="submit"
                disabled={csvImporting}
                className="inline-flex items-center gap-1 rounded-lg px-4 py-2 text-sm font-semibold"
                style={{
                  background: "var(--primary)",
                  color: "var(--primary-fg)",
                  cursor: csvImporting ? "not-allowed" : "pointer",
                  border: "none",
                }}
              >
                <FileInput size={14} />{" "}
                {csvImporting ? "Importing..." : "Import"}
              </button>
            </div>
          </form>
        </div>
      </Modal>

      {/* Bulk Operations Modal */}
      <Modal
        open={showBulkOps}
        onClose={() => setShowBulkOps(false)}
        maxWidth="500px"
      >
        <div className="p-6">
          <h2 className="text-lg font-bold mb-1 flex items-center gap-2">
            <Tags size={16} /> Bulk Actions
          </h2>
          <p
            className="text-sm mb-4"
            style={{ color: "var(--muted-foreground)" }}
          >
            Apply to <strong>{selected.size}</strong> selected {tab} record(s).
          </p>
          <div className="space-y-4">
            <div>
              <div className="flex gap-2 items-center mb-1">
                <label className="block text-xs font-semibold">Tags</label>
                <select
                  value={bulkTagMode}
                  onChange={(e) =>
                    setBulkTagMode(e.target.value as "add" | "remove")
                  }
                  className="rounded-lg border px-2 py-1 text-xs cursor-pointer"
                  style={{
                    background: "var(--card)",
                    borderColor: "var(--border)",
                    color: "var(--foreground)",
                  }}
                >
                  <option value="add">Add</option>
                  <option value="remove">Remove</option>
                </select>
              </div>
              <input
                value={bulkTagValue}
                onChange={(e) => setBulkTagValue(e.target.value)}
                placeholder="Comma separated tags"
                className="w-full rounded-lg border px-3 py-2 text-sm mb-1"
                style={{
                  background: "var(--background)",
                  borderColor: "var(--border)",
                  color: "var(--foreground)",
                }}
              />
              <div className="flex justify-end">
                <AnimBtn
                  onClick={handleBulkTag}
                  disabled={bulkOperating || !bulkTagValue.trim()}
                  style={{
                    padding: "0.4rem 0.75rem",
                    background: "var(--primary)",
                    color: "var(--primary-fg)",
                    fontSize: "0.8rem",
                    fontWeight: 600,
                  }}
                >
                  Apply Tags
                </AnimBtn>
              </div>
            </div>
            <div
              className="border-t"
              style={{ borderColor: "var(--border)", paddingTop: "1rem" }}
            >
              <label className="block text-xs font-semibold mb-1">
                Reassign Source
              </label>
              <input
                value={bulkReassignValue}
                onChange={(e) => setBulkReassignValue(e.target.value)}
                placeholder="New source value"
                className="w-full rounded-lg border px-3 py-2 text-sm mb-1"
                style={{
                  background: "var(--background)",
                  borderColor: "var(--border)",
                  color: "var(--foreground)",
                }}
              />
              <div className="flex justify-end">
                <AnimBtn
                  onClick={handleBulkReassign}
                  disabled={bulkOperating || !bulkReassignValue.trim()}
                  style={{
                    padding: "0.4rem 0.75rem",
                    background: "var(--primary)",
                    color: "var(--primary-fg)",
                    fontSize: "0.8rem",
                    fontWeight: 600,
                  }}
                >
                  Reassign Source
                </AnimBtn>
              </div>
            </div>
          </div>
        </div>
      </Modal>

      {/* View / Edit / Public Modal */}
      <Modal
        open={!!viewItem}
        onClose={() => setViewItem(null)}
        maxWidth="900px"
      >
        {viewItem && (
          <div>
            {/* Mode tabs */}
            <div
              className="flex items-center gap-2 px-6 pt-5 border-b"
              style={{ borderColor: "var(--border)" }}
            >
              <ModeTab
                active={viewMode === "details"}
                onClick={() => setViewMode("details")}
                label="Details"
                icon={<Eye size={14} />}
              />
              <ModeTab
                active={viewMode === "edit"}
                onClick={() => setViewMode("edit")}
                label="Edit"
                icon={<Pencil size={14} />}
              />
              <ModeTab
                active={viewMode === "public"}
                onClick={() => setViewMode("public")}
                label="Public Preview"
                icon={<Monitor size={14} />}
              />
              <div className="flex-1" />
              <AnimLink
                href={`/${tab}/${viewItem.id}`}
                target="_blank"
                rel="noopener noreferrer"
                title="Open public page"
                style={{
                  padding: "0.375rem 0.5rem",
                  background: "var(--card)",
                  border: "1px solid var(--border)",
                  color: "var(--primary)",
                  marginBottom: "0.5rem",
                }}
              >
                <ExternalLink size={14} /> Open page
              </AnimLink>
            </div>

            {viewMode === "edit" ? (
              <EditForm
                tab={tab as Exclude<Tab, "dashboard">}
                item={viewItem}
                onSave={handleEdit}
                saving={editing}
              />
            ) : viewMode === "public" ? (
              <div className="p-6">
                <PublicPreview
                  type={tab as Exclude<Tab, "dashboard">}
                  item={viewItem}
                />
              </div>
            ) : (
              <DetailsView
                tab={tab as Exclude<Tab, "dashboard">}
                item={viewItem}
                getMediaUrl={getMediaUrl}
                isYouTubeUrl={isYouTubeUrl}
                getYouTubeEmbedUrl={getYouTubeEmbedUrl}
                onDelete={() => handleDelete(viewItem.id)}
                onEdit={() => setViewMode("edit")}
              />
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}

function ModeTab({
  active,
  onClick,
  label,
  icon,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  icon: ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1.5 pb-2.5 px-1 font-semibold text-sm"
      style={{
        background: "none",
        border: "none",
        cursor: "pointer",
        color: active ? "var(--primary)" : "var(--muted-foreground)",
        borderBottom: active
          ? "2px solid var(--primary)"
          : "2px solid transparent",
        marginBottom: "-1px",
      }}
    >
      {icon} {label}
    </button>
  );
}

/* ---------- Dashboard ---------- */

function DashboardView({
  stats,
  onBrowse,
}: {
  stats: StatsData | null;
  onBrowse: (t: string) => void;
}) {
  if (!stats) return <SkeletonTable rows={6} cols={4} />;

  const countCards = [
    {
      label: "Images",
      value: stats.counts.images,
      tab: "images",
      icon: ImageIcon,
    },
    { label: "Videos", value: stats.counts.videos, tab: "videos", icon: Video },
    { label: "News", value: stats.counts.news, tab: "news", icon: Newspaper },
    {
      label: "Audio",
      value: stats.counts.audio,
      tab: "audio",
      icon: Headphones,
    },
  ];

  const sourceBlocks = [
    { title: "Top Image Sources", list: stats.sources.images, tab: "images" },
    { title: "Top Video Sources", list: stats.sources.videos, tab: "videos" },
    { title: "Top News Sources", list: stats.sources.news, tab: "news" },
    { title: "Top Audio Sources", list: stats.sources.audio, tab: "audio" },
  ];

  const recentBlocks = [
    { title: "Recent Images", list: stats.recent.images, tab: "images" },
    { title: "Recent Videos", list: stats.recent.videos, tab: "videos" },
    { title: "Recent News", list: stats.recent.news, tab: "news" },
    { title: "Recent Audio", list: stats.recent.audio, tab: "audio" },
  ];

  // Compute max value across all types for trend scaling
  const allTrendCounts = stats.trend
    ? [
        ...stats.trend.images,
        ...stats.trend.videos,
        ...stats.trend.news,
        ...stats.trend.audio,
      ].map((t) => t.count)
    : [];
  const trendMax = Math.max(1, ...allTrendCounts);

  return (
    <div>
      {/* Count cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {countCards.map(({ label, value, tab, icon: Icon }) => (
          <button
            key={tab}
            onClick={() => onBrowse(tab)}
            className="card text-left cursor-pointer hover:shadow-lg transition-all"
            style={{ padding: "1rem" }}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-2xl font-bold">
                {value.toLocaleString()}
              </span>
              <span style={{ color: "var(--primary)" }}>
                <Icon size={18} />
              </span>
            </div>
            <div
              className="text-xs font-medium uppercase tracking-wide"
              style={{ color: "var(--muted-foreground)" }}
            >
              {label}
            </div>
          </button>
        ))}
      </div>

      {/* Image insights */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
        <StatCard label="Total Records" value={stats.counts.total} />
        <StatCard label="Images w/ Faces" value={stats.images.withFaces} />
        <StatCard label="Face Matches" value={stats.images.faceMatches} />
      </div>

      {/* Collection trend */}
      {stats.trend && (
        <>
          <h2
            className="text-sm font-bold uppercase tracking-wide mb-3"
            style={{ color: "var(--muted-foreground)" }}
          >
            Collection Activity (last 14 days)
          </h2>
          <div className="card mb-6" style={{ padding: "1rem" }}>
            <div className="flex flex-col gap-4">
              {(
                [
                  ["Images", stats.trend.images, "var(--primary)"],
                  ["Videos", stats.trend.videos, "var(--focus)"],
                  ["News", stats.trend.news, "var(--success)"],
                  ["Audio", stats.trend.audio, "#f59e0b"],
                ] as [string, TrendPoint[], string][]
              ).map(([label, series, color]) => (
                <div key={label}>
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className="text-xs font-semibold"
                      style={{ color: "var(--muted-foreground)" }}
                    >
                      {label}
                    </span>
                    <span className="text-xs font-bold" style={{ color }}>
                      {series.reduce(
                        (a: number, b: TrendPoint) => a + b.count,
                        0,
                      )}
                    </span>
                  </div>
                  <div className="flex items-end gap-0.5 h-10">
                    {series.map((p: TrendPoint) => (
                      <div
                        key={p.date}
                        title={`${p.date}: ${p.count}`}
                        style={{
                          flex: 1,
                          background: color,
                          borderRadius: "2px 2px 0 0",
                          height: `${Math.max(2, (p.count / trendMax) * 100)}%`,
                          opacity: p.count === 0 ? 0.15 : 1,
                        }}
                      />
                    ))}
                  </div>
                </div>
              ))}
              <div
                className="flex justify-between text-[10px] mt-1"
                style={{ color: "var(--muted-foreground)" }}
              >
                <span>{stats.trend.labels[0]}</span>
                <span>
                  {
                    stats.trend.labels[
                      Math.floor(stats.trend.labels.length / 2)
                    ]
                  }
                </span>
                <span>{stats.trend.labels[stats.trend.labels.length - 1]}</span>
              </div>
            </div>
          </div>
        </>
      )}

      {/* User activity */}
      {stats.activity && stats.activity.length > 0 && (
        <>
          <h2
            className="text-sm font-bold uppercase tracking-wide mb-3"
            style={{ color: "var(--muted-foreground)" }}
          >
            Admin Activity (last 30 days)
          </h2>
          <div className="card mb-6" style={{ padding: "1rem" }}>
            <div className="flex flex-col gap-2">
              {stats.activity.map((a) => (
                <div
                  key={a.username}
                  className="flex items-center gap-2 text-sm"
                >
                  <span className="w-32 truncate font-medium">
                    {a.username}
                  </span>
                  <div className="flex-1">
                    <div
                      className="h-2.5 rounded overflow-hidden"
                      style={{ background: "var(--muted)" }}
                    >
                      <div
                        style={{
                          width: `${Math.min(100, (a.count / Math.max(1, stats.activity[0].count)) * 100)}%`,
                          height: "100%",
                          background: "var(--primary)",
                        }}
                      />
                    </div>
                  </div>
                  <span
                    className="text-xs font-semibold"
                    style={{ color: "var(--muted-foreground)" }}
                  >
                    {a.count}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Top sources */}
      <h2
        className="text-sm font-bold uppercase tracking-wide mb-3"
        style={{ color: "var(--muted-foreground)" }}
      >
        Top Sources
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
        {sourceBlocks.map(({ title, list, tab }) => (
          <div key={title} className="card" style={{ padding: "1rem" }}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold">{title}</h3>
              <AnimBtn
                onClick={() => onBrowse(tab)}
                style={{
                  fontSize: "0.7rem",
                  background: "var(--card)",
                  border: "1px solid var(--border)",
                  padding: "0.2rem 0.5rem",
                  color: "var(--primary)",
                }}
              >
                Browse
              </AnimBtn>
            </div>
            {list.length === 0 ? (
              <p
                className="text-xs"
                style={{ color: "var(--muted-foreground)" }}
              >
                No data
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {list.map((s) => (
                  <div
                    key={s.source}
                    className="flex items-center gap-2 text-sm"
                  >
                    <span className="flex-1 truncate">{s.source}</span>
                    <span
                      className="text-xs font-semibold"
                      style={{ color: "var(--muted-foreground)" }}
                    >
                      {s.count}
                    </span>
                    <div
                      className="w-16 bg-(--muted) rounded h-1.5 overflow-hidden"
                      style={{ background: "var(--muted)" }}
                    >
                      <div
                        style={{
                          width: `${Math.min(100, (s.count / Math.max(1, list[0].count)) * 100)}%`,
                          height: "100%",
                          background: "var(--primary)",
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Recent */}
      <h2
        className="text-sm font-bold uppercase tracking-wide mb-3"
        style={{ color: "var(--muted-foreground)" }}
      >
        Recently Collected
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {recentBlocks.map(({ title, list, tab }) => (
          <div key={title} className="card" style={{ padding: "1rem" }}>
            <h3 className="text-sm font-semibold mb-3">{title}</h3>
            {list.length === 0 ? (
              <p
                className="text-xs"
                style={{ color: "var(--muted-foreground)" }}
              >
                No data
              </p>
            ) : (
              <div
                className="flex flex-col divide-y"
                style={{ borderColor: "var(--border)" }}
              >
                {list.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => onBrowse(tab)}
                    className="flex items-center gap-2 py-2 text-left text-sm cursor-pointer hover:opacity-70"
                    style={{
                      background: "none",
                      border: "none",
                      color: "var(--foreground)",
                    }}
                  >
                    <span
                      className="font-semibold text-xs"
                      style={{ color: "var(--muted-foreground)" }}
                    >
                      #{item.id}
                    </span>
                    <span className="flex-1 truncate">
                      {item.title || item.url || item.source || "Untitled"}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div
      className="card"
      style={{
        padding: "1rem",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}
    >
      <div>
        <div className="text-2xl font-bold">{value.toLocaleString()}</div>
        <div
          className="text-xs font-medium uppercase tracking-wide mt-1"
          style={{ color: "var(--muted-foreground)" }}
        >
          {label}
        </div>
      </div>
    </div>
  );
}

/* ---------- Details view ---------- */

function DetailsView({
  tab,
  item,
  getMediaUrl,
  isYouTubeUrl: isYT,
  getYouTubeEmbedUrl: getYt,
  onDelete,
  onEdit,
}: {
  tab: Exclude<Tab, "dashboard">;
  item: MediaItem;
  getMediaUrl: (i: MediaItem) => string | null;
  isYouTubeUrl: (u: string) => boolean;
  getYouTubeEmbedUrl: (u: string) => string | null;
  onDelete: () => void;
  onEdit: () => void;
}) {
  return (
    <div>
      {tab === "images" && (
        <div>
          <div
            className="flex items-center justify-center min-h-75"
            style={{ background: "var(--muted)" }}
          >
            {getMediaUrl(item) ? (
              <div className="relative w-full max-h-[45vh] h-[45vh]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={getMediaUrl(item) || ""}
                  alt=""
                  style={{
                    objectFit: "contain",
                    width: "100%",
                    height: "100%",
                  }}
                />
              </div>
            ) : null}
          </div>
          <div className="p-6">
            <h2 className="text-lg font-bold mb-3">Image Details</h2>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <strong>ID:</strong> {item.id}
              </div>
              <div>
                <strong>Source:</strong> {item.source || "-"}
              </div>
              <div className="col-span-2">
                <strong>URL:</strong>{" "}
                {item.url ? (
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-(--primary)"
                  >
                    {item.url.slice(0, 80)}...
                  </a>
                ) : (
                  "-"
                )}
              </div>
              {item.query && (
                <div className="col-span-2">
                  <strong>Query:</strong> {item.query}
                </div>
              )}
              {item.faceCount != null && (
                <div>
                  <strong>Faces:</strong> {item.faceCount}
                </div>
              )}
              {item.faceMatch != null && (
                <div>
                  <strong>Face match:</strong> {item.faceMatch ? "Yes" : "No"}
                </div>
              )}
              {item.collectedAt && (
                <div className="col-span-2">
                  <strong>Collected:</strong> {item.collectedAt}
                </div>
              )}
            </div>
            <ModalActions
              mediaUrl={getMediaUrl(item)}
              onDelete={onDelete}
              onEdit={onEdit}
            />
          </div>
        </div>
      )}

      {tab === "videos" && (
        <div>
          <div className="w-full aspect-video bg-black flex items-center justify-center">
            {getMediaUrl(item) && isYT(getMediaUrl(item)!) ? (
              <iframe
                src={getYt(getMediaUrl(item)!) || undefined}
                className="w-full h-full border-none"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            ) : getMediaUrl(item) ? (
              <video
                src={getMediaUrl(item) || ""}
                controls
                className="w-full h-full"
              />
            ) : (
              <div className="text-white p-8">No video source available</div>
            )}
          </div>
          <div className="p-6">
            <h2 className="text-lg font-bold mb-2">
              {item.title || "Untitled"}
            </h2>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <strong>ID:</strong> {item.id}
              </div>
              <div>
                <strong>Platform:</strong> {item.platform || "-"}
              </div>
              <div>
                <strong>Channel:</strong> {item.channel || "-"}
              </div>
              <div>
                <strong>Views:</strong> {item.views?.toLocaleString() || "-"}
              </div>
            </div>
            <ModalActions
              mediaUrl={getMediaUrl(item)}
              onDelete={onDelete}
              onEdit={onEdit}
            />
          </div>
        </div>
      )}

      {tab === "news" && (
        <div className="p-6">
          <h2 className="text-lg font-bold mb-1">{item.title || "Untitled"}</h2>
          <div
            className="text-sm mb-4"
            style={{ color: "var(--muted-foreground)" }}
          >
            {item.sourceName} · {item.date}
          </div>
          {item.snippet && (
            <div
              className="p-4 rounded-lg text-sm leading-relaxed mb-4"
              style={{ background: "var(--muted)" }}
              dangerouslySetInnerHTML={{ __html: item.snippet }}
            />
          )}
          <div className="flex gap-2 flex-wrap">
            {item.url && (
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded-lg px-4 py-2 text-sm font-semibold no-underline"
                style={{
                  background: "var(--primary)",
                  color: "var(--primary-fg)",
                }}
              >
                <ExternalLink size={14} /> Open Article
              </a>
            )}
            <AnimBtn
              onClick={onEdit}
              style={{
                padding: "0.5rem 1rem",
                background: "var(--card)",
                border: "1px solid var(--border)",
                color: "var(--primary)",
                fontWeight: 600,
                fontSize: "0.875rem",
                gap: "0.375rem",
              }}
            >
              <Pencil size={14} /> Edit
            </AnimBtn>
            <AnimBtn
              onClick={onDelete}
              style={{
                padding: "0.5rem 1rem",
                background: "var(--danger)",
                color: "white",
                fontWeight: 600,
                fontSize: "0.875rem",
                gap: "0.375rem",
              }}
            >
              <Trash2 size={14} /> Delete
            </AnimBtn>
          </div>
        </div>
      )}

      {tab === "audio" && (
        <div>
          <div
            className="flex flex-col items-center justify-center py-12 px-8"
            style={{ background: "var(--muted)" }}
          >
            <Music size={48} className="mb-4 opacity-50" />
            {getMediaUrl(item) ? (
              <audio
                src={getMediaUrl(item) || ""}
                controls
                className="w-full max-w-md"
              />
            ) : (
              <div style={{ color: "var(--muted-foreground)" }}>
                No audio source
              </div>
            )}
          </div>
          <div className="p-6">
            <h2 className="text-lg font-bold mb-2">
              {item.title || "Untitled"}
            </h2>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <strong>ID:</strong> {item.id}
              </div>
              <div>
                <strong>Artist:</strong> {item.artist || "-"}
              </div>
              <div>
                <strong>Source:</strong> {item.source || "-"}
              </div>
              {item.duration && (
                <div>
                  <strong>Duration:</strong> {item.duration}s
                </div>
              )}
            </div>
            <ModalActions
              mediaUrl={getMediaUrl(item)}
              onDelete={onDelete}
              onEdit={onEdit}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function ModalActions({
  mediaUrl,
  onDelete,
  onEdit,
}: {
  mediaUrl: string | null;
  onDelete: () => void;
  onEdit: () => void;
}) {
  return (
    <div className="flex gap-2 mt-4 flex-wrap">
      {mediaUrl && (
        <a
          href={mediaUrl}
          download
          className="inline-flex items-center gap-1 rounded-lg px-4 py-2 text-sm font-semibold no-underline"
          style={{ background: "var(--primary)", color: "var(--primary-fg)" }}
        >
          <Download size={14} /> Download
        </a>
      )}
      <AnimBtn
        onClick={onEdit}
        style={{
          padding: "0.5rem 1rem",
          background: "var(--card)",
          border: "1px solid var(--border)",
          color: "var(--primary)",
          fontWeight: 600,
          fontSize: "0.875rem",
          gap: "0.375rem",
        }}
      >
        <Pencil size={14} /> Edit
      </AnimBtn>
      <AnimBtn
        onClick={onDelete}
        style={{
          padding: "0.5rem 1rem",
          background: "var(--danger)",
          color: "white",
          fontWeight: 600,
          fontSize: "0.875rem",
          gap: "0.375rem",
        }}
      >
        <Trash2 size={14} /> Delete
      </AnimBtn>
    </div>
  );
}

/* ---------- Public preview ---------- */

function PublicPreview({
  type,
  item,
}: {
  type: Exclude<Tab, "dashboard">;
  item: MediaItem;
}) {
  const mediaUrl =
    localToMediaUrl(item.localPath) ||
    getMediaUrl({ localPath: item.localPath, url: item.url });

  return (
    <div>
      <div
        className="text-xs font-semibold uppercase tracking-wide mb-3"
        style={{ color: "var(--muted-foreground)" }}
      >
        Public preview — how visitors see this on the site
      </div>

      {type === "images" && (
        <div
          className="grid"
          style={{
            gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
            gap: "1rem",
          }}
        >
          <div
            className="card"
            style={{ cursor: "default", padding: "0.75rem" }}
          >
            <div
              style={{
                width: "100%",
                height: "160px",
                overflow: "hidden",
                borderRadius: "0.25rem",
                marginBottom: "0.5rem",
                background: "var(--background)",
              }}
            >
              {mediaUrl ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={mediaUrl}
                    alt=""
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />
                </>
              ) : (
                <div
                  style={{
                    width: "100%",
                    height: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "var(--muted)",
                    fontSize: "0.75rem",
                  }}
                >
                  No preview
                </div>
              )}
            </div>
            <div
              style={{
                fontSize: "0.75rem",
                color: "var(--muted)",
                display: "flex",
                justifyContent: "space-between",
              }}
            >
              <span>{item.source || "Unknown"}</span>
              <span>#{item.id}</span>
            </div>
            {item.faceMatch ? (
              <div
                style={{
                  fontSize: "0.75rem",
                  color: "var(--success)",
                  fontWeight: 600,
                }}
              >
                Face match
              </div>
            ) : null}
          </div>
        </div>
      )}

      {type === "videos" && (
        <div className="card" style={{ overflow: "hidden" }}>
          <div
            style={{
              position: "relative",
              paddingBottom: "56.25%",
              height: 0,
              background: "#000",
            }}
          >
            {mediaUrl && isYouTubeUrl(mediaUrl) ? (
              <iframe
                src={getYouTubeEmbedUrl(mediaUrl) || undefined}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  height: "100%",
                  border: "none",
                }}
                allowFullScreen
                allow="autoplay"
              />
            ) : mediaUrl ? (
              <video
                controls
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  height: "100%",
                }}
              >
                <source src={mediaUrl} />
              </video>
            ) : (
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#fff",
                  padding: "1rem",
                  textAlign: "center",
                }}
              >
                No video source available
              </div>
            )}
          </div>
          <div className="p-4">
            <h3 className="font-semibold mb-1">{item.title || "Untitled"}</h3>
            <div
              className="text-xs text-(--muted-foreground) space-y-0.5"
              style={{ color: "var(--muted-foreground)" }}
            >
              {item.channel && <div>Channel: {item.channel}</div>}
              {item.views != null && (
                <div>{item.views.toLocaleString()} views</div>
              )}
              {item.duration ? (
                <div>Duration: {formatDuration(item.duration)}</div>
              ) : null}
            </div>
          </div>
        </div>
      )}

      {type === "news" && (
        <div className="card" style={{ padding: "1.25rem" }}>
          <h2 className="text-xl font-bold mb-1">
            {item.title || `News #${item.id}`}
          </h2>
          <div
            className="text-sm mb-3"
            style={{ color: "var(--muted-foreground)" }}
          >
            {item.sourceName || "Unknown source"}
            {item.date ? ` · ${item.date}` : ""}
          </div>
          {item.snippet && (
            <div
              className="p-4 rounded-lg text-sm leading-relaxed"
              style={{ background: "var(--background)", lineHeight: 1.6 }}
            >
              {item.snippet}
            </div>
          )}
          {item.url && (
            <div className="mt-3 text-sm">
              <a href={item.url} target="_blank" rel="noopener noreferrer">
                Open source URL &rarr;
              </a>
            </div>
          )}
        </div>
      )}

      {type === "audio" && (
        <div className="card" style={{ padding: "1.5rem" }}>
          <h2 className="text-lg font-bold mb-3">
            {item.title || `Audio #${item.id}`}
          </h2>
          {item.artist && (
            <div
              className="text-sm mb-3"
              style={{ color: "var(--muted-foreground)" }}
            >
              {item.artist}
            </div>
          )}
          {mediaUrl ? (
            <audio controls style={{ width: "100%" }}>
              <source src={mediaUrl} />
            </audio>
          ) : (
            <div
              style={{
                padding: "2rem",
                textAlign: "center",
                color: "var(--muted)",
              }}
            >
              No audio available for playback
            </div>
          )}
          {item.url && (
            <div className="mt-3 text-sm">
              <a href={item.url} target="_blank" rel="noopener noreferrer">
                Open source URL &rarr;
              </a>
            </div>
          )}
        </div>
      )}

      <div className="flex justify-center mt-4">
        <Link
          href={`/${type}/${item.id}`}
          target="_blank"
          className="inline-flex items-center gap-1 rounded-lg px-4 py-2 text-sm font-semibold no-underline"
          style={{ background: "var(--primary)", color: "var(--primary-fg)" }}
        >
          <ExternalLink size={14} /> Open live public page
        </Link>
      </div>
    </div>
  );
}

/* ---------- Edit form ---------- */

const EDITABLE_FIELDS: Record<Exclude<Tab, "dashboard">, string[]> = {
  images: [
    "source",
    "query",
    "url",
    "faceDetected",
    "faceCount",
    "faceMatch",
    "faceMatchScore",
    "faceMatchDistance",
  ],
  videos: [
    "source",
    "platform",
    "title",
    "url",
    "channel",
    "duration",
    "views",
  ],
  news: ["source", "query", "title", "url", "sourceName", "date", "snippet"],
  audio: ["source", "query", "title", "url", "artist", "duration"],
};

function EditForm({
  tab,
  item,
  onSave,
  saving,
}: {
  tab: Exclude<Tab, "dashboard">;
  item: MediaItem;
  onSave: (e: FormEvent<HTMLFormElement>) => void;
  saving: boolean;
}) {
  const fields = EDITABLE_FIELDS[tab];
  const [values, setValues] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const f of fields)
      init[f] =
        item[f] === null || item[f] === undefined ? "" : String(item[f]);
    return init;
  });

  return (
    <div className="p-6">
      <h2 className="text-lg font-bold mb-1">
        Edit {tab.slice(0, -1)} #{item.id}
      </h2>
      <p className="text-sm mb-4" style={{ color: "var(--muted-foreground)" }}>
        Update the fields below and save. Changes are reflected immediately.
      </p>
      <form onSubmit={onSave}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
          {fields.map((f) => (
            <div key={f}>
              <label className="block text-xs font-semibold mb-1">
                {f
                  .replace(/([A-Z])/g, " $1")
                  .replace(/^./, (s) => s.toUpperCase())}
              </label>
              {f === "snippet" ? (
                <textarea
                  name={f}
                  value={values[f] || ""}
                  onChange={(e) =>
                    setValues((v) => ({ ...v, [f]: e.target.value }))
                  }
                  rows={4}
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                  style={{
                    background: "var(--background)",
                    borderColor: "var(--border)",
                    color: "var(--foreground)",
                  }}
                />
              ) : (
                <input
                  name={f}
                  value={values[f] || ""}
                  onChange={(e) =>
                    setValues((v) => ({ ...v, [f]: e.target.value }))
                  }
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                  style={{
                    background: "var(--background)",
                    borderColor: "var(--border)",
                    color: "var(--foreground)",
                  }}
                />
              )}
            </div>
          ))}
        </div>
        <div className="flex gap-2 justify-end">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-1 rounded-lg px-4 py-2 text-sm font-semibold"
            style={{
              background: "var(--primary)",
              color: "var(--primary-fg)",
              cursor: saving ? "not-allowed" : "pointer",
              border: "none",
            }}
          >
            {saving ? (
              <>
                <Save size={14} /> Saving...
              </>
            ) : (
              <>
                <Save size={14} /> Save Changes
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
