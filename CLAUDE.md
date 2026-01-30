# CLAUDE.md

## Project overview

Forgejo/Gitea CI/CD pipeline monitoring dashboard. Browser-based, no backend – talks directly to the Forgejo/Gitea REST API v1. Two variants exist: a React component (`forgejo-dashboard.jsx`) and a standalone HTML file (`forgejo-local.html`).

## Architecture

- **forgejo-dashboard.jsx** – Single React component (`ForgejoDashboard`) using React 18 Hooks. Depends on `lucide-react` for icons. Meant for embedding in a React app.
- **forgejo-local.html** – Self-contained HTML file. Loads React 18, ReactDOM, Babel, and Tailwind via CDN. Icons are inline SVGs. Opens directly in a browser with zero build steps.

Both variants share the same core logic:

1. **Config** → stored in `localStorage` (`forgejo-dashboard-v3-config` / `v2-config`)
2. **Discovery** → fetch org repos via `/api/v1/orgs/{org}/repos`, filter by repo regex
3. **Run fetching** → get workflow runs via `/api/v1/repos/{owner}/{repo}/actions/runs`
4. **Grouping** → group runs by job path (`repo/workflow`), filter by workflow regex
5. **Rendering** → table view with expandable rows, status indicators, history bars

## Key files

| File | Purpose |
|---|---|
| `forgejo-dashboard.jsx` | React component (1293 lines) – the primary, full-featured version |
| `forgejo-local.html` | Standalone HTML version (~565 lines) – includes grid view mode |
| `LICENSE` | MIT license |

## Code conventions

- Inline CSS styles (no external stylesheets, no CSS modules)
- React functional components with Hooks (`useState`, `useEffect`, `useCallback`, `useMemo`)
- JetBrains Mono as the monospace font
- Dark theme colors: background `#0d0d0d`–`#1a1a1a`, text `#e5e5e5`, borders `#2a2a2a`
- Status colors: success `#22c55e`, failure `#ef4444`, running `#3b82f6`, pending `#f59e0b`, cancelled `#6b7280`

## Important patterns

- API token is passed as a query parameter (`?token=...`)
- Pagination uses `limit=50` per page
- `filteredAndGroupedJobs` is the central `useMemo` that processes all run data
- Status priority sort order: failure → running → waiting → pending → success → cancelled/skipped
- Auto-refresh only calls `refreshRuns()` (fast path), full `discoverJobs()` must be triggered manually

## Common tasks

### Adding a new status type
1. Add the mapping in `getStatus()` (returns `{ color, bg, icon, label }`)
2. Update `statusPriority` sort order in `filteredAndGroupedJobs`

### Modifying the table layout
- JSX version: look for the `return` statement of the main component, table structure starts after the settings panel
- HTML version: same structure inside the `<script type="text/babel">` block

### Changing default config values
- JSX: `defaultConfig` object near the top of the component
- HTML: `defaultConfig` object inside the Babel script block

## Testing

No automated tests exist yet. Manual testing:
1. Open `forgejo-local.html` in a browser
2. Configure a Forgejo/Gitea instance URL and API token
3. Add at least one organization
4. Click "Discover Jobs" and verify repos and runs appear correctly
