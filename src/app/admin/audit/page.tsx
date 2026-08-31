"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ScrollText, Trash2, Plus, Edit } from "lucide-react";
import { SkeletonTable, EmptyState } from "@/components/ui";

interface AuditLog {
  id: number;
  action: string;
  entityType: string;
  entityId: number;
  userId: number | null;
  details: string | null;
  createdAt: string;
}

export default function AuditPage() {
  const router = useRouter();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    fetch("/api/me")
      .then((r) => r.json())
      .then((d) => {
        if (!d.isAdmin) {
          router.push("/login");
          return;
        }
        setIsAdmin(true);
        fetch("/api/admin/audit")
          .then((r) => r.json())
          .then((d) => {
            setLogs(d.logs || []);
            setLoading(false);
          });
      });
  }, [router]);

  if (!isAdmin)
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <SkeletonTable rows={5} cols={4} />
      </div>
    );

  const getActionIcon = (action: string) => {
    switch (action) {
      case "delete":
        return <Trash2 size={14} style={{ color: "var(--danger)" }} />;
      case "create":
        return <Plus size={14} style={{ color: "var(--success)" }} />;
      default:
        return <Edit size={14} style={{ color: "var(--focus)" }} />;
    }
  };

  const getActionColor = (action: string) => {
    switch (action) {
      case "delete":
        return "var(--danger)";
      case "create":
        return "var(--success)";
      default:
        return "var(--focus)";
    }
  };

  return (
    <div className="page-enter">
      <h1 className="text-xl font-bold mb-1">Audit Log</h1>
      <p className="text-sm mb-6" style={{ color: "var(--muted-foreground)" }}>
        Track all admin actions — creates, deletes, and modifications.
      </p>

      {loading ? (
        <SkeletonTable rows={8} cols={4} />
      ) : logs.length === 0 ? (
        <EmptyState
          message="No audit logs yet."
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
                <th>Details</th>
                <th>Time</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id} className="stagger-item">
                  <td>
                    <div className="flex items-center gap-2">
                      {getActionIcon(log.action)}
                      <span
                        className="font-medium capitalize"
                        style={{ color: getActionColor(log.action) }}
                      >
                        {log.action}
                      </span>
                    </div>
                  </td>
                  <td className="font-medium capitalize">{log.entityType}</td>
                  <td>#{log.entityId}</td>
                  <td
                    className="text-sm max-w-75 truncate"
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
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
