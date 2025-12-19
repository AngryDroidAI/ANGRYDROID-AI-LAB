const API_BASE = window.location.origin; // e.g. http://localhost:8080

let costChart, latencyChart, divisionChart;

// Simple local counters
let totalQueries = 0;
let totalCost = 0;
let latencies = [];

// --- Helpers ---

function $(id) {
  return document.getElementById(id);
}

function addLog(message) {
  const logs = $("logs");
  const li = document.createElement("li");
  const time = new Date().toLocaleTimeString();
  li.innerHTML = `<span class="log-time">${time}</span> ${message}`;
  logs.prepend(li);
  while (logs.children.length > 50) logs.removeChild(logs.lastChild);
}

function addActiveQuery(query) {
  const list = $("active-queries");
  const li = document.createElement("li");
  const time = new Date().toLocaleTimeString();
  li.innerHTML = `<span class="log-time">${time}</span> ${query}`;
  list.prepend(li);
  while (list.children.length > 20) list.removeChild(list.lastChild);
}

// --- Health & Metrics (synthetic for now) ---

async function refreshHealth() {
  try {
    const res = await fetch(`${API_BASE}/api/health`);
    const data = await res.json();

    $("metric-health-text").textContent = data.status.toUpperCase();
    const pill = $("health-indicator");
    if (data.status === "ok") {
      pill.textContent = "OK";
      pill.className = "pill pill-ok";
    } else {
      pill.textContent = "SLOW";
      pill.className = "pill pill-slow";
    }
  } catch {
    const pill = $("health-indicator");
    pill.textContent = "DOWN";
    pill.className = "pill pill-bad";
  }
}

// --- Query Routing ---

async function routeQuery() {
  const query = $("query-input").value.trim();
  if (!query) return;

  addActiveQuery(query);

  const t0 = performance.now();
  try {
    const res = await fetch(`${API_BASE}/api/route-query`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query })
    });
    const data = await res.json();
    const t1 = performance.now();
    const latency = Math.round(t1 - t0);

    $("query-result-output").textContent = JSON.stringify(data, null, 2);

    // Update metrics
    totalQueries += 1;
    latencies.push(latency);
    const estCost = data.cost ? data.cost * 0.5 : 0.0005;
    totalCost += estCost;

    $("metric-queries").textContent = totalQueries;
    $("metric-latency").textContent = `${latency}ms`;
    $("metric-cost").textContent = `$${totalCost.toFixed(4)}`;
    $("metric-models").textContent = `2/2`; // static for now

    // Model inspector
    $("mi-id").textContent = data.routed_to || "—";
    $("mi-endpoint").textContent = data.endpoint || "—";
    $("mi-cost").textContent = data.cost != null ? `$${data.cost}` : "—";
    $("mi-latency").textContent = data.latency_sla != null ? `${data.latency_sla}ms` : "—";
    $("mi-specialization").textContent = (data.specialization || []).join(", ") || "—";
    $("mi-division").textContent = data.division || "—";

    // Charts
    updateLatencyChart(latency);
    updateDivisionActivity(data.division || "unknown");

    addLog(`Routed query to ${data.routed_to || "fallback"}`);
  } catch (err) {
    $("query-result-output").textContent = `Error: ${err.message}`;
    addLog(`Error routing query: ${err.message}`);
  }
}

// --- WebSocket Logs ---

function initWebSocket() {
  let ws;
  const statusEl = $("ws-status");

  function connect() {
    ws = new WebSocket(`ws://${window.location.host}/ws/logs`);

    ws.onopen = () => {
      statusEl.textContent = "WS: CONNECTED";
      statusEl.className = "pill pill-ok";
      addLog("WebSocket connected.");
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        addLog(data.message || "Log event");
      } catch {
        addLog(event.data);
      }
    };

    ws.onclose = () => {
      statusEl.textContent = "WS: DISCONNECTED";
      statusEl.className = "pill pill-disconnected";
      addLog("WebSocket disconnected, retrying in 3s...");
      setTimeout(connect, 3000);
    };

    ws.onerror = () => {
      statusEl.textContent = "WS: ERROR";
      statusEl.className = "pill pill-bad";
    };
  }

  connect();
}

// --- Charts ---

function initCharts() {
  const costCtx = $("cost-chart").getContext("2d");
  const latencyCtx = $("latency-chart").getContext("2d");
  const divisionCtx = $("division-chart").getContext("2d");

  costChart = new Chart(costCtx, {
    type: "bar",
    data: {
      labels: ["Chief", "Senior"],
      datasets: [{
        label: "Cost per 1k tokens ($)",
        data: [0.008, 0.0005],
        backgroundColor: [ "#ff4b9a", "#35e2ff" ]
      }]
    },
    options: {
      plugins: { legend: { display: false } },
      scales: {
        y: { beginAtZero: true }
      }
    }
  });

  latencyChart = new Chart(latencyCtx, {
    type: "line",
    data: {
      labels: ["0-100ms", "100-500ms", "500-1000ms", "1000-2000ms", "2000ms+"],
      datasets: [{
        label: "Latency (count)",
        data: [0, 0, 0, 0, 0],
        borderColor: "#35e2ff",
        backgroundColor: "rgba(53,226,255,0.2)",
        tension: 0.3,
        fill: true
      }]
    },
    options: {
      plugins: { legend: { display: false } },
      scales: {
        y: { beginAtZero: true, ticks: { stepSize: 1 } }
      }
    }
  });

  divisionChart = new Chart(divisionCtx, {
    type: "bar",
    data: {
      labels: ["executive", "engineering", "vision", "research", "ops", "creative", "routing", "safety", "experimental", "unknown"],
      datasets: [{
        label: "Queries (session)",
        data: new Array(10).fill(0),
        backgroundColor: "#ff9fd0"
      }]
    },
    options: {
      plugins: { legend: { display: false } },
      indexAxis: "y",
      scales: { x: { beginAtZero: true } }
    }
  });
}

function updateLatencyChart(latency) {
  const d = latencyChart.data.datasets[0].data;
  if (latency <= 100) d[0] += 1;
  else if (latency <= 500) d[1] += 1;
  else if (latency <= 1000) d[2] += 1;
  else if (latency <= 2000) d[3] += 1;
  else d[4] += 1;
  latencyChart.update();
}

function updateDivisionActivity(division) {
  const map = {
    executive: 0,
    engineering: 1,
    vision_perception: 2,
    research_development: 3,
    operations_infrastructure: 4,
    creative_ux: 5,
    routing_glue: 6,
    safety_sentiment: 7,
    experimental: 8,
    unknown: 9
  };
  const idx = map[division] ?? 9;
  divisionChart.data.datasets[0].data[idx] += 1;
  divisionChart.update();
}

// --- Org Tree (static, sample) ---

function initOrgTree() {
  const tree = `
ANGRYDROID AI LAB
├─ EXECUTIVE
│  └─ Chief Strategy Officer → mistral-large-3-675b
└─ ENGINEERING
   └─ Senior Code Generation Engineer → deepseek-coder-v2-16b
`.trim();
  $("org-tree").textContent = tree;
}

// --- Roster (static sample, derived from YAML concept) ---

function initRoster() {
  const roster = [
    {
      title: "Chief Strategy Officer (CSO)",
      model: "mistral-large-3-675b",
      dept: "Executive",
      cost: "$0.008 / 1k tokens",
      sla: "2000ms"
    },
    {
      title: "Senior Code Generation Engineer",
      model: "deepseek-coder-v2-16b",
      dept: "Engineering",
      cost: "$0.0005 / 1k tokens",
      sla: "300ms"
    }
  ];

  const container = $("roster-list");
  container.innerHTML = "";
  roster.forEach(item => {
    const div = document.createElement("div");
    div.className = "roster-item";
    div.innerHTML = `
      <div class="roster-item-title">${item.title}</div>
      <div class="roster-item-meta">Model: ${item.model}</div>
      <div class="roster-item-meta">Dept: ${item.dept}</div>
      <div class="roster-item-meta">Cost: ${item.cost}</div>
      <div class="roster-item-meta">SLA: ${item.sla}</div>
    `;
    container.appendChild(div);
  });
}

// --- Tabs (currently cosmetic) ---

function initTabs() {
  const tabs = document.querySelectorAll(".tab");
  tabs.forEach(tab => {
    tab.addEventListener("click", () => {
      tabs.forEach(t => t.classList.remove("active"));
      tab.classList.add("active");
      // Filtering could be implemented here in future
    });
  });
}

// --- Query Examples ---

function loadExample() {
  const examples = [
    "Design a microservices architecture for a fintech platform handling 1M TPS.",
    "Debug this Python error: 'AttributeError: module 'numpy' has no attribute 'int''.",
    "Analyze this product roadmap strategy for potential risks.",
    "Draft a research hypothesis for quantum-inspired optimization."
  ];
  const ex = examples[Math.floor(Math.random() * examples.length)];
  $("query-input").value = ex;
}

// --- Init ---

window.addEventListener("DOMContentLoaded", () => {
  initCharts();
  initOrgTree();
  initRoster();
  initTabs();
  initWebSocket();
  refreshHealth();

  $("route-query-btn").addEventListener("click", routeQuery);
  $("clear-query-btn").addEventListener("click", () => {
    $("query-input").value = "";
    $("query-result-output").textContent = "{}";
  });
  $("load-example-btn").addEventListener("click", loadExample);
  $("refresh-btn").addEventListener("click", () => {
    refreshHealth();
    addLog("Manual refresh triggered.");
  });
});

