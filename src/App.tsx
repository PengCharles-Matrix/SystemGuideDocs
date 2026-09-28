import { useEffect, useMemo, useState } from "react";
import { categoryOrder, initialDocs } from "./data";
import type { Doc } from "./types";

const icon = (name: string) => ({
  page: "▤", folder: "▱", plus: "+", search: "⌕",
  share: "↗", edit: "✎", menu: "☷", info: "i", top: "↑",
}[name] ?? "•");

function App() {
  const [docs, setDocs] = useState<Doc[]>(() => {
    try {
      const saved = localStorage.getItem("systemguide-docs");
      return saved ? JSON.parse(saved) : initialDocs;
    } catch { return initialDocs; }
  });
  const [activeId, setActiveId] = useState("platform");
  const [category, setCategory] = useState("All Categories");
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<"Reader" | "Editor" | "Manage">("Reader");
  const [jsonOpen, setJsonOpen] = useState(false);
  const [draft, setDraft] = useState("");

  useEffect(() => { localStorage.setItem("systemguide-docs", JSON.stringify(docs)); }, [docs]);

  const active = docs.find((doc) => doc.id === activeId) ?? docs[0];
  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return docs.filter((doc) => {
      const categoryMatch = category === "All Categories" || doc.category === category;
      const text = [doc.title, doc.description, doc.category,
        ...doc.sections.map((s) => s.title + " " + s.paragraphs.join(" ") + " " + (s.bullets ?? []).join(" "))]
        .join(" ").toLowerCase();
      return categoryMatch && (!term || text.includes(term));
    });
  }, [docs, category, query]);

  useEffect(() => {
    if (!filtered.some((doc) => doc.id === activeId) && filtered[0]) setActiveId(filtered[0].id);
  }, [filtered, activeId]);

  useEffect(() => {
    if (!active) return;
    setDraft(active.sections.map((s) => {
      const bullets = s.bullets?.length ? "\n\n" + s.bullets.map((b) => "- " + b).join("\n") : "";
      return "## " + s.title + "\n" + s.paragraphs.join("\n\n") + bullets;
    }).join("\n\n"));
  }, [active]);

  if (!active) return <div className="p-10">No documents available.</div>;

  const grouped = categoryOrder.map((name) => ({
    name, docs: filtered.filter((doc) => doc.category === name),
  })).filter((group) => group.docs.length);

  const createPage = () => {
    const id = "page-" + Date.now();
    const next: Doc = {
      id, category: "Getting Started", title: "Untitled Page",
      description: "Add a short description for this documentation page.",
      author: "Documentation Team", updated: "Sep 28, 2026", readTime: 1,
      sections: [{ id: "overview", title: "Overview", paragraphs: ["Start writing your documentation here."] }],
    };
    setDocs((current) => [...current, next]);
    setActiveId(id); setMode("Editor");
  };

  const saveDraft = () => {
    const paragraphs = draft.split(/\n\s*\n/).filter(Boolean);
    setDocs((current) => current.map((doc) => doc.id === active.id
      ? { ...doc, sections: [{ ...doc.sections[0], paragraphs }] } : doc));
    setMode("Reader");
  };

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(docs, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "systemguide-docs.json"; a.click(); URL.revokeObjectURL(url);
    setJsonOpen(false);
  };

  const pageLink = window.location.origin + window.location.pathname + "#" + active.id;

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand"><span className="brand-mark">▦</span><strong>DocFlow Studio</strong><span className="slash">/</span><span className="crumb">Docs</span></div>
        <div className="search-wrap"><span>{icon("search")}</span><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search documentation..." /><kbd>⌘K</kbd></div>
        <div className="top-actions">
          <div className="segmented">{(["Reader", "Editor", "Manage"] as const).map((item) => <button key={item} className={mode === item ? "active" : ""} onClick={() => setMode(item)}>{item}</button>)}</div>
          <div className="json-menu"><button className="json-button" onClick={() => setJsonOpen((open) => !open)}>{icon("menu")} JSON <span>⌄</span></button>
            {jsonOpen && <div className="json-popover"><button onClick={exportJson}>Export JSON</button><button onClick={() => setJsonOpen(false)}>Close</button></div>}
          </div>
        </div>
      </header>

      <div className="workspace">
        <aside className="sidebar">
          <div className="category-row"><select value={category} onChange={(e) => setCategory(e.target.value)}><option>All Categories</option>{categoryOrder.map((item) => <option key={item}>{item}</option>)}</select><button className="square-button" onClick={createPage}>{icon("plus")}</button></div>
          <input className="filter-input" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Filter topics..." />
          <div className="nav-tree">{grouped.map((group) => <div className="nav-group" key={group.name}>
            <div className="group-heading"><span>⌄</span>{group.name.toUpperCase()} <em>{group.docs.length}</em></div>
            {group.docs.map((doc) => <button key={doc.id} className={"nav-item " + (doc.id === active.id ? "selected" : "")} onClick={() => { setActiveId(doc.id); setMode("Reader"); }}>
              <span className="doc-icon">{icon("page")}</span><span>{doc.title}</span>
            </button>)}
          </div>)}{!grouped.length && <div className="empty-nav">No matching topics.</div>}</div>
          <div className="sidebar-footer"><button onClick={createPage}>{icon("plus")} New Page</button><button>{icon("folder")}</button></div>
        </aside>

        <main className="content">
          <div className="article-wrap">
            <div className="breadcrumbs"><span>Docs</span><b>›</b><span>{active.category}</span><b>›</b><strong>{active.title}</strong></div>
            <div className="article-toolbar"><span className="pill">Overview</span><div><button onClick={() => navigator.clipboard?.writeText(pageLink)}>{icon("share")} Share</button><button onClick={() => setMode("Editor")}>{icon("edit")} Edit</button></div></div>

            {mode === "Reader" ? <article>
              <h1>{active.title}</h1><p className="lead">{active.description}</p>
              <div className="meta">{active.author}<span>•</span><span>Updated {active.updated}</span></div><hr />
              {active.sections.map((section) => <section className="doc-section" id={section.id} key={section.id}>
                <h2>{section.title}</h2>{section.paragraphs.map((paragraph, index) => <p key={index}>{paragraph}</p>)}
                {section.bullets && <ul>{section.bullets.map((bullet) => <li key={bullet}>{bullet}</li>)}</ul>}
                {section.id === "architecture" && <div className="info-callout"><span>{icon("info")}</span><div><strong>Instant Search Shortcut</strong><p>Press <kbd>⌘K</kbd> (or <kbd>Ctrl+K</kbd>) anywhere on the platform to search across all guides, topics, and code snippets.</p></div></div>}
              </section>)}<div className="read-time">{active.readTime} min read</div>
            </article> : mode === "Editor" ? <div className="editor-panel">
              <h1>Edit Documentation</h1><p className="lead">Edit the selected page locally. Changes are saved to browser storage when you save.</p>
              <label>Page content</label><textarea value={draft} onChange={(e) => setDraft(e.target.value)} />
              <div className="editor-actions"><button className="secondary" onClick={() => setMode("Reader")}>Cancel</button><button className="primary" onClick={saveDraft}>Save changes</button></div>
            </div> : <div className="manage-panel">
              <h1>Manage Documentation</h1><p className="lead">Local workspace controls for the current documentation collection.</p>
              <div className="manage-card"><strong>{docs.length} pages</strong><span>stored locally in this browser</span></div>
              <button className="primary" onClick={exportJson}>Export all pages as JSON</button>
            </div>}
          </div>
          <aside className="toc"><div className="toc-title">ON THIS PAGE</div>
            {active.sections.map((section, index) => <a href={"#" + section.id} className={index === 0 ? "current" : ""} key={section.id}>{section.title}</a>)}
            <div className="toc-divider" /><span>{active.readTime} min read</span><a href="#top" className="back-top">{icon("top")} Top</a>
          </aside>
        </main>
      </div>
    </div>
  );
}

export default App;
