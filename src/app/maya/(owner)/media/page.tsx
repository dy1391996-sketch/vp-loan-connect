"use client";
/* eslint-disable @next/next/no-img-element -- owner-private authenticated media bytes; next/image cannot proxy review frames */
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { MediaRecord, QC } from "@/lib/maya/media/types";
const blankQC: QC = { identity: false, anatomy: false, scene: false, quality: false, start: false, middle: false, end: false, note: "" };
const control = "w-full rounded-xl border border-[#624453] bg-[#21151d] p-3 text-[#f9e8ee]";
const button = "rounded-xl bg-[#e7b7c8] px-4 py-2 font-medium text-[#21151d] disabled:opacity-40";
type State = { records: MediaRecord[]; provider: { available: boolean; photo: boolean; imageToVideo: boolean; reason?: string }; master: { available: boolean; error?: string } };
export default function MayaMediaPage() {
  const [data, setData] = useState<State>(); const [message, setMessage] = useState(""); const [busy, setBusy] = useState(false);
  const [kind, setKind] = useState("photo"); const [source, setSource] = useState(""); const [continuity, setContinuity] = useState("");
  const [refs, setRefs] = useState<string[]>([]); const [filter, setFilter] = useState("all"); const [selected, setSelected] = useState<MediaRecord>();
  const [qc, setQC] = useState<QC>(blankQC); const [reason, setReason] = useState("");
  const refresh = useCallback(async () => { const r = await fetch("/api/maya/media"); if (r.status === 401) { window.location.href = "/maya/login"; return; } const d = await r.json(); if (!r.ok) throw new Error(d.error); setData(d); }, []);
  useEffect(() => { void refresh().catch(e => setMessage(String(e))); }, [refresh]);
  useEffect(() => { if (!busy) return; const timer = setInterval(() => { void refresh().catch(() => undefined); }, 4000); return () => clearInterval(timer); }, [busy, refresh]);
  async function generate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage("Generating your new moment…");
    const form = new FormData(event.currentTarget); const values = Object.fromEntries(form.entries());
    try {
      const r = await fetch("/api/maya/media", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...values, kind, sourcePhotoId: source || undefined, continuityId: continuity || undefined, continuity: form.getAll("keep"), referenceIds: refs, keep: undefined }) });
      const d = await r.json();
      const failed = !r.ok || d.record?.status === "FAILED" || d.record?.status === "QC_FAILED";
      setMessage(failed
        ? (d.record?.error || d.error || "No media was generated. A compatible free local photo/video service is not available.")
        : (d.record?.error || d.error || "Ready for your visual review. Nothing is accepted automatically."));
      await refresh(); if (d.record?.status === "READY_FOR_REVIEW") { setSelected(d.record); setQC(blankQC); }
    } catch { setMessage("The request was interrupted. Refresh the library to check its saved status before retrying."); }
    finally { setBusy(false); }
  }
  async function review(action: string) {
    if (!selected) return; setBusy(true);
    try {
      const r = await fetch(`/api/maya/media/${selected.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ action, qc, reason }) });
      const d = await r.json(); if (!r.ok) throw new Error(d.error); setSelected(d.record); await refresh(); setMessage(`Saved: ${d.record.status.replaceAll("_", " ")}`);
    } catch (e) { setMessage(String(e)); } finally { setBusy(false); }
  }
  const accepted = data?.records.filter(r => r.status === "ACCEPTED" && r.request.kind === "photo") || [];
  return <main className="mx-auto h-full max-w-6xl overflow-y-auto px-5 py-7 text-[#faeaf0]">
    <header className="mb-6 flex items-center justify-between"><div><p className="text-sm text-[#d7a7bb]">MAYA · PRIVATE STUDIO</p><h1 className="text-3xl font-semibold">A new moment, the same Maya.</h1><p className="mt-2 text-sm text-[#d7c4c8]">Photos, motion and a visual history. Creative scenes stay separate from real memories.</p></div><Link className="text-[#e7b7c8]" href="/maya">Back to chat</Link></header>
    <div className="mb-6 flex items-center gap-4 rounded-2xl border border-[#624453] p-4">
      <img src="/api/maya/visual" alt="Protected Master Maya" className="h-20 w-20 rounded-full object-cover" />
      <div><p className="font-semibold">Master Maya · protected</p><p className="text-sm">{data?.master.available ? "Original project reference preserved. New photos never replace it." : data?.master.error || "Checking identity reference…"}</p><p className="mt-1 text-sm text-[#e7b7c8]">{data?.provider.available ? "Free local generation service connected" : "Generation unavailable — a compatible free local photo/video service is needed."}</p></div>
    </div>
    <div className="grid gap-7 lg:grid-cols-[minmax(280px,360px)_1fr]">
      <form onSubmit={generate} className="space-y-4 rounded-2xl bg-[#281923] p-5">
        <h2 className="text-xl">Create a moment</h2>
        <label className="block">Format<select className={control} value={kind} onChange={e => { setKind(e.target.value); if(e.target.value === "photo") setSource(""); }}><option value="photo">Create photo</option><option value="video">Photo → video</option></select></label>
        {kind === "video" && <label className="block">Approved source photo<select required className={control} value={source} onChange={e => setSource(e.target.value)}><option value="">Choose an accepted photo</option>{accepted.map(r => <option key={r.id} value={r.id}>{r.request.scene.slice(0,65)}</option>)}</select><span className="text-xs">The exact photo supplies the starting scene, outfit and pose.</span></label>}
        <label className="block">Style<select name="mode" className={control}>{["casual", "lifestyle", "fashion", "fitness", "social", "custom"].map(x => <option key={x}>{x}</option>)}</select></label>
        <label className="block">Scene<textarea required minLength={3} maxLength={2000} name="scene" className={control} placeholder="Maya standing on a balcony at night, looking toward the street" /></label>
        {kind === "video" && <label className="block">Motion<textarea name="motion" maxLength={400} className={control} defaultValue="Subtle breathing, blinking and hair movement. Static phone camera." /></label>}
        <details><summary className="cursor-pointer text-[#e7b7c8]">Outfit, camera and continuity</summary><div className="mt-3 space-y-3">
          {[['outfit','Outfit',''],['pose','Pose',''],['expression','Expression',''],['camera','Camera','smartphone candid'],['framing','Framing','waist-up'],['lighting','Lighting','natural available light'],['hairstyle','Hair','natural long dark hair'],['activity','Activity','']].map(([key,label,value]) => <label key={key} className="block text-sm">{label}<input name={key} maxLength={200} defaultValue={value} className={control} /></label>)}
          <label className="block">Continue an accepted moment<select className={control} value={continuity} onChange={e => setContinuity(e.target.value)}><option value="">New moment</option>{accepted.map(r => <option key={r.id} value={r.id}>{r.request.scene.slice(0,60)}</option>)}</select></label>
          {continuity && ["outfit", "scene", "lighting", "hairstyle"].map(x => <label key={x} className="mr-3 inline-flex gap-2"><input type="checkbox" name="keep" value={x} />Same {x}</label>)}
        </div></details>
        <details><summary className="cursor-pointer text-[#e7b7c8]">Extra identity references (up to 3)</summary>{accepted.filter(r => r.useAsReference).map(r => <label key={r.id} className="mt-2 flex gap-2 text-sm"><input type="checkbox" checked={refs.includes(r.id)} disabled={!refs.includes(r.id) && refs.length >= 3} onChange={e => setRefs(e.target.checked ? [...refs,r.id] : refs.filter(id => id !== r.id))} />{r.request.scene}</label>)}</details>
        <button className={button} disabled={busy || !data?.master.available}>{busy ? "Working…" : kind === "photo" ? "Create photo" : "Create video"}</button>
        <p className="text-xs text-[#d7c4c8]">₹0 · no paid service configured. Every output requires your review.</p>
      </form>
      <section><div className="mb-4 flex items-center justify-between"><h2 className="text-xl">Media library</h2><select aria-label="Filter library" value={filter} onChange={e => setFilter(e.target.value)} className="rounded-lg bg-[#281923] p-2">{["all","ACCEPTED","READY_FOR_REVIEW","FAILED","QC_FAILED","REJECTED","ARCHIVED"].map(x => <option key={x} value={x}>{x.replaceAll("_"," ")}</option>)}</select></div>
        <p role="status" className="mb-4 whitespace-pre-wrap text-sm text-[#f0c8d7]">{message}</p>
        <div className="grid grid-cols-2 gap-4">{data?.records.filter(r => filter === "all" ? r.status !== "ARCHIVED" : r.status === filter).map(r => <button key={r.id} type="button" onClick={() => { setSelected(r); setQC(r.qc || blankQC); setReason(""); }} className="overflow-hidden rounded-2xl border border-[#624453] bg-[#281923] text-left">
          {r.thumbnail ? <img src={`/api/maya/media/${r.id}?variant=thumbnail`} alt={r.request.scene} className="h-48 w-full object-cover" /> : <div className="flex h-32 items-center justify-center text-[#d7c4c8]">{r.status === "GENERATING" ? "Generating…" : "No media generated"}</div>}
          <div className="p-3"><p className="text-xs text-[#e7b7c8]">{r.provenance === "USER_REFERENCE" ? "IDENTITY REFERENCE" : r.status.replaceAll("_"," ")}</p><p className="mt-1 line-clamp-2 text-sm">{r.request.scene}</p></div></button>)}</div>
      </section>
    </div>
    {selected && <section aria-label="Media review" className="mt-8 rounded-2xl border border-[#624453] bg-[#21151d] p-5">
      <div className="flex justify-between"><h2 className="text-xl">Review this moment</h2><button onClick={() => setSelected(undefined)}>Close review</button></div><p className="my-3">{selected.request.scene} · {selected.status.replaceAll("_"," ")}</p>
      {selected.file && (selected.request.kind === "photo" ? <img src={`/api/maya/media/${selected.id}`} alt="Review Maya identity and scene" className="max-h-[600px] max-w-full rounded-xl" /> : <video controls preload="metadata" src={`/api/maya/media/${selected.id}`} className="max-h-[600px] max-w-full" />)}
      {selected.frames && <div className="mt-3 grid grid-cols-3 gap-3">{selected.frames.map((_,i) => <figure key={i}><img alt={["Start", "Middle", "End"][i]} src={`/api/maya/media/${selected.id}?variant=frame-${i}`} /><figcaption>{["Start", "Middle", "End"][i]}</figcaption></figure>)}</div>}
      {selected.error && <p className="my-3 text-[#f7b3bb]">{selected.error}</p>}
      {selected.status === "READY_FOR_REVIEW" && <fieldset className="my-4 space-y-2"><legend>Inspect before accepting</legend>{(["identity","anatomy","scene","quality", ...(selected.request.kind === "video" ? ["start","middle","end"] : [])] as Array<keyof QC>).map(key => <label className="mr-5 inline-flex gap-2" key={key}><input type="checkbox" checked={Boolean(qc[key])} onChange={e => setQC({ ...qc, [key]: e.target.checked })} />{key} verified</label>)}</fieldset>}
      <label className="my-3 block">Review / rejection reason<input className={control} value={reason} onChange={e => setReason(e.target.value)} maxLength={1000} placeholder="Face drift, wrong pose, artificial skin, motion issue…" /></label>
      <div className="flex flex-wrap gap-3">
        {selected.status === "READY_FOR_REVIEW" && <><button className={button} disabled={busy || !qc.identity || !qc.anatomy || !qc.scene || !qc.quality || (selected.request.kind === "video" && (!qc.start || !qc.middle || !qc.end))} onClick={() => review("accept")}>Accept</button><button className={button} disabled={busy || !reason.trim()} onClick={() => review("qc-fail")}>QC failed</button></>}
        <button className={button} disabled={busy || !reason.trim()} onClick={() => review("reject")}>Reject</button><button className={button} disabled={busy} onClick={() => review("archive")}>Archive</button>
        {selected.status === "ACCEPTED" && selected.request.kind === "photo" && <><button className={button} disabled={busy || selected.useAsReference} onClick={() => review("reference")}>{selected.useAsReference ? "Identity reference enabled" : "Use as reference"}</button><button className={button} onClick={() => {setSource(selected.id);setKind("video"); window.scrollTo(0,0);}}>Photo → video</button></>}
        {selected.file && <a className={button} href={`/api/maya/media/${selected.id}?download=1`}>Download</a>}
      </div>
      <details className="mt-5"><summary>Generation details</summary><pre className="mt-2 max-h-96 overflow-auto whitespace-pre-wrap text-xs">{JSON.stringify(selected, null, 2)}</pre><a className="text-[#e7b7c8]" href={`/api/maya/media/${selected.id}?variant=details`} target="_blank" rel="noreferrer">Open metadata export</a></details>
    </section>}
  </main>;
}
