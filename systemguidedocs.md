# SystemGuideDocs — Project Structure and Code Map

> This document describes the implementation in this repository. Keep it updated when responsibilities move between files. A successful build does not mean every browser interaction has passed end-to-end testing.

## 1. System overview

SystemGuideDocs is a single-page documentation application. The React frontend is built with TypeScript and Vite. A Node.js/Express server supplies the API, session authentication, MongoDB Atlas persistence, and uploaded-file delivery. In production, Express serves the compiled frontend from the dist directory.

    Browser
      | React UI / HTTP requests (/api/* and /uploads/*)
      v
    Express server — server.mjs
      |                         |
      | MongoDB driver           | Local persistent file directory
      v                         v
    MongoDB Atlas                data/uploads/
      - users                    - PDFs
      - workspaceContent         - images and attachments

    Development: Browser -> Vite :5173 -> proxy /api and /uploads to Express :3001
    Production:  Browser -> Express :3001 (normally behind HTTPS reverse proxy) -> Atlas + data/uploads/

**Storage distinction:** document pages, categories, and site title are stored in the shared MongoDB workspaceContent collection. Uploaded file bytes are stored on the application server filesystem in data/uploads/; document records contain references/URLs. JSON exports do not include uploaded file bytes. Back up both Atlas and data/uploads/.

## 2. File-by-file code map

| File / directory | Responsibility |
|---|---|
| src/main.tsx | Frontend entry point. Loads global styles and mounts React inside StrictMode and the top-level error boundary. |
| src/App.tsx | Main application UI and workflow: login screens, Reader/Editor/Manage modes, navigation, search, document metadata, page creation/deletion, category management, toolbar actions, uploads, JSON backup/restore, preview rendering, and API synchronization. |
| src/PdfDocumentViewer.tsx | PDF.js / React-PDF viewer: loading, page count/navigation, zoom, text search, result navigation, download/open, resize handling, and recoverable PDF loading errors. Lazy-loaded by App.tsx. |
| src/ErrorBoundary.tsx | React render-error recovery UI. Logs render/lifecycle diagnostics and offers reload. It does not catch every asynchronous/network error; requests need their own error handling. |
| src/styles.css | Global styles and layout: sidebar, reader, editor, management pages, upload panel, rich-text editor, PDF viewer, responsive behavior, and error recovery screen. |
| src/data.ts | Starter documentation and default category ordering. Used for initialization and explicit starter-data reset. |
| src/types.ts | Shared TypeScript types for Doc and Section. |
| src/vite-env.d.ts | Vite client type declarations. |
| server.mjs | Backend entry point. Express configuration, MongoDB connection/retry, health/content APIs, signed sessions, guest/admin authentication, role checks, upload/list/download routes, production static serving, and server startup. |
| vite.config.ts | Vite plugins, development host/port, and /api and /uploads proxy configuration. |
| index.html | HTML shell where Vite/React mounts. |
| package.json | Project scripts and direct dependencies. |
| package-lock.json | Exact dependency resolution used by npm ci and npm installs. Commit with intentional dependency changes. |
| tsconfig.json, tsconfig.app.json, tsconfig.node.json | TypeScript project configuration for app and build tooling. |
| .env.example | Names/examples for runtime environment variables. Copy to .env locally; never commit real credentials. |
| .gitignore | Excludes node_modules, build output, local environment files, and uploaded data. |
| README.md | Setup, usage, configuration, and deployment notes. |
| systemguidedocs.md | This architecture map and maintenance reference. |
| FrontendStack/ | Supporting reference notes for frontend tooling and workflow; not runtime application code. |
| data/uploads/ | Runtime upload storage created by the server. Intentionally excluded from Git. |
| dist/ | Generated production frontend output from npm run build. Do not hand-edit. |
| .backups/ | Local recovery artifacts if present; not part of runtime. |
| preview.log, server.log | Local runtime logs if present; inspect for troubleshooting and avoid committing sensitive output. |

## 3. Backend API and persistence map (server.mjs)

### Database connection

- MongoClient from the mongodb package creates the Atlas connection.
- MONGODB_URI provides the connection string.
- MONGODB_DB chooses the database; default is systemguidedocs.
- connectMongo() connects, creates a unique index on users.username, and assigns the users and workspaceContent collections.
- Startup makes a bounded connection attempt; if Atlas is unavailable, a background timer retries every 15 seconds.
- GET /api/health reports database as connected, disconnected, or not configured.
- A successful HTTP health response does not guarantee that a database query will succeed; inspect its database field.

### Shared workspace

- GET /api/content returns shared document data and updatedAt.
- PUT /api/content is administrator-only. It validates the top-level payload and writes the workspace record with _id: "workspace" using an upsert.
- Workspace shape: { docs, categories, siteTitle, updatedAt }.
- Browser localStorage is a local recovery/migration cache, not the authoritative shared database.

### Authentication and authorization

- POST /api/auth/guest creates a signed read-only guest session.
- POST /api/auth/admin looks up the administrator in the existing users collection and creates a session after credential verification.
- GET /api/auth/me reports the current session.
- POST /api/auth/logout clears the session cookie.
- getSession() verifies the signed, expiring cookie.
- requireAuth protects routes that need a session; requireAdmin protects administrator-only routes.
- Session signing uses SESSION_SECRET; configure a stable random value of at least 32 characters. Changing it invalidates existing sessions.
- COOKIE_SECURE=true should be used when the public application is served through HTTPS. Do not enable it while accessing the app directly over plain HTTP.
- Existing user records use username and userpassword fields. Do not change this schema/password format without a migration plan.

### Uploaded files

- Upload directory: data/uploads/.
- Upload limit: 50 MiB per file; one file per request.
- POST /api/uploads is administrator-only multipart upload; saves bytes to disk and returns a URL.
- GET /api/uploads is administrator-only file inventory.
- GET /uploads/:filename requires a valid session. PDFs and PNG/JPEG images are served inline; other file types are downloaded as attachments.
- Stored filenames receive a generated UUID prefix and sanitized original filename.
- Files are local to the application server. If EC2 is replaced, copy/migrate files or old links will break.
- JSON export/import contains documentation records, not the binary contents in data/uploads/.

### Production static serving

When NODE_ENV=production, Express serves the generated dist directory and uses its index.html as the frontend fallback. API and upload routes are registered before the static frontend fallback.

## 4. Frontend workflows (src/App.tsx)

- **Authentication:** checks /api/auth/me, then allows guest or admin login. Admin controls are hidden for guests, and backend middleware also enforces authorization.
- **Initial workspace load:** fetches /api/content; successful cloud content replaces local starter/cache data.
- **First-workspace migration:** if the server has no workspace and an administrator is signed in, the current browser's content is sent to the API as the initial shared workspace. Verify intended seed data before using a new database.
- **Autosave:** administrator changes to documents, categories, or site title are sent to PUT /api/content after a short debounce. Check sync status after edits before closing the page.
- **Reader:** renders saved rich HTML through DOMPurify when present; otherwise renders structured sections and Markdown-like image/link/callout blocks. Click an imported image to open the accessible full-screen image preview; Escape, the close button, or clicking the backdrop closes it.
- **Editor:** Tiptap extensions provide headings, lists, bold/italic/underline/strike, inline code, blockquote, font family/size, text color, highlighting, and images. Font size/color use the TextStyle mark; toolbar handlers preserve the editor selection while a font/color control has focus.
- **Preview modes:** Visual, Split, and HTML. HTML view displays editor-generated HTML source. Saving persists editor HTML and the document section representation.
- **Manage:** category ordering/renaming/deletion, document listing/actions, site title, JSON export/import, and explicit starter-data reset.
- **File upload:** sends multipart data to the API. Images are inserted into the draft; other files are inserted as links. Save the document after upload to persist the inserted reference.
- **PDF page creation:** the file manager's Create PDF page action creates a documentation page with an embedded viewer link.

## 5. PDF viewer details (src/PdfDocumentViewer.tsx)

Uses react-pdf and pdfjs-dist (PDF.js). The worker is bundled by Vite.

- Navigation: previous/next page and numeric page field.
- Zoom: decrement/increment in bounded steps and reset to 100%.
- Search: extracts text from each page, reports matching pages, and moves between results. It cannot find text in image-only/scanned pages unless the PDF has OCR text.
- Download/open: provides the original file URL for download or browser viewing.
- Resize handling: ResizeObserver measures viewer width.
- Failure handling: a failed document load shows an inline message and leaves download/open actions available.
- PDF access requires a valid session because the upload route is protected.
- Large PDFs and high zoom can consume substantial browser memory. Test representative files and browsers.

## 6. Development and build commands

Requirements: a supported Node.js version compatible with the locked Vite release, npm, and access to the configured MongoDB instance for cloud-backed features.

    npm ci
    npm run dev
    npm run build
    npm start
    npm audit --audit-level=high
    git diff --check

Default development URLs:
- Vite frontend: http://localhost:5173/
- Express API: http://localhost:3001/
- Health check: http://localhost:3001/api/health

npm run preview starts the server and Vite preview concurrently. For a production-like test, build first and use NODE_ENV=production npm start; ensure the desired port is free and .env has the required settings.

## 7. Configuration and secrets

| Variable | Purpose |
|---|---|
| PORT | Express listening port; defaults to 3001. |
| MONGODB_URI | MongoDB Atlas connection string. Keep private. |
| MONGODB_DB | Database name; defaults to systemguidedocs. |
| SESSION_SECRET | HMAC signing secret for session cookies; use a random secret of at least 32 characters. |
| PASSWORD_SALT | Existing password-related configuration. Do not rotate without checking the current authentication scheme. |
| ADMIN_USERNAME | Default/admin configuration hint; current login checks an existing Atlas user record. |
| ADMIN_PASSWORD | Present in example/config history; inspect the actual login scheme before assuming this variable provisions a user. |
| NODE_ENV | Set to production to enable Express static serving from dist/. |
| COOKIE_SECURE | Set to true when users access the application over HTTPS. |

Never paste secrets into source files, logs, issue reports, or Git commits. .env and .env.* are ignored by Git; .env.example is the safe template.

## 8. Deployment and recovery notes

1. Back up Atlas and data/uploads/ before a release.
2. Confirm the intended source branch and review git status / git diff.
3. Install dependencies from the lockfile and run npm run build.
4. Run API smoke tests and manually exercise editor, viewer, uploads, and backup/restore.
5. Deploy the new code, retaining production .env and the uploads directory.
6. Restart the process and verify /api/health, login, document reading, editing/saving, and PDF/image delivery.
7. Confirm public HTML references the newly built asset names, not stale dist output or browser cache.
8. Keep the previous release and database/file backups available for rollback.

Do not use Reset Demo Data on a live shared workspace unless replacing all shared documentation is intended. It changes shared state for every visitor.

## 9. Known validation limits and maintenance checklist

A successful build and API smoke tests do not prove every UI control works in every browser. Before a release, test:

- Admin and guest sign-in, session refresh, and logout.
- Reader search, categories, previous/next navigation, and share-link fallback.
- Editor Visual/Split/HTML modes; every formatting toolbar control; title/category/description; save, reload, and reopen.
- PDF navigation across the full document, page input boundaries, zoom limits, search with zero/one/multiple results, download/open, missing PDF, and large PDF behavior.
- Upload success/failure, 50 MiB size boundary, images, PDFs, generic attachments, and session-protected file access.
- Manage category create/rename/reorder/delete; document create/view/edit/delete; site title save; JSON export/import; invalid backup handling; reset confirmation.
- Atlas disconnection/reconnection, save failure messages, and reload after failed requests.
- Small-screen layout, keyboard focus, browser console errors, and no unintended changes to shared production data.

Current implementation caveats to revisit:
- No dedicated automated end-to-end test suite is configured yet.
- Autosave failures need visible recovery/retry behavior; do not assume edits reached Atlas just because they appear in the editor.
- Browser-local recovery data can differ between devices and must not silently overwrite a populated shared database.
- Uploaded binaries live on local disk, so file backup/migration is separate from document backup.
- Production HTTPS and operational protections must be configured at the hosting/reverse-proxy layer.
