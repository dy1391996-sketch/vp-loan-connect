"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type MemoryRow = { memoryId: string; type: string; content: string; confidence: string; status: string; importance: number };

export default function MayaMemoryPage() {
  const [memories, setMemories] = useState<MemoryRow[]>([]);
  const [query, setQuery] = useState("");
  const [people, setPeople] = useState<Array<{ name: string; relationshipToOwner?: string }>>([]);
  const [projects, setProjects] = useState<Array<{ name: string; status: string; latestUpdate?: string }>>([]);
  const [loops, setLoops] = useState<Array<{ description: string; status: string }>>([]);

  async function refresh(text = query) {
    const [memoryRes, peopleRes, projectRes, loopRes] = await Promise.all([
      fetch(`/api/maya/memory?q=${encodeURIComponent(text)}`),
      fetch("/api/maya/people"),
      fetch("/api/maya/projects"),
      fetch("/api/maya/loops"),
    ]);
    if (memoryRes.ok) setMemories(((await memoryRes.json()) as { memories: MemoryRow[] }).memories);
    if (peopleRes.ok) setPeople(((await peopleRes.json()) as { people: Array<{ name: string; relationshipToOwner?: string }> }).people);
    if (projectRes.ok) setProjects(((await projectRes.json()) as { projects: Array<{ name: string; status: string; latestUpdate?: string }> }).projects);
    if (loopRes.ok) setLoops(((await loopRes.json()) as { loops: Array<{ description: string; status: string }> }).loops);
  }

  useEffect(() => {
    void (async () => {
      const [memoryRes, peopleRes, projectRes, loopRes] = await Promise.all([
        fetch("/api/maya/memory"),
        fetch("/api/maya/people"),
        fetch("/api/maya/projects"),
        fetch("/api/maya/loops"),
      ]);
      if (memoryRes.ok) setMemories(((await memoryRes.json()) as { memories: MemoryRow[] }).memories);
      if (peopleRes.ok) setPeople(((await peopleRes.json()) as { people: Array<{ name: string; relationshipToOwner?: string }> }).people);
      if (projectRes.ok) setProjects(((await projectRes.json()) as { projects: Array<{ name: string; status: string; latestUpdate?: string }> }).projects);
      if (loopRes.ok) setLoops(((await loopRes.json()) as { loops: Array<{ description: string; status: string }> }).loops);
    })();
  }, []);

  return (
    <section className="mx-auto max-w-5xl px-4 py-8">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/maya" className="text-sm text-[#e7b7c8]">
            ← Chat
          </Link>
          <h1 className="mt-2 font-display text-3xl">Owner memory</h1>
        </div>
        <div className="flex gap-2 text-sm">
          <a className="rounded-full border border-[#3a2a31] px-3 py-2" href="/api/maya/export">
            Export JSON
          </a>
          <a className="rounded-full border border-[#3a2a31] px-3 py-2" href="/api/maya/export?format=markdown">
            Export Markdown
          </a>
        </div>
      </div>
      <form
        className="mt-6 flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          void refresh(query);
        }}
      >
        <input className="flex-1 rounded-2xl border border-[#3a2a31] bg-[#1b1216] px-4 py-3" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search memories" />
        <button className="rounded-2xl bg-[#e7b7c8] px-4 py-3 text-[#1b1216]" type="submit">
          Search
        </button>
      </form>
      <div className="mt-8 grid gap-6 md:grid-cols-3">
        <Card title="People" items={people.map((person) => `${person.name}${person.relationshipToOwner ? ` · ${person.relationshipToOwner}` : ""}`)} />
        <Card title="Projects" items={projects.map((project) => `${project.name} [${project.status}]`)} />
        <Card title="Open loops" items={loops.map((loop) => `${loop.status}: ${loop.description}`)} />
      </div>
      <ul className="mt-8 space-y-3">
        {memories.map((memory) => (
          <li key={memory.memoryId} className="rounded-2xl border border-[#3a2a31] bg-[#1b1216] p-4">
            <p className="text-xs uppercase tracking-wide text-[#e7b7c8]">
              {memory.type} · {memory.confidence} · {memory.status}
            </p>
            <p className="mt-2">{memory.content}</p>
            <div className="mt-3 flex gap-2 text-xs">
              <button
                className="rounded-full border border-[#3a2a31] px-3 py-1"
                type="button"
                onClick={async () => {
                  const content = window.prompt("Corrected content", memory.content);
                  if (!content) return;
                  await fetch("/api/maya/memory", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ memoryId: memory.memoryId, content }) });
                  void refresh();
                }}
              >
                Correct
              </button>
              <button
                className="rounded-full border border-[#3a2a31] px-3 py-1"
                type="button"
                onClick={async () => {
                  if (!window.confirm("Delete this stored memory?")) return;
                  await fetch(`/api/maya/memory?memoryId=${memory.memoryId}`, { method: "DELETE" });
                  void refresh();
                }}
              >
                Delete
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Card({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-2xl border border-[#3a2a31] bg-[#1b1216] p-4">
      <h2 className="font-display text-xl">{title}</h2>
      <ul className="mt-3 space-y-2 text-sm text-[#d7c4c8]">
        {items.length ? items.map((item) => <li key={item}>{item}</li>) : <li>None yet</li>}
      </ul>
    </div>
  );
}
