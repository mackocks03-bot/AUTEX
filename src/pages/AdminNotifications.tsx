import { useState, useEffect, useMemo } from "react";
import { ref, onValue, push, set, remove } from "firebase/database";
import { db } from "@/firebase";
import type { AppNotification } from "@/types";

export function AdminNotifications() {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  useEffect(() => {
    const r = ref(db, "notifications");
    return onValue(r, (snap) => {
      const data = snap.val() as Record<string, AppNotification> | null;
      if (data) {
        setNotifications(
          Object.entries(data)
            .map(([id, val]) => ({ ...val, id }))
            .sort((a, b) => b.createdAt - a.createdAt)
        );
      } else {
        setNotifications([]);
      }
    });
  }, []);

  async function createNotification(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      if (!title.trim() || !message.trim()) {
        throw new Error("Title and message are required.");
      }

      const key = push(ref(db, "notifications")).key;
      if (!key) throw new Error("Could not allocate notification id.");

      let imageUrl = "";
      if (file) {
        const reader = new FileReader();
        imageUrl = await new Promise<string>((resolve, reject) => {
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = () => reject(new Error("Failed to read image file"));
          reader.readAsDataURL(file);
        });
      }

      await set(ref(db, `notifications/${key}`), {
        title: title.trim(),
        message: message.trim(),
        imageUrl,
        createdAt: Date.now(),
      } satisfies AppNotification);

      setMsg("Notification published.");
      setTitle("");
      setMessage("");
      setFile(null);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Could not create notification.");
    } finally {
      setBusy(false);
    }
  }

  async function confirmDeleteNotification() {
    if (!deleteTargetId) return;
    const id = deleteTargetId;
    setDeleteTargetId(null);
    setErr(null);
    setMsg(null);
    try {
      await remove(ref(db, `notifications/${id}`));
      setMsg("Notification deleted successfully.");
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Could not delete.");
    }
  }

  return (
    <div className="split">
      <div className="neu-card">
        <div className="card-body">
          <h2 style={{ margin: "0 0 10px", fontSize: 18 }}>Send Notification</h2>
          {msg && <div className="alert info" style={{ marginBottom: 10 }}>{msg}</div>}
          {err && <div className="alert" style={{ marginBottom: 10 }}>{err}</div>}
          <form className="grid" style={{ gap: 12 }} onSubmit={createNotification}>
            <div className="field">
              <label htmlFor="title">Title</label>
              <input id="title" className="input" value={title} onChange={(e) => setTitle(e.target.value)} required />
            </div>
            <div className="field">
              <label htmlFor="message">Message</label>
              <textarea id="message" className="textarea" value={message} onChange={(e) => setMessage(e.target.value)} required />
            </div>
            <div className="field">
              <label htmlFor="img">Image (Optional)</label>
              <input id="img" type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            </div>
            <button className="neu-btn" type="submit" disabled={busy}>
              {busy ? "Publishing…" : "Publish Notification"}
            </button>
          </form>
        </div>
      </div>

      <div className="neu-card">
        <div className="card-body" style={{ padding: 0 }}>
          <table className="table">
            <thead>
              <tr>
                <th>Notification</th>
                <th>Date</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {notifications.map((n) => (
                <tr key={n.id}>
                  <td>
                    <div className="row" style={{ gap: 10 }}>
                      {n.imageUrl && <img src={n.imageUrl} alt="" style={{ width: 60, height: 60, borderRadius: 8, objectFit: "cover" }} />}
                      <div>
                        <div style={{ fontWeight: 600 }}>{n.title}</div>
                        <div className="muted" style={{ fontSize: 13, textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap", maxWidth: 200 }}>
                          {n.message}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="muted">
                    {new Date(n.createdAt).toLocaleDateString()}
                  </td>
                  <td style={{ width: 80 }}>
                    <button className="neu-btn btn-ghost" style={{ color: "var(--danger)" }} type="button" onClick={() => setDeleteTargetId(n.id!)}>
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
              {!notifications.length && (
                <tr>
                  <td colSpan={3} className="muted">
                    No notifications yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {deleteTargetId && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.65)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 99999,
            padding: 16,
          }}
          onClick={() => setDeleteTargetId(null)}
        >
          <div
            className="neu-card"
            style={{
              maxWidth: 420,
              width: "100%",
              borderRadius: 18,
              padding: 24,
              border: "1px solid var(--stroke)",
              boxShadow: "0 20px 40px rgba(0,0,0,0.4)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontSize: 32, marginBottom: 12, textAlign: "center" }}>🗑️</div>
            <h3 style={{ margin: "0 0 8px", fontSize: 17, fontWeight: 700, textAlign: "center" }}>
              Delete Notification?
            </h3>
            <p style={{ margin: "0 0 20px", fontSize: 13.5, color: "var(--muted)", textAlign: "center", lineHeight: 1.5 }}>
              Are you sure you want to delete this broadcast notification? This action cannot be undone.
            </p>
            <div style={{ display: "flex", gap: 10 }}>
              <button
                className="neu-btn btn-ghost"
                style={{ flex: 1, padding: "10px 14px", borderRadius: 10 }}
                onClick={() => setDeleteTargetId(null)}
              >
                Cancel
              </button>
              <button
                className="neu-btn"
                style={{
                  flex: 1,
                  padding: "10px 14px",
                  borderRadius: 10,
                  background: "var(--danger)",
                  color: "#fff",
                  fontWeight: 600,
                  border: "none",
                }}
                onClick={() => void confirmDeleteNotification()}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
