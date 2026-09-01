"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ScrollText, Trash2, Plus, Edit, LogIn, LogOut } from "lucide-react";
import { SkeletonTable, EmptyState } from "@/components/ui";

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

export default function AuditPage() {
  const router = useRouter();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [entityType, setEntityType] = useState("");
  const [action, setAction] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const perPage = 50;

  useEffect(() => {
    fetch("/api/me")
      .then((r) => r.json())
      .then((d) => {
        if (!d.isAdmin) {
          router.push("/login");
          return;
        }
        setIsAdmin(true);
      });
  }, [router]);

  // Reset to first page when filters change
  useEffect(() => {
    setPage(1);
  }, [entityType, action]);

  useEffect(() => {
    if (!isAdmin) return;
    let active = true;
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: String(perPage) });
    if (entityType) params.set("entityType", entityType);
    if (action) params.set("action", action);
    fetch(`/api/admin/audit?${params}`)
      .then((r) => r.json())
      .then((d) => {
        if (!active) return;
        setLogs(d.logs || []);
        setTotal(d.total || 0);
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [isAdmin, entityType, action, page]);

  if (!isAdmin)
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <SkeletonTable rows={5} cols={5} />
      </div>
    );

  const totalPages = Math.max(1, Math.ceil(total / perPage));

  const getActionIcon = (a: string) => {
    switch (a) {
      case "delete": return { icon: <Trash2 size={14} style={{ color: "var(--danger)" }} />, color: "var(--danger)" };
      case "create": return { icon: <Plus size={14} style={{ color: "var(--success)" }} />, color: "var(--success)" };
      case "login": return { icon: <LogIn size={14} style={{ color: "var(--primary)" }} />, color: "var(--primary)" };
      case "logout": return { icon: <LogOut size={14} style={{ color: "var(--muted)" }} />, color: "var(--muted)" };
      case "edit": return { icon: <Edit size={14} style={{ color: "var(--focus)" }} />, color: "var(--focus)" };
      default: return { icon: <Edit size={14} style={{ color: "var(--focus)" }} />, color: "var(--focus)" };
    }
  };

  return (
    <div className="page-enter">
      <h1 className="text-xl font-bold mb-1">Audit Log</h1>
      <p className="text-sm mb-4" style={{ color: "var(--muted-foreground)" }}>
        Track all admin actions — logins, creates, edits, deletes, and logouts.
      </p>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-4">
        <select
          value={entityType}
          onChange={(e) => setEntityType(e.target.value)}
          className="rounded-lg border px-3 py-2 text-sm cursor-pointer"
          style={{ background: "var(--card)", borderColor: "var(--border)", color: "var(--foreground)" }}
        >
          <option value="">All entities</option>
          {["images", "videos", "news", "audio", "user"].map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
        <select
          value={action}
          onChange={(e) => setAction(e.target.value)}
          className="rounded-lg border px-3 py-2 text-sm cursor-pointer"
          style={{ background: "var(--card)", borderColor: "var(--border)", color: "var(--foreground)" }}
        >
          <option value="">All actions</option>
          {["login", "logout", "create", "edit", "delete"].map((a) => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>
        <span className="text-sm self-center" style={{ color: "var(--muted-foreground)" }}>
          {total.toLocaleString()} entr{total === 1 ? "y" : "ies"}
        </span>
      </div>

      {loading ? (
        <SkeletonTable rows={8} cols={6} />
      ) : logs.length === 0 ? (
        <EmptyState
          message="No audit logs match your filters."
          icon={<ScrollText size={48} />}
        />
      ) : (
        <div className="card overflow-x-auto">
          <table>
            <thead>
              <tr>
                <th>Action</th>
                <th>Entity</th>
                <th>ID</th>
                <th>User</th>
                <th>Details</th>
                <th>Time</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => {
                const meta = getActionIcon(log.action);
                return (
                  <tr key={log.id} className="stagger-item">
                    <td>
                      <div className="flex items-center gap-2">
                        {meta.icon}
                        <span
                          className="font-medium capitalize whitespace-nowrap"
                          style={{ color: meta.color }}
                        >
                          {log.action}
                        </span>
                      </div>
                    </td>
                    <td className="font-medium capitalize">{log.entityType}</td>
                    <td>{log.entityId ? `#${log.entityId}` : "-"}</td>
                    <td style={{ whiteSpace: "nowrap" }}>{log.username || "-"}</td>
                    <td
                      className="text-sm max-w-100 truncate"
                      title={log.details || ""}
                      style={{ color: "var(--muted-foreground)" }}
                    >
                      {log.details || "-"}
                    </td>
                    <td
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
      )}

      {totalPages > 1 && (
        <div className="pagination" style={{ display: "flex", gap: "0.5rem", justifyContent: "center", marginTop: "1.5rem" }}>
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            style={{ background: "none", border: "none", cursor: page <= 1 ? "not-allowed" : "pointer", color: "var(--muted)" }}
          >
            Prev
          </button>
          <span className="current">{page} / {totalPages}</span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            style={{ background: "none", border: "none", cursor: page >= totalPages ? "not-allowed" : "pointer", color: "var(--muted)" }}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
