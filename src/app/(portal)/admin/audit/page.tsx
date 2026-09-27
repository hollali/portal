'use client';

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ScrollText, Trash2, Plus, Edit, LogIn, LogOut, type LucideIcon } from "lucide-react";
import { SkeletonTable, EmptyState } from "@/components/ui";
import { PageHeader, Button, Badge, Field, Select, type BadgeTone } from "@/components/ui/kit";
import { jsonFetch } from "@/lib/jsonFetch";

interface AuditLog {
  id: number;
  action: string;
  entityType: string;
  entityId: number;
  userId: number | null;
  username: string | null;
  details: string | null;
  createdAt: string;
}

const ACTION_META: Record<string, { icon: LucideIcon; tone: BadgeTone }> = {
  delete: { icon: Trash2, tone: "danger" },
  create: { icon: Plus, tone: "success" },
  login: { icon: LogIn, tone: "info" },
  logout: { icon: LogOut, tone: "neutral" },
  edit: { icon: Edit, tone: "brand" },
};

const ENTITIES = ["images", "videos", "news", "audio", "user"];
const ACTIONS = ["login", "logout", "create", "edit", "delete"];

export default function AuditPage() {
  const router = useRouter();
  // Admits admins OR editors, so `isAdmin` was a misleading name.
  const [authorized, setAuthorized] = useState(false);
  const [entityType, setEntityType] = useState("");
  const [action, setAction] = useState("");
  const [page, setPage] = useState(1);
  const perPage = 50;

  const filterKey = `${entityType}|${action}`;
  const prevFilterKey = useRef(filterKey);
  useEffect(() => {
    if (prevFilterKey.current !== filterKey) {
      prevFilterKey.current = filterKey;
      setPage(1);
    }
  }, [filterKey]);

  useEffect(() => {
    jsonFetch<{ role?: string }>("/api/me")
      .then((d) => {
        if (d?.role !== "admin" && d?.role !== "editor") {
          router.push("/admin");
          return;
        }
        setAuthorized(true);
      });
  }, [router]);

  // `loading` is derived from whether the stored rows match the current query,
  // instead of being set inside the effect body.
  const queryKey = `${filterKey}|${page}`;
  const [result, setResult] = useState<{
    key: string;
    logs: AuditLog[];
    total: number;
  } | null>(null);

  useEffect(() => {
    if (!authorized) return;
    let active = true;
    const params = new URLSearchParams({ page: String(page), limit: String(perPage) });
    if (entityType) params.set("entityType", entityType);
    if (action) params.set("action", action);
    jsonFetch<{ logs?: AuditLog[]; total?: number }>(`/api/admin/audit?${params}`).then((d) => {
      if (!active) return;
      setResult({ key: queryKey, logs: d?.logs || [], total: d?.total || 0 });
    });
    return () => {
      active = false;
    };
  }, [authorized, entityType, action, page, perPage, queryKey]);

  const loading = result?.key !== queryKey;
  const rows = loading ? [] : (result?.logs ?? []);
  const rowTotal = loading ? 0 : (result?.total ?? 0);

  if (!authorized)
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <SkeletonTable rows={5} cols={5} />
      </div>
    );

  const totalPages = Math.max(1, Math.ceil(rowTotal / perPage));
  const filtering = entityType !== "" || action !== "";

  return (
    <div className="page-enter">
      <PageHeader
        title="Audit Log"
        icon={<ScrollText size={22} />}
        crumbs={[{ label: "Admin", href: "/admin" }, { label: "Audit" }]}
        description="Track all admin actions — logins, creates, edits, deletes, and logouts."
        meta={
          <span aria-live="polite" style={{ fontSize: "0.8125rem", color: "var(--muted)" }}>
            {loading ? "Loading…" : `${rowTotal.toLocaleString()} entr${rowTotal === 1 ? "y" : "ies"}`}
          </span>
        }
      />

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3 mb-4">
        <Field label="Entity" className="w-44" hideLabel>
          <Select
            value={entityType}
            onChange={(e) => setEntityType(e.target.value)}
            aria-label="Filter by entity type"
          >
            <option value="">All entities</option>
            {ENTITIES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </Select>
        </Field>
        <Field label="Action" className="w-44" hideLabel>
          <Select
            value={action}
            onChange={(e) => setAction(e.target.value)}
            aria-label="Filter by action"
          >
            <option value="">All actions</option>
            {ACTIONS.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </Select>
        </Field>
        {filtering && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => { setEntityType(""); setAction(""); }}
          >
            Clear filters
          </Button>
        )}
      </div>

      {loading ? (
        <SkeletonTable rows={8} cols={6} />
      ) : rows.length === 0 ? (
        <EmptyState
          message={filtering ? "No audit logs match your filters." : "No audit activity recorded yet."}
          icon={<ScrollText size={48} />}
        />
      ) : (
        <div className="card overflow-x-auto">
          <div className="table-wrap table-cards">
            <table>
            <caption className="sr-only">Audit log entries, newest first</caption>
            <thead>
              <tr>
                <th scope="col">Action</th>
                <th scope="col">Entity</th>
                <th scope="col">ID</th>
                <th scope="col">User</th>
                <th scope="col">Details</th>
                <th scope="col">Time</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((log) => {
                const meta = ACTION_META[log.action] ?? { icon: Edit, tone: "neutral" as BadgeTone };
                const Icon = meta.icon;
                return (
                  <tr key={log.id} className="stagger-item">
                    <td data-label="Action">
                      <Badge tone={meta.tone} icon={<Icon size={13} aria-hidden />}>
                        <span className="capitalize">{log.action}</span>
                      </Badge>
                    </td>
                    <td data-label="Entity" className="font-medium capitalize">{log.entityType}</td>
                    <td data-label="ID">{log.entityId ? `#${log.entityId}` : <span style={{ color: "var(--muted)" }}>—</span>}</td>
                    <td data-label="User" style={{ whiteSpace: "nowrap" }}>
                      {log.username || <span style={{ color: "var(--muted)" }}>—</span>}
                    </td>
                    <td
                      data-label="Details"
                      className="text-sm"
                      title={log.details || undefined}
                      // `max-w-100` is not a real Tailwind size, so the original
                      // truncation never applied and long details stretched the
                      // table until the wrapper scrolled.
                      style={{ maxWidth: "22rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "var(--muted-foreground)" }}
                    >
                      {log.details || <span style={{ color: "var(--muted)" }}>—</span>}
                    </td>
                    <td
                      data-label="Time"
                      className="text-sm whitespace-nowrap"
                      style={{ color: "var(--muted-foreground)" }}
                    >
                      {new Date(log.createdAt).toLocaleString()}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            </table>
          </div>
        </div>
      )}

      {totalPages > 1 && (
        <nav className="pagination" aria-label="Audit log pages" style={{ display: "flex", gap: "0.5rem", justifyContent: "center", marginTop: "1.5rem" }}>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
          >
            Prev
          </Button>
          <span className="current" aria-current="page">Page {page} of {totalPages}</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
          >
            Next
          </Button>
        </nav>
      )}
    </div>
  );
}
