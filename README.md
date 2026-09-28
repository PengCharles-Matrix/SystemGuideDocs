# SystemGuideDocs

Documentation Management frontend based on the SystemGuide reference image.

## Frontend stack

- React 19
- TypeScript
- Tailwind CSS v4
- Vite
- Git feature branches and Pull Requests

## Run locally

npm install
npm run dev

Open http://localhost:5173/.

## Production build

npm run build
npm run preview

## Features implemented

- Documentation sidebar grouped by category.
- Search and topic filtering.
- Reader, Editor, and Manage modes.
- Page creation with browser-local storage.
- JSON export.
- Share action copies the current page URL.
- Right-side page outline and reading-time metadata.
- Responsive layout for smaller screens.
- Visual styling closely follows Pictures/systemguide.png.

Frontend implementation lives in src/.
Frontend stack standards live in FrontendStack/.
