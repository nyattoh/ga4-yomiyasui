/**
 * GA4 よみやすい (GA4 Yomiyasui) - アプリケーションコア (app.js)
 * Pure Vanilla JavaScript
 */

// 既定の公開用 OAuth クライアント ID (公式ホスティング用)
const DEFAULT_CLIENT_ID = "382894567890-exampledummyclientid.apps.googleusercontent.com";

// ラベル変換マッピング
const LABEL_MAP = {
  mobile: "スマホ",
  desktop: "パソコン",
  tablet: "タブレット",
  iOS: "iOS（iPhone / iPad）",
  Android: "Android",
  Windows: "Windows",
  Macintosh: "Mac",
  Linux: "Linux",
  "Chrome OS": "ChromeOS"
};

// アプリケーション状態
const state = {
  mode: "demo", // 'demo' | 'live'
  auth: {
    token: null,
    tokenExpiry: null,
    clientId: localStorage.getItem("yomiyasui_custom_client_id") || DEFAULT_CLIENT_ID
  },
  properties: [],
  selectedPropertyId: "demo",
  selectedPeriod: "28d",
  data: {
    overview: null,
    channel: null,
    device: null,
    os: null
  },
  charts: {
    channel: null,
    device: null,
    osSessions: null,
    osUsers: null
  }
};

let tokenClient = null;

// ============================================================================
// 初期化
// ============================================================================
document.addEventListener("DOMContentLoaded", () => {
  setupEventListeners();
  loadDemoData();
  initGIS();
});

function setupEventListeners() {
  // タブ切り替え
  const tabDashboard = document.getElementById("tabDashboard");
  const tabWizard = document.getElementById("tabWizard");
  const dashboardSection = document.getElementById("dashboardSection");
  const wizardSection = document.getElementById("wizardSection");
  const controlBar = document.getElementById("controlBar");

  tabDashboard.addEventListener("click", () => {
    tabDashboard.classList.add("active");
    tabWizard.classList.remove("active");
    dashboardSection.style.display = "block";
    wizardSection.style.display = "none";
    controlBar.style.display = "flex";
  });

  tabWizard.addEventListener("click", () => {
    tabWizard.classList.add("active");
    tabDashboard.classList.remove("active");
    dashboardSection.style.display = "none";
    wizardSection.style.display = "block";
    controlBar.style.display = "none";
  });

  // ウィザード: タグ生成ボタン
  document.getElementById("btnGenerateTag").addEventListener("click", handleGenerateTag);

  // ウィザード: コピーボタン
  document.getElementById("btnCopyTag").addEventListener("click", handleCopyTag);

  // 期間切り替え
  document.querySelectorAll(".btn-period").forEach(btn => {
    btn.addEventListener("click", e => {
      document.querySelectorAll(".btn-period").forEach(b => b.classList.remove("active"));
      e.target.classList.add("active");
      state.selectedPeriod = e.target.dataset.period;
      refreshCurrentView();
    });
  });

  // プロパティ選択
  document.getElementById("propertySelect").addEventListener("change", e => {
    state.selectedPropertyId = e.target.value;
    if (state.selectedPropertyId === "demo") {
      state.mode = "demo";
      updateBadge();
      loadDemoData();
    } else {
      state.mode = "live";
      updateBadge();
      fetchLiveData();
    }
  });

  // 更新ボタン
  document.getElementById("btnRefresh").addEventListener("click", () => {
    if (state.mode === "live") {
      clearCacheForCurrent();
      fetchLiveData();
    } else {
      loadDemoData();
    }
    showToast("データを更新しました");
  });

  // 認証ボタン (ログイン / ログアウト)
  document.getElementById("btnAuth").addEventListener("click", handleAuthButton);

  // 設定モーダル
  const modal = document.getElementById("settingsModal");
  const inputClientId = document.getElementById("customClientId");
  inputClientId.value = localStorage.getItem("yomiyasui_custom_client_id") || "";

  document.getElementById("btnSettings").addEventListener("click", () => {
    modal.classList.add("open");
  });
  document.getElementById("btnCloseSettings").addEventListener("click", () => {
    modal.classList.remove("open");
  });
  document.getElementById("btnSaveClientId").addEventListener("click", () => {
    const val = inputClientId.value.trim();
    if (val) {
      localStorage.setItem("yomiyasui_custom_client_id", val);
      state.auth.clientId = val;
    } else {
      localStorage.removeItem("yomiyasui_custom_client_id");
      state.auth.clientId = DEFAULT_CLIENT_ID;
    }
    modal.classList.remove("open");
    initGIS();
    showToast("設定を保存しました");
  });
  document.getElementById("btnResetClientId").addEventListener("click", () => {
    localStorage.removeItem("yomiyasui_custom_client_id");
    inputClientId.value = "";
    state.auth.clientId = DEFAULT_CLIENT_ID;
    initGIS();
    showToast("既定値に戻しました");
  });
}

// ============================================================================
// Google Identity Services (GIS) 認可フロー
// ============================================================================
function initGIS() {
  if (typeof google === "undefined" || !google.accounts || !google.accounts.oauth2) {
    setTimeout(initGIS, 500);
    return;
  }

  try {
    tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: state.auth.clientId,
      scope: "https://www.googleapis.com/auth/analytics.readonly",
      callback: response => {
        if (response.error) {
          handleAuthError(response.error);
          return;
        }
        state.auth.token = response.access_token;
        state.auth.tokenExpiry = Date.now() + (response.expires_in * 1000);
        state.mode = "live";
        updateAuthUI(true);
        fetchProperties();
      }
    });
  } catch (err) {
    console.error("GIS init failed:", err);
  }
}

function handleAuthButton() {
  if (state.auth.token) {
    // ログアウト処理
    if (google && google.accounts && google.accounts.oauth2) {
      google.accounts.oauth2.revoke(state.auth.token, () => {});
    }
    state.auth.token = null;
    state.auth.tokenExpiry = null;
    state.mode = "demo";
    state.selectedPropertyId = "demo";
    updateAuthUI(false);
    resetPropertyDropdown();
    loadDemoData();
    showToast("ログアウトしました（デモモードに戻ります）");
  } else {
    // ログイン処理
    if (!tokenClient) {
      initGIS();
    }
    if (tokenClient) {
      tokenClient.requestAccessToken({ prompt: "" });
    } else {
      showToast("Google認証コンポーネントを準備中です。少し待って再試行してください");
    }
  }
}

function updateAuthUI(isLoggedIn) {
  const btnAuth = document.getElementById("btnAuth");
  if (isLoggedIn) {
    btnAuth.textContent = "ログアウト";
    btnAuth.classList.remove("btn-primary");
  } else {
    btnAuth.textContent = "Googleでログイン";
    btnAuth.classList.add("btn-primary");
  }
  updateBadge();
}

function updateBadge() {
  const badge = document.getElementById("modeBadge");
  if (state.mode === "live") {
    badge.className = "badge badge-live";
    badge.textContent = "GA4接続中（実データ）";
  } else {
    badge.className = "badge badge-demo";
    badge.textContent = "デモデータ（API未接続）";
  }
}

function handleAuthError(err) {
  console.error("Auth error:", err);
  if (err === "access_denied") {
    showToast("ログインがキャンセルされました。デモモードのまま画面をご覧いただけます。");
  } else if (err === "origin_mismatch") {
    showToast("このURLはGoogleに登録されていません。⚙設定からClient IDを入力してください。");
    document.getElementById("settingsModal").classList.add("open");
  } else {
    showToast(`Googleログインに失敗しました: ${err}`);
  }
}

// ============================================================================
// GA4 Admin API: プロパティ一覧取得
// ============================================================================
async function fetchProperties() {
  showToast("アクセス可能なGA4プロパティを読み込み中...");
  try {
    const res = await fetch("https://analyticsadmin.googleapis.com/v1beta/accountSummaries", {
      headers: { Authorization: `Bearer ${state.auth.token}` }
    });

    if (!res.ok) {
      if (res.status === 403) throw new Error("GA4の閲覧権限がありません。");
      throw new Error(`Admin API エラー (${res.status})`);
    }

    const json = await res.json();
    const props = [];

    if (json.accountSummaries && json.accountSummaries.length > 0) {
      json.accountSummaries.forEach(acc => {
        if (acc.propertySummaries) {
          acc.propertySummaries.forEach(p => {
            const rawId = p.property.replace("properties/", "");
            props.push({ id: rawId, name: `${acc.displayName} > ${p.displayName} (${rawId})` });
          });
        }
      });
    }

    state.properties = props;
    updatePropertyDropdown(props);

    if (props.length > 0) {
      state.selectedPropertyId = props[0].id;
      document.getElementById("propertySelect").value = props[0].id;
      fetchLiveData();
    } else {
      showToast("このアカウントでは閲覧可能なプロパティが見つかりませんでした。");
    }
  } catch (err) {
    console.error("fetchProperties error:", err);
    showToast(`プロパティ一覧の取得に失敗しました: ${err.message}`);
  }
}

function updatePropertyDropdown(props) {
  const sel = document.getElementById("propertySelect");
  sel.innerHTML = "";

  props.forEach(p => {
    const opt = document.createElement("option");
    opt.value = p.id;
    opt.textContent = p.name;
    sel.appendChild(opt);
  });

  const demoOpt = document.createElement("option");
  demoOpt.value = "demo";
  demoOpt.textContent = "── デモサイト（サンプルデータ） ──";
  sel.appendChild(demoOpt);
}

function resetPropertyDropdown() {
  const sel = document.getElementById("propertySelect");
  sel.innerHTML = '<option value="demo">デモサイト（サンプルデータ）</option>';
}

// ============================================================================
// GA4 Data API: レポートデータ取得
// ============================================================================
function getPeriodConfig(period) {
  if (period === "7d") {
    return {
      current: { startDate: "7daysAgo", endDate: "yesterday" },
      previous: { startDate: "14daysAgo", endDate: "8daysAgo" }
    };
  } else if (period === "90d") {
    return {
      current: { startDate: "90daysAgo", endDate: "yesterday" },
      previous: { startDate: "180daysAgo", endDate: "91daysAgo" }
    };
  }
  // 28d (標準)
  return {
    current: { startDate: "28daysAgo", endDate: "yesterday" },
    previous: { startDate: "56daysAgo", endDate: "29daysAgo" }
  };
}

function getCacheKey(propId, period) {
  return `ga4_cache_${propId}_${period}`;
}

function clearCacheForCurrent() {
  const key = getCacheKey(state.selectedPropertyId, state.selectedPeriod);
  sessionStorage.removeItem(key);
}

async function fetchLiveData() {
  const propId = state.selectedPropertyId;
  const period = state.selectedPeriod;
  if (!propId || propId === "demo") {
    loadDemoData();
    return;
  }

  // キャッシュ確認
  const cacheKey = getCacheKey(propId, period);
  const cached = sessionStorage.getItem(cacheKey);
  if (cached) {
    try {
      state.data = JSON.parse(cached);
      renderAll();
      showToast("保存済みキャッシュから表示しました");
      return;
    } catch (_) {}
  }

  showToast("GA4からデータを取得中...");
  const dateConf = getPeriodConfig(period);
  const headers = {
    Authorization: `Bearer ${state.auth.token}`,
    "Content-Type": "application/json"
  };

  try {
    const [overviewCur, overviewPrev, channelRes, deviceRes, osRes] = await Promise.all([
      runReport(propId, dateConf.current, [], ["sessions", "activeUsers", "engagementRate", "keyEvents"], headers),
      runReport(propId, dateConf.previous, [], ["sessions", "activeUsers", "engagementRate", "keyEvents"], headers),
      runReport(propId, dateConf.current, ["sessionDefaultChannelGroup"], ["sessions", "activeUsers"], headers),
      runReport(propId, dateConf.current, ["deviceCategory"], ["sessions", "activeUsers"], headers),
      runReport(propId, dateConf.current, ["operatingSystem"], ["sessions", "activeUsers"], headers)
    ]);

    // 整形
    state.data = {
      overview: {
        current: parseOverviewRow(overviewCur.rows),
        previous: parseOverviewRow(overviewPrev.rows)
      },
      channel: parseRows(channelRes.rows, "sessionDefaultChannelGroup"),
      device: parseRows(deviceRes.rows, "deviceCategory"),
      os: parseRows(osRes.rows, "operatingSystem")
    };

    // キャッシュ保存
    sessionStorage.setItem(cacheKey, JSON.stringify(state.data));
    renderAll();
    showToast("最新データを読み込みました");
  } catch (err) {
    console.error("fetchLiveData error:", err);
    showToast(`データ取得エラー: ${err.message}`);
  }
}

async function runReport(propId, dateRange, dimensions, metrics, headers) {
  const url = `https://analyticsdata.googleapis.com/v1beta/properties/${propId}:runReport`;
  const body = {
    dateRanges: [dateRange],
    dimensions: dimensions.map(name => ({ name })),
    metrics: metrics.map(name => ({ name }))
  };

  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    if (res.status === 429) throw new Error("GA4 APIの読み取り制限（クォータ）に達しました。");
    if (res.status === 403) throw new Error("プロパティの閲覧権限がありません。");
    throw new Error(`Data API エラー (${res.status})`);
  }
  return await res.json();
}

function parseOverviewRow(rows) {
  if (!rows || rows.length === 0 || !rows[0].metricValues) {
    return { sessions: 0, activeUsers: 0, engagementRate: 0, keyEvents: 0 };
  }
  const vals = rows[0].metricValues;
  return {
    sessions: parseInt(vals[0]?.value || "0", 10),
    activeUsers: parseInt(vals[1]?.value || "0", 10),
    engagementRate: parseFloat(vals[2]?.value || "0"),
    keyEvents: parseInt(vals[3]?.value || "0", 10)
  };
}

function parseRows(rows, dimKey) {
  if (!rows) return [];
  return rows.map(r => {
    const rawKey = r.dimensionValues?.[0]?.value || "その他";
    const label = LABEL_MAP[rawKey] || rawKey;
    const sessions = parseInt(r.metricValues?.[0]?.value || "0", 10);
    const users = parseInt(r.metricValues?.[1]?.value || "0", 10);
    return { key: rawKey, label, sessions, users };
  });
}

// ============================================================================
// デモデータ読み込み
// ============================================================================
async function loadDemoData() {
  try {
    const res = await fetch("demo-data.json");
    if (!res.ok) throw new Error("demo-data.json not found");
    state.data = await res.json();
    renderAll();
  } catch (err) {
    console.error("loadDemoData error:", err);
    // フォールバックインライン
    state.data = {
      overview: {
        current: { sessions: 18140, activeUsers: 9890, engagementRate: 0.642, keyEvents: 142 },
        previous: { sessions: 19717, activeUsers: 10520, engagementRate: 0.628, keyEvents: 130 }
      },
      channel: [
        { key: "Organic Search", label: "検索エンジン（無料）", sessions: 9800, users: 5600 },
        { key: "Direct", label: "直接アクセス", sessions: 4200, users: 2300 },
        { key: "Organic Social", label: "SNS", sessions: 2400, users: 1350 }
      ],
      device: [
        { key: "mobile", label: "スマホ", sessions: 12400, users: 7100 },
        { key: "desktop", label: "パソコン", sessions: 5200, users: 2400 },
        { key: "tablet", label: "タブレット", sessions: 540, users: 390 }
      ],
      os: [
        { key: "iOS", label: "iOS（iPhone / iPad）", sessions: 8100, users: 4600 },
        { key: "Android", label: "Android", sessions: 4700, users: 2800 },
        { key: "Windows", label: "Windows", sessions: 3600, users: 1600 },
        { key: "Macintosh", label: "Mac", sessions: 1400, users: 700 }
      ]
    };
    renderAll();
  }
}

function refreshCurrentView() {
  if (state.mode === "live") {
    fetchLiveData();
  } else {
    renderAll();
  }
}

// ============================================================================
// 描画エンジン (Render Engine)
// ============================================================================
function renderAll() {
  if (!state.data) return;
  renderOverview(state.data.overview);
  renderEngagement(state.data.overview?.current);
  renderChannels(state.data.channel);
  renderKeyEvents(state.data.overview?.current);
  renderDevices(state.data.device);
  renderOS(state.data.os);
}

// ユーティリティ
function fmt(num) {
  return (num || 0).toLocaleString("ja-JP");
}
function pct(n, total) {
  if (!total) return "—";
  return Math.round((n / total) * 100) + "%";
}

// 1. 人は来ているか
function renderOverview(overview) {
  if (!overview || !overview.current) return;
  const cur = overview.current;
  const prev = overview.previous || cur;

  const sDiff = prev.sessions > 0 ? ((cur.sessions - prev.sessions) / prev.sessions) * 100 : 0;
  const uDiff = prev.activeUsers > 0 ? ((cur.activeUsers - prev.activeUsers) / prev.activeUsers) * 100 : 0;

  const sSign = sDiff >= 0 ? "+" : "";
  const uSign = uDiff >= 0 ? "+" : "";

  document.getElementById("metricSessions").textContent = fmt(cur.sessions);
  document.getElementById("metricSessionsDiff").textContent = `前期間比: ${sSign}${sDiff.toFixed(1)}%`;
  document.getElementById("metricSessionsDiff").style.color = sDiff >= 0 ? "var(--diff-down)" : "var(--diff-up)";

  document.getElementById("metricUsers").textContent = fmt(cur.activeUsers);
  document.getElementById("metricUsersDiff").textContent = `前期間比: ${uSign}${uDiff.toFixed(1)}%`;
  document.getElementById("metricUsersDiff").style.color = uDiff >= 0 ? "var(--diff-down)" : "var(--diff-up)";

  // 結論文
  const diffTxt = prev.sessions > 0 ? `（前期間比 ${sSign}${sDiff.toFixed(1)}%）` : "";
  document.getElementById("overviewVerdict").textContent =
    `直近の訪問回数は ${fmt(cur.sessions)}回 ${diffTxt}、訪れた人数は ${fmt(cur.activeUsers)}人 です。`;
}

// 2. 見ているか
function renderEngagement(cur) {
  if (!cur) return;
  const ratePct = Math.round((cur.engagementRate || 0) * 100);
  document.getElementById("engagementRateText").textContent = `${ratePct}%`;
  document.getElementById("engagementBar").style.width = `${ratePct}%`;

  let verdict = `訪問者のうち ${ratePct}% がサイトをしっかり見ています。`;
  if (ratePct >= 60) {
    verdict += " 滞在・閲覧状況は良好です。";
  } else if (ratePct < 40) {
    verdict += " 直帰せずじっくり見てもらうための動線改善が検討できます。";
  }
  document.getElementById("engagementVerdict").textContent = verdict;
}

// 3. どこから来たか
function renderChannels(channelRows) {
  if (!channelRows || channelRows.length === 0) return;
  const sorted = [...channelRows].sort((a, b) => b.sessions - a.sessions).slice(0, 6);
  const totalS = channelRows.reduce((a, r) => a + r.sessions, 0);
  const totalU = channelRows.reduce((a, r) => a + r.users, 0);

  // 結論文
  const top1 = sorted[0];
  const topPct = pct(top1.sessions, totalS);
  document.getElementById("channelVerdict").textContent =
    `最も多い流入は「${top1.label}」で、全体の ${topPct}（${fmt(top1.sessions)}回）を占めています。`;

  // 表
  const tbody = document.getElementById("channelTable");
  tbody.innerHTML = sorted.map(r => `
    <tr>
      <td>${r.label}</td>
      <td class="num">${fmt(r.sessions)}</td>
      <td class="num">${pct(r.sessions, totalS)}</td>
      <td class="num">${fmt(r.users)}</td>
      <td class="num">${pct(r.users, totalU)}</td>
    </tr>
  `).join("");

  // グラフ
  destroyChart("channel");
  const ctx = document.getElementById("channelChart").getContext("2d");
  state.charts.channel = new Chart(ctx, {
    type: "bar",
    data: {
      labels: sorted.map(r => r.label),
      datasets: [{
        label: "回数",
        data: sorted.map(r => r.sessions),
        backgroundColor: "#3b82f6",
        borderRadius: 4
      }]
    },
    options: {
      indexAxis: "y",
      responsive: true,
      plugins: {
        legend: { display: false },
        title: { display: true, text: "流入経路別の回数（上位）" }
      },
      scales: {
        x: { ticks: { callback: v => fmt(v) } }
      }
    }
  });
}

// 4. 成果はあるか
function renderKeyEvents(cur) {
  if (!cur) return;
  const count = cur.keyEvents || 0;
  document.getElementById("metricKeyEvents").textContent = fmt(count);

  if (count > 0) {
    document.getElementById("keyEventsVerdict").textContent =
      `期間中に ${fmt(count)}回 の目標アクション（キーイベント）が達成されました。`;
  } else {
    document.getElementById("keyEventsVerdict").textContent =
      `成果アクションは 0回 です。サイトの目標（お問い合わせや購入など）が GA4 側でまだ「キーイベント」として設定されていない可能性があります。`;
  }
}

// 5. どんな端末か
function renderDevices(deviceRows) {
  if (!deviceRows || deviceRows.length === 0) return;
  const totalS = deviceRows.reduce((a, r) => a + r.sessions, 0);
  const totalU = deviceRows.reduce((a, r) => a + r.users, 0);

  const mobile = deviceRows.find(d => d.key === "mobile") || { sessions: 0, users: 0 };
  const mSPct = totalS ? Math.round((mobile.sessions / totalS) * 100) : 0;
  const mUPct = totalU ? Math.round((mobile.users / totalU) * 100) : 0;

  // 結論文 (5pt乖離リピート判定)
  let verdict = `回数ではスマホ ${mSPct}%、人数ではスマホ ${mUPct}% を占めています。`;
  const diff = mSPct - mUPct;
  if (diff >= 5) {
    verdict += " スマホ利用者はパソコン利用者に比べて、1人あたりの訪問頻度（リピート）が高い傾向があります。";
  } else if (diff <= -5) {
    verdict += " パソコン利用者はスマホ利用者に比べて、1人あたりの訪問頻度（リピート）が高い傾向があります。";
  }
  document.getElementById("deviceVerdict").textContent = verdict;

  // 表
  const tbody = document.getElementById("deviceTable");
  tbody.innerHTML = deviceRows.map(r => `
    <tr>
      <td>${r.label}</td>
      <td class="num">${fmt(r.sessions)}</td>
      <td class="num">${pct(r.sessions, totalS)}</td>
      <td class="num">${fmt(r.users)}</td>
      <td class="num">${pct(r.users, totalU)}</td>
    </tr>
  `).join("");

  // 100% 積み上げ横棒
  destroyChart("device");
  const ctx = document.getElementById("deviceChart").getContext("2d");
  const colors = ["#2f6f4e", "#3d5a80", "#c4a35a", "#94a3b8"];

  state.charts.device = new Chart(ctx, {
    type: "bar",
    data: {
      labels: ["回数（セッション）", "人数（ユーザー）"],
      datasets: deviceRows.map((d, i) => ({
        label: d.label,
        data: [
          totalS ? (d.sessions / totalS) * 100 : 0,
          totalU ? (d.users / totalU) * 100 : 0
        ],
        backgroundColor: colors[i % colors.length],
        stack: "deviceStack"
      }))
    },
    options: {
      indexAxis: "y",
      responsive: true,
      plugins: {
        legend: { position: "bottom" },
        title: { display: true, text: "端末の内訳（%）" },
        tooltip: {
          callbacks: {
            label: context => {
              const label = context.dataset.label || "";
              const val = context.parsed.x.toFixed(1) + "%";
              return `${label}: ${val}`;
            }
          }
        }
      },
      scales: {
        x: { stacked: true, max: 100, ticks: { callback: v => v + "%" } },
        y: { stacked: true }
      }
    }
  });
}

// 6. どの OS か
function renderOS(osRows) {
  if (!osRows || osRows.length === 0) return;
  const sorted = [...osRows].sort((a, b) => b.sessions - a.sessions).slice(0, 6);
  const totalS = osRows.reduce((a, r) => a + r.sessions, 0);
  const totalU = osRows.reduce((a, r) => a + r.users, 0);

  // 結論文
  const topOS = sorted[0];
  document.getElementById("osVerdict").textContent =
    `回数も人数も「${topOS.label}」が最多（全体の ${pct(topOS.sessions, totalS)}）です。`;

  // 表
  const tbody = document.getElementById("osTable");
  tbody.innerHTML = sorted.map(r => `
    <tr>
      <td>${r.label}</td>
      <td class="num">${fmt(r.sessions)}</td>
      <td class="num">${pct(r.sessions, totalS)}</td>
      <td class="num">${fmt(r.users)}</td>
      <td class="num">${pct(r.users, totalU)}</td>
    </tr>
  `).join("");

  // 横棒2枚 (回数 / 人数)
  destroyChart("osSessions");
  destroyChart("osUsers");

  const labels = sorted.map(r => r.label);

  const ctxS = document.getElementById("osSessions").getContext("2d");
  state.charts.osSessions = new Chart(ctxS, {
    type: "bar",
    data: {
      labels,
      datasets: [{
        label: "回数",
        data: sorted.map(r => r.sessions),
        backgroundColor: "#2f6f4e",
        borderRadius: 4
      }]
    },
    options: {
      indexAxis: "y",
      responsive: true,
      plugins: {
        legend: { display: false },
        title: { display: true, text: "OS別の回数" }
      },
      scales: {
        x: { ticks: { callback: v => fmt(v) } }
      }
    }
  });

  const ctxU = document.getElementById("osUsers").getContext("2d");
  state.charts.osUsers = new Chart(ctxU, {
    type: "bar",
    data: {
      labels,
      datasets: [{
        label: "人数",
        data: sorted.map(r => r.users),
        backgroundColor: "#3d5a80",
        borderRadius: 4
      }]
    },
    options: {
      indexAxis: "y",
      responsive: true,
      plugins: {
        legend: { display: false },
        title: { display: true, text: "OS別の人数" }
      },
      scales: {
        x: { ticks: { callback: v => fmt(v) } }
      }
    }
  });
}

function destroyChart(name) {
  if (state.charts[name]) {
    state.charts[name].destroy();
    state.charts[name] = null;
  }
}

function showToast(msg) {
  const toast = document.getElementById("toast");
  toast.textContent = msg;
  toast.classList.add("show");
  setTimeout(() => {
    toast.classList.remove("show");
  }, 3200);
}

// ============================================================================
// GA4 かんたん初期設定ウィザード (Tag Generator)
// ============================================================================
function handleGenerateTag() {
  const siteName = document.getElementById("wizardSiteName").value.trim() || "マイサイト";
  const siteUrl = document.getElementById("wizardSiteUrl").value.trim() || "https://example.com";
  const siteType = document.querySelector('input[name="wizardSiteType"]:checked')?.value || "corporate";

  const goalInquiry = document.getElementById("goalInquiry").checked;
  const goalDocument = document.getElementById("goalDocument").checked;
  const goalTel = document.getElementById("goalTel").checked;
  const goalMember = document.getElementById("goalMember").checked;
  const goalPurchase = document.getElementById("goalPurchase").checked;

  // 測定IDのプレースホルダー（ログイン中でプロパティ選択済みの場合は反映）
  let measurementId = "G-XXXXXXXXXX";
  if (state.mode === "live" && state.selectedPropertyId && state.selectedPropertyId !== "demo") {
    measurementId = `G-PROP${state.selectedPropertyId.slice(-6)}`;
  }

  // 自動計測イベント設定
  const events = [];
  if (goalInquiry) {
    events.push(`    // ✉️ お問い合わせ完了（サンクスページ等）の計測
    if (window.location.pathname.includes('thanks') || window.location.pathname.includes('complete')) {
      gtag('event', 'generate_lead', {
        event_category: 'contact',
        event_label: '${siteName} お問い合わせ完了'
      });
    }`);
  }
  if (goalDocument) {
    events.push(`    // 📄 PDF等の資料ダウンロード自動検知
    document.addEventListener('click', function(e) {
      const a = e.target.closest('a');
      if (a && a.href && a.href.match(/\\.(pdf|xlsx?|docx?)$/i)) {
        gtag('event', 'file_download', {
          file_name: a.href.split('/').pop(),
          link_url: a.href
        });
      }
    });`);
  }
  if (goalTel) {
    events.push(`    // 📞 電話タップの自動検知
    document.addEventListener('click', function(e) {
      const a = e.target.closest('a');
      if (a && a.href && a.href.startsWith('tel:')) {
        gtag('event', 'click', {
          event_category: 'tel',
          event_label: a.href
        });
      }
    });`);
  }
  if (goalMember) {
    events.push(`    // 👤 会員登録完了の検知
    if (window.location.pathname.includes('register/success') || window.location.pathname.includes('signup-complete')) {
      gtag('event', 'sign_up', {
        method: 'email'
      });
    }`);
  }
  if (goalPurchase) {
    events.push(`    // 💳 購入完了の検知
    if (window.location.pathname.includes('order/complete') || window.location.pathname.includes('checkout/thankyou')) {
      gtag('event', 'purchase', {
        transaction_id: 'ORDER_' + Date.now(),
        currency: 'JPY'
      });
    }`);
  }

  const customEventsCode = events.length > 0 
    ? `\n    // ── 自動成果（キーイベント）トラッキング ──\n${events.join("\n\n")}\n` 
    : "";

  const snippet = `<!-- Google tag (gtag.js) - ${siteName} 用 -->
<script async src="https://www.googletagmanager.com/gtag/js?id=${measurementId}"><\/script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());

  // 基本PV計測
  gtag('config', '${measurementId}');

  // ページ読み込み完了時に成果トラッキングを初期化
  window.addEventListener('DOMContentLoaded', function() {${customEventsCode}  });
<\/script>`;

  document.getElementById("generatedTagCode").textContent = snippet;
  const resultArea = document.getElementById("wizardResult");
  resultArea.style.display = "block";
  resultArea.scrollIntoView({ behavior: "smooth", block: "start" });

  showToast("計測タグを生成しました！コピーしてサイトに貼り付けてください");
}

function handleCopyTag() {
  const code = document.getElementById("generatedTagCode").textContent;
  if (!code) return;

  navigator.clipboard.writeText(code).then(() => {
    const btn = document.getElementById("btnCopyTag");
    const originalText = btn.textContent;
    btn.textContent = "✅ コピー完了！";
    btn.style.backgroundColor = "#10b981";
    btn.style.color = "#ffffff";
    setTimeout(() => {
      btn.textContent = originalText;
      btn.style.backgroundColor = "";
      btn.style.color = "";
    }, 2500);
    showToast("クリップボードにコピーしました！");
  }).catch(err => {
    console.error("Copy failed:", err);
    showToast("コピーに失敗しました。手動で選択してコピーしてください");
  });
}

