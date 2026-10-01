import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import { categoryOrder as initialCategoryOrder, initialDocs } from "./data";
import type { Doc } from "./types";

const icon = (name: string) => ({
  page: "▤", folder: "▱", plus: "+", search: "⌕", share: "↗", edit: "✎",
  menu: "☷", info: "i", top: "↑", chevron: "⌄", eye: "◉", split: "◫", trash: "⌫",
  html: "▧", bold: "B", italic: "I", underline: "U", strike: "S",
  code: "</>", quote: "❞", image: "▧", tip: "♧", warning: "△"
}[name] ?? "•");

function renderDocParagraph(paragraph: string, index: number) {
  const match = paragraph.match(/^\[(info|tip|note|warning|steps|code)\]\s*(.*)$/i);
  if (!match) return <p key={index}>{paragraph}</p>;
  const kind = match[1].toLowerCase();
  const title = kind === "steps" ? "Steps" : kind[0].toUpperCase() + kind.slice(1);
  return <div key={index} className={"doc-callout callout-" + kind}><div className="callout-heading"><span>{kind === "warning" ? "⚠" : kind === "tip" ? "✦" : kind === "steps" ? "✓" : kind === "code" ? "⌘" : "ⓘ"}</span><strong>{title}</strong></div>{match[2] && <p>{match[2]}</p>}</div>;
}

function App() {
  const [docs, setDocs] = useState<Doc[]>(() => {
    try { const saved = localStorage.getItem("systemguide-docs"); const parsed = saved ? JSON.parse(saved) : null; return Array.isArray(parsed) && parsed.length > 0 ? parsed : initialDocs; }
    catch { return initialDocs; }
  });
  const [categories, setCategories] = useState<string[]>(() => {
    try { const saved = localStorage.getItem("systemguide-categories"); return saved ? JSON.parse(saved) : initialCategoryOrder; }
    catch { return initialCategoryOrder; }
  });
  const [activeId, setActiveId] = useState("platform");
  const [category, setCategory] = useState("All Categories");
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<"Reader" | "Editor" | "Manage">("Reader");
  const [manageTab, setManageTab] = useState<"categories" | "documents" | "settings">("categories");
  const [siteTitle, setSiteTitle] = useState(() => localStorage.getItem("systemguide-site-title") || "System Guide Docs");
  const [siteTitleDraft, setSiteTitleDraft] = useState(siteTitle);
  const [editorView, setEditorView] = useState<"Visual" | "Split" | "HTML">("Visual");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [newCategory, setNewCategory] = useState("");
  const [draft, setDraft] = useState("");
  const [meta, setMeta] = useState({ title: "", description: "", category: "", badge: "Overview" });
  const [activeSectionId, setActiveSectionId] = useState("");
  useEffect(() => { localStorage.setItem("systemguide-docs", JSON.stringify(docs)); }, [docs]);
  useEffect(() => { localStorage.setItem("systemguide-categories", JSON.stringify(categories)); }, [categories]);
  useEffect(() => { localStorage.setItem("systemguide-site-title", siteTitle); }, [siteTitle]);

  const active = docs.find((doc) => doc.id === activeId) ?? docs[0];
  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return docs.filter((doc) => {
      const categoryMatch = category === "All Categories" || doc.category === category;
      const text = [doc.title, doc.description, doc.category, ...doc.sections.map((s) =>
        s.title + " " + s.paragraphs.join(" ") + " " + (s.bullets ?? []).join(" "))].join(" ").toLowerCase();
      return categoryMatch && (!term || text.includes(term));
    });
  }, [docs, category, query]);

  useEffect(() => {
    if (!filtered.some((doc) => doc.id === activeId) && filtered[0]) setActiveId(filtered[0].id);
  }, [filtered, activeId]);

  useEffect(() => {
    if (!active) return;
    setActiveSectionId(active.sections[0]?.id ?? "");
    setDraft(active.sections.map((s) => {
      const bullets = s.bullets?.length ? "\n\n" + s.bullets.map((b) => "- " + b).join("\n") : "";
      return "## " + s.title + "\n" + s.paragraphs.join("\n\n") + bullets;
    }).join("\n\n"));
    setMeta({ title: active.title, description: active.description, category: active.category, badge: "Overview" });
  }, [active]);

  useEffect(() => {
    const reader = document.querySelector<HTMLElement>(".reader-content");
    if (!reader || mode !== "Reader" || !active.sections.length) return;
    const updateCurrentSection = () => {
      const readerTop = reader.getBoundingClientRect().top;
      const threshold = readerTop + 120;
      let current = active.sections[0].id;
      for (const section of active.sections) {
        const element = document.getElementById(section.id);
        if (element && element.getBoundingClientRect().top <= threshold) current = section.id;
      }
      setActiveSectionId(current);
    };
    updateCurrentSection();
    reader.addEventListener("scroll", updateCurrentSection, { passive: true });
    window.addEventListener("resize", updateCurrentSection);
    return () => {
      reader.removeEventListener("scroll", updateCurrentSection);
      window.removeEventListener("resize", updateCurrentSection);
    };
  }, [active, mode]);

  if (!active) return <div className="app-shell empty-workspace"><header className="topbar"><div className="brand"><span className="brand-mark">▦</span><strong>System Guide Docs</strong></div></header><main className="empty-recovery"><h1>No documents found</h1><p>Your workspace is empty or its saved document data could not be loaded.</p><button className="primary" onClick={() => { setDocs(initialDocs); setActiveId(initialDocs[0].id); setMode("Reader"); }}>Restore starter documentation</button></main></div>;

  const grouped = categories.map((name) => ({ name, docs: filtered.filter((doc) => doc.category === name) }))
    .filter((group) => group.docs.length || category === "All Categories");
  const storageBytes = new Blob([JSON.stringify({ siteTitle, categories, docs })]).size;
  const storageLabel = storageBytes >= 1024 * 1024 ? `${(storageBytes / 1024 / 1024).toFixed(1)} MB` : `${(storageBytes / 1024).toFixed(1)} KB`;

  const updateMeta = (key: keyof typeof meta, value: string) => setMeta((m) => ({ ...m, [key]: value }));

  const activeIndex = Math.max(0, filtered.findIndex((doc) => doc.id === active.id));
  const previousDoc = activeIndex > 0 ? filtered[activeIndex - 1] : null;
  const nextDoc = activeIndex >= 0 && activeIndex < filtered.length - 1 ? filtered[activeIndex + 1] : null;
  const openDoc = (doc: Doc | null) => {
    if (!doc) return;
    setActiveId(doc.id);
    setMode("Reader");
    document.querySelector<HTMLElement>(".reader-content")?.scrollTo({ top: 0, behavior: "smooth" });
  };

  const createCategory = () => {
    const value = newCategory.trim();
    if (!value || categories.includes(value)) return;
    setCategories((items) => [...items, value]);
    setNewCategory("");
    setCategoryOpen(false);
  };

  const createPage = () => {
    const id = "page-" + Date.now();
    const fallbackCategory = categories[0] ?? "Getting Started";
    const next: Doc = {
      id, category: fallbackCategory, title: "Untitled Page",
      description: "Add a short description for this documentation page.",
      author: "Documentation Team", updated: "Sep 28, 2026", readTime: 1,
      sections: [{ id: "overview", title: "Overview", paragraphs: ["Start writing your documentation here."] }],
    };
    setDocs((current) => [...current, next]);
    setActiveId(id); setMode("Editor"); setEditorView("Visual");
  };

  const saveDraft = () => {
    const paragraphs = draft.split(/\n\s*\n/).filter(Boolean);
    const sections = paragraphs.length
      ? paragraphs.map((block, index) => {
          const lines = block.split("\n").filter(Boolean);
          const callout = lines[0]?.match(/^\[(info|tip|note|warning|steps|code)\]\s*(.*)$/i);
          const heading = callout ? (callout[1].toLowerCase() === "steps" ? "Steps" : callout[1][0].toUpperCase() + callout[1].slice(1)) : lines[0]?.replace(/^#{1,6}\s*/, "") || "Section " + (index + 1);
          const body = lines.slice(1);
          const bullets = body.filter((line) => callout?.[1].toLowerCase() === "steps" ? /^\d+[.)]\s/.test(line) : /^[-*]\s/.test(line)).map((line) => line.replace(callout?.[1].toLowerCase() === "steps" ? /^\d+[.)]\s/ : /^[-*]\s/, ""));
          const plain = callout ? [lines[0], ...body.filter((line) => !(callout[1].toLowerCase() === "steps" && /^\d+[.)]\s/.test(line)))].filter(Boolean) : body.filter((line) => !/^[-*]\s/.test(line));
          return { id: heading.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "section-" + index, title: heading, paragraphs: plain, ...(bullets.length ? { bullets } : {}) };
        })
      : active.sections;
    setDocs((current) => current.map((doc) => doc.id === active.id
      ? { ...doc, title: meta.title.trim() || "Untitled Page", description: meta.description, category: meta.category, sections } : doc));
    if (!categories.includes(meta.category)) setCategories((items) => [...items, meta.category]);
    setMode("Reader");
  };

  const insert = (token: string) => {
    const textarea = document.querySelector<HTMLTextAreaElement>(".editor-canvas");
    const start = textarea?.selectionStart ?? draft.length;
    const end = textarea?.selectionEnd ?? draft.length;
    const next = draft.slice(0, start) + token + draft.slice(end);
    setDraft(next);
    requestAnimationFrame(() => { textarea?.focus(); textarea?.setSelectionRange(start + token.length, start + token.length); });
  };

  const renameCategory = (name: string) => {
    const next = window.prompt("Rename category", name)?.trim();
    if (!next || next === name || categories.includes(next)) return;
    setCategories((items) => items.map((item) => item === name ? next : item));
    setDocs((items) => items.map((doc) => doc.category === name ? { ...doc, category: next } : doc));
    if (category === name) setCategory(next);
    if (meta.category === name) updateMeta("category", next);
  };

  const deleteCategory = (name: string) => {
    const fallback = categories.find((item) => item !== name);
    if (!window.confirm(`Delete category “${name}”? Documents will be moved to ${fallback ?? "Uncategorized"}.`)) return;
    setCategories((items) => items.filter((item) => item !== name));
    setDocs((items) => items.map((doc) => doc.category === name ? { ...doc, category: fallback ?? "Uncategorized" } : doc));
    if (category === name) setCategory("All Categories");
  };

  const deleteDocument = (doc: Doc) => {
    if (docs.length <= 1) {
      window.alert("Keep at least one document in the workspace. Create another page before deleting this one.");
      return;
    }
    if (!window.confirm(`Delete “${doc.title}” permanently from this browser?`)) return;
    const remaining = docs.filter((item) => item.id !== doc.id);
    setDocs(remaining);
    if (activeId === doc.id) { setActiveId(remaining[0].id); setMode("Reader"); }
  };

  const exportJson = () => {
    const blob = new Blob([JSON.stringify({ siteTitle, categories, docs }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob); const a = document.createElement("a");
    a.href = url; a.download = "systemguide-docs.json"; a.click(); URL.revokeObjectURL(url);
  };

  const importJson = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        if (!Array.isArray(parsed.docs) || !Array.isArray(parsed.categories)) throw new Error("Invalid backup");
        setDocs(parsed.docs); setCategories(parsed.categories);
        if (typeof parsed.siteTitle === "string") { setSiteTitle(parsed.siteTitle); setSiteTitleDraft(parsed.siteTitle); }
        setActiveId(parsed.docs[0]?.id ?? ""); setCategory("All Categories"); setQuery(""); setMode("Manage"); setManageTab("settings");
      } catch { window.alert("That file is not a valid System Guide Docs backup."); }
    };
    reader.readAsText(file);
  };

  const resetDemoData = () => {
    if (!window.confirm("Reset the workspace to the starter documentation? Your current local data will be replaced.")) return;
    setDocs(initialDocs); setCategories(initialCategoryOrder); setActiveId(initialDocs[0].id); setCategory("All Categories"); setQuery("");
  };

  const renderPreview = (source: string) => source.split(/\n\s*\n/).filter(Boolean).map((block, i) => {
    const lines = block.split("\n"); const first = lines[0] ?? "";
    const headingMatch = first.match(/^#{1,3}\s+(.*)$/);
    const body = lines.slice(headingMatch ? 1 : 0);
    const marker = (body[0] ?? first).match(/^\[(tip|info|note|warning|steps|code)\]\s*(.*)$/i);
    if (marker) {
      const kind = marker[1].toLowerCase();
      const content = [marker[2], ...body.slice(1)].filter(Boolean);
      const title = kind === "steps" ? "Steps" : kind[0].toUpperCase() + kind.slice(1);
      const listItems = content.filter((line) => /^\d+[.)]\s/.test(line));
      return <section className="preview-section" key={i}>
        {headingMatch && <h2>{headingMatch[1]}</h2>}
        <div className={"doc-callout callout-" + kind}><div className="callout-heading"><span>{kind === "warning" ? "⚠" : kind === "tip" ? "✦" : kind === "steps" ? "✓" : kind === "code" ? "⌘" : "ⓘ"}</span><strong>{title}</strong></div>
          {kind === "steps" ? <ol>{listItems.map((line, n) => <li key={n}>{line.replace(/^\d+[.)]\s/, "")}</li>)}</ol> : kind === "code" ? <pre><code>{content.join("\n")}</code></pre> : content.map((line, n) => <p key={n}>{line}</p>)}
        </div>
      </section>;
    }
    const bullets = body.filter((line) => /^[-*]\s/.test(line));
    const paragraphs = body.filter((line) => !/^[-*]\s/.test(line));
    return <section className="preview-section" key={i}>
      {headingMatch && <h2>{headingMatch[1]}</h2>}
      {paragraphs.map((p, n) => <p key={n}>{p}</p>)}
      {bullets.length > 0 && <ul>{bullets.map((b, n) => <li key={n}>{b.replace(/^[-*]\s/, "")}</li>)}</ul>}
    </section>;
  });

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand"><span className="brand-mark">▦</span><strong>{siteTitle}</strong><span className="slash">/</span><span className="crumb">Docs</span></div>
        <div className="search-wrap"><span>{icon("search")}</span><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search documentation..." /><kbd>⌘K</kbd></div>
        <div className="top-actions">
          <div className="segmented">{(["Reader", "Editor", "Manage"] as const).map((item) => <button key={item} className={mode === item ? "active" : ""} onClick={() => setMode(item)}>{item}</button>)}</div>
          <div className="json-menu"><button className="json-button" onClick={exportJson}>{icon("menu")} JSON <span>⌄</span></button></div>
        </div>
      </header>

      <div className="workspace">
        <aside className="sidebar">
          <div className="category-row">
            <select value={category} onChange={(e) => setCategory(e.target.value)}><option>All Categories</option>{categories.map((item) => <option key={item}>{item}</option>)}</select>
            <button className="square-button" onClick={() => setCategoryOpen((v) => !v)}>{icon("plus")}</button>
            {categoryOpen && <div className="category-popover"><strong>New category</strong><input autoFocus value={newCategory} onChange={(e) => setNewCategory(e.target.value)} onKeyDown={(e) => e.key === "Enter" && createCategory()} placeholder="Category name" /><div><button onClick={() => setCategoryOpen(false)}>Cancel</button><button className="primary" onClick={createCategory}>Add</button></div></div>}
          </div>
          <input className="filter-input" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Filter topics..." />
          <div className="nav-tree">{grouped.map((group) => <div className="nav-group" key={group.name}>
            <button className="group-heading" onClick={() => setCollapsed((c) => ({ ...c, [group.name]: !c[group.name] }))}><span>{collapsed[group.name] ? "›" : "⌄"}</span>{group.name.toUpperCase()} <em>{group.docs.length}</em></button>
            {!collapsed[group.name] && group.docs.map((doc) => <button key={doc.id} className={"nav-item " + (doc.id === active.id ? "selected" : "")} onClick={() => { setActiveId(doc.id); setMode("Reader"); }}>
              <span className="doc-icon">{icon("page")}</span><span>{doc.title}</span>
            </button>)}
          </div>)}{!grouped.length && <div className="empty-nav">No matching topics.</div>}</div>
          <div className="sidebar-footer"><button onClick={createPage}>{icon("plus")} New Page</button><button title="New category" onClick={() => setCategoryOpen(true)}>{icon("folder")}</button></div>
        </aside>

        <main className="content">
          {mode === "Editor" ? <div className="editor-workspace">
            <div className="editor-header">
              <div className="editor-breadcrumb"><strong>Pages</strong><span>›</span><span>{active.title}</span></div>
              <div className="editor-switch"><button className={editorView === "Visual" ? "active" : ""} onClick={() => setEditorView("Visual")}>{icon("eye")} Visual</button><button className={editorView === "Split" ? "active" : ""} onClick={() => setEditorView("Split")}>{icon("split")} Split</button><button className={editorView === "HTML" ? "active" : ""} onClick={() => setEditorView("HTML")}>{icon("html")} HTML</button><button className="done" onClick={() => setMode("Reader")}>Done</button><button className="save" onClick={saveDraft}>Save</button></div>
            </div>
            <div className="metadata-grid">
              <label>Title<input value={meta.title} onChange={(e) => updateMeta("title", e.target.value)} /></label>
              <label>Category<div className="field-with-plus"><select value={meta.category} onChange={(e) => updateMeta("category", e.target.value)}>{categories.map((item) => <option key={item}>{item}</option>)}</select><button onClick={() => setCategoryOpen(true)}>+</button></div></label>
              <label>Badge<input value={meta.badge} onChange={(e) => updateMeta("badge", e.target.value)} /></label>
              <label className="description-field">Description<input value={meta.description} onChange={(e) => updateMeta("description", e.target.value)} /></label>
            </div>
            <div className="format-toolbar">
              <select defaultValue="System Sans" onChange={() => undefined}><option>System Sans</option><option>Serif</option><option>Mono</option></select>
              <select defaultValue="16px" onChange={() => undefined}><option>16px</option><option>14px</option><option>18px</option><option>20px</option></select>
              {["H1","H2","H3","B","I","U","S","</>","•","1.","❞"].map((item) => <button key={item} onClick={() => insert(item.startsWith("H") ? "#".repeat(Number(item[1])) + " " : item === "•" ? "- " : item === "1." ? "1. " : item === "❞" ? "> " : item === "B" ? "**text**" : item === "I" ? "*text*" : item === "U" ? "<u>text</u>" : item === "S" ? "~~text~~" : item === "</>" ? "`code`" : item)}>{item}</button>)}
              <span className="toolbar-divider" />
              <button onClick={() => insert("\n\n[Info] Add helpful context here.")}>ⓘ Info</button><button onClick={() => insert("\n\n[Tip] Add a practical tip here.")}>♧ Tip</button><button onClick={() => insert("\n\n[Warning] Describe a risk or caution here.")}>△ Warning</button><button onClick={() => insert("\n\n[Steps]\n1. First step\n2. Second step\n3. Third step")}>☷ Steps</button><button onClick={() => insert("\n\n[Note] Add an important note here.")}>▤ Note</button><button onClick={() => insert("\n\n[Code]\nPaste code here")}>⌘ Code</button><button onClick={() => insert("\n\n![Image](image-url) ")}>▧ Image</button>
            </div>
            <div className={"editor-body view-" + editorView.toLowerCase()}>
              {(editorView === "Visual" || editorView === "Split") && <div className="editor-pane"><div className="pane-label">EDITOR</div><textarea className="editor-canvas" value={draft} onChange={(e) => setDraft(e.target.value)} spellCheck={false} /></div>}
              {(editorView === "Split" || editorView === "HTML") && <div className="preview-pane"><div className="pane-label">{editorView === "HTML" ? "HTML" : "PREVIEW"}</div><div className="preview-card">{renderPreview(draft)}</div></div>}
            </div>
          </div> : mode === "Manage" ? <div className="manage-page"><div className="manage-inner"><h1>Management</h1><p className="manage-subtitle">Organize categories, review all documentation pages, and manage local storage.</p><div className="manage-tabs"><button className={manageTab === "categories" ? "active" : ""} onClick={() => setManageTab("categories")}>Categories ({categories.length})</button><button className={manageTab === "documents" ? "active" : ""} onClick={() => setManageTab("documents")}>All Documents ({docs.length})</button><button className={manageTab === "settings" ? "active" : ""} onClick={() => setManageTab("settings")}>Settings &amp; Storage</button></div>{manageTab === "categories" && <section className="management-view"><div className="management-heading"><h2>CATEGORY HIERARCHY</h2><button className="manage-new" onClick={() => setCategoryOpen(true)}>＋ New Category</button></div><div className="category-list">{categories.map((name, index) => <div className="category-item" key={name}><div className="category-main"><span className="category-symbol">{index === 0 ? "◎" : index === 1 ? "♢" : index === 2 ? "⌂" : "♧"}</span><div><strong>{name}</strong><button className="inline-edit" onClick={() => renameCategory(name)} title={"Rename " + name}>{icon("edit")}</button><small>{docs.filter((doc) => doc.category === name).length} {docs.filter((doc) => doc.category === name).length === 1 ? "document" : "documents"}</small></div></div><div className="category-actions"><button title="Move up" disabled={index === 0} onClick={() => setCategories((items) => { const next=[...items]; [next[index-1],next[index]]=[next[index],next[index-1]]; return next; })}>↑</button><button title="Move down" disabled={index === categories.length-1} onClick={() => setCategories((items) => { const next=[...items]; [next[index],next[index+1]]=[next[index+1],next[index]]; return next; })}>↓</button><button className="manage-trash" title="Delete category" onClick={() => deleteCategory(name)}>{icon("trash")}</button></div></div>)}</div></section>}{manageTab === "documents" && <section className="management-view"><div className="document-filters"><div className="manage-search"><span>{icon("search")}</span><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search documents by title or category..." /></div><label>Category:<select value={category} onChange={(e) => setCategory(e.target.value)}><option value="All Categories">All ({docs.length})</option>{categories.map((item) => <option key={item} value={item}>{item}</option>)}</select></label></div><div className="document-table"><div className="document-row document-head"><span>TITLE</span><span>CATEGORY</span><span>BADGE</span><span>WORDS</span><span>UPDATED</span><span>ACTIONS</span></div>{filtered.map((doc) => { const words = [doc.description, ...doc.sections.flatMap((s) => [...s.paragraphs, ...(s.bullets ?? [])])].join(" ").trim().split(/\s+/).filter(Boolean).length; return <div className="document-row" key={doc.id}><strong>{doc.title}</strong><div className="doc-category-cell"><span>{doc.category}</span><span>⌄</span></div><span><em className="badge-chip">{meta.title === doc.title ? meta.badge : "Overview"}</em></span><span>~{words}</span><span>{doc.updated.replace(", 2026", "")}</span><div className="doc-actions"><button onClick={() => { setActiveId(doc.id); setMode("Reader"); }}>View</button><button onClick={() => { setActiveId(doc.id); setMode("Editor"); setEditorView("Visual"); }}>Edit</button><button className="manage-trash" title="Delete document" onClick={() => deleteDocument(doc)}>{icon("trash")}</button></div></div>; })}</div></section>}{manageTab === "settings" && <section className="management-view settings-view">
  <div className="settings-panel">
    <section className="settings-section site-title-section">
      <h2>SITE TITLE</h2>
      <div className="site-title-row"><input value={siteTitleDraft} onChange={(e) => setSiteTitleDraft(e.target.value)} /><button className="settings-save" onClick={() => setSiteTitle(siteTitleDraft.trim() || "System Guide Docs")}>Save</button></div>
    </section>
    <section className="settings-section storage-section">
      <div className="settings-section-heading"><h2><span className="storage-icon">▱</span> LOCAL BROWSER STORAGE</h2><p>Your documentation is saved directly inside your browser&apos;s LocalStorage. No server or cloud database is needed.</p></div>
      <div className="storage-metrics"><div><span>STORAGE USED</span><strong>{storageLabel}</strong><small>of ~5MB browser quota</small></div><div><span>CATEGORIES</span><strong>{categories.length}</strong></div><div><span>DOCUMENTS</span><strong>{docs.length}</strong></div></div>
    </section>
    <section className="settings-section backup-section">
      <h2>DATA BACKUP &amp; RESTORE</h2><p>Download your entire documentation library as a portable JSON file, or restore from a previous backup.</p>
      <div className="backup-actions"><button className="secondary backup-button" onClick={exportJson}>⇩&nbsp; Export JSON File</button><label className="secondary backup-button" htmlFor="systemguide-json-import">⇧&nbsp; Import JSON File</label><input id="systemguide-json-import" className="visually-hidden-input" type="file" accept="application/json,.json" onChange={importJson} /><button className="reset-demo" onClick={resetDemoData}>↻&nbsp; Reset Demo Data</button></div>
    </section>
  </div>
</section>}</div></div> : <div className="reader-content">
            <div className="article-wrap">
              <div className="breadcrumbs"><span>Docs</span><b>›</b><span>{active.category}</span><b>›</b><strong>{active.title}</strong></div>
              <div className="article-toolbar"><span className="pill">Overview</span><div><button onClick={() => navigator.clipboard?.writeText(window.location.href + "#" + active.id)}>{icon("share")} Share</button><button onClick={() => setMode("Editor")}>{icon("edit")} Edit</button></div></div>
              <article><h1>{active.title}</h1><p className="lead">{active.description}</p><div className="meta">{active.author}<span>•</span><span>Updated {active.updated}</span></div><hr />
                {active.sections.map((section) => <section className="doc-section" id={section.id} key={section.id}><h2>{section.title}</h2>{section.paragraphs.map((paragraph, index) => renderDocParagraph(paragraph, index))}{section.bullets && <ul>{section.bullets.map((bullet) => <li key={bullet}>{bullet}</li>)}</ul>}</section>)}
                <nav className="doc-pagination" aria-label="Document navigation">
                  <button className="doc-nav-button previous" disabled={!previousDoc} onClick={() => openDoc(previousDoc)}><span className="doc-nav-label">← Previous</span><strong>{previousDoc?.title ?? "No previous document"}</strong></button>
                  <button className="doc-nav-button next" disabled={!nextDoc} onClick={() => openDoc(nextDoc)}><span className="doc-nav-label">Next →</span><strong>{nextDoc?.title ?? "No next document"}</strong></button>
                </nav>
              </article>
            </div>
            <aside className="toc"><div className="toc-title">ON THIS PAGE</div>{active.sections.map((section) => <a href={"#" + section.id} className={activeSectionId === section.id ? "current" : ""} onClick={(event) => { event.preventDefault(); setActiveSectionId(section.id); document.getElementById(section.id)?.scrollIntoView({ behavior: "smooth", block: "start" }); }} key={section.id}>{section.title}</a>)}<div className="toc-divider" /><span>{active.readTime} min read</span><button className="back-top" onClick={() => document.querySelector<HTMLElement>(".reader-content")?.scrollTo({ top: 0, behavior: "smooth" })}>{icon("top")} Top</button></aside>
          </div>}
        </main>
      </div>
    </div>
  );
}
export default App;
