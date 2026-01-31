import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { RefreshCw, CheckCircle, XCircle, Clock, AlertCircle, PlayCircle, Settings, Search, Trash2, ExternalLink, GitBranch, Activity, Filter, Regex, FolderSearch, ChevronDown, ChevronRight, User, GitCommit, MessageSquare, Sun, Moon } from 'lucide-react';

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
    textMuted: '#888',
    textDim: '#666',
    textDimmer: '#555',
    textDimmest: '#444',
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
    textMuted: '#555',
    textDim: '#777',
    textDimmer: '#888',
    textDimmest: '#aaa',
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

// Commit Message kürzen
const truncateMessage = (msg, maxLength = 60) => {
  if (!msg) return '-';
  const firstLine = msg.split('\n')[0];
  if (firstLine.length <= maxLength) return firstLine;
  return firstLine.substring(0, maxLength) + '...';
};

// Author extrahieren
const getAuthor = (run) => {
  if (run.head_commit?.author?.name) return run.head_commit.author.name;
  if (run.head_commit?.author?.login) return run.head_commit.author.login;
  if (run.actor?.login) return run.actor.login;
  if (run.trigger_actor?.login) return run.trigger_actor.login;
  return '-';
};

// Commit Message extrahieren
const getCommitMessage = (run) => {
  if (run.head_commit?.message) return run.head_commit.message;
  if (run.display_title) return run.display_title;
  if (run.title) return run.title;
  return '-';
};

// Commit SHA extrahieren
const getCommitSha = (run) => {
  if (run.head_sha) return run.head_sha.substring(0, 7);
  if (run.head_commit?.id) return run.head_commit.id.substring(0, 7);
  return '-';
};

export default function ForgejoDashboard() {
  const [config, setConfig] = useState({
    baseUrl: '',
    token: '',
    repoPattern: '.*',
    workflowPattern: '.*',
    branchPattern: '^main$',
    organizations: [],
  });

  const [discoveredRepos, setDiscoveredRepos] = useState([]);
  const [allRuns, setAllRuns] = useState([]);
  const [loading, setLoading] = useState(false);
  const [discovering, setDiscovering] = useState(false);
  const [error, setError] = useState(null);
  const [showSettings, setShowSettings] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(30);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [newOrg, setNewOrg] = useState('');
  const [viewMode, setViewMode] = useState('table');
  const [expandedJobs, setExpandedJobs] = useState(new Set());
  const [expandedRepos, setExpandedRepos] = useState(new Set());
  const [discoveryLog, setDiscoveryLog] = useState([]);
  const [themeMode, setThemeMode] = useState(() => {
    try { return localStorage.getItem('forgejo-dashboard-theme') || 'dark'; } catch { return 'dark'; }
  });
  const t = THEMES[themeMode] || THEMES.dark;

  // Save theme to localStorage
  useEffect(() => {
    localStorage.setItem('forgejo-dashboard-theme', themeMode);
  }, [themeMode]);

  // Load config from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('forgejo-dashboard-v3-config');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setConfig(parsed);
        if (parsed.baseUrl && (parsed.organizations?.length > 0 || parsed.repoPattern)) {
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
      created_at: run.created_at || run.created,
      run_number: run.run_number || run.index_in_repo,
    };
  };

  // Workflow Runs für ein Repo abrufen (paginiert bis alle Workflows abgedeckt sind)
  const fetchRepoRuns = useCallback(async (owner, repo) => {
    try {
      const allRuns = [];
      const seenWorkflows = new Set();
      const PAGE_LIMIT = 50;
      const MAX_PAGES = 5;

      for (let page = 1; page <= MAX_PAGES; page++) {
        const data = await apiCall(`/repos/${owner}/${repo}/actions/runs?page=${page}&limit=${PAGE_LIMIT}`);
        const runs = data.workflow_runs || data || [];
        if (runs.length === 0) break;

        const prevCount = seenWorkflows.size;
        for (const run of runs) {
          allRuns.push(normalizeRun(run));
          seenWorkflows.add(getWorkflowName(run));
        }

        // Stop if this page brought no new workflows and we already have enough data
        if (seenWorkflows.size === prevCount && page > 1) break;
        // Stop if page was not full (no more data)
        if (runs.length < PAGE_LIMIT) break;
      }

      return allRuns;
    } catch (err) {
      if (!err.message.includes('404')) {
        addLog(`⚠️ Runs für ${owner}/${repo}: ${err.message}`);
      }
      return [];
    }
  }, [apiCall]);

  // Discovery: Alle Repos und deren Runs finden
  const discoverJobs = useCallback(async () => {
    if (!config.baseUrl) return;

    setDiscovering(true);
    setDiscoveryLog([]);
    setError(null);

    try {
      let allRepos = [];

      for (const org of config.organizations) {
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

      for (const repo of matchingRepos) {
        addLog(`📥 Lade Runs für: ${repo.full_name}`);
        const runs = await fetchRepoRuns(repo.owner.login || repo.owner.username, repo.name);

        const enrichedRuns = runs.map(run => ({
          ...run,
          _repo: repo,
          _repoFullName: repo.full_name,
          _workflowName: getWorkflowName(run),
          _jobPath: `${repo.full_name}/${getWorkflowName(run)}`,
        }));

        allRunsCollected.push(...enrichedRuns);
      }

      addLog(`✅ Insgesamt ${allRunsCollected.length} Runs geladen`);
      setAllRuns(allRunsCollected);
      setLastUpdate(new Date());

    } catch (err) {
      setError(err.message);
      addLog(`❌ Fehler: ${err.message}`);
    } finally {
      setDiscovering(false);
    }
  }, [config, fetchOrgRepos, searchRepos, fetchRepoRuns]);

  // Nur Runs aktualisieren (schneller)
  const refreshRuns = useCallback(async () => {
    if (!config.baseUrl || discoveredRepos.length === 0) return;

    setLoading(true);

    try {
      const allRunsCollected = [];

      for (const repo of discoveredRepos) {
        const runs = await fetchRepoRuns(repo.owner.login || repo.owner.username, repo.name);
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
      setLastUpdate(new Date());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [config.baseUrl, discoveredRepos, fetchRepoRuns]);

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

    const filtered = allRuns.filter(run => {
      const matchesWorkflow = workflowRegex.test(run._workflowName) || workflowRegex.test(run._jobPath);
      const matchesBranch = !branchRegex || branchRegex.test(run.head_branch || '');
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
  }, [allRuns, config.workflowPattern, config.branchPattern]);

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
            href={`${config.baseUrl}/${repoFullName}/actions/runs/${run.id}`}
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
              href={`${config.baseUrl}/${repoFullName}/commit/${run.head_sha || run.head_commit?.id}`}
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

            {/* Discover Button */}
            <button
              onClick={discoverJobs}
              disabled={discovering || !config.baseUrl}
              style={{
                width: '100%',
                background: 'linear-gradient(135deg, #f97316, #ea580c)',
                border: 'none',
                borderRadius: '6px',
                padding: '0.75rem',
                color: 'white',
                cursor: discovering ? 'wait' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                fontSize: '0.85rem',
                fontWeight: 600,
                opacity: discovering || !config.baseUrl ? 0.6 : 1,
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
          </div>
        )}

        {/* Main Content */}
        <div style={{ flex: 1, padding: '1.25rem', overflowY: 'auto' }}>
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
                        <td colSpan={8} style={{ padding: '0.6rem 1rem' }}>
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
                                <a
                                  href={`${config.baseUrl}/${job.repoFullName}/actions/runs/${latestRun.id}`}
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
                                  {job.workflowName}
                                  <ExternalLink size={12} style={{ color: t.textDimmest }} />
                                </a>
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
                              <td style={{ padding: '0.6rem 1rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'center', gap: '2px' }}>
                                  {job.allRuns.slice(0, 8).map((run, i) => {
                                    const s = getStatus(run.status, run.conclusion);
                                    return (
                                      <a
                                        key={run.id || i}
                                        href={`${config.baseUrl}/${job.repoFullName}/actions/runs/${run.id}`}
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
                                  <td colSpan={8} style={{ padding: '0.5rem 1rem 0.25rem 2.5rem' }}>
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
                                  <td colSpan={8}></td>
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
