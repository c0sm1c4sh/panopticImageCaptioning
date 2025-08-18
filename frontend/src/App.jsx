import React, { useState } from "react";

const API = import.meta.env.VITE_BACKEND_URL || "http://localhost:8000";

export default function App() {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [topk, setTopk] = useState(8);
  const [loading, setLoading] = useState(false);
  const [res, setRes] = useState(null);
  const [err, setErr] = useState(null);

  const onFile = (e) => {
    const f = e.target.files?.[0];
    setFile(f || null);
    setRes(null);
    setErr(null);
    setPreview(f ? URL.createObjectURL(f) : null);
  };

  const submit = async () => {
    if (!file) return;
    setLoading(true);
    setErr(null);
    setRes(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("topk", String(topk));
      const r = await fetch(`${API}/api/caption`, { method: "POST", body: fd });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
      setRes(j);
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ fontFamily: "system-ui, sans-serif", padding: 20, maxWidth: 900, margin: "0 auto" }}>
      <h1>Panoptic Captioning — Demo</h1>
      <div style={{ margin: "12px 0" }}>
        <input type="file" accept="image/*" onChange={onFile} />
        <label style={{ marginLeft: 12 }}>Top-K: </label>
        <input style={{ width: 60 }} type="number" value={topk} onChange={(e) => setTopk(Number(e.target.value))} />
        <button style={{ marginLeft: 12 }} onClick={submit} disabled={!file || loading}>
          {loading ? "Processing…" : "Generate"}
        </button>
      </div>

      {preview && <img src={preview} alt="preview" style={{ maxWidth: "100%", maxHeight: 420, borderRadius: 8 }} />}

      {err && <div style={{ color: "crimson", marginTop: 12 }}>Error: {err}</div>}

      {res && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 16 }}>
          <div style={{ padding: 12, border: "1px solid #ddd", borderRadius: 8 }}>
            <h3>Baseline</h3>
            <p>{res.baseline_caption}</p>
            <small>Recall@K: {res.recall_baseline?.toFixed(3)} • CLIPScore: {res.clipscore_baseline?.toFixed(3)}</small>
          </div>
          <div style={{ padding: 12, border: "1px solid #ddd", borderRadius: 8 }}>
            <h3>Panoptic-aware</h3>
            <p><strong>{res.panoptic_caption}</strong></p>
            <small>Recall@K: {res.recall_panoptic?.toFixed(3)} • CLIPScore: {res.clipscore_panoptic?.toFixed(3)}</small>
            <div style={{ marginTop: 8 }}>
              <strong>Top-K labels:</strong>
              <div>{(res.labels_topk || []).map((l, i) => <span key={i} style={{ marginRight: 6 }}>{l}</span>)}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
