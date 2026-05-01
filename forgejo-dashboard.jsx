import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { RefreshCw, CheckCircle, XCircle, Clock, AlertCircle, PlayCircle, Play, Settings, Search, Trash2, ExternalLink, GitBranch, Activity, Filter, Regex, FolderSearch, ChevronDown, ChevronRight, User, GitCommit, MessageSquare, Sun, Moon, Pencil, X, Check } from 'lucide-react';

// Status mapping für Forgejo Actions
const STATUS_MAP = {
  success: { color: '#22c55e', bg: '#052e16', icon: CheckCircle, label: 'Success', priority: 1 },
  failure: { color: '#ef4444', bg: '#450a0a', icon: XCircle, label: 'Failed', priority: 4 },
  cancelled: { color: '#6b7280', bg: '#1f2937', icon: AlertCircle, label: 'Cancelled', priority: 2 },
  running: { color: '#3b82f6', bg: '#172554', icon: PlayCircle, label: 'Running', priority: 3 },
  waiting: { color: '#f59e0b', bg: '#451a03', icon: Clock, label: 'Waiting', priority: 3 },
  pending: { color: '#f59e0b', bg: '#451a03', icon: Clock, label: 'Pending', priority: 3 },
  skipped: { color: '#6b7280', bg: '#1f2937', icon: AlertCircle, label: 'Skipped', priority: 1 },
  unknown: { color: '#6b7280', bg: '#1f2937', icon: AlertCircle, label: 'Unknown', priority: 0 },
};

const THEMES = {
  dark: {
    bg: 'linear-gradient(180deg, #0d0d0d 0%, #1a1a1a 100%)',
    text: '#e5e5e5',
    textBright: '#fff',
    textMuted: '#b0b0b0',
    textDim: '#999',
    textDimmer: '#888',
    textDimmest: '#777',
    border: '#2a2a2a',
    borderLight: '#333',
    borderDark: '#222',
    headerBg: 'rgba(0,0,0,0.5)',
    panelBg: '#141414',
    inputBg: '#0a0a0a',
    cardBg: '#141414',
    rowBg: '#1a1a1a',
    rowAltBg: '#111',
    rowHoverBg: '#1a1a1a',
    repoBg: '#0a0a0a',
    expandedBg: '#0d0d0d',
    logBg: '#0a0a0a',
    statsBg: '#1a1a1a',
    btnBg: '#1a1a1a',
    btnActiveBg: '#333',
    btnActiveText: '#fff',
    orgBg: '#1a1a1a',
    linkColor: '#3b82f6',
    scrollTrack: '#0a0a0a',
    scrollThumb: '#333',
    scrollThumbHover: '#444',
    placeholderColor: '#444',
  },
  light: {
    bg: 'linear-gradient(180deg, #f8f9fa 0%, #ffffff 100%)',
    text: '#1a1a1a',
    textBright: '#000',
    textMuted: '#444',
    textDim: '#555',
    textDimmer: '#666',
    textDimmest: '#888',
    border: '#e0e0e0',
    borderLight: '#d0d0d0',
    borderDark: '#e5e5e5',
    headerBg: 'rgba(255,255,255,0.9)',
    panelBg: '#f5f5f5',
    inputBg: '#ffffff',
    cardBg: '#ffffff',
    rowBg: '#f5f5f5',
    rowAltBg: '#fafafa',
    rowHoverBg: '#f0f0f0',
    repoBg: '#f0f0f0',
    expandedBg: '#f8f8f8',
    logBg: '#ffffff',
    statsBg: '#f0f0f0',
    btnBg: '#f0f0f0',
    btnActiveBg: '#d0d0d0',
    btnActiveText: '#000',
    orgBg: '#f0f0f0',
    linkColor: '#2563eb',
    scrollTrack: '#f0f0f0',
    scrollThumb: '#ccc',
    scrollThumbHover: '#bbb',
    placeholderColor: '#aaa',
  },
};

const getStatus = (status, conclusion) => {
  if (status === 'completed') {
    return STATUS_MAP[conclusion] || STATUS_MAP.unknown;
  }
  return STATUS_MAP[status] || STATUS_MAP.unknown;
};

const formatDuration = (start, end) => {
  if (!start) return '-';
  const startDate = new Date(start);
  const endDate = end ? new Date(end) : new Date();
  const diff = Math.floor((endDate - startDate) / 1000);

  if (diff < 60) return `${diff}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ${diff % 60}s`;
  return `${Math.floor(diff / 3600)}h ${Math.floor((diff % 3600) / 60)}m`;
};

const formatTimeAgo = (date) => {
  if (!date) return '-';
  const now = new Date();
  const then = new Date(date);
  const diff = Math.floor((now - then) / 1000);

  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
};

// Hilfsfunktion um Workflow-Name aus dem vollen Pfad zu extrahieren
const getWorkflowName = (run) => {
  if (run.workflow_ref) {
    const match = run.workflow_ref.match(/workflows\/([^@]+)/);
    if (match) return match[1].replace(/\.(yml|yaml)$/, '');
  }
  if (run.name) return run.name;
  if (run.workflow_id) return run.workflow_id;
  return 'unknown';
};

// Liefert nur den Datei-basierten Workflow-Namen (ohne Fallback auf den YAML-Namen).
// Wird zum sicheren Vergleich gegen vorhandene Workflow-Dateien benutzt.
const getWorkflowFilename = (run) => {
  if (run.workflow_ref) {
    const match = run.workflow_ref.match(/workflows\/([^@]+)/);
    if (match) return match[1].replace(/\.(yml|yaml)$/, '');
  }
  return null;
};

// Commit Message kürzen
const truncateMessage = (msg, maxLength = 60) => {
  if (!msg) return '-';
  const firstLine = msg.split('\n')[0];
  if (firstLine.length <= maxLength) return firstLine;
  return firstLine.substring(0, maxLength) + '...';
};

// Author extrahieren (Forgejo returns actor/trigger_actor User objects, no head_commit)
const getAuthor = (run) => {
  if (run.actor?.full_name) return run.actor.full_name;
  if (run.actor?.login) return run.actor.login;
  if (run.trigger_actor?.full_name) return run.trigger_actor.full_name;
  if (run.trigger_actor?.login) return run.trigger_actor.login;
  return '-';
};

// Commit Message extrahieren (Forgejo uses display_title/title, no head_commit)
const getCommitMessage = (run) => {
  if (run.display_title) return run.display_title;
  if (run.title) return run.title;
  return '-';
};

// Commit SHA extrahieren
const getCommitSha = (run) => {
  if (run.head_sha) return run.head_sha.substring(0, 7);
  if (run.commit_sha) return run.commit_sha.substring(0, 7);
  return '-';
};

export default function ForgejoDashboard() {
  const [config, setConfig] = useState({
    baseUrl: '',
    token: '',
    repoPattern: '.*',
    workflowPattern: '.*',
    branchPattern: '^main$',
    maxRuns: 500,
    organizations: [],
    hideDeletedWorkflows: true,
  });

  const [discoveredRepos, setDiscoveredRepos] = useState([]);
  const [allRuns, setAllRuns] = useState([]);
  const [existingWorkflows, setExistingWorkflows] = useState({});
  const [loading, setLoading] = useState(false);
  const [discovering, setDiscovering] = useState(false);
  const [error, setError] = useState(null);
  const [progress, setProgress] = useState({ current: 0, total: 0, phase: 'idle' });
  const [showSettings, setShowSettings] = useState(() => {
    try { const p = JSON.parse(localStorage.getItem('forgejo-dashboard-ui-prefs')); return p?.showSettings ?? true; } catch { return true; }
  });
  const [autoRefresh, setAutoRefresh] = useState(() => {
    try { const p = JSON.parse(localStorage.getItem('forgejo-dashboard-ui-prefs')); return p?.autoRefresh ?? 30; } catch { return 30; }
  });
  const [lastUpdate, setLastUpdate] = useState(null);
  const [newOrg, setNewOrg] = useState('');
  const [viewMode, setViewMode] = useState(() => {
    try { const p = JSON.parse(localStorage.getItem('forgejo-dashboard-ui-prefs')); return p?.viewMode || 'table'; } catch { return 'table'; }
  });
  const [expandedJobs, setExpandedJobs] = useState(new Set());
  const [expandedRepos, setExpandedRepos] = useState(new Set());
  const [discoveryLog, setDiscoveryLog] = useState([]);
  const [themeMode, setThemeMode] = useState(() => {
    try { return localStorage.getItem('forgejo-dashboard-theme') || 'dark'; } catch { return 'dark'; }
  });
  const [workflowRenames, setWorkflowRenames] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('forgejo-dashboard-workflow-renames')) || {};
    } catch { return {}; }
  });
  const [editingJobPath, setEditingJobPath] = useState(null);
  const [editingName, setEditingName] = useState('');
  const renameInputRef = useRef(null);
  const t = THEMES[themeMode] || THEMES.dark;

  // Save theme to localStorage
  useEffect(() => {
    localStorage.setItem('forgejo-dashboard-theme', themeMode);
  }, [themeMode]);

  // Save workflow renames to localStorage
  useEffect(() => {
    localStorage.setItem('forgejo-dashboard-workflow-renames', JSON.stringify(workflowRenames));
  }, [workflowRenames]);

  // Save UI preferences to localStorage
  useEffect(() => {
    localStorage.setItem('forgejo-dashboard-ui-prefs', JSON.stringify({ showSettings, autoRefresh, viewMode }));
  }, [showSettings, autoRefresh, viewMode]);

  // Load config from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('forgejo-dashboard-v3-config');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.hideDeletedWorkflows === undefined) parsed.hideDeletedWorkflows = true;
        setConfig(parsed);
        // Only auto-hide settings if there's no persisted UI preference for it
        const hasUiPrefs = localStorage.getItem('forgejo-dashboard-ui-prefs');
        if (!hasUiPrefs && parsed.baseUrl && (parsed.organizations?.length > 0 || parsed.repoPattern)) {
          setShowSettings(false);
        }
      } catch (e) {
        console.error('Failed to load config:', e);
      }
    }
  }, []);

  // Save config to localStorage
  useEffect(() => {
    localStorage.setItem('forgejo-dashboard-v3-config', JSON.stringify(config));
  }, [config]);

  const addLog = (message) => {
    setDiscoveryLog(prev => [...prev.slice(-50), `${new Date().toLocaleTimeString()} - ${message}`]);
  };

  const apiCall = useCallback(async (endpoint) => {
    const url = `${config.baseUrl}/api/v1${endpoint}`;

    // 1) Prefer Authorization header (required from Forgejo v13+).
    // 2) Fall back to ?token= query param if the header fails due to CORS.
    if (config.token) {
      try {
        const response = await fetch(url, {
          headers: { 'Accept': 'application/json', 'Authorization': `token ${config.token}` },
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        return response.json();
      } catch (err) {
        if (err.name !== 'TypeError') throw err;
        // Network/CORS error — fall back to query-parameter auth
        const sep = endpoint.includes('?') ? '&' : '?';
        const fallbackUrl = `${config.baseUrl}/api/v1${endpoint}${sep}token=${config.token}`;
        const response = await fetch(fallbackUrl, { headers: { 'Accept': 'application/json' } });
        if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        return response.json();
      }
    }

    const response = await fetch(url, { headers: { 'Accept': 'application/json' } });
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    return response.json();
  }, [config.baseUrl, config.token]);

  // Alle Repos einer Organisation abrufen
  const fetchOrgRepos = useCallback(async (org) => {
    const repos = [];
    let page = 1;
    const limit = 50;

    while (true) {
      try {
        const data = await apiCall(`/orgs/${org}/repos?page=${page}&limit=${limit}`);
        if (!data || data.length === 0) break;
        repos.push(...data);
        if (data.length < limit) break;
        page++;
      } catch (err) {
        addLog(`⚠️ Fehler bei Org ${org}: ${err.message}`);
        break;
      }
    }

    return repos;
  }, [apiCall]);

  // Workflow-Dateien aus dem Default-Branch eines Repos abrufen
  const fetchWorkflowFiles = useCallback(async (owner, repo, defaultBranch) => {
    const ref = encodeURIComponent(defaultBranch || 'main');
    const names = new Set();
    for (const dir of ['.forgejo/workflows', '.gitea/workflows', '.github/workflows']) {
      try {
        const data = await apiCall(`/repos/${owner}/${repo}/contents/${dir}?ref=${ref}`);
        if (Array.isArray(data)) {
          for (const f of data) {
            if (f.type === 'file' && /\.(ya?ml)$/i.test(f.name)) {
              names.add(f.name.replace(/\.(yml|yaml)$/i, ''));
            }
          }
        }
      } catch (err) {
        // 404 wenn das Verzeichnis nicht existiert – ignorieren
      }
    }
    return names;
  }, [apiCall]);

  // Repos per Suche finden
  const searchRepos = useCallback(async (query) => {
    try {
      const data = await apiCall(`/repos/search?q=${encodeURIComponent(query)}&limit=100`);
      return data.data || data || [];
    } catch (err) {
      addLog(`⚠️ Suche fehlgeschlagen: ${err.message}`);
      return [];
    }
  }, [apiCall]);

  // Normalize Forgejo API field names to what the UI code expects
  const normalizeRun = (run) => {
    const { repository, ...rest } = run;
    return {
      ...rest,
      head_branch: run.head_branch || run.prettyref,
      head_sha: run.head_sha || run.commit_sha,
      created_at: run.created_at || run.created,
      started_at: run.started_at || run.started,
      completed_at: run.completed_at || run.completed || run.stopped,
      run_number: run.run_number || run.index_in_repo,
      trigger_actor: run.trigger_actor || run.trigger_user,
    };
  };

  // Workflow Runs für ein Repo abrufen (Testflight→total_count→neueste Pages)
  const fetchRepoRuns = useCallback(async (owner, repo, onProgress, onProbe) => {
    try {
      const allRuns = [];
      const PAGE_LIMIT = 50;
      const maxRuns = config.maxRuns || 500;

      // Testflight mit limit=1: total_count günstig ermitteln
      const probe = await apiCall(`/repos/${owner}/${repo}/actions/runs?page=1&limit=1`);
      const totalCount = probe.total_count || 0;
      if (onProbe) onProbe(totalCount);

      if (totalCount === 0) {
        // Keine Runs oder API ohne total_count → Fallback: sequentiell von Seite 1
        const probeRuns = Array.isArray(probe) ? probe : (probe.workflow_runs || []);
        if (probeRuns.length === 0) return allRuns;
        for (let page = 1; page <= Math.ceil(maxRuns / PAGE_LIMIT); page++) {
          const data = await apiCall(`/repos/${owner}/${repo}/actions/runs?page=${page}&limit=${PAGE_LIMIT}`);
          const runs = data.workflow_runs || data || [];
          if (runs.length === 0) break;
          for (const run of runs) allRuns.push(normalizeRun(run));
          if (onProgress) onProgress(allRuns.length);
          if (runs.length < PAGE_LIMIT) break;
        }
        return allRuns;
      }

      // Nur die Pages mit den neusten maxRuns laden (API liefert älteste zuerst)
      const lastPage = Math.ceil(totalCount / PAGE_LIMIT);
      const startPage = Math.max(1, Math.ceil((totalCount - maxRuns + 1) / PAGE_LIMIT));

      for (let page = startPage; page <= lastPage; page++) {
        const data = await apiCall(`/repos/${owner}/${repo}/actions/runs?page=${page}&limit=${PAGE_LIMIT}`);
        const runs = data.workflow_runs || data || [];
        if (runs.length === 0) break;
        for (const run of runs) allRuns.push(normalizeRun(run));
        if (onProgress) onProgress(allRuns.length);
      }

      // Auf maxRuns trimmen (neueste = Ende der aufsteigenden Liste)
      return allRuns.slice(-maxRuns);
    } catch (err) {
      if (!err.message.includes('404')) {
        addLog(`⚠️ Runs für ${owner}/${repo}: ${err.message}`);
      }
      return [];
    }
  }, [apiCall, config.maxRuns]);

  // Discovery: Alle Repos und deren Runs finden
  const discoverJobs = useCallback(async () => {
    if (!config.baseUrl || discovering) return;

    setDiscovering(true);
    setDiscoveryLog([]);
    setError(null);
    setProgress({ current: 0, total: config.organizations.length, phase: 'discovering' });

    const timeout = setTimeout(() => {
      setDiscovering(false);
      setProgress(p => ({ ...p, phase: 'idle' }));
      setError('Discovery timed out after 60 seconds');
    }, 60000);

    try {
      let allRepos = [];

      for (let i = 0; i < config.organizations.length; i++) {
        const org = config.organizations[i];
        setProgress({ current: i + 1, total: config.organizations.length, phase: 'discovering' });
        addLog(`🔍 Durchsuche Organisation: ${org}`);
        const repos = await fetchOrgRepos(org);
        addLog(`   → ${repos.length} Repos gefunden`);
        allRepos.push(...repos);
      }

      if (config.repoPattern && config.repoPattern !== '.*') {
        const searchTerm = config.repoPattern
          .replace(/\.\*/g, '')
          .replace(/[^a-zA-Z0-9-_]/g, '')
          .slice(0, 20);

        if (searchTerm.length >= 2) {
          addLog(`🔍 Suche nach Repos mit: "${searchTerm}"`);
          const searchResults = await searchRepos(searchTerm);
          addLog(`   → ${searchResults.length} Repos gefunden`);

          const existingIds = new Set(allRepos.map(r => r.id));
          const newRepos = searchResults.filter(r => !existingIds.has(r.id));
          allRepos.push(...newRepos);
        }
      }

      let repoRegex;
      try {
        repoRegex = new RegExp(config.repoPattern, 'i');
      } catch (e) {
        addLog(`⚠️ Ungültiges Repo-Pattern: ${e.message}`);
        repoRegex = /.*/;
      }

      const matchingRepos = allRepos.filter(repo =>
        repoRegex.test(repo.full_name) || repoRegex.test(repo.name)
      );

      addLog(`✅ ${matchingRepos.length} Repos entsprechen dem Pattern`);
      setDiscoveredRepos(matchingRepos);

      const allRunsCollected = [];
      const maxRuns = config.maxRuns || 500;
      const actualTotals = matchingRepos.map(() => maxRuns);
      const getTotal = () => actualTotals.reduce((a, b) => a + b, 0);
      let runsFetched = 0;
      const workflowsByRepo = {};

      for (let i = 0; i < matchingRepos.length; i++) {
        const repo = matchingRepos[i];
        setProgress({ current: runsFetched, total: getTotal(), phase: 'fetching' });
        addLog(`📥 Lade Runs für: ${repo.full_name}`);
        const owner = repo.owner.login || repo.owner.username;
        const baseRunsFetched = runsFetched;
        const runs = await fetchRepoRuns(owner, repo.name, (repoRunCount) => {
          setProgress({ current: baseRunsFetched + repoRunCount, total: getTotal(), phase: 'fetching' });
        }, (totalCount) => {
          actualTotals[i] = totalCount > 0 ? Math.min(totalCount, maxRuns) : maxRuns;
          setProgress({ current: runsFetched, total: getTotal(), phase: 'fetching' });
        });

        const existing = await fetchWorkflowFiles(owner, repo.name, repo.default_branch);
        workflowsByRepo[repo.full_name] = existing;
        addLog(`   → ${existing.size} Workflow-Datei(en) auf ${repo.default_branch || 'main'}`);

        runsFetched += runs.length;
        const enrichedRuns = runs.map(run => ({
          ...run,
          _repo: repo,
          _repoFullName: repo.full_name,
          _workflowName: getWorkflowName(run),
          _jobPath: `${repo.full_name}/${getWorkflowName(run)}`,
        }));

        allRunsCollected.push(...enrichedRuns);
      }

      setProgress({ current: runsFetched, total: getTotal(), phase: 'fetching' });
      addLog(`✅ Insgesamt ${allRunsCollected.length} Runs geladen`);
      setAllRuns(allRunsCollected);
      setExistingWorkflows(workflowsByRepo);
      setLastUpdate(new Date());

    } catch (err) {
      setError(err.message);
      addLog(`❌ Fehler: ${err.message}`);
    } finally {
      clearTimeout(timeout);
      setDiscovering(false);
      setProgress({ current: 0, total: 0, phase: 'idle' });
    }
  }, [config, discovering, fetchOrgRepos, searchRepos, fetchRepoRuns, fetchWorkflowFiles]);

  // Nur Runs aktualisieren (schneller)
  const refreshRuns = useCallback(async () => {
    if (!config.baseUrl || discoveredRepos.length === 0 || loading) return;

    setLoading(true);
    const maxRuns = config.maxRuns || 500;
    const actualTotals = discoveredRepos.map(() => maxRuns);
    const getTotal = () => actualTotals.reduce((a, b) => a + b, 0);
    setProgress({ current: 0, total: getTotal(), phase: 'refreshing' });

    const timeout = setTimeout(() => {
      setLoading(false);
      setProgress(p => ({ ...p, phase: 'idle' }));
      setError('Refresh timed out after 60 seconds');
    }, 60000);

    try {
      const allRunsCollected = [];
      let runsFetched = 0;
      const workflowsByRepo = {};

      for (let i = 0; i < discoveredRepos.length; i++) {
        const repo = discoveredRepos[i];
        const owner = repo.owner.login || repo.owner.username;
        const baseRunsFetched = runsFetched;
        setProgress({ current: runsFetched, total: getTotal(), phase: 'refreshing' });
        const runs = await fetchRepoRuns(owner, repo.name, (repoRunCount) => {
          setProgress({ current: baseRunsFetched + repoRunCount, total: getTotal(), phase: 'refreshing' });
        }, (totalCount) => {
          actualTotals[i] = totalCount > 0 ? Math.min(totalCount, maxRuns) : maxRuns;
          setProgress({ current: runsFetched, total: getTotal(), phase: 'refreshing' });
        });
        workflowsByRepo[repo.full_name] = await fetchWorkflowFiles(owner, repo.name, repo.default_branch);
        runsFetched += runs.length;
        const enrichedRuns = runs.map(run => ({
          ...run,
          _repo: repo,
          _repoFullName: repo.full_name,
          _workflowName: getWorkflowName(run),
          _jobPath: `${repo.full_name}/${getWorkflowName(run)}`,
        }));
        allRunsCollected.push(...enrichedRuns);
      }

      setAllRuns(allRunsCollected);
      setExistingWorkflows(workflowsByRepo);
      setLastUpdate(new Date());
    } catch (err) {
      setError(err.message);
    } finally {
      clearTimeout(timeout);
      setLoading(false);
      setProgress({ current: 0, total: 0, phase: 'idle' });
    }
  }, [config.baseUrl, config.maxRuns, discoveredRepos, loading, fetchRepoRuns, fetchWorkflowFiles]);

  // Nach Workflow-Pattern filtern
  const filteredAndGroupedJobs = useMemo(() => {
    let workflowRegex;
    try {
      workflowRegex = config.workflowPattern ? new RegExp(config.workflowPattern, 'i') : /.*/;
    } catch (e) {
      workflowRegex = /.*/;
    }

    let branchRegex;
    try {
      branchRegex = config.branchPattern ? new RegExp(config.branchPattern, 'i') : null;
    } catch (e) {
      branchRegex = null;
    }

    const hideDeleted = config.hideDeletedWorkflows !== false;

    const filtered = allRuns.filter(run => {
      const matchesWorkflow = workflowRegex.test(run._workflowName) || workflowRegex.test(run._jobPath);
      const matchesBranch = !branchRegex || branchRegex.test(run.head_branch || '');
      if (hideDeleted) {
        const existing = existingWorkflows[run._repoFullName];
        const filename = getWorkflowFilename(run);
        // Nur filtern wenn wir den Dateinamen sicher kennen UND wir Workflow-
        // Dateien gefunden haben. Sonst (API-Fehler, unbekanntes Verzeichnis,
        // fehlendes workflow_ref) lieber nichts ausblenden.
        if (filename && existing && existing.size > 0 && !existing.has(filename)) return false;
      }
      return matchesWorkflow && matchesBranch;
    });

    const jobMap = new Map();

    for (const run of filtered) {
      const key = run._jobPath;
      const existing = jobMap.get(key);

      if (!existing || new Date(run.created_at) > new Date(existing.latestRun.created_at)) {
        jobMap.set(key, {
          jobPath: key,
          repo: run._repo,
          repoFullName: run._repoFullName,
          workflowName: run._workflowName,
          latestRun: run,
          allRuns: existing ? [...existing.allRuns, run] : [run],
        });
      } else {
        existing.allRuns.push(run);
      }
    }

    for (const job of jobMap.values()) {
      job.allRuns.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      job.allRuns = job.allRuns.slice(0, 15);
    }

    const jobs = Array.from(jobMap.values());
    jobs.sort((a, b) => {
      const statusA = getStatus(a.latestRun.status, a.latestRun.conclusion);
      const statusB = getStatus(b.latestRun.status, b.latestRun.conclusion);
      return statusB.priority - statusA.priority;
    });

    return jobs;
  }, [allRuns, config.workflowPattern, config.branchPattern, config.hideDeletedWorkflows, existingWorkflows]);

  // Lazy backfill: wenn die Checkbox aktiv ist und für entdeckte Repos
  // noch keine Workflow-Dateiliste geladen wurde, jetzt nachholen –
  // damit der Toggle ohne erneutes Discover sofort wirkt.
  useEffect(() => {
    if (!config.hideDeletedWorkflows) return;
    if (discoveredRepos.length === 0) return;

    const missing = discoveredRepos.filter(r => !(r.full_name in existingWorkflows));
    if (missing.length === 0) return;

    let cancelled = false;
    (async () => {
      const updates = {};
      for (const repo of missing) {
        if (cancelled) return;
        const owner = repo.owner.login || repo.owner.username;
        try {
          updates[repo.full_name] = await fetchWorkflowFiles(owner, repo.name, repo.default_branch);
        } catch {
          updates[repo.full_name] = new Set();
        }
      }
      if (!cancelled) setExistingWorkflows(prev => ({ ...prev, ...updates }));
    })();

    return () => { cancelled = true; };
  }, [config.hideDeletedWorkflows, discoveredRepos, existingWorkflows, fetchWorkflowFiles]);

  // Auto-refresh
  useEffect(() => {
    if (discoveredRepos.length === 0 || !config.baseUrl || autoRefresh === 0) return;

    const interval = setInterval(refreshRuns, autoRefresh * 1000);
    return () => clearInterval(interval);
  }, [discoveredRepos, config.baseUrl, autoRefresh, refreshRuns]);

  const addOrg = () => {
    if (newOrg && !config.organizations.includes(newOrg)) {
      setConfig(prev => ({
        ...prev,
        organizations: [...prev.organizations, newOrg]
      }));
      setNewOrg('');
    }
  };

  const removeOrg = (org) => {
    setConfig(prev => ({
      ...prev,
      organizations: prev.organizations.filter(o => o !== org)
    }));
  };

  const getOverallStatus = () => {
    if (filteredAndGroupedJobs.length === 0) return 'unknown';

    const statuses = filteredAndGroupedJobs.map(job => {
      const run = job.latestRun;
      if (run.status === 'completed') return run.conclusion;
      return run.status;
    });

    if (statuses.includes('failure')) return 'failure';
    if (statuses.includes('running')) return 'running';
    if (statuses.includes('pending') || statuses.includes('waiting')) return 'pending';
    if (statuses.every(s => s === 'success')) return 'success';
    return 'unknown';
  };

  const overallStatus = getOverallStatus();
  const statusInfo = getStatus(overallStatus === 'success' ? 'completed' : overallStatus, overallStatus);

  const toggleJobExpand = (jobPath) => {
    setExpandedJobs(prev => {
      const next = new Set(prev);
      if (next.has(jobPath)) {
        next.delete(jobPath);
      } else {
        next.add(jobPath);
      }
      return next;
    });
  };

  const toggleRepoExpand = (repoName) => {
    setExpandedRepos(prev => {
      const next = new Set(prev);
      if (next.has(repoName)) {
        next.delete(repoName);
      } else {
        next.add(repoName);
      }
      return next;
    });
  };

  const getDisplayName = (jobPath, originalName) => {
    return workflowRenames[jobPath] || originalName;
  };

  const startRename = (jobPath, currentName) => {
    setEditingJobPath(jobPath);
    setEditingName(workflowRenames[jobPath] || currentName);
    setTimeout(() => renameInputRef.current?.focus(), 0);
  };

  const confirmRename = () => {
    if (editingJobPath && editingName.trim()) {
      setWorkflowRenames(prev => ({ ...prev, [editingJobPath]: editingName.trim() }));
    }
    setEditingJobPath(null);
    setEditingName('');
  };

  const cancelRename = () => {
    setEditingJobPath(null);
    setEditingName('');
  };

  const removeRename = (jobPath) => {
    setWorkflowRenames(prev => {
      const next = { ...prev };
      delete next[jobPath];
      return next;
    });
  };

  // Gruppiere Jobs nach Repo
  const jobsByRepo = useMemo(() => {
    const grouped = new Map();
    for (const job of filteredAndGroupedJobs) {
      const repoName = job.repoFullName;
      if (!grouped.has(repoName)) {
        grouped.set(repoName, []);
      }
      grouped.get(repoName).push(job);
    }
    return grouped;
  }, [filteredAndGroupedJobs]);

  // Run Detail Row Component
  const RunDetailRow = ({ run, repoFullName, isFirst }) => {
    const status = getStatus(run.status, run.conclusion);
    const author = getAuthor(run);
    const message = getCommitMessage(run);
    const sha = getCommitSha(run);

    return (
      <tr style={{
        background: isFirst ? t.rowBg : t.rowAltBg,
        borderBottom: `1px solid ${t.borderDark}`,
      }}>
        <td style={{ padding: '0.5rem 1rem', width: '30px' }}>
          <div style={{
            width: '10px',
            height: '10px',
            borderRadius: '50%',
            background: status.color,
            boxShadow: run.status === 'running' ? `0 0 8px ${status.color}` : 'none',
            animation: run.status === 'running' ? 'pulse 1.5s infinite' : 'none',
          }} />
        </td>
        <td style={{ padding: '0.5rem 1rem' }}>
          <a
            href={`${config.baseUrl}/${repoFullName}/actions/runs/${run.run_number || run.id}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              color: t.text,
              textDecoration: 'none',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              fontSize: '0.8rem',
            }}
          >
            <span style={{ color: t.textDim }}>#{run.run_number || run.id}</span>
            <ExternalLink size={10} style={{ color: t.textDimmest }} />
          </a>
        </td>
        <td style={{ padding: '0.5rem 1rem', maxWidth: '300px' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            fontSize: '0.75rem',
          }}>
            <GitCommit size={12} style={{ color: t.textDim, flexShrink: 0 }} />
            <a
              href={`${config.baseUrl}/${repoFullName}/commit/${run.head_sha}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: t.linkColor, textDecoration: 'none', fontFamily: 'monospace' }}
            >
              {sha}
            </a>
            <span style={{
              color: t.textMuted,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              flex: 1,
            }} title={message}>
              {truncateMessage(message, 50)}
            </span>
          </div>
        </td>
        <td style={{ padding: '0.5rem 1rem' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            fontSize: '0.75rem',
            color: t.textMuted,
          }}>
            <User size={12} style={{ color: t.textDim }} />
            {author}
          </div>
        </td>
        <td style={{ padding: '0.5rem 1rem' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            fontSize: '0.75rem',
            color: t.textDim,
          }}>
            <GitBranch size={12} />
            {run.head_branch || 'main'}
          </div>
        </td>
        <td style={{ padding: '0.5rem 1rem', fontSize: '0.75rem', color: t.textDim }}>
          {formatTimeAgo(run.created_at)}
        </td>
        <td style={{ padding: '0.5rem 1rem', fontSize: '0.75rem', color: t.textDim }}>
          {formatDuration(run.started_at, run.completed_at)}
        </td>
        <td style={{ padding: '0.5rem 1rem' }}>
          <span style={{
            fontSize: '0.65rem',
            padding: '0.2rem 0.4rem',
            borderRadius: '3px',
            background: status.bg,
            color: status.color,
            fontWeight: 500,
          }}>
            {status.label}
          </span>
        </td>
      </tr>
    );
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: t.bg,
      color: t.text,
      fontFamily: "'JetBrains Mono', 'Fira Code', 'SF Mono', monospace",
    }}>
      {/* Header */}
      <header style={{
        background: t.headerBg,
        borderBottom: `1px solid ${t.border}`,
        padding: '0.75rem 1.5rem',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        position: 'sticky',
        top: 0,
        zIndex: 100,
        backdropFilter: 'blur(10px)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{
            width: '36px',
            height: '36px',
            background: 'linear-gradient(135deg, #f97316, #ea580c)',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <Activity size={20} style={{ color: 'white' }} />
          </div>
          <div>
            <h1 style={{
              margin: 0,
              fontSize: '1.25rem',
              fontWeight: 700,
              color: t.textBright,
              letterSpacing: '-0.02em',
            }}>
              Forgejo Pipeline Monitor
            </h1>
            <p style={{
              margin: 0,
              fontSize: '0.65rem',
              color: t.textDim,
              letterSpacing: '0.15em',
              textTransform: 'uppercase',
            }}>
              Jenkins-Style Dashboard
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {lastUpdate && (
            <span style={{ fontSize: '0.7rem', color: t.textDimmer }}>
              {lastUpdate.toLocaleTimeString()}
            </span>
          )}

          <select
            value={autoRefresh}
            onChange={(e) => setAutoRefresh(Number(e.target.value))}
            style={{
              background: t.btnBg,
              border: `1px solid ${t.borderLight}`,
              borderRadius: '4px',
              padding: '0.4rem 0.6rem',
              color: t.textMuted,
              fontSize: '0.7rem',
              cursor: 'pointer',
            }}
          >
            <option value={0}>Manual</option>
            <option value={10}>10s</option>
            <option value={30}>30s</option>
            <option value={60}>60s</option>
          </select>

          <button
            onClick={discoveredRepos.length > 0 ? refreshRuns : discoverJobs}
            disabled={loading || discovering}
            title={discoveredRepos.length > 0 ? "Poll now" : "Discover & poll"}
            style={{
              background: 'transparent',
              border: 'none',
              padding: '0.2rem',
              color: '#22c55e',
              cursor: loading || discovering ? 'wait' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              opacity: loading || discovering ? 0.4 : 0.8,
            }}
          >
            <Play size={14} fill="#22c55e" />
          </button>

          <button
            onClick={refreshRuns}
            disabled={loading || discoveredRepos.length === 0}
            style={{
              background: t.btnBg,
              border: `1px solid ${t.borderLight}`,
              borderRadius: '4px',
              padding: '0.4rem 0.8rem',
              color: t.textMuted,
              cursor: loading ? 'wait' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              fontSize: '0.75rem',
            }}
          >
            <RefreshCw size={14} style={{
              animation: loading ? 'spin 1s linear infinite' : 'none'
            }} />
            Refresh
          </button>

          <button
            onClick={() => setThemeMode(prev => prev === 'dark' ? 'light' : 'dark')}
            style={{
              background: t.btnBg,
              border: `1px solid ${t.borderLight}`,
              borderRadius: '4px',
              padding: '0.4rem',
              color: t.textDim,
              cursor: 'pointer',
            }}
          >
            {themeMode === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>

          <button
            onClick={() => setShowSettings(!showSettings)}
            style={{
              background: showSettings ? t.btnActiveBg : t.btnBg,
              border: `1px solid ${t.borderLight}`,
              borderRadius: '4px',
              padding: '0.4rem',
              color: showSettings ? t.btnActiveText : t.textDim,
              cursor: 'pointer',
            }}
          >
            <Settings size={18} />
          </button>
        </div>
      </header>

      {/* Progress Bar */}
      {progress.phase !== 'idle' && (
        <div style={{
          height: '3px',
          background: t.border,
          position: 'relative',
          overflow: 'hidden',
        }}>
          <div style={{
            height: '100%',
            background: progress.phase === 'discovering' ? '#f97316' : '#3b82f6',
            width: progress.total > 0 ? `${(progress.current / progress.total) * 100}%` : '0%',
            transition: 'width 0.3s ease',
          }} />
        </div>
      )}

      {/* Overall Status Bar */}
      {filteredAndGroupedJobs.length > 0 && (
        <div style={{
          background: statusInfo.bg,
          borderBottom: `2px solid ${statusInfo.color}`,
          padding: '0.75rem 1.5rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            {React.createElement(statusInfo.icon, {
              size: 28,
              style: { color: statusInfo.color }
            })}
            <span style={{
              fontSize: '1rem',
              fontWeight: 600,
              color: statusInfo.color,
            }}>
              {filteredAndGroupedJobs.length} Jobs
              {overallStatus === 'success' && ' — All Passing'}
              {overallStatus === 'failure' && ` — ${filteredAndGroupedJobs.filter(j => getStatus(j.latestRun.status, j.latestRun.conclusion) === STATUS_MAP.failure).length} Failing`}
              {overallStatus === 'running' && ` — ${filteredAndGroupedJobs.filter(j => getStatus(j.latestRun.status, j.latestRun.conclusion) === STATUS_MAP.running).length} Running`}
            </span>
          </div>

          <div style={{ display: 'flex', gap: '1.25rem', fontSize: '1rem', color: t.textMuted }}>
            <span style={{ color: '#22c55e' }}>{'✓'} {filteredAndGroupedJobs.filter(j => getStatus(j.latestRun.status, j.latestRun.conclusion) === STATUS_MAP.success).length}</span>
            <span style={{ color: '#ef4444' }}>{'✗'} {filteredAndGroupedJobs.filter(j => getStatus(j.latestRun.status, j.latestRun.conclusion) === STATUS_MAP.failure).length}</span>
            <span style={{ color: '#3b82f6' }}>{'●'} {filteredAndGroupedJobs.filter(j => getStatus(j.latestRun.status, j.latestRun.conclusion) === STATUS_MAP.running).length}</span>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', minHeight: 'calc(100vh - 120px)' }}>
        {/* Settings Panel */}
        {showSettings && (
          <div style={{
            width: '320px',
            flexShrink: 0,
            background: t.panelBg,
            borderRight: `1px solid ${t.border}`,
            padding: '1.25rem',
            overflowY: 'auto',
          }}>
            <h2 style={{
              margin: '0 0 1.25rem 0',
              fontSize: '0.7rem',
              fontWeight: 600,
              color: t.textDim,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
            }}>
              Configuration
            </h2>

            {/* Forgejo URL */}
            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{
                display: 'block',
                fontSize: '0.7rem',
                color: t.textDimmer,
                marginBottom: '0.4rem',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}>
                Forgejo URL
              </label>
              <input
                type="text"
                value={config.baseUrl}
                onChange={(e) => setConfig(prev => ({ ...prev, baseUrl: e.target.value.replace(/\/$/, '') }))}
                placeholder="https://git.alm.anlei-service.de"
                style={{
                  width: '100%',
                  background: t.inputBg,
                  border: `1px solid ${t.borderLight}`,
                  borderRadius: '4px',
                  padding: '0.6rem',
                  color: t.text,
                  fontSize: '0.8rem',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            {/* API Token */}
            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{
                display: 'block',
                fontSize: '0.7rem',
                color: t.textDimmer,
                marginBottom: '0.4rem',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}>
                API Token
              </label>
              <input
                type="password"
                value={config.token}
                onChange={(e) => setConfig(prev => ({ ...prev, token: e.target.value }))}
                placeholder="5993a9683b8de8c2493fe6e88eefd70a4df04ccb"
                style={{
                  width: '100%',
                  background: t.inputBg,
                  border: `1px solid ${t.borderLight}`,
                  borderRadius: '4px',
                  padding: '0.6rem',
                  color: t.text,
                  fontSize: '0.8rem',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            {/* Organizations */}
            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                fontSize: '0.7rem',
                color: t.textDimmer,
                marginBottom: '0.4rem',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}>
                <FolderSearch size={12} />
                Organizations to scan
              </label>
              <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.5rem' }}>
                <input
                  type="text"
                  value={newOrg}
                  onChange={(e) => setNewOrg(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && addOrg()}
                  placeholder="org-name"
                  style={{
                    flex: 1,
                    background: t.inputBg,
                    border: `1px solid ${t.borderLight}`,
                    borderRadius: '4px',
                    padding: '0.5rem',
                    color: t.text,
                    fontSize: '0.8rem',
                  }}
                />
                <button
                  onClick={addOrg}
                  style={{
                    background: '#1a472a',
                    border: '1px solid #22c55e40',
                    borderRadius: '4px',
                    padding: '0.5rem 0.75rem',
                    color: '#22c55e',
                    cursor: 'pointer',
                    fontSize: '0.8rem',
                  }}
                >
                  +
                </button>
              </div>
              {config.organizations.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                  {config.organizations.map(org => (
                    <span
                      key={org}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.4rem',
                        background: t.orgBg,
                        border: `1px solid ${t.borderLight}`,
                        borderRadius: '4px',
                        padding: '0.25rem 0.5rem',
                        fontSize: '0.75rem',
                      }}
                    >
                      {org}
                      <button
                        onClick={() => removeOrg(org)}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: t.textDim,
                          cursor: 'pointer',
                          padding: 0,
                          display: 'flex',
                        }}
                      >
                        <Trash2 size={12} />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Repo Pattern */}
            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                fontSize: '0.7rem',
                color: t.textDimmer,
                marginBottom: '0.4rem',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}>
                <Regex size={12} />
                Repository Pattern (Regex)
              </label>
              <input
                type="text"
                value={config.repoPattern}
                onChange={(e) => setConfig(prev => ({ ...prev, repoPattern: e.target.value }))}
                placeholder=".*"
                style={{
                  width: '100%',
                  background: t.inputBg,
                  border: `1px solid ${t.borderLight}`,
                  borderRadius: '4px',
                  padding: '0.6rem',
                  color: '#f97316',
                  fontSize: '0.8rem',
                  fontFamily: 'monospace',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            {/* Workflow Pattern */}
            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                fontSize: '0.7rem',
                color: t.textDimmer,
                marginBottom: '0.4rem',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}>
                <Filter size={12} />
                Workflow Pattern (Regex)
              </label>
              <textarea
                value={config.workflowPattern}
                onChange={(e) => setConfig(prev => ({ ...prev, workflowPattern: e.target.value }))}
                placeholder="(build|continuous-delivery|check)"
                rows={3}
                style={{
                  width: '100%',
                  background: t.inputBg,
                  border: `1px solid ${t.borderLight}`,
                  borderRadius: '4px',
                  padding: '0.6rem',
                  color: '#8b5cf6',
                  fontSize: '0.8rem',
                  fontFamily: 'monospace',
                  boxSizing: 'border-box',
                  resize: 'vertical',
                }}
              />
            </div>

            {/* Branch Pattern */}
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                fontSize: '0.7rem',
                color: t.textDimmer,
                marginBottom: '0.4rem',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}>
                <GitBranch size={12} />
                Branch Pattern (Regex)
              </label>
              <input
                type="text"
                value={config.branchPattern}
                onChange={(e) => setConfig(prev => ({ ...prev, branchPattern: e.target.value }))}
                placeholder="^main$"
                style={{
                  width: '100%',
                  background: t.inputBg,
                  border: `1px solid ${t.borderLight}`,
                  borderRadius: '4px',
                  padding: '0.6rem',
                  color: '#22d3ee',
                  fontSize: '0.8rem',
                  fontFamily: 'monospace',
                  boxSizing: 'border-box',
                }}
              />
              <span style={{
                display: 'block',
                fontSize: '0.6rem',
                color: t.textDimmest,
                marginTop: '0.3rem',
              }}>
                Default: ^main$ (nur main-Branch). Leer lassen für alle Branches.
              </span>
            </div>

            {/* Hide deleted workflows */}
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                fontSize: '0.8rem',
                color: t.text,
                cursor: 'pointer',
              }}>
                <input
                  type="checkbox"
                  checked={config.hideDeletedWorkflows !== false}
                  onChange={(e) => setConfig(prev => ({ ...prev, hideDeletedWorkflows: e.target.checked }))}
                  style={{ cursor: 'pointer' }}
                />
                Gelöschte Workflows ausblenden
              </label>
              <span style={{
                display: 'block',
                fontSize: '0.6rem',
                color: t.textDimmest,
                marginTop: '0.3rem',
                marginLeft: '1.4rem',
              }}>
                Versteckt Workflows, deren YAML-Datei nicht mehr im Default-Branch des Repos existiert.
              </span>
            </div>

            {/* Max Runs */}
            <div>
              <label style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                fontSize: '0.7rem',
                color: t.textDim,
                marginBottom: '0.4rem',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}>
                Max Runs per Repo
              </label>
              <input
                type="number"
                min="50"
                step="50"
                value={config.maxRuns || 500}
                onChange={(e) => setConfig(prev => ({ ...prev, maxRuns: parseInt(e.target.value) || 500 }))}
                placeholder="500"
                style={{
                  width: '100%',
                  background: t.inputBg,
                  border: `1px solid ${t.borderLight}`,
                  borderRadius: '4px',
                  padding: '0.6rem',
                  color: '#22d3ee',
                  fontSize: '0.8rem',
                  fontFamily: 'monospace',
                  boxSizing: 'border-box',
                }}
              />
              <span style={{
                display: 'block',
                fontSize: '0.6rem',
                color: t.textDimmest,
                marginTop: '0.3rem',
              }}>
                Maximale Anzahl Runs pro Repo (in 50er-Schritten). Höher = mehr Workflows sichtbar, aber langsamer.
              </span>
            </div>

            {/* Discover Button */}
            <button
              onClick={discoverJobs}
              disabled={discovering || loading || !config.baseUrl}
              style={{
                width: '100%',
                background: 'linear-gradient(135deg, #f97316, #ea580c)',
                border: 'none',
                borderRadius: '6px',
                padding: '0.75rem',
                color: 'white',
                cursor: discovering || loading ? 'wait' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                fontSize: '0.85rem',
                fontWeight: 600,
                opacity: discovering || loading || !config.baseUrl ? 0.6 : 1,
              }}
            >
              {discovering ? (
                <>
                  <RefreshCw size={16} style={{ animation: 'spin 1s linear infinite' }} />
                  Discovering...
                </>
              ) : (
                <>
                  <Search size={16} />
                  Discover Jobs
                </>
              )}
            </button>

            {/* Discovery Log */}
            {discoveryLog.length > 0 && (
              <div style={{
                marginTop: '1rem',
                background: t.logBg,
                border: `1px solid ${t.borderDark}`,
                borderRadius: '4px',
                padding: '0.75rem',
                maxHeight: '200px',
                overflowY: 'auto',
                fontSize: '0.65rem',
                fontFamily: 'monospace',
                color: t.textDim,
              }}>
                {discoveryLog.map((log, i) => (
                  <div key={i} style={{ marginBottom: '0.25rem' }}>{log}</div>
                ))}
              </div>
            )}

            {/* Stats */}
            {discoveredRepos.length > 0 && (
              <div style={{
                marginTop: '1rem',
                padding: '0.75rem',
                background: t.statsBg,
                borderRadius: '6px',
                fontSize: '0.7rem',
                color: t.textDim,
              }}>
                <div style={{ marginBottom: '0.4rem' }}>
                  <strong style={{ color: t.textMuted }}>{discoveredRepos.length}</strong> Repos discovered
                </div>
                <div style={{ marginBottom: '0.4rem' }}>
                  <strong style={{ color: t.textMuted }}>{allRuns.length}</strong> Total runs loaded
                </div>
                <div>
                  <strong style={{ color: t.textMuted }}>{filteredAndGroupedJobs.length}</strong> Jobs matching filters
                </div>
              </div>
            )}

            {/* Workflow Renames */}
            {Object.keys(workflowRenames).length > 0 && (
              <div style={{ marginTop: '1.25rem' }}>
                <label style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  fontSize: '0.7rem',
                  color: t.textDimmer,
                  marginBottom: '0.4rem',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}>
                  <Pencil size={12} />
                  Workflow Renames
                </label>
                <div style={{
                  background: t.logBg,
                  border: `1px solid ${t.borderDark}`,
                  borderRadius: '4px',
                  padding: '0.5rem',
                  maxHeight: '250px',
                  overflowY: 'auto',
                }}>
                  {Object.entries(workflowRenames).map(([jobPath, customName]) => (
                    <div key={jobPath} style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                      padding: '0.35rem 0.25rem',
                      borderBottom: `1px solid ${t.borderDark}`,
                      fontSize: '0.7rem',
                    }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ color: t.text, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {customName}
                        </div>
                        <div style={{ color: t.textDimmest, fontSize: '0.6rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={jobPath}>
                          {jobPath}
                        </div>
                      </div>
                      <button
                        onClick={() => startRename(jobPath, jobPath.split('/').pop())}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          padding: '0.15rem',
                          color: t.textDim,
                          cursor: 'pointer',
                          display: 'flex',
                          flexShrink: 0,
                        }}
                        title="Edit rename"
                      >
                        <Pencil size={11} />
                      </button>
                      <button
                        onClick={() => removeRename(jobPath)}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          padding: '0.15rem',
                          color: '#ef4444',
                          cursor: 'pointer',
                          display: 'flex',
                          flexShrink: 0,
                        }}
                        title="Remove rename"
                      >
                        <Trash2 size={11} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Main Content */}
        <div style={{ flex: 1, padding: '1.25rem', overflowY: 'auto', position: 'relative' }}>
          {progress.phase !== 'idle' && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.5rem 0.75rem',
              marginBottom: '0.75rem',
              background: progress.phase === 'discovering' ? 'rgba(249,115,22,0.1)' : 'rgba(59,130,246,0.1)',
              border: `1px solid ${progress.phase === 'discovering' ? 'rgba(249,115,22,0.25)' : 'rgba(59,130,246,0.25)'}`,
              borderRadius: '6px',
              fontSize: '0.75rem',
              color: progress.phase === 'discovering' ? '#fb923c' : '#60a5fa',
            }}>
              <RefreshCw size={12} style={{ animation: 'spin 1s linear infinite' }} />
              <span>
                {progress.phase === 'discovering' && `Discovering orgs... ${progress.current}/${progress.total}`}
                {progress.phase === 'fetching' && `Fetching runs... ${progress.current}/${progress.total}`}
                {progress.phase === 'refreshing' && `Refreshing... ${progress.current}/${progress.total} runs`}
              </span>
              <span style={{ marginLeft: 'auto', opacity: 0.7 }}>
                {progress.total > 0 ? `${Math.round((progress.current / progress.total) * 100)}%` : ''}
              </span>
            </div>
          )}
          {error && (
            <div style={{
              background: 'rgba(239,68,68,0.1)',
              border: '1px solid rgba(239,68,68,0.3)',
              borderRadius: '6px',
              padding: '1rem',
              marginBottom: '1rem',
              color: '#fca5a5',
              fontSize: '0.85rem',
            }}>
              ⚠️ {error}
            </div>
          )}

          {filteredAndGroupedJobs.length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: '4rem 2rem',
              color: t.textDimmest,
            }}>
              <Search size={48} style={{ marginBottom: '1rem', opacity: 0.3 }} />
              <h2 style={{ margin: '0 0 0.5rem 0', color: t.textDimmer, fontWeight: 500 }}>
                {discoveredRepos.length === 0 ? 'No Jobs Discovered' : 'No Matching Workflows'}
              </h2>
              <p style={{ margin: 0, fontSize: '0.85rem' }}>
                {discoveredRepos.length === 0
                  ? 'Configure organizations and patterns, then click "Discover Jobs"'
                  : 'Adjust your workflow pattern to find matching jobs'}
              </p>
            </div>
          ) : (
            /* Table View with expandable rows */
            <div style={{
              background: t.cardBg,
              border: `1px solid ${t.border}`,
              borderRadius: '8px',
              overflow: 'hidden',
            }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                <thead>
                  <tr style={{ background: t.rowBg, borderBottom: `1px solid ${t.border}` }}>
                    <th style={{ padding: '0.75rem 1rem', textAlign: 'left', color: t.textDim, fontWeight: 500, width: '30px' }}></th>
                    <th style={{ padding: '0.75rem 1rem', textAlign: 'left', color: t.textDim, fontWeight: 500, width: '40px' }}>S</th>
                    <th style={{ padding: '0.75rem 1rem', textAlign: 'left', color: t.textDim, fontWeight: 500 }}>Workflow</th>
                    <th style={{ padding: '0.75rem 1rem', textAlign: 'left', color: t.textDim, fontWeight: 500 }}>Last Commit</th>
                    <th style={{ padding: '0.75rem 1rem', textAlign: 'left', color: t.textDim, fontWeight: 500, width: '120px' }}>Author</th>
                    <th style={{ padding: '0.75rem 1rem', textAlign: 'left', color: t.textDim, fontWeight: 500, width: '100px' }}>Branch</th>
                    <th style={{ padding: '0.75rem 1rem', textAlign: 'left', color: t.textDim, fontWeight: 500, width: '100px' }}>Time</th>
                    <th style={{ padding: '0.75rem 1rem', textAlign: 'left', color: t.textDim, fontWeight: 500, width: '90px' }}>Duration</th>
                    <th style={{ padding: '0.75rem 1rem', textAlign: 'center', color: t.textDim, fontWeight: 500, width: '100px' }}>History</th>
                  </tr>
                </thead>
                <tbody>
                  {Array.from(jobsByRepo.entries()).map(([repoName, jobs]) => (
                    <React.Fragment key={repoName}>
                      {/* Repo Header Row */}
                      <tr
                        style={{
                          background: t.repoBg,
                          cursor: 'pointer',
                          borderBottom: `1px solid ${t.borderDark}`,
                        }}
                        onClick={() => toggleRepoExpand(repoName)}
                      >
                        <td colSpan={9} style={{ padding: '0.6rem 1rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            {expandedRepos.has(repoName) || expandedRepos.size === 0 ?
                              <ChevronDown size={14} style={{ color: t.textDim }} /> :
                              <ChevronRight size={14} style={{ color: t.textDim }} />
                            }
                            <a
                              href={`${config.baseUrl}/${repoName}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              style={{
                                color: t.textMuted,
                                fontWeight: 600,
                                textDecoration: 'none',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                              }}
                            >
                              {repoName}
                              <ExternalLink size={12} style={{ color: t.textDimmest }} />
                            </a>
                            <span style={{ color: t.textDimmest, fontSize: '0.7rem' }}>({jobs.length} workflows)</span>
                          </div>
                        </td>
                      </tr>

                      {/* Job Rows */}
                      {(expandedRepos.has(repoName) || expandedRepos.size === 0) && jobs.map(job => {
                        const status = getStatus(job.latestRun.status, job.latestRun.conclusion);
                        const isExpanded = expandedJobs.has(job.jobPath);
                        const latestRun = job.latestRun;

                        return (
                          <React.Fragment key={job.jobPath}>
                            {/* Main Job Row */}
                            <tr
                              style={{
                                borderBottom: `1px solid ${t.rowBg}`,
                                background: isExpanded ? t.rowBg : 'transparent',
                                cursor: 'pointer',
                                transition: 'background 0.15s',
                              }}
                              onClick={() => toggleJobExpand(job.jobPath)}
                              onMouseOver={(e) => { if (!isExpanded) e.currentTarget.style.background = t.rowHoverBg; }}
                              onMouseOut={(e) => { if (!isExpanded) e.currentTarget.style.background = 'transparent'; }}
                            >
                              <td style={{ padding: '0.6rem 0.5rem 0.6rem 2rem' }}>
                                {isExpanded ?
                                  <ChevronDown size={12} style={{ color: t.textDim }} /> :
                                  <ChevronRight size={12} style={{ color: t.textDim }} />
                                }
                              </td>
                              <td style={{ padding: '0.6rem 0.5rem' }}>
                                <div style={{
                                  width: '12px',
                                  height: '12px',
                                  borderRadius: '50%',
                                  background: status.color,
                                  boxShadow: `0 0 8px ${status.color}60`,
                                  animation: latestRun.status === 'running' ? 'pulse 1.5s infinite' : 'none',
                                }} />
                              </td>
                              <td style={{ padding: '0.6rem 1rem' }}>
                                {editingJobPath === job.jobPath ? (
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }} onClick={(e) => e.stopPropagation()}>
                                    <input
                                      ref={renameInputRef}
                                      type="text"
                                      value={editingName}
                                      onChange={(e) => setEditingName(e.target.value)}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') confirmRename();
                                        if (e.key === 'Escape') cancelRename();
                                      }}
                                      style={{
                                        background: t.inputBg,
                                        border: `1px solid ${t.borderLight}`,
                                        borderRadius: '3px',
                                        padding: '0.25rem 0.4rem',
                                        color: t.text,
                                        fontSize: '0.8rem',
                                        fontFamily: 'inherit',
                                        width: '200px',
                                      }}
                                    />
                                    <button onClick={confirmRename} style={{ background: 'transparent', border: 'none', padding: '0.15rem', color: '#22c55e', cursor: 'pointer', display: 'flex' }}>
                                      <Check size={14} />
                                    </button>
                                    <button onClick={cancelRename} style={{ background: 'transparent', border: 'none', padding: '0.15rem', color: '#ef4444', cursor: 'pointer', display: 'flex' }}>
                                      <X size={14} />
                                    </button>
                                  </div>
                                ) : (
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <a
                                      href={`${config.baseUrl}/${job.repoFullName}/actions/runs/${latestRun.run_number || latestRun.id}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      onClick={(e) => e.stopPropagation()}
                                      style={{
                                        color: t.text,
                                        textDecoration: 'none',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.5rem',
                                        fontWeight: 500,
                                      }}
                                    >
                                      {getDisplayName(job.jobPath, job.workflowName)}
                                      <ExternalLink size={12} style={{ color: t.textDimmest }} />
                                    </a>
                                    {workflowRenames[job.jobPath] && (
                                      <span style={{ fontSize: '0.65rem', color: t.textDimmest }} title={`Original: ${job.workflowName}`}>
                                        ({job.workflowName})
                                      </span>
                                    )}
                                    <button
                                      onClick={(e) => { e.stopPropagation(); startRename(job.jobPath, job.workflowName); }}
                                      style={{
                                        background: 'transparent',
                                        border: 'none',
                                        padding: '0.15rem',
                                        color: t.textDimmest,
                                        cursor: 'pointer',
                                        display: 'flex',
                                        opacity: 0.5,
                                        transition: 'opacity 0.15s',
                                      }}
                                      onMouseOver={(e) => e.currentTarget.style.opacity = 1}
                                      onMouseOut={(e) => e.currentTarget.style.opacity = 0.5}
                                      title="Rename workflow"
                                    >
                                      <Pencil size={12} />
                                    </button>
                                  </div>
                                )}
                              </td>
                              <td style={{ padding: '0.6rem 1rem', maxWidth: '250px' }}>
                                <div style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '0.5rem',
                                  fontSize: '0.75rem',
                                }}>
                                  <a
                                    href={`${config.baseUrl}/${job.repoFullName}/commit/${latestRun.head_sha}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={(e) => e.stopPropagation()}
                                    style={{ color: t.linkColor, textDecoration: 'none', fontFamily: 'monospace' }}
                                  >
                                    {getCommitSha(latestRun)}
                                  </a>
                                  <span style={{
                                    color: t.textMuted,
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                  }} title={getCommitMessage(latestRun)}>
                                    {truncateMessage(getCommitMessage(latestRun), 40)}
                                  </span>
                                </div>
                              </td>
                              <td style={{ padding: '0.6rem 1rem', fontSize: '0.75rem', color: t.textMuted }}>
                                {getAuthor(latestRun)}
                              </td>
                              <td style={{ padding: '0.6rem 1rem', fontSize: '0.75rem', color: t.textDim }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                                  <GitBranch size={12} />
                                  {latestRun.head_branch || 'main'}
                                </div>
                              </td>
                              <td style={{ padding: '0.6rem 1rem', fontSize: '0.75rem', color: t.textDim }}>
                                {formatTimeAgo(latestRun.created_at)}
                              </td>
                              <td style={{ padding: '0.6rem 1rem', fontSize: '0.75rem', color: t.textDim }}>
                                {formatDuration(latestRun.started_at, latestRun.completed_at)}
                              </td>
                              <td style={{ padding: '0.6rem 1rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'center', gap: '2px' }}>
                                  {job.allRuns.slice(0, 8).map((run, i) => {
                                    const s = getStatus(run.status, run.conclusion);
                                    return (
                                      <a
                                        key={run.id || i}
                                        href={`${config.baseUrl}/${job.repoFullName}/actions/runs/${run.run_number || run.id}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        onClick={(e) => e.stopPropagation()}
                                        title={`#${run.run_number || i + 1} - ${s.label} - ${truncateMessage(getCommitMessage(run), 30)}`}
                                        style={{
                                          width: '14px',
                                          height: '14px',
                                          borderRadius: '2px',
                                          background: s.color,
                                          opacity: i === 0 ? 1 : 0.6,
                                          transition: 'opacity 0.15s, transform 0.15s',
                                        }}
                                        onMouseOver={(e) => { e.target.style.opacity = 1; e.target.style.transform = 'scale(1.2)'; }}
                                        onMouseOut={(e) => { e.target.style.opacity = i === 0 ? 1 : 0.6; e.target.style.transform = 'scale(1)'; }}
                                      />
                                    );
                                  })}
                                </div>
                              </td>
                            </tr>

                            {/* Expanded Detail Rows */}
                            {isExpanded && (
                              <>
                                <tr style={{ background: t.expandedBg }}>
                                  <td colSpan={9} style={{ padding: '0.5rem 1rem 0.25rem 2.5rem' }}>
                                    <span style={{ fontSize: '0.65rem', color: t.textDimmer, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                                      Recent Runs ({job.allRuns.length})
                                    </span>
                                  </td>
                                </tr>
                                {job.allRuns.slice(0, 10).map((run, i) => (
                                  <RunDetailRow
                                    key={run.id || i}
                                    run={run}
                                    repoFullName={job.repoFullName}
                                    isFirst={i === 0}
                                  />
                                ))}
                                <tr style={{ background: t.expandedBg, height: '8px' }}>
                                  <td colSpan={9}></td>
                                </tr>
                              </>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }

        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&display=swap');

        * { box-sizing: border-box; }

        input::placeholder, textarea::placeholder { color: ${t.placeholderColor}; }

        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: ${t.scrollTrack}; }
        ::-webkit-scrollbar-thumb { background: ${t.scrollThumb}; border-radius: 3px; }
        ::-webkit-scrollbar-thumb:hover { background: ${t.scrollThumbHover}; }

        table a:hover { text-decoration: underline !important; }
      `}</style>
    </div>
  );
}
