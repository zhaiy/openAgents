import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

export interface DebugServerOptions {
  port: number;
  workflowDir: string;
  runsDir: string;
}

export class DebugServer {
  private server: http.Server | null = null;
  private options: DebugServerOptions;

  constructor(options: DebugServerOptions) {
    this.options = options;
  }

  start(): Promise<void> {
    return new Promise((resolve) => {
      this.server = http.createServer((req, res) => {
        this.handleRequest(req, res);
      });

      this.server.listen(this.options.port, () => {
        resolve();
      });
    });
  }

  stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => resolve());
      } else {
        resolve();
      }
    });
  }

  private handleRequest(req: http.IncomingMessage, res: http.ServerResponse): void {
    const parsedUrl = url.parse(req.url || '', true);
    const pathname = parsedUrl.pathname || '/';

    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    try {
      if (pathname === '/' || pathname === '/index.html') {
        this.serveHTML(res, parsedUrl.query);
      } else if (pathname === '/dag') {
        // DAG view - serve HTML with workflow parameter
        const workflowId = parsedUrl.query.workflow as string | undefined;
        this.serveHTML(res, { workflow: workflowId });
      } else if (pathname.startsWith('/run/')) {
        // Run view - serve HTML with run parameter
        const runId = pathname.replace('/run/', '');
        this.serveHTML(res, { run: runId });
      } else if (pathname === '/api/workflows' && req.method === 'GET') {
        this.serveWorkflows(res);
      } else if (pathname.startsWith('/api/workflow/')) {
        const workflowId = pathname.replace('/api/workflow/', '');
        this.serveWorkflow(res, workflowId);
      } else if (pathname.startsWith('/api/run/')) {
        const parts = pathname.replace('/api/run/', '').split('/');
        const runId = parts[0];
        const subPath = parts.slice(1).join('/');
        this.serveRun(res, runId, subPath);
      } else {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not Found');
      }
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end(`Internal Server Error: ${error instanceof Error ? error.message : error}`);
    }
  }

  private serveHTML(res: http.ServerResponse, query: Record<string, unknown> = {}): void {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(this.getIndexHTML(query));
  }

  private serveWorkflows(res: http.ServerResponse): void {
    const workflowsDir = this.options.workflowDir;
    if (!fs.existsSync(workflowsDir)) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify([]));
      return;
    }

    const files = fs.readdirSync(workflowsDir).filter((f) => f.endsWith('.yaml') || f.endsWith('.yml'));
    const workflows = files.map((file) => {
      const filePath = path.join(workflowsDir, file);
      const content = fs.readFileSync(filePath, 'utf8');
      const idMatch = content.match(/^\s*id:\s*(\S+)/m);
      const nameMatch = content.match(/^\s*name:\s*(.+)/m);
      return {
        id: idMatch ? idMatch[1] : file.replace(/\.(yaml|yml)$/, ''),
        name: nameMatch ? nameMatch[1].trim() : file,
        file,
      };
    });

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(workflows));
  }

  private serveWorkflow(res: http.ServerResponse, workflowId: string): void {
    const workflowsDir = this.options.workflowDir;
    const filePath = path.join(workflowsDir, `${workflowId}.yaml`);

    if (!fs.existsSync(filePath)) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Workflow not found' }));
      return;
    }

    const content = fs.readFileSync(filePath, 'utf8');
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end(content);
  }

  private serveRun(res: http.ServerResponse, runId: string, subPath: string): void {
    // Find run in runs directory
    const runsDir = this.options.runsDir;
    if (!fs.existsSync(runsDir)) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Runs directory not found' }));
      return;
    }

    // Search for run directory
    const entries = fs.readdirSync(runsDir, { withFileTypes: true });
    let runDir: string | null = null;

    for (const entry of entries) {
      if (entry.isDirectory() && entry.name.startsWith(runId)) {
        runDir = path.join(runsDir, entry.name);
        break;
      }
    }

    if (!runDir) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Run not found' }));
      return;
    }

    if (!subPath || subPath === '') {
      // Serve run state
      const statePath = path.join(runDir, 'state.json');
      if (fs.existsSync(statePath)) {
        const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(state));
      } else {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Run state not found' }));
      }
    } else if (subPath === 'events') {
      // Serve events
      const eventsPath = path.join(runDir, 'events.jsonl');
      if (fs.existsSync(eventsPath)) {
        const events = fs.readFileSync(eventsPath, 'utf8').split('\n').filter(Boolean).map((line) => JSON.parse(line));
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(events));
      } else {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Events not found' }));
      }
    } else if (subPath.startsWith('step/')) {
      // Serve step output
      const stepId = subPath.replace('step/', '');
      const state = JSON.parse(fs.readFileSync(path.join(runDir, 'state.json'), 'utf8'));
      const stepState = state.steps?.[stepId];

      if (!stepState) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Step not found' }));
        return;
      }

      if (stepState.outputFile) {
        const outputPath = path.join(runDir, stepState.outputFile);
        if (fs.existsSync(outputPath)) {
          const output = fs.readFileSync(outputPath, 'utf8');
          res.writeHead(200, { 'Content-Type': 'text/plain' });
          res.end(output);
        } else {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Output file not found' }));
        }
      } else {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: stepState.status, error: stepState.error }));
      }
    } else {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Unknown subpath' }));
    }
  }

  private getIndexHTML(query: Record<string, unknown> = {}): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>OpenAgents Debug</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #1a1a2e; color: #eee; min-height: 100vh; }
    .container { max-width: 1200px; margin: 0 auto; padding: 20px; }
    h1 { color: #00d4ff; margin-bottom: 20px; }
    h2 { color: #ff6b6b; margin: 20px 0 10px; }
    .card { background: #16213e; border-radius: 8px; padding: 20px; margin-bottom: 15px; }
    .card h3 { color: #00d4ff; margin-bottom: 10px; }
    .workflow-list { display: grid; gap: 10px; }
    .workflow-item { background: #0f3460; padding: 15px; border-radius: 6px; cursor: pointer; transition: background 0.2s; }
    .workflow-item:hover { background: #1a4a7a; }
    .workflow-item .id { color: #888; font-size: 0.9em; }
    .dag-container { background: #0f3460; border-radius: 8px; padding: 20px; margin-top: 20px; overflow-x: auto; }
    .dag { display: flex; flex-direction: column; gap: 10px; }
    .dag-step { display: flex; align-items: center; gap: 10px; padding: 10px 15px; background: #16213e; border-radius: 6px; }
    .dag-step.pending { border-left: 3px solid #888; }
    .dag-step.running { border-left: 3px solid #00d4ff; animation: pulse 1s infinite; }
    .dag-step.completed { border-left: 3px solid #4ade80; }
    .dag-step.failed { border-left: 3px solid #ff6b6b; }
    @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.7; } }
    .dag-arrow { color: #00d4ff; font-size: 1.2em; }
    .run-list { display: grid; gap: 10px; }
    .run-item { background: #0f3460; padding: 15px; border-radius: 6px; cursor: pointer; transition: background 0.2s; }
    .run-item:hover { background: #1a4a7a; }
    .run-item .meta { display: flex; gap: 15px; color: #888; font-size: 0.85em; margin-top: 5px; }
    .status { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 0.8em; }
    .status.running { background: #00d4ff22; color: #00d4ff; }
    .status.completed { background: #4ade8022; color: #4ade80; }
    .status.failed { background: #ff6b6b22; color: #ff6b6b; }
    .status.pending { background: #88882222; color: #888; }
    pre { background: #0a0a1a; padding: 15px; border-radius: 6px; overflow-x: auto; font-size: 0.9em; line-height: 1.5; }
    .tabs { display: flex; gap: 5px; margin-bottom: 15px; }
    .tab { padding: 8px 16px; background: #16213e; border: none; border-radius: 6px 6px 0 0; color: #888; cursor: pointer; }
    .tab.active { background: #0f3460; color: #00d4ff; }
    .tab-content { display: none; }
    .tab-content.active { display: block; }
    .loading { color: #888; text-align: center; padding: 40px; }
    .modal { display: none; position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.8); z-index: 1000; }
    .modal.active { display: flex; align-items: center; justify-content: center; }
    .modal-content { background: #16213e; border-radius: 12px; width: 90%; max-width: 1000px; max-height: 90vh; overflow: auto; }
    .modal-header { display: flex; justify-content: space-between; align-items: center; padding: 20px; border-bottom: 1px solid #0f3460; }
    .modal-header h2 { color: #00d4ff; margin: 0; }
    .modal-close { background: none; border: none; color: #888; font-size: 1.5em; cursor: pointer; padding: 5px 10px; }
    .modal-close:hover { color: #fff; }
    .modal-body { padding: 20px; }
    .dag-view { display: flex; flex-direction: column; gap: 20px; }
    .dag-graph { display: flex; flex-direction: column; gap: 2px; }
    .dag-layer { display: flex; gap: 20px; align-items: center; justify-content: center; }
    .dag-node { background: #0f3460; border-radius: 8px; padding: 15px 20px; min-width: 150px; text-align: center; }
    .dag-node .step-id { color: #00d4ff; font-weight: bold; margin-bottom: 5px; }
    .dag-node .step-agent { color: #888; font-size: 0.85em; }
    .dag-node .step-status { margin-top: 8px; font-size: 0.8em; }
    .dag-edge { color: #00d4ff; font-size: 1.5em; padding: 0 10px; }
    .dag-arrow-down { color: #00d4ff; font-size: 1.5em; text-align: center; padding: 10px 0; }
    .run-view { display: flex; flex-direction: column; gap: 20px; }
    .run-header { display: flex; gap: 20px; align-items: center; background: #0f3460; padding: 15px; border-radius: 8px; }
    .run-header .run-id { color: #00d4ff; font-weight: bold; }
    .run-steps { display: flex; flex-direction: column; gap: 10px; }
    .run-step { background: #0f3460; border-radius: 8px; overflow: hidden; }
    .run-step-header { display: flex; justify-content: space-between; align-items: center; padding: 15px; cursor: pointer; }
    .run-step-header:hover { background: #1a4a7a; }
    .run-step-info { display: flex; gap: 15px; align-items: center; }
    .run-step-info .step-id { color: #00d4ff; font-weight: bold; }
    .run-step-body { display: none; padding: 15px; border-top: 1px solid #16213e; }
    .run-step-body.open { display: block; }
    .run-step-body pre { max-height: 300px; }
  </style>
  <script>
    window.__INITIAL_WORKFLOW__ = ${query.workflow ? `"${query.workflow}"` : 'null'};
    window.__INITIAL_RUN__ = ${query.run ? `"${query.run}"` : 'null'};
  </script>
</head>
<body>
  <div class="container">
    <h1>OpenAgents Debug</h1>

    <h2>Workflows</h2>
    <div class="workflows">
      <div class="loading">Loading workflows...</div>
    </div>

    <h2>Runs</h2>
    <div class="runs">
      <div class="loading">Loading runs...</div>
    </div>
  </div>

  <!-- DAG Modal -->
  <div id="dag-modal" class="modal">
    <div class="modal-content">
      <div class="modal-header">
        <h2 id="dag-modal-title">DAG View</h2>
        <button class="modal-close" onclick="closeDagModal()">&times;</button>
      </div>
      <div class="modal-body" id="dag-modal-body">
        <div class="loading">Loading DAG...</div>
      </div>
    </div>
  </div>

  <!-- Run Modal -->
  <div id="run-modal" class="modal">
    <div class="modal-content">
      <div class="modal-header">
        <h2 id="run-modal-title">Run View</h2>
        <button class="modal-close" onclick="closeRunModal()">&times;</button>
      </div>
      <div class="modal-body" id="run-modal-body">
        <div class="loading">Loading run...</div>
      </div>
    </div>
  </div>

  <script>
    async function loadWorkflows() {
      try {
        const res = await fetch('/api/workflows');
        const workflows = await res.json();
        const container = document.querySelector('.workflows');
        if (workflows.length === 0) {
          container.innerHTML = '<p style="color:#888">No workflows found</p>';
          return;
        }
        container.innerHTML = '<div class="workflow-list">' +
          workflows.map(w => '<div class="workflow-item" onclick="showDag(\\'' + w.id + '\\')">' +
            '<div class="id">' + w.id + '</div>' +
            '<div>' + w.name + '</div>' +
          '</div>').join('') + '</div>';
      } catch (e) {
        console.error('Failed to load workflows:', e);
      }
    }

    async function loadRuns() {
      try {
        const res = await fetch('/api/workflows');
        const workflows = await res.json();
        const container = document.querySelector('.runs');

        let runsHtml = '';
        for (const wf of workflows) {
          const wfRes = await fetch('/api/workflow/' + wf.id);
          if (!wfRes.ok) continue;
          const content = await wfRes.text();
          const stepMatches = content.match(/^steps:$/m);
          if (!stepMatches) continue;

          runsHtml += '<h3 style="color:#00d4ff;margin:15px 0 10px">' + wf.name + '</h3>';
          runsHtml += '<div id="runs-' + wf.id + '"><div class="loading">Loading...</div></div>';

          // Load runs for this workflow
          loadRunsForWorkflow(wf.id);
        }

        if (!runsHtml) {
          container.innerHTML = '<p style="color:#888">No runs found</p>';
        } else {
          container.innerHTML = runsHtml;
        }
      } catch (e) {
        console.error('Failed to load runs:', e);
      }
    }

    async function loadRunsForWorkflow(workflowId) {
      try {
        const runsRes = await fetch('/api/run/' + workflowId + '-');
        const container = document.getElementById('runs-' + workflowId);
        if (!container) return;

        // Try to get all runs
        const runs = [];
        for (let i = 0; i < 10; i++) {
          const runId = workflowId + '-run-' + i;
          const res = await fetch('/api/run/' + runId);
          if (res.ok) {
            const state = await res.json();
            runs.push({ id: runId, ...state });
          }
        }

        if (runs.length === 0) {
          container.innerHTML = '<p style="color:#888">No runs found for this workflow</p>';
          return;
        }

        container.innerHTML = '<div class="run-list">' +
          runs.map(r => '<div class="run-item" onclick="showRun(\\'' + r.id + '\\')">' +
            '<div><span class="status ' + r.status + '">' + r.status + '</span></div>' +
            '<div class="meta">' +
              '<span>Run: ' + r.runId + '</span>' +
              '<span>Steps: ' + Object.keys(r.steps || {}).length + '</span>' +
            '</div>' +
          '</div>').join('') + '</div>';
      } catch (e) {
        console.error('Failed to load runs for workflow:', e);
      }
    }

    function showDag(workflowId) {
      const modal = document.getElementById('dag-modal');
      const title = document.getElementById('dag-modal-title');
      const body = document.getElementById('dag-modal-body');
      title.textContent = 'DAG: ' + workflowId;
      body.innerHTML = '<div class="loading">Loading DAG...</div>';
      modal.classList.add('active');

      fetch('/api/workflow/' + workflowId)
        .then(res => res.text())
        .then(yaml => {
          const dag = parseWorkflowDag(yaml);
          body.innerHTML = renderDag(dag, workflowId);
        })
        .catch(err => {
          body.innerHTML = '<p style="color:#ff6b6b">Failed to load workflow: ' + err.message + '</p>';
        });
    }

    function closeDagModal() {
      document.getElementById('dag-modal').classList.remove('active');
    }

    function showRun(runId) {
      const modal = document.getElementById('run-modal');
      const title = document.getElementById('run-modal-title');
      const body = document.getElementById('run-modal-body');
      title.textContent = 'Run: ' + runId;
      body.innerHTML = '<div class="loading">Loading run...</div>';
      modal.classList.add('active');

      Promise.all([
        fetch('/api/run/' + runId).then(res => res.json()),
        fetch('/api/run/' + runId + '/events').then(res => res.json()).catch(() => []),
      ]).then(([state, events]) => {
        body.innerHTML = renderRun(state, events);
      }).catch(err => {
        body.innerHTML = '<p style="color:#ff6b6b">Failed to load run: ' + err.message + '</p>';
      });
    }

    function closeRunModal() {
      document.getElementById('run-modal').classList.remove('active');
    }

    function parseWorkflowDag(yaml) {
      const lines = yaml.split('\n');
      const steps = [];
      let currentStep = null;
      let inSteps = false;

      for (const line of lines) {
        if (line.match(/^steps:\s*$/)) {
          inSteps = true;
          continue;
        }
        if (inSteps && line.match(/^[a-z]/)) {
          inSteps = false;
        }
        if (inSteps) {
          const idMatch = line.match(/^\s+id:\s*(\S+)/);
          if (idMatch) {
            currentStep = { id: idMatch[1], agent: '', task: '', depends_on: [] };
            steps.push(currentStep);
          }
          const agentMatch = line.match(/^\s+agent:\s*(\S+)/);
          if (agentMatch && currentStep) {
            currentStep.agent = agentMatch[1];
          }
          const taskMatch = line.match(/^\s+task:\s*(.+)/);
          if (taskMatch && currentStep) {
            currentStep.task = taskMatch[1].trim();
          }
          const depMatch = line.match(/^\s+depends_on:\s*$/);
          if (depMatch && currentStep) {
            // next lines will have dependencies
          }
          const depItemMatch = line.match(/^\s+-\s*(\S+)/);
          if (depItemMatch && currentStep && line.match(/^\s+-\s*/)) {
            currentStep.depends_on.push(depItemMatch[1]);
          }
        }
      }

      // Calculate layers (topological sort)
      const layers = [];
      const assigned = new Set();
      const stepMap = new Map(steps.map(s => [s.id, s]));

      while (assigned.size < steps.length) {
        const layer = [];
        for (const step of steps) {
          if (assigned.has(step.id)) continue;
          const depsMet = step.depends_on.every(d => assigned.has(d));
          if (depsMet) {
            layer.push(step);
          }
        }
        if (layer.length === 0 && assigned.size < steps.length) {
          // Circular dependency or error
          for (const step of steps) {
            if (!assigned.has(step.id)) {
              layer.push(step);
              break;
            }
          }
        }
        for (const step of layer) {
          assigned.add(step.id);
        }
        layers.push(layer);
      }

      return { steps, layers };
    }

    function renderDag(dag, workflowId) {
      const { steps, layers } = dag;

      let html = '<div class="dag-view">';
      html += '<p style="color:#888">Workflow: ' + workflowId + ' | ' + steps.length + ' steps, ' + layers.length + ' layers</p>';
      html += '<div class="dag-graph">';

      for (let i = 0; i < layers.length; i++) {
        html += '<div class="dag-layer">';
        for (const step of layers[i]) {
          html += '<div class="dag-node">';
          html += '<div class="step-id">' + step.id + '</div>';
          html += '<div class="step-agent">' + step.agent + '</div>';
          if (step.depends_on.length > 0) {
            html += '<div class="step-status">deps: ' + step.depends_on.join(', ') + '</div>';
          }
          html += '</div>';
          if (layers[i + 1]) {
            // Show connection to next layer
          }
        }
        html += '</div>';
        if (i < layers.length - 1) {
          html += '<div class="dag-arrow-down">&#8595;</div>';
        }
      }

      html += '</div></div>';
      return html;
    }

    function renderRun(state, events) {
      let html = '<div class="run-view">';

      // Run header
      html += '<div class="run-header">';
      html += '<span class="run-id">' + state.runId + '</span>';
      html += '<span class="status ' + state.status + '">' + state.status + '</span>';
      html += '<span style="color:#888">Steps: ' + Object.keys(state.steps || {}).length + '</span>';
      if (state.startedAt) {
        html += '<span style="color:#888">Started: ' + new Date(state.startedAt).toLocaleString() + '</span>';
      }
      if (state.completedAt) {
        const duration = ((state.completedAt - state.startedAt) / 1000).toFixed(1) + 's';
        html += '<span style="color:#888">Duration: ' + duration + '</span>';
      }
      html += '</div>';

      // Steps
      html += '<div class="run-steps">';
      const steps = state.steps || {};
      for (const [stepId, stepState] of Object.entries(steps)) {
        const statusClass = stepState.status || 'pending';
        html += '<div class="run-step">';
        html += '<div class="run-step-header" onclick="toggleStep(this)">';
        html += '<div class="run-step-info">';
        html += '<span class="step-id">' + stepId + '</span>';
        html += '<span class="status ' + statusClass + '">' + statusClass + '</span>';
        if (stepState.durationMs) {
          html += '<span style="color:#888;font-size:0.85em">' + (stepState.durationMs / 1000).toFixed(1) + 's</span>';
        }
        html += '</div>';
        html += '<span style="color:#888">&#9660;</span>';
        html += '</div>';

        html += '<div class="run-step-body">';
        if (stepState.outputFile) {
          html += '<pre class="step-output-' + stepId + '">Loading output...</pre>';
          // Fetch output asynchronously
          setTimeout(() => {
            fetch('/api/run/' + state.runId + '/step/' + stepId)
              .then(res => res.text())
              .then(output => {
                const pre = document.querySelector('.step-output-' + stepId);
                if (pre) pre.textContent = output.substring(0, 5000);
              })
              .catch(() => {});
          }, 0);
        } else if (stepState.error) {
          html += '<pre style="color:#ff6b6b">' + stepState.error + '</pre>';
        } else {
          html += '<pre style="color:#888">No output available</pre>';
        }
        html += '</div>';
        html += '</div>';
      }
      html += '</div></div>';

      // Events timeline
      if (events.length > 0) {
        html += '<div style="margin-top:20px">';
        html += '<h3 style="color:#00d4ff;margin-bottom:10px">Events (' + events.length + ')</h3>';
        html += '<div style="max-height:200px;overflow-y:auto">';
        for (const evt of events.slice(-20)) {
          html += '<div style="padding:5px 0;border-bottom:1px solid #0f3460;color:#888;font-size:0.85em">';
          html += '<span>' + new Date(evt.ts).toLocaleTimeString() + '</span> ';
          html += '<span style="color:#00d4ff">' + evt.event + '</span>';
          html += '</div>';
        }
        html += '</div></div>';
      }

      return html;
    }

    function toggleStep(header) {
      const body = header.nextElementSibling;
      body.classList.toggle('open');
      header.querySelector('span:last-child').textContent = body.classList.contains('open') ? '&#9650;' : '&#9660;';
    }

    // Load data on page load
    loadWorkflows();
    loadRuns();

    // Auto-load DAG or Run if specified in initial params
    const initialWorkflow = window.__INITIAL_WORKFLOW__;
    const initialRun = window.__INITIAL_RUN__;

    if (initialWorkflow) {
      setTimeout(() => showDag(initialWorkflow), 100);
    } else if (initialRun) {
      setTimeout(() => showRun(initialRun), 100);
    }

    // Close modals on click outside
    document.getElementById('dag-modal').addEventListener('click', function(e) {
      if (e.target === this) closeDagModal();
    });
    document.getElementById('run-modal').addEventListener('click', function(e) {
      if (e.target === this) closeRunModal();
    });

    // Close on escape
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') {
        closeDagModal();
        closeRunModal();
      }
    });
  </script>
</body>
</html>`;
  }
}
