# Forgejo Dashboard

Ein leichtgewichtiges CI/CD-Pipeline-Monitoring-Dashboard für [Forgejo](https://forgejo.org/) / [Gitea](https://gitea.io/) Instanzen. Zeigt den Status von Workflow-Runs über mehrere Repositories und Organisationen hinweg in einer übersichtlichen, Jenkins-ähnlichen Oberfläche an.

![MIT License](https://img.shields.io/badge/license-MIT-green)

## Features

- **Multi-Organisation-Scanning** – Überwachung aller Repos einer oder mehrerer Organisationen
- **Regex-Filter** – Repos und Workflows per regulärem Ausdruck filtern
- **Echtzeit-Status** – Farbcodierte Anzeige (Erfolg, Fehler, Laufend, Wartend, Abgebrochen)
- **Build-Historie** – Letzte 15 Runs pro Workflow mit visueller History-Leiste
- **Auto-Refresh** – Konfigurierbares Intervall (10s, 30s, 60s)
- **Dark Theme** – Optimiert für Monitoring-Displays
- **Kein Backend nötig** – Läuft komplett im Browser über die Forgejo/Gitea API
- **Konfiguration im Browser** – Alle Einstellungen werden in `localStorage` gespeichert

## Dateien

| Datei | Beschreibung |
|---|---|
| `forgejo-dashboard.jsx` | React-Komponente (zur Einbindung in ein bestehendes React-Projekt) |
| `forgejo-local.html` | Standalone HTML-Datei – lädt React, Babel und Tailwind über CDN, läuft ohne Build-Schritt direkt im Browser |

## Schnellstart

### Standalone (ohne Build)

1. `forgejo-local.html` im Browser öffnen
2. Im Settings-Panel die Forgejo-URL und einen API-Token eintragen
3. Organisationen hinzufügen und optional Repo-/Workflow-Filter anpassen
4. Auf **Discover Jobs** klicken

### Als React-Komponente

```jsx
import ForgejoDashboard from './forgejo-dashboard';

function App() {
  return <ForgejoDashboard />;
}
```

Voraussetzungen:
- React 18+
- [Lucide React](https://lucide.dev/) Icons (`lucide-react`)

## Konfiguration

| Einstellung | Beschreibung | Beispiel |
|---|---|---|
| **Forgejo URL** | Basis-URL der Instanz | `https://git.example.com` |
| **API Token** | Persönlicher Access-Token | – |
| **Organisationen** | Liste der zu scannenden Orgs | `my-org` |
| **Repo Pattern** | Regex für Repository-Namen | `.*amerigo.*` |
| **Workflow Pattern** | Regex für Workflow-Namen | `(build\|check\|deploy)` |
| **Auto-Refresh** | Intervall in Sekunden (0 = aus) | `30` |

## Genutzte API-Endpunkte

- `GET /api/v1/orgs/{org}/repos` – Repositories einer Organisation
- `GET /api/v1/repos/search` – Repository-Suche
- `GET /api/v1/repos/{owner}/{repo}/actions/runs` – Workflow-Runs eines Repos

## Technologien

- React 18 (Hooks)
- Forgejo/Gitea REST API v1
- JetBrains Mono Font
- Lucide Icons (JSX) / Inline SVG (HTML)
- localStorage für Konfiguration

## Lizenz

[MIT](LICENSE)
