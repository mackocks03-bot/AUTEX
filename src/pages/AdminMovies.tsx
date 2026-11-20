import { useEffect, useState } from "react";
import { onValue, push, ref, remove, set } from "firebase/database";
import { db } from "@/firebase";
import type { Movie, MovieGroup } from "@/types";

export function AdminMovies() {
  const [groups, setGroups] = useState<Record<string, MovieGroup> | null>(null);
  const [movies, setMovies] = useState<Record<string, Movie> | null>(null);
  
  const [gName, setGName] = useState("");
  const [gThumbFile, setGThumbFile] = useState<File | null>(null);
  const [gAmount, setGAmount] = useState("1000");
  const [gDesc, setGDesc] = useState("");
  
  const [mTitle, setMTitle] = useState("");
  const [mYoutube, setMYoutube] = useState("");
  const [mFile, setMFile] = useState<File | null>(null);
  const [mGroup, setMGroup] = useState("");
  
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ type: "group" | "movie"; id: string; name: string } | null>(null);

  useEffect(() => {
    const gr = ref(db, "movieGroups");
    const mr = ref(db, "movies");
    const u1 = onValue(gr, snap => setGroups(snap.val()));
    const u2 = onValue(mr, snap => setMovies(snap.val()));
    return () => { u1(); u2(); };
  }, []);

  async function createGroup(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr(null); setMsg(null);
    try {
      let thumbnail = "";
      if (gThumbFile) {
        const reader = new FileReader();
        thumbnail = await new Promise<string>((resolve, reject) => {
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = () => reject(new Error("Failed to read image"));
          reader.readAsDataURL(gThumbFile);
        });
      }

      const key = push(ref(db, "movieGroups")).key;
      if (!key) throw new Error("Failed to allocate key.");
      await set(ref(db, `movieGroups/${key}`), {
        name: gName,
        thumbnail,
        amount: Number(gAmount),
        currency: "TZS",
        description: gDesc,
        createdAt: Date.now()
      });
      setMsg("Group created.");
      setGName(""); setGThumbFile(null); setGDesc("");
    } catch (e: any) { setErr(e.message); }
    finally { setBusy(false); }
  }

  async function addMovie(e: React.FormEvent) {
    e.preventDefault();
    if (!mGroup) { setErr("Select a group first."); return; }
    if (!mYoutube && !mFile) { setErr("Provide a YouTube ID or upload a video file."); return; }

    setBusy(true); setErr(null); setMsg(null);

    try {
      let videoData = "";
      if (mFile) {
        if (mFile.size > 10 * 1024 * 1024) {
          throw new Error("File too large. Realtime Database only supports files up to 10MB. For larger movies, please use YouTube or Storage.");
        }

        const reader = new FileReader();
        videoData = await new Promise<string>((resolve, reject) => {
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = () => reject(new Error("Failed to read video file"));
          reader.readAsDataURL(mFile);
        });
      }

      const key = push(ref(db, "movies")).key;
      await set(ref(db, `movies/${key}`), {
        title: mTitle,
        youtubeId: mYoutube || null,
        videoUrl: videoData || null,
        groupId: mGroup,
        createdAt: Date.now()
      });
      setMsg("Movie added successfully.");
      setMTitle(""); setMYoutube(""); setMFile(null);
    } catch (e: any) { setErr(e.message); }
    finally { setBusy(false); }
  }

  async function executeDelete() {
    if (!confirmDelete) return;
    const { type, id } = confirmDelete;
    setConfirmDelete(null);
    try {
      if (type === "group") {
        await remove(ref(db, `movieGroups/${id}`));
        setMsg("Group deleted successfully.");
      } else {
        await remove(ref(db, `movies/${id}`));
        setMsg("Movie deleted successfully.");
      }
    } catch (e: any) {
      setErr(e.message || "Failed to delete.");
    }
  }

  const groupList = Object.entries(groups || {}).map(([id, v]) => ({ id, ...v }));
  const movieList = Object.entries(movies || {}).map(([id, v]) => ({ id, ...v }));

  return (
    <div className="split">
      <div className="grid" style={{ gap: 24 }}>
        <div className="neu-card">
          <div className="card-body">
            <h2 style={{ margin: "0 0 16px" }}>Manage Movie Groups</h2>
            {msg && <div className="alert info" style={{ marginBottom: 12 }}>{msg}</div>}
            {err && <div className="alert" style={{ marginBottom: 12 }}>{err}</div>}
            
            <form className="grid" style={{ gap: 12 }} onSubmit={createGroup}>
              <div className="field">
                <label>Group Name</label>
                <input className="input" value={gName} onChange={e => setGName(e.target.value)} required placeholder="e.g. Bongo Connection" />
              </div>
              <div className="field">
                <label>Group Thumbnail</label>
                <input type="file" accept="image/*" onChange={e => setGThumbFile(e.target.files?.[0] ?? null)} required />
                <p className="muted" style={{ fontSize: 11, marginTop: 4 }}>This image will represent the movie category.</p>
              </div>
              <div className="field">
                <label>Amount (TZS)</label>
                <input className="input" type="number" value={gAmount} onChange={e => setGAmount(e.target.value)} required />
              </div>
              <div className="field">
                <label>Description</label>
                <textarea className="textarea" value={gDesc} onChange={e => setGDesc(e.target.value)} required />
              </div>
              <button className="neu-btn" type="submit" disabled={busy}>Create Group</button>
            </form>

            <hr style={{ margin: "24px 0", border: "0", borderTop: "1px solid var(--stroke)" }} />

            <h3 style={{ marginBottom: 12 }}>Add Movie to Group</h3>
            <form className="grid" style={{ gap: 12 }} onSubmit={addMovie}>
              <div className="field">
                <label>Select Group</label>
                <select className="select" value={mGroup} onChange={e => setMGroup(e.target.value)} required>
                  <option value="">-- Choose --</option>
                  {groupList.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
              </div>
              <div className="field">
                <label>Movie Title</label>
                <input className="input" value={mTitle} onChange={e => setMTitle(e.target.value)} required />
              </div>
              <div className="field">
                <label>Source: YouTube ID</label>
                <input className="input" value={mYoutube} onChange={e => setMYoutube(e.target.value)} placeholder="e.g. dQw4w9WgXcQ" />
              </div>
              <div style={{ textAlign: "center", color: "var(--muted)", fontSize: 12 }}>- OR -</div>
              <div className="field">
                <label>Source: Upload Video File</label>
                <input type="file" accept="video/*" onChange={e => setMFile(e.target.files?.[0] ?? null)} />
              </div>
              <button className="neu-btn" type="submit" disabled={busy}>
                {busy ? "Processing..." : "Add Movie"}
              </button>
            </form>
          </div>
        </div>
      </div>

      <div className="neu-card">
        <div className="card-body" style={{ padding: 0 }}>
           <h3 style={{ padding: 16, margin: 0 }}>Groups & Movies List</h3>
           <div style={{ maxHeight: "70vh", overflowY: "auto" }}>
             <table className="table">
               <thead>
                 <tr>
                   <th>Group / Movie</th>
                   <th>Info</th>
                   <th>Action</th>
                 </tr>
               </thead>
               <tbody>
                 {groupList.map(g => (
                   <tr key={g.id} style={{ background: "rgba(0,0,0,0.03)" }}>
                     <td>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                           <img src={g.thumbnail} style={{ width: 40, height: 40, borderRadius: 4, objectFit: "cover" }} />
                           <strong>{g.name}</strong>
                        </div>
                     </td>
                     <td>{g.amount} TZS</td>
                     <td><button className="neu-btn btn-danger btn-sm" onClick={() => setConfirmDelete({ type: "group", id: g.id, name: g.name })}>Delete</button></td>
                   </tr>
                 ))}
                 {movieList.map(m => (
                   <tr key={m.id}>
                     <td style={{ paddingLeft: 32 }}>🎬 {m.title}</td>
                     <td style={{ fontSize: 11 }}>{m.youtubeId ? "YouTube" : "Uploaded File"}</td>
                     <td><button className="neu-btn btn-danger btn-sm" onClick={() => setConfirmDelete({ type: "movie", id: m.id, name: m.title })}>Delete</button></td>
                   </tr>
                 ))}
               </tbody>
             </table>
           </div>
        </div>
      </div>

      {confirmDelete && (
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
          onClick={() => setConfirmDelete(null)}
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
              Delete {confirmDelete.type === "group" ? "Group" : "Movie"}?
            </h3>
            <p style={{ margin: "0 0 20px", fontSize: 13.5, color: "var(--muted)", textAlign: "center", lineHeight: 1.5 }}>
              Are you sure you want to delete <strong>"{confirmDelete.name}"</strong>?
              {confirmDelete.type === "group" && " Movies in this group will remain but become unorganized."}
            </p>
            <div style={{ display: "flex", gap: 10 }}>
              <button
                className="neu-btn btn-ghost"
                style={{ flex: 1, padding: "10px 14px", borderRadius: 10 }}
                onClick={() => setConfirmDelete(null)}
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
                onClick={() => void executeDelete()}
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
