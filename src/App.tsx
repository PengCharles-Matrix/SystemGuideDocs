import { lazy, Suspense, useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { categoryOrder as initialCategoryOrder, initialDocs } from "./data";
import type { Doc } from "./types";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Markdown } from "@tiptap/markdown";
import Underline from "@tiptap/extension-underline";
import FontFamily from "@tiptap/extension-font-family";
import Color from "@tiptap/extension-color";
import { TextStyle } from "@tiptap/extension-text-style";
import Highlight from "@tiptap/extension-highlight";
import Image from "@tiptap/extension-image";
import DOMPurify from "dompurify";
const PdfDocumentViewer = lazy(() => import("./PdfDocumentViewer"));

const isInlineImageFile = (name: string) => /\.(png|jpe?g)$/i.test(name);

const RichTextStyle = TextStyle.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      fontSize: {
        default: null,
        parseHTML: (element: HTMLElement) => element.style.fontSize || null,
        renderHTML: (attributes: Record<string, unknown>) => attributes.fontSize ? { style: "font-size: " + attributes.fontSize } : {},
      },
    };
  },
});
const richEditorExtensions = [StarterKit.configure({ underline: false }), Markdown, Underline, RichTextStyle, FontFamily, Color, Highlight.configure({ multicolor: true }), Image];

const icon = (name: string) => ({
  page: "▤", folder: "▱", plus: "+", search: "⌕", share: "↗", edit: "✎",
  menu: "☷", info: "i", top: "↑", chevron: "⌄", eye: "◉", split: "◫", trash: "⌫",
  html: "▧", bold: "B", italic: "I", underline: "U", strike: "S",
  code: "</>", quote: "❞", image: "▧", tip: "♧", warning: "△"
}[name] ?? "•");

function renderInlineImages(source: string, index: number): React.ReactNode {
  const pattern = /!\[([^\]]*)\]\(([^)]+)\)/g;
  const nodes: React.ReactNode[] = [];
  let last = 0;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(source)) !== null) {
    if (match.index > last) nodes.push(source.slice(last, match.index));
    nodes.push(<img key={"inline-image-" + index + "-" + match.index} className="doc-inline-image is-zoomable-image" src={match[2]} alt={match[1]} loading="lazy" tabIndex={0} role="button" onClick={() => window.dispatchEvent(new CustomEvent("systemguide:preview-image", { detail: { src: match![2], alt: match![1] } }))} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); window.dispatchEvent(new CustomEvent("systemguide:preview-image", { detail: { src: match![2], alt: match![1] } })); } }} />);
    last = pattern.lastIndex;
  }
  if (last === 0) return source;
  if (last < source.length) nodes.push(source.slice(last));
  return nodes;
}

function renderDocParagraph(paragraph: string, index: number) {
  const match = paragraph.match(/^\[(info|tip|note|warning|steps|code)\]\s*(.*)$/i);
  if (!match) {
    const image = paragraph.match(/^!\[([^\]]*)\]\((.+)\)$/);
    if (image) return <p key={index}>{renderInlineImages(paragraph, index)}</p>;
    const link = paragraph.match(/^\[([^\]]+)\]\((.+)\)$/);
    if (link && /\.pdf(?:[?#].*)?$/i.test(decodeURIComponent(link[2]))) {
      return <Suspense key={index} fallback={<p className="pdf-load-status">Loading PDF viewer…</p>}><PdfDocumentViewer fileUrl={link[2]} fileName={link[1]} /></Suspense>;
    }
    if (link) return <p key={index}><a href={link[2]} target={link[2].startsWith("data:") || link[2].startsWith("/") ? undefined : "_blank"} rel="noreferrer" download={link[2].startsWith("data:") ? link[1].replace(/^Download /, "") : undefined}>{link[1]}</a></p>;
    return <p key={index}>{renderInlineImages(paragraph, index)}</p>;
  }
  const kind = match[1].toLowerCase();
  const title = kind === "steps" ? "Steps" : kind[0].toUpperCase() + kind.slice(1);
  return <div key={index} className={"doc-callout callout-" + kind}><div className="callout-heading"><span>{kind === "warning" ? "⚠" : kind === "tip" ? "✦" : kind === "steps" ? "✓" : kind === "code" ? "⌘" : "ⓘ"}</span><strong>{title}</strong></div>{match[2] && <p>{renderInlineImages(match[2], index)}</p>}</div>;
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
  const [role, setRole] = useState<"admin" | "guest" | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [adminUsername, setAdminUsername] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [mode, setMode] = useState<"Reader" | "Editor" | "Manage">("Reader");
  const [manageTab, setManageTab] = useState<"categories" | "documents" | "settings">("categories");
  const [siteTitle, setSiteTitle] = useState(() => localStorage.getItem("systemguide-site-title") || "System Guide Docs");
  const [siteTitleDraft, setSiteTitleDraft] = useState(siteTitle);
  const [editorView, setEditorView] = useState<"Visual" | "Split" | "HTML">("Visual");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [newCategory, setNewCategory] = useState("");
  const [draft, setDraft] = useState("");
  const [lightboxImage, setLightboxImage] = useState<{ src: string; alt: string } | null>(null);
  const lastEditorSelection = useRef<{ from: number; to: number } | null>(null);
  const editor = useEditor({
    extensions: richEditorExtensions,
    content: "",
    contentType: "markdown",
    immediatelyRender: false,
    onUpdate: ({ editor: currentEditor }) => setDraft(currentEditor.getMarkdown()),
  });
  const [meta, setMeta] = useState({ title: "", description: "", category: "", badge: "Overview" });
  const [activeSectionId, setActiveSectionId] = useState("");
  const [uploadedFiles, setUploadedFiles] = useState<Array<{ name: string; url: string; size: number; uploadedAt: string }>>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [showUploadedFiles, setShowUploadedFiles] = useState(false);
  const [serverContentLoaded, setServerContentLoaded] = useState(false);
  const [serverHasContent, setServerHasContent] = useState<boolean | null>(null);
  const [syncStatus, setSyncStatus] = useState<"loading" | "saving" | "synced" | "error">("loading");
  useEffect(() => {
    const showImage = (event: Event) => {
      const detail = (event as CustomEvent<{ src?: string; alt?: string }>).detail;
      if (detail?.src) setLightboxImage({ src: detail.src, alt: detail.alt || "Uploaded image" });
    };
    window.addEventListener("systemguide:preview-image", showImage);
    return () => window.removeEventListener("systemguide:preview-image", showImage);
  }, []);
  useEffect(() => { localStorage.setItem("systemguide-docs", JSON.stringify(docs)); }, [docs]);
  // Load the shared workspace from MongoDB Atlas. localStorage is retained only as a
  // recovery cache and as the one-time source for migrating an existing browser workspace.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/content")
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Could not load shared documentation.");
        return data as { content: { docs: Doc[]; categories: string[]; siteTitle: string } | null };
      })
      .then(({ content }) => {
        if (cancelled) return;
        if (content && Array.isArray(content.docs) && content.docs.length > 0 &&
            Array.isArray(content.categories) && typeof content.siteTitle === "string") {
          setDocs(content.docs);
          setCategories(content.categories);
          setSiteTitle(content.siteTitle);
          setSiteTitleDraft(content.siteTitle);
          setActiveId(content.docs[0]?.id ?? "platform");
          setServerHasContent(true);
          setSyncStatus("synced");
        } else {
          setServerHasContent(false);
          setSyncStatus("loading");
        }
        setServerContentLoaded(true);
      })
      .catch((error) => {
        if (cancelled) return;
        console.error("MongoDB workspace load failed:", error);
        setServerHasContent(null);
        setSyncStatus("error");
        setServerContentLoaded(true);
      });
    return () => { cancelled = true; };
  }, []);

  // If Atlas has no workspace yet, migrate this admin browser's existing content once.
  useEffect(() => {
    if (role !== "admin" || !serverContentLoaded || serverHasContent !== false) return;
    let cancelled = false;
    const migrateExistingWorkspace = async () => {
      setSyncStatus("saving");
      try {
        const response = await fetch("/api/content", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ docs, categories, siteTitle }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Could not migrate existing documentation.");
        if (!cancelled) { setServerHasContent(true); setSyncStatus("synced"); }
      } catch (error) {
        console.error("MongoDB workspace migration failed:", error);
        if (!cancelled) setSyncStatus("error");
      }
    };
    void migrateExistingWorkspace();
    return () => { cancelled = true; };
  }, [role, serverContentLoaded, serverHasContent, docs, categories, siteTitle]);

  // Admin changes are automatically saved to the shared database after a short debounce.
  useEffect(() => {
    if (role !== "admin" || !serverContentLoaded || serverHasContent !== true) return;
    const timer = window.setTimeout(async () => {
      setSyncStatus("saving");
      try {
        const response = await fetch("/api/content", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ docs, categories, siteTitle }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Could not save shared documentation.");
        setSyncStatus("synced");
      } catch (error) {
        console.error("MongoDB workspace save failed:", error);
        setSyncStatus("error");
      }
    }, 650);
    return () => window.clearTimeout(timer);
  }, [role, serverContentLoaded, serverHasContent, docs, categories, siteTitle]);

  useEffect(() => {
    let cancelled = false;
    if (role !== "admin") { setUploadedFiles([]); return () => { cancelled = true; }; }
    const loadUploadedFiles = () => {
      fetch("/api/uploads").then(async (response) => {
        if (!response.ok) throw new Error("Could not load shared uploaded files.");
        return response.json() as Promise<Array<{ name: string; url: string; size: number; uploadedAt: string }>>;
      }).then((files) => {
        if (!cancelled && Array.isArray(files)) {
          setUploadedFiles(files);
          setUploadError("");
        }
      }).catch(() => {
        if (!cancelled) setUploadError("Shared file list is unavailable. Check that the upload server is running.");
      });
    };
    loadUploadedFiles();
    const refreshTimer = window.setInterval(loadUploadedFiles, 5000);
    return () => { cancelled = true; window.clearInterval(refreshTimer); };
  }, [role]);
  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/me").then((response) => response.json()).then((data) => {
      if (!cancelled && data.authenticated && (data.role === "admin" || data.role === "guest")) setRole(data.role);
    }).catch(() => { if (!cancelled) setLoginError("Unable to contact the login server. Check that the app server is running."); })
      .finally(() => { if (!cancelled) setAuthLoading(false); });
    return () => { cancelled = true; };
  }, []);
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
    if (!editor || editor.getMarkdown() === draft) return;
    editor.commands.setContent(draft, { contentType: "markdown", emitUpdate: false });
  }, [editor, draft]);

  useEffect(() => {
    if (!active) return;
    setActiveSectionId(active.sections[0]?.id ?? "");
    if (active.contentHtml && editor) {
      editor.commands.setContent(active.contentHtml, { contentType: "html", emitUpdate: false });
      setDraft(editor.getMarkdown());
    } else {
      setDraft(active.sections.map((s) => {
        const bullets = s.bullets?.length ? "\n\n" + s.bullets.map((b) => "- " + b).join("\n") : "";
        return "## " + s.title + "\n" + s.paragraphs.join("\n\n") + bullets;
      }).join("\n\n"));
    }
    setMeta({ title: active.title, description: active.description, category: active.category, badge: "Overview" });
  }, [active, editor]);

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

  const loginAsGuest = async () => {
    setAuthBusy(true); setLoginError("");
    try {
      const response = await fetch("/api/auth/guest", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Guest login failed.");
      setRole("guest"); setMode("Reader"); setShowAdminLogin(false);
    } catch (error) { setLoginError(error instanceof Error ? error.message : "Guest login failed."); }
    finally { setAuthBusy(false); }
  };
  const loginAsAdmin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setAuthBusy(true); setLoginError("");
    try {
      const response = await fetch("/api/auth/admin", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: adminUsername, password: adminPassword }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Admin login failed.");
      setRole("admin"); setMode("Reader"); setAdminPassword(""); setShowAdminLogin(false);
    } catch (error) { setLoginError(error instanceof Error ? error.message : "Admin login failed."); }
    finally { setAuthBusy(false); }
  };
  const logout = async () => {
    try { await fetch("/api/auth/logout", { method: "POST" }); } finally {
      setRole(null); setMode("Reader"); setShowAdminLogin(false); setAdminPassword(""); setUploadedFiles([]);
    }
  };

  if (authLoading) return <main className="auth-screen"><div className="auth-card"><div className="auth-mark">▦</div><h1>System Guide Docs</h1><p>Checking your session…</p></div></main>;
  if (!role) return <main className="auth-screen"><section className="auth-card">
    <div className="auth-mark">▦</div><p className="auth-eyebrow">SYSTEM GUIDE DOCS</p><h1>Welcome back</h1><p className="auth-description">Choose how you want to access the documentation workspace.</p>
    <button className="auth-choice auth-admin-choice" type="button" disabled={authBusy} onClick={() => { setShowAdminLogin(true); setLoginError(""); }}> <span className="auth-choice-icon">♙</span><span><strong>Login as admin</strong><small>Access editing, management, uploads and all features</small></span><span className="auth-arrow">→</span></button>
    {showAdminLogin && <form className="auth-form" onSubmit={loginAsAdmin}>
      <label>Admin username<input autoComplete="username" value={adminUsername} onChange={(event) => setAdminUsername(event.target.value)} required /></label>
      <label>Password<input type="password" autoComplete="current-password" value={adminPassword} onChange={(event) => setAdminPassword(event.target.value)} required /></label>
      <button className="auth-submit" type="submit" disabled={authBusy}>{authBusy ? "Signing in…" : "Sign in as admin"}</button>
    </form>}
    <button className="auth-choice" type="button" disabled={authBusy} onClick={loginAsGuest}><span className="auth-choice-icon">◉</span><span><strong>Login as guest</strong><small>Read documentation only; editing is disabled</small></span><span className="auth-arrow">→</span></button>
    {loginError && <p className="auth-error" role="alert">{loginError}</p>}
    <p className="auth-footnote">Admin access requires credentials configured by the site owner.</p>
  </section></main>;

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
    if (!value || categories.some((item) => item.toLocaleLowerCase() === value.toLocaleLowerCase())) {
      if (value) window.alert("That category already exists.");
      return;
    }
    setCategories((items) => [...items, value]);
    setNewCategory("");
    setCategoryOpen(false);
  };

  const createPdfPage = (file: { name: string; url: string }) => {
    const id = "pdf-" + Date.now();
    const title = file.name.replace(/\.pdf$/i, "").replace(/[-_]+/g, " ").trim() || "PDF Document";
    const next: Doc = {
      id, category: categories[0] ?? "Getting Started", title,
      description: "PDF document — browse every page, zoom, search, print, or download in the built-in viewer.",
      author: "Documentation Team", updated: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }), readTime: 1,
      sections: [{ id: "pdf-document", title: "Document", paragraphs: ["[" + file.name.replace(/[\\[\\]]/g, "") + "](" + file.url + ")"] }],
    };
    setDocs((current) => [...current, next]);
    setActiveId(id);
    setMode("Reader");
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
          const linkOnly = /^\[[^\]]+\]\(.+\)$/.test(lines[0] ?? "");
          const imageOnly = lines.length === 1 && /^!\[[^\]]*\]\([^)]+\)$/.test(lines[0]);
          // Uploaded images inserted as their own paragraph are content, not headings.
          // Keeping the full line here prevents Save from silently dropping the image.
          const heading = imageOnly ? "Image" : callout ? (callout[1].toLowerCase() === "steps" ? "Steps" : callout[1][0].toUpperCase() + callout[1].slice(1)) : linkOnly ? "Attachments" : lines[0]?.replace(/^#{1,6}\s*/, "") || "Section " + (index + 1);
          const body = imageOnly || linkOnly ? lines : lines.slice(1);
          const bullets = body.filter((line) => callout?.[1].toLowerCase() === "steps" ? /^\d+[.)]\s/.test(line) : /^[-*]\s/.test(line)).map((line) => line.replace(callout?.[1].toLowerCase() === "steps" ? /^\d+[.)]\s/ : /^[-*]\s/, ""));
          const plain = callout ? [lines[0], ...body.filter((line) => !(callout[1].toLowerCase() === "steps" && /^\d+[.)]\s/.test(line)))].filter(Boolean) : body.filter((line) => !/^[-*]\s/.test(line));
          return { id: imageOnly ? "uploaded-image-" + index : heading.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "section-" + index, title: heading, paragraphs: plain, ...(bullets.length ? { bullets } : {}) };
        })
      : active.sections;
    setDocs((current) => current.map((doc) => doc.id === active.id
      ? { ...doc, title: meta.title.trim() || "Untitled Page", description: meta.description, category: meta.category, sections, contentHtml: active.id.startsWith("pdf-") || /^\[(info|tip|note|warning|steps|code)\]/im.test(draft) ? undefined : editor?.getHTML() ?? doc.contentHtml } : doc));
    if (!categories.includes(meta.category)) setCategories((items) => [...items, meta.category]);
    setMode("Reader");
  };

  const insert = (token: string) => {
    if (!editor) return;
    editor.chain().focus().insertContent(token, { contentType: "markdown" }).run();
  };
  const restoreEditorSelection = () => {
    if (!editor) return;
    const chain = editor.chain().focus();
    const selection = lastEditorSelection.current;
    if (selection && selection.from <= editor.state.doc.content.size && selection.to <= editor.state.doc.content.size) {
      chain.setTextSelection(selection);
    }
    return chain;
  };
  const rememberEditorSelection = () => {
    if (!editor) return;
    const { from, to } = editor.state.selection;
    lastEditorSelection.current = { from, to };
  };
  const applyFontSize = (size: string) => {
    if (!editor) return;
    const chain = restoreEditorSelection();
    if (!chain) return;
    chain.setMark("textStyle", { fontSize: size }).run();
    editor.commands.focus();
  };
  const applyFontFamily = (family: string) => {
    if (!editor) return;
    const chain = restoreEditorSelection();
    if (!chain) return;
    chain.setFontFamily(family).run();
    editor.commands.focus();
  };
  const applyTextColor = (color: string) => {
    if (!editor) return;
    const chain = restoreEditorSelection();
    if (!chain) return;
    chain.setColor(color).run();
    editor.commands.focus();
  };
  const handleImageClick = (event: React.MouseEvent<HTMLElement>) => {
    const target = event.target;
    if (target instanceof HTMLImageElement) {
      event.preventDefault();
      setLightboxImage({ src: target.currentSrc || target.src, alt: target.alt || "Uploaded image" });
    }
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
    if (!window.confirm(`Delete “${doc.title}” permanently from the shared workspace?`)) return;
    const remaining = docs.filter((item) => item.id !== doc.id);
    setDocs(remaining);
    if (activeId === doc.id) { setActiveId(remaining[0].id); setMode("Reader"); }
  };

  const exportJson = () => {
    const blob = new Blob([JSON.stringify({ siteTitle, categories, docs }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob); const a = document.createElement("a");
    a.href = url; a.download = "systemguide-docs.json"; a.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
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

  const uploadEditorFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (file.size > 50 * 1024 * 1024) {
      window.alert("That file is larger than the 50 MB upload limit.");
      return;
    }
    const form = new FormData();
    form.append("file", file);
    setUploading(true);
    setUploadError("");
    try {
      const response = await fetch("/api/uploads", { method: "POST", body: form });
      const result = await response.json() as { url?: string; name?: string; size?: number; error?: string };
      if (!response.ok || !result.url) throw new Error(result.error || ("Upload failed (HTTP " + response.status + ")."));
      const uploaded = { name: result.name || file.name, url: result.url, size: result.size ?? file.size, uploadedAt: new Date().toISOString() };
      setUploadedFiles((files) => [uploaded, ...files.filter((item) => item.url !== uploaded.url)]);
      const isImage = isInlineImageFile(file.name);
      if (isImage) {
        insert("\n\n![" + uploaded.name.replace(/[\[\]]/g, "") + "](" + uploaded.url + ")");
      } else {
        insert("\n\n[Download " + uploaded.name.replace(/[\[\]]/g, "") + "](" + uploaded.url + ")");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown upload error.";
      setUploadError(message);
      window.alert("Upload failed: " + message + "\n\nCheck that the System Guide Docs upload server is running.");
    } finally {
      setUploading(false);
    }
  };

  const resetDemoData = () => {
    if (!window.confirm("Reset the shared workspace to the starter documentation? Current documentation will be replaced for all users.")) return;
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
          {kind === "steps" ? <ol>{listItems.map((line, n) => <li key={n}>{line.replace(/^\d+[.)]\s/, "")}</li>)}</ol> : kind === "code" ? <pre><code>{content.join("\n")}</code></pre> : content.map((line, n) => {
            const image = line.match(/^!\[([^\]]*)\]\((.+)\)$/);
            if (image) return <p key={n}><img src={image[2]} alt={image[1]} style={{ maxWidth: "100%", height: "auto", display: "block" }} /></p>;
            const link = line.match(/^\[([^\]]+)\]\((.+)\)$/);
            if (link && /\.pdf(?:[?#].*)?$/i.test(decodeURIComponent(link[2]))) return <Suspense key={n} fallback={<p className="pdf-load-status">Loading PDF viewer…</p>}><PdfDocumentViewer fileUrl={link[2]} fileName={link[1]} compact /></Suspense>;
        if (link) return <p key={n}><a href={link[2]} target="_blank" rel="noreferrer">{link[1]}</a></p>;
            return <p key={n}>{line}</p>;
          })}
        </div>
      </section>;
    }
    const bullets = body.filter((line) => /^[-*]\s/.test(line));
    const paragraphs = body.filter((line) => !/^[-*]\s/.test(line));
    return <section className="preview-section" key={i}>
      {headingMatch && <h2>{headingMatch[1]}</h2>}
      {paragraphs.map((p, n) => {
        const imagePattern = /!\[([^\]]*)\]\((\/uploads\/[^)]+)\)/g;
        if (imagePattern.test(p)) { imagePattern.lastIndex = 0; const nodes: React.ReactNode[] = []; let last = 0; let found: RegExpExecArray | null; while ((found = imagePattern.exec(p)) !== null) { if (found.index > last) nodes.push(p.slice(last, found.index)); nodes.push(<img key={"preview-img-" + n + "-" + found.index} className="doc-inline-image" src={found[2]} alt={found[1]} loading="lazy" />); last = imagePattern.lastIndex; } if (last < p.length) nodes.push(p.slice(last)); return <p key={n}>{nodes}</p>; }
        const link = p.match(/^\[([^\]]+)\]\((.+)\)$/);
        if (link && /\.pdf(?:[?#].*)?$/i.test(decodeURIComponent(link[2]))) return <Suspense key={n} fallback={<p className="pdf-load-status">Loading PDF viewer…</p>}><PdfDocumentViewer fileUrl={link[2]} fileName={link[1]} compact /></Suspense>;
        if (link) return <p key={n}><a href={link[2]} target="_blank" rel="noreferrer">{link[1]}</a></p>;
        return <p key={n}>{p}</p>;
      })}
      {bullets.length > 0 && <ul>{bullets.map((b, n) => {
        const line = b.replace(/^[-*]\s/, "");
        const image = line.match(/^!\[([^\]]*)\]\((.+)\)$/);
        if (image) return <li key={n}><img src={image[2]} alt={image[1]} style={{ maxWidth: "100%", height: "auto", display: "block" }} /></li>;
        const link = line.match(/^\[([^\]]+)\]\((.+)\)$/);
        if (link) return <li key={n}><a href={link[2]} target="_blank" rel="noreferrer">{link[1]}</a></li>;
        return <li key={n}>{line}</li>;
      })}</ul>}
    </section>;
  });

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand"><span className="brand-mark">▦</span><strong>{siteTitle}</strong><span className="slash">/</span><span className="crumb">Docs</span></div>
        <div className="search-wrap"><span>{icon("search")}</span><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search documentation..." /><kbd>⌘K</kbd></div>
        <div className="top-actions">
          <div className="segmented">{(role === "admin" ? ["Reader", "Editor", "Manage"] as const : ["Reader"] as const).map((item) => <button key={item} className={mode === item ? "active" : ""} onClick={() => setMode(item)}>{item}</button>)}</div>
          {role === "admin" && <div className="json-menu"><button className="json-button" onClick={exportJson}>{icon("menu")} JSON <span>⌄</span></button></div>}
          <div className="auth-session"><span>{role === "admin" ? "Admin" : "Guest"}</span><button onClick={logout}>Log out</button></div>
        </div>
      </header>

      <div className="workspace">
        <aside className="sidebar">
          <div className="category-row">
            <select value={category} onChange={(e) => setCategory(e.target.value)}><option>All Categories</option>{categories.map((item) => <option key={item}>{item}</option>)}</select>
            {role === "admin" && <button className="square-button" onClick={() => setCategoryOpen((v) => !v)}>{icon("plus")}</button>}
            {role === "admin" && categoryOpen && <div className="category-popover"><strong>New category</strong><input autoFocus value={newCategory} onChange={(e) => setNewCategory(e.target.value)} onKeyDown={(e) => e.key === "Enter" && createCategory()} placeholder="Category name" /><div><button onClick={() => setCategoryOpen(false)}>Cancel</button><button className="primary" onClick={createCategory}>Add</button></div></div>}
          </div>
          <input className="filter-input" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Filter topics..." />
          <div className="nav-tree">{grouped.map((group) => <div className="nav-group" key={group.name}>
            <button className="group-heading" onClick={() => setCollapsed((c) => ({ ...c, [group.name]: !c[group.name] }))}><span>{collapsed[group.name] ? "›" : "⌄"}</span>{group.name.toUpperCase()} <em>{group.docs.length}</em></button>
            {!collapsed[group.name] && group.docs.map((doc) => <button key={doc.id} className={"nav-item " + (doc.id === active.id ? "selected" : "")} onClick={() => { setActiveId(doc.id); setMode("Reader"); }}>
              <span className="doc-icon">{icon("page")}</span><span>{doc.title}</span>
            </button>)}
          </div>)}{!grouped.length && <div className="empty-nav">No matching topics.</div>}</div>
          {role === "admin" && <div className="sidebar-footer"><button onClick={createPage}>{icon("plus")} New Page</button><button title="New category" onClick={() => setCategoryOpen(true)}>{icon("folder")}</button></div>}
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
              <select aria-label="Font family" defaultValue="Inter" onFocus={rememberEditorSelection} onMouseDown={rememberEditorSelection} onChange={(event) => applyFontFamily(event.target.value)}><option value="Inter">Sans</option><option value="Georgia">Serif</option><option value="monospace">Mono</option><option value="Arial">Arial</option></select>
              <select aria-label="Font size" defaultValue="16px" onFocus={rememberEditorSelection} onMouseDown={rememberEditorSelection} onChange={(event) => applyFontSize(event.target.value)}><option value="14px">14px</option><option value="16px">16px</option><option value="18px">18px</option><option value="20px">20px</option><option value="24px">24px</option><option value="32px">32px</option></select>
              {["H1","H2","H3","B","I","U","S","</>","•","1.","❞"].map((item) => <button type="button" key={item} title={item} onClick={() => {
                if (!editor) return;
                if (["H1","H2","H3"].includes(item)) editor.chain().focus().toggleHeading({ level: Number(item[1]) as 1 | 2 | 3 }).run();
                else if (item === "B") editor.chain().focus().toggleBold().run();
                else if (item === "I") editor.chain().focus().toggleItalic().run();
                else if (item === "U") editor.chain().focus().toggleUnderline().run();
                else if (item === "S") editor.chain().focus().toggleStrike().run();
                else if (item === "</>") editor.chain().focus().toggleCode().run();
                else if (item === "•") editor.chain().focus().toggleBulletList().run();
                else if (item === "1.") editor.chain().focus().toggleOrderedList().run();
                else if (item === "❞") editor.chain().focus().toggleBlockquote().run();
              }}>{item}</button>)}
              <span className="toolbar-divider" />
              <label className="toolbar-color" title="Text color">A<input type="color" aria-label="Text color" defaultValue="#30343a" onPointerDown={rememberEditorSelection} onFocus={rememberEditorSelection} onChange={(event) => applyTextColor(event.target.value)} /></label>
              <button type="button" onClick={() => editor?.chain().focus().toggleHighlight({ color: "#fff2a8" }).run()} title="Highlight text">▨</button>
              <button onClick={() => insert("\n\n[Info] Add helpful context here.")}>ⓘ Info</button><button onClick={() => insert("\n\n[Tip] Add a practical tip here.")}>♧ Tip</button><button onClick={() => insert("\n\n[Warning] Describe a risk or caution here.")}>△ Warning</button><button onClick={() => insert("\n\n[Steps]\n1. First step\n2. Second step\n3. Third step")}>☷ Steps</button><button onClick={() => insert("\n\n[Note] Add an important note here.")}>▤ Note</button><button onClick={() => insert("\n\n[Code]\nPaste code here")}>⌘ Code</button><button type="button" onClick={() => document.getElementById("systemguide-editor-file-upload")?.click()}>⇧ Upload Files</button><input id="systemguide-editor-file-upload" className="visually-hidden-input" type="file" onChange={uploadEditorFile} />
            </div>
            <div className="uploaded-files-toggle-row">
              <span className="uploaded-files-summary">{uploadedFiles.length} shared file{uploadedFiles.length === 1 ? "" : "s"} available</span>
              <button type="button" className="uploaded-files-toggle" aria-expanded={showUploadedFiles} onClick={() => setShowUploadedFiles((shown) => !shown)}>{showUploadedFiles ? "Hide shared files −" : "Show shared files +"}</button>
            </div>
            {showUploadedFiles && <section className="uploaded-files-panel">
              <div className="uploaded-files-heading"><strong>Shared uploaded files</strong><span>{uploadedFiles.length} file{uploadedFiles.length === 1 ? "" : "s"} stored on this server</span><button type="button" className="uploaded-files-close" aria-label="Close shared uploaded files" onClick={() => setShowUploadedFiles(false)}>×</button></div>
              {uploadError && <p className="upload-status-error">{uploadError}</p>}
              {uploading && <p className="upload-status">Uploading file…</p>}
              {uploadedFiles.length === 0 && !uploading ? <p className="upload-status">No files uploaded yet. Files uploaded here are visible to other visitors of this site.</p> : <ul className="uploaded-files-list">{uploadedFiles.map((file) => { const imageFile = isInlineImageFile(file.name); const pdfFile = /\.pdf$/i.test(file.name); return <li key={file.url}><a href={file.url} {...(imageFile || pdfFile ? { target: "_blank", rel: "noreferrer" } : { download: true })}>{file.name}</a><span>{file.size >= 1024 * 1024 ? (file.size / 1024 / 1024).toFixed(1) + " MB" : (file.size / 1024).toFixed(1) + " KB"}</span>{pdfFile && <button type="button" onClick={() => createPdfPage(file)}>Create PDF page</button>}<button type="button" onClick={() => insert(imageFile ? "\n\n![" + file.name.replace(/[\[\]]/g, "") + "](" + file.url + ")" : "\n\n[Download " + file.name.replace(/[\[\]]/g, "") + "](" + file.url + ")")}>{imageFile ? "Insert image" : pdfFile ? "Insert viewer link" : "Insert link"}</button></li>; })}</ul>}
            </section>}
            <div className={"editor-body view-" + editorView.toLowerCase()}>
              {(editorView === "Visual" || editorView === "Split") && <div className="editor-pane"><div className="pane-label">EDITOR</div><div className="editor-canvas rich-editor-canvas" onClick={handleImageClick}><EditorContent editor={editor} onBlur={rememberEditorSelection} /></div></div>}
              {(editorView === "Split" || editorView === "HTML") && <div className="preview-pane"><div className="pane-label">{editorView === "HTML" ? "HTML" : "PREVIEW"}</div><div className="preview-card" onClick={handleImageClick}>{editorView === "HTML"
                ? <pre className="html-source">{editor?.getHTML() ?? ""}</pre>
                : /\[(info|tip|note|warning|steps|code)\]/i.test(draft) || /\.pdf(?:[?#\s)]|$)/i.test(draft)
                  ? renderPreview(draft)
                  : <div className="saved-rich-content" onClick={handleImageClick} dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(editor?.getHTML() ?? "") }} />}</div></div>}
            </div>
          </div> : mode === "Manage" ? <div className="manage-page"><div className="manage-inner"><h1>Management</h1><p className="manage-subtitle">Organize categories, review documentation pages, and manage shared cloud content.</p><div className="manage-tabs"><button className={manageTab === "categories" ? "active" : ""} onClick={() => setManageTab("categories")}>Categories ({categories.length})</button><button className={manageTab === "documents" ? "active" : ""} onClick={() => setManageTab("documents")}>All Documents ({docs.length})</button><button className={manageTab === "settings" ? "active" : ""} onClick={() => setManageTab("settings")}>Settings &amp; Storage</button></div>{manageTab === "categories" && <section className="management-view"><div className="management-heading"><h2>CATEGORY HIERARCHY</h2><button className="manage-new" onClick={() => setCategoryOpen(true)}>＋ New Category</button></div><div className="category-list">{categories.map((name, index) => <div className="category-item" key={name}><div className="category-main"><span className="category-symbol">{index === 0 ? "◎" : index === 1 ? "♢" : index === 2 ? "⌂" : "♧"}</span><div><strong>{name}</strong><button className="inline-edit" onClick={() => renameCategory(name)} title={"Rename " + name}>{icon("edit")}</button><small>{docs.filter((doc) => doc.category === name).length} {docs.filter((doc) => doc.category === name).length === 1 ? "document" : "documents"}</small></div></div><div className="category-actions"><button title="Move up" disabled={index === 0} onClick={() => setCategories((items) => { const next=[...items]; [next[index-1],next[index]]=[next[index],next[index-1]]; return next; })}>↑</button><button title="Move down" disabled={index === categories.length-1} onClick={() => setCategories((items) => { const next=[...items]; [next[index],next[index+1]]=[next[index+1],next[index]]; return next; })}>↓</button><button className="manage-trash" title="Delete category" onClick={() => deleteCategory(name)}>{icon("trash")}</button></div></div>)}</div></section>}{manageTab === "documents" && <section className="management-view"><div className="document-filters"><div className="manage-search"><span>{icon("search")}</span><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search documents by title or category..." /></div><label>Category:<select value={category} onChange={(e) => setCategory(e.target.value)}><option value="All Categories">All ({docs.length})</option>{categories.map((item) => <option key={item} value={item}>{item}</option>)}</select></label></div><div className="document-table"><div className="document-row document-head"><span>TITLE</span><span>CATEGORY</span><span>BADGE</span><span>WORDS</span><span>UPDATED</span><span>ACTIONS</span></div>{filtered.map((doc) => { const words = [doc.description, ...doc.sections.flatMap((s) => [...s.paragraphs, ...(s.bullets ?? [])])].join(" ").trim().split(/\s+/).filter(Boolean).length; return <div className="document-row" key={doc.id}><strong>{doc.title}</strong><div className="doc-category-cell"><span>{doc.category}</span><span>⌄</span></div><span><em className="badge-chip">{meta.title === doc.title ? meta.badge : "Overview"}</em></span><span>~{words}</span><span>{doc.updated.replace(", 2026", "")}</span><div className="doc-actions"><button onClick={() => { setActiveId(doc.id); setMode("Reader"); }}>View</button><button onClick={() => { setActiveId(doc.id); setMode("Editor"); setEditorView("Visual"); }}>Edit</button><button className="manage-trash" title="Delete document" onClick={() => deleteDocument(doc)}>{icon("trash")}</button></div></div>; })}</div></section>}{manageTab === "settings" && <section className="management-view settings-view">
  <div className="settings-panel">
    <section className="settings-section site-title-section">
      <h2>SITE TITLE</h2>
      <div className="site-title-row"><input value={siteTitleDraft} onChange={(e) => setSiteTitleDraft(e.target.value)} /><button className="settings-save" onClick={() => setSiteTitle(siteTitleDraft.trim() || "System Guide Docs")}>Save</button></div>
    </section>
    <section className="settings-section storage-section">
      <div className="settings-section-heading"><h2><span className="storage-icon">▱</span> MONGODB ATLAS CLOUD STORAGE</h2><p>Documentation, categories, and the site title are shared through the server database. This browser keeps a local recovery cache.</p></div>
      <div className="storage-metrics"><div><span>CLOUD SYNC</span><strong>{syncStatus === "saving" ? "Saving…" : syncStatus === "synced" ? "Connected" : syncStatus === "loading" ? "Loading…" : "Unavailable"}</strong><small>{serverHasContent === null ? "Check server MongoDB configuration" : serverHasContent ? "Shared workspace is active" : "Cloud workspace not initialized yet"}</small></div><div><span>CATEGORIES</span><strong>{categories.length}</strong></div><div><span>DOCUMENTS</span><strong>{docs.length}</strong></div></div>
    </section>
    <section className="settings-section backup-section">
      <h2>DATA BACKUP &amp; RESTORE</h2><p>Download your entire documentation library as a portable JSON file, or restore from a previous backup.</p>
      <div className="backup-actions"><button className="secondary backup-button" onClick={exportJson}>⇩&nbsp; Export JSON File</button><label className="secondary backup-button" htmlFor="systemguide-json-import">⇧&nbsp; Import JSON File</label><input id="systemguide-json-import" className="visually-hidden-input" type="file" accept="application/json,.json" onChange={importJson} /><button className="reset-demo" onClick={resetDemoData}>↻&nbsp; Reset Demo Data</button></div>
    </section>
  </div>
</section>}</div></div> : <div className="reader-content">
            <div className="article-wrap">
              <div className="breadcrumbs"><span>Docs</span><b>›</b><span>{active.category}</span><b>›</b><strong>{active.title}</strong></div>
              <div className="article-toolbar"><span className="pill">Overview</span><div><button onClick={async () => {
                const shareUrl = window.location.origin + window.location.pathname + "#" + active.id;
                try {
                  if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(shareUrl);
                  else { const field = document.createElement("textarea"); field.value = shareUrl; document.body.appendChild(field); field.select(); document.execCommand("copy"); field.remove(); }
                  window.alert("Page link copied.");
                } catch { window.prompt("Copy this page link:", shareUrl); }
              }}>{icon("share")} Share</button>{role === "admin" && <button onClick={() => setMode("Editor")}>{icon("edit")} Edit</button>}</div></div>
              <article><h1>{active.title}</h1><p className="lead">{active.description}</p><div className="meta">{active.author}<span>•</span><span>Updated {active.updated}</span></div><hr />
                {active.contentHtml
                  ? <div className="saved-rich-content" onClick={handleImageClick} dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(active.contentHtml) }} />
                  : active.sections.map((section) => <section className="doc-section" id={section.id} key={section.id}><h2>{section.title}</h2>{section.paragraphs.map((paragraph, index) => renderDocParagraph(paragraph, index))}{section.bullets && <ul>{section.bullets.map((bullet) => <li key={bullet}>{bullet}</li>)}</ul>}</section>)}
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
      {lightboxImage && <div className="image-lightbox" role="dialog" aria-modal="true" aria-label="Image preview" onClick={() => setLightboxImage(null)} onKeyDown={(event) => { if (event.key === "Escape") setLightboxImage(null); }}>
        <button className="image-lightbox-close" type="button" aria-label="Close image preview" onClick={() => setLightboxImage(null)}>×</button>
        <img src={lightboxImage.src} alt={lightboxImage.alt} onClick={(event) => event.stopPropagation()} />
        <p>{lightboxImage.alt}</p>
      </div>}
    </div>
  );
}
export default App;
