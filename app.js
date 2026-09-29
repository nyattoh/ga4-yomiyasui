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
  isConfigured: localStorage.getItem("yomiyasui_configured") === "true",
  auth: {
    token: null,
    tokenExpiry: null,
    clientId: localStorage.getItem("yomiyasui_custom_client_id") || DEFAULT_CLIENT_ID
  },
  properties: [],
  accounts: [],
  selectedPropertyId: "demo",
  selectedPeriod: "28d",
  data: {
    overview: null,
    channel: null,
    device: null,
    os: null,
    location: null
  },
  charts: {
    channel: null,
    device: null,
    osSessions: null,
    osUsers: null,
    location: null
  }
};

let tokenClient = null;

// ============================================================================
// 初期化
// ============================================================================
document.addEventListener("DOMContentLoaded", () => {
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get("demo") === "1") {
    state.isConfigured = true;
  }

  setupEventListeners();
  updateConfigurationGate();
  loadDemoData();
  initGIS();
  setupAIAdvisor();

  if (urlParams.get("tab") === "wizard") {
    document.getElementById("tabWizard")?.click();
  }
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
    updateConfigurationGate();
  });

  tabWizard.addEventListener("click", () => {
    tabWizard.classList.add("active");
    tabDashboard.classList.remove("active");
    dashboardSection.style.display = "none";
    wizardSection.style.display = "block";
    controlBar.style.display = "none";
  });

  // 初期設定ゲートのボタン
  document.getElementById("btnGoWizard")?.addEventListener("click", () => {
    tabWizard.click();
  });
  document.getElementById("btnUnlockDemo")?.addEventListener("click", () => {
    state.isConfigured = true;
    updateConfigurationGate();
    showToast("サンプル画面（デモ）を表示しました");
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
      resetViewToLoading();
      refreshCurrentView();
    });
  });

  // プロパティ選択
  document.getElementById("propertySelect").addEventListener("change", e => {
    state.selectedPropertyId = e.target.value;
    resetViewToLoading();
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
    resetViewToLoading();
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

  function openSettingsModal() {
    const originCode = document.getElementById("currentOriginCode");
    if (originCode) originCode.textContent = window.location.origin;
    modal.classList.add("open");
  }

  document.getElementById("btnSettings").addEventListener("click", openSettingsModal);
  document.getElementById("btnOpenSettingsFromWizard")?.addEventListener("click", openSettingsModal);
  
  document.getElementById("btnCloseSettings").addEventListener("click", () => {
    modal.classList.remove("open");
  });
  document.getElementById("btnCloseSettingsBottom")?.addEventListener("click", () => {
    modal.classList.remove("open");
  });

  document.getElementById("btnCopyOrigin")?.addEventListener("click", () => {
    navigator.clipboard.writeText(window.location.origin).then(() => {
      showToast("現在のURL（生成元）をコピーしました！");
    }).catch(() => {
      showToast("コピーに失敗しました");
    });
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
    showToast("クライアントIDを保存しました！「Googleでログイン」をお試しください");
  });
  document.getElementById("btnResetClientId").addEventListener("click", () => {
    localStorage.removeItem("yomiyasui_custom_client_id");
    inputClientId.value = "";
    state.auth.clientId = DEFAULT_CLIENT_ID;
    initGIS();
    showToast("既定値に戻しました");
  });

  // 権限エラーモーダルの閉じるボタン
  const permModal = document.getElementById("permissionModal");
  document.getElementById("btnClosePermissionModal")?.addEventListener("click", () => {
    permModal.classList.remove("open");
  });
  document.getElementById("btnClosePermissionModalBottom")?.addEventListener("click", () => {
    permModal.classList.remove("open");
  });

  // ウィザード作成モードの切り替え (auto vs manual)
  document.querySelectorAll('input[name="wizardMode"]').forEach(radio => {
    radio.addEventListener("change", e => {
      const isManual = e.target.value === "manual";
      const manualGroup = document.getElementById("wizardManualMeasurementIdGroup");
      const accountGroup = document.getElementById("wizardAccountGroup");
      if (manualGroup) manualGroup.style.display = isManual ? "block" : "none";
      if (accountGroup) accountGroup.style.display = (!isManual && state.auth.token) ? "block" : "none";
    });
  });

  // 権限エラーモーダル内の「手動作成モードに切り替える」ボタン
  document.getElementById("btnSwitchToManualMode")?.addEventListener("click", () => {
    permModal.classList.remove("open");
    tabWizard.click();
    const manualRadio = document.querySelector('input[name="wizardMode"][value="manual"]');
    if (manualRadio) {
      manualRadio.checked = true;
      manualRadio.dispatchEvent(new Event("change"));
    }
    const manualGroup = document.getElementById("wizardManualMeasurementIdGroup");
    if (manualGroup) {
      manualGroup.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    showToast("「計測タグだけ生成（手動用）」モードに切り替えました");
  });
}

function showPermissionErrorModal(detailText) {
  const permModal = document.getElementById("permissionModal");
  const detailEl = document.getElementById("permissionErrorDetail");
  if (detailEl) {
    detailEl.innerHTML = `<strong>⚠️ 発生したエラー:</strong><br />${detailText}`;
  }
  if (permModal) {
    permModal.classList.add("open");
  }
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
      scope: "https://www.googleapis.com/auth/analytics https://www.googleapis.com/auth/analytics.edit https://www.googleapis.com/auth/analytics.readonly",
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

function updateConfigurationGate() {
  const unconfiguredGate = document.getElementById("unconfiguredGate");
  const reportBlocks = document.getElementById("reportBlocks");
  const controlBar = document.getElementById("controlBar");

  if (!state.isConfigured) {
    if (unconfiguredGate) unconfiguredGate.style.display = "block";
    if (reportBlocks) reportBlocks.style.display = "none";
    if (controlBar) controlBar.style.display = "none";
  } else {
    if (unconfiguredGate) unconfiguredGate.style.display = "none";
    if (reportBlocks) reportBlocks.style.display = "block";
    if (controlBar) controlBar.style.display = "flex";
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
    // Client ID がダミーまたは未設定の場合は、Googleの 401 エラー画面を出さずに設定モーダルを開く
    const isDummy = !state.auth.clientId || state.auth.clientId === DEFAULT_CLIENT_ID || state.auth.clientId.includes("exampledummyclientid");
    if (isDummy) {
      const originCode = document.getElementById("currentOriginCode");
      if (originCode) originCode.textContent = window.location.origin;
      document.getElementById("settingsModal").classList.add("open");
      showToast("Google ログインには OAuth クライアント ID が必要です。取得手順をご確認ください");
      return;
    }

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
  const wizardAuthBanner = document.getElementById("wizardAuthBanner");
  const wizardAccountGroup = document.getElementById("wizardAccountGroup");

  if (isLoggedIn) {
    btnAuth.textContent = "ログアウト";
    btnAuth.classList.remove("btn-primary");
    if (wizardAuthBanner) {
      wizardAuthBanner.style.background = "#dcfce7";
      wizardAuthBanner.style.borderColor = "#bbf7d0";
      wizardAuthBanner.innerHTML = `
        <div>
          <strong style="color: #166534; font-size: 0.95rem;">✅ Google アカウント接続完了</strong>
          <p style="margin: 2px 0 0; font-size: 0.825rem; color: #14532d;">GA4の作成権限が確認されました。下のフォームから直接GA4へ自動反映できます。</p>
        </div>
      `;
    }
    if (wizardAccountGroup) wizardAccountGroup.style.display = "block";
  } else {
    btnAuth.textContent = "Googleでログイン";
    btnAuth.classList.add("btn-primary");
    if (wizardAuthBanner) {
      wizardAuthBanner.style.background = "#fef3c7";
      wizardAuthBanner.style.borderColor = "#fde68a";
      wizardAuthBanner.innerHTML = `
        <div>
          <strong style="color: #92400e; font-size: 0.95rem;">⚠️ Google アカウント未ログイン</strong>
          <p style="margin: 2px 0 0; font-size: 0.825rem; color: #78350f;">ログインすると、ボタン1つであなたの Google アナリティクスにプロパティとキーイベントが自動作成されます。</p>
        </div>
        <button id="btnWizardLogin" class="btn btn-primary" style="font-size: 0.85rem;">Googleでログイン</button>
      `;
      document.getElementById("btnWizardLogin")?.addEventListener("click", handleAuthButton);
    }
    if (wizardAccountGroup) wizardAccountGroup.style.display = "none";
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
// GA4 Admin API: プロパティ＆アカウント一覧取得
// ============================================================================
async function fetchProperties() {
  showToast("アクセス可能なGA4プロパティとアカウントを読み込み中...");
  try {
    const res = await fetch("https://analyticsadmin.googleapis.com/v1beta/accountSummaries", {
      headers: { Authorization: `Bearer ${state.auth.token}` }
    });

    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      const rawMsg = errJson.error?.message || "";
      if (res.status === 403) {
        showPermissionErrorModal(
          `Google Analytics へのアクセスが拒否されました（403 Forbidden）。<br /><br />` +
          `<strong>Google API からのメッセージ:</strong><br /><code>${rawMsg || "権限が不足しています。"}</code>`
        );
        throw new Error("Google Cloud で Admin API が有効化されていないか、Google アナリティクスの権限が不足しています。");
      }
      throw new Error(`Admin API エラー (${res.status}): ${rawMsg || res.statusText}`);
    }

    const json = await res.json();
    const props = [];
    const accounts = [];

    if (json.accountSummaries && json.accountSummaries.length > 0) {
      json.accountSummaries.forEach(acc => {
        // アカウントリスト
        accounts.push({ id: acc.account, name: acc.displayName });

        // プロパティリスト
        if (acc.propertySummaries) {
          acc.propertySummaries.forEach(p => {
            const rawId = p.property.replace("properties/", "");
            props.push({ id: rawId, name: `${acc.displayName} > ${p.displayName} (${rawId})` });
          });
        }
      });
    }

    state.properties = props;
    state.accounts = accounts;
    updatePropertyDropdown(props);
    updateWizardAccountDropdown(accounts);

    if (props.length > 0) {
      state.selectedPropertyId = props[0].id;
      document.getElementById("propertySelect").value = props[0].id;
      fetchLiveData();
    } else {
      showToast("閲覧可能なプロパティがまだありません。初期設定ウィザードで新規作成できます！");
    }
  } catch (err) {
    console.error("fetchProperties error:", err);
    showToast(`プロパティ一覧の取得に失敗しました: ${err.message}`);
  }
}

function updateWizardAccountDropdown(accounts) {
  const sel = document.getElementById("wizardAccountSelect");
  if (!sel) return;
  sel.innerHTML = "";

  if (accounts.length === 0) {
    sel.innerHTML = '<option value="">アカウントが見つかりません</option>';
    return;
  }

  accounts.forEach(a => {
    const opt = document.createElement("option");
    opt.value = a.id; // e.g. "accounts/12345"
    opt.textContent = `${a.name} (${a.id.replace("accounts/", "")})`;
    sel.appendChild(opt);
  });
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

function resetViewToLoading() {
  // 1. 人は来ているか
  const ovVerdict = document.getElementById("overviewVerdict");
  if (ovVerdict) ovVerdict.textContent = "データを読み込み中...";
  const mS = document.getElementById("metricSessions");
  if (mS) mS.textContent = "-";
  const mSDiff = document.getElementById("metricSessionsDiff");
  if (mSDiff) mSDiff.textContent = "前期間比: -";
  const mU = document.getElementById("metricUsers");
  if (mU) mU.textContent = "-";
  const mUDiff = document.getElementById("metricUsersDiff");
  if (mUDiff) mUDiff.textContent = "前期間比: -";

  // 2. 見ているか
  const engVerdict = document.getElementById("engagementVerdict");
  if (engVerdict) engVerdict.textContent = "データを読み込み中...";
  const engText = document.getElementById("engagementRateText");
  if (engText) engText.textContent = "0%";
  const engBar = document.getElementById("engagementBar");
  if (engBar) engBar.style.width = "0%";

  // 3. どこから来たか
  const chVerdict = document.getElementById("channelVerdict");
  if (chVerdict) chVerdict.textContent = "データを読み込み中...";
  const chTable = document.getElementById("channelTable");
  if (chTable) chTable.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 24px; color: var(--text-muted);">データを取得中...</td></tr>';
  destroyChart("channel");

  // 4. 成果はあるか
  const keyVerdict = document.getElementById("keyEventsVerdict");
  if (keyVerdict) keyVerdict.textContent = "データを読み込み中...";
  const mKey = document.getElementById("metricKeyEvents");
  if (mKey) mKey.textContent = "-";

  // 5. どんな端末か
  const devVerdict = document.getElementById("deviceVerdict");
  if (devVerdict) devVerdict.textContent = "データを読み込み中...";
  const devTable = document.getElementById("deviceTable");
  if (devTable) devTable.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 24px; color: var(--text-muted);">データを取得中...</td></tr>';
  destroyChart("device");

  // 6. どの OS か
  const osVerdict = document.getElementById("osVerdict");
  if (osVerdict) osVerdict.textContent = "データを読み込み中...";
  const osTable = document.getElementById("osTable");
  if (osTable) osTable.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 24px; color: var(--text-muted);">データを取得中...</td></tr>';
  destroyChart("osSessions");
  destroyChart("osUsers");

  // 7. どの国・地域からか
  const locVerdict = document.getElementById("locationVerdict");
  if (locVerdict) locVerdict.textContent = "データを読み込み中...";
  const locTable = document.getElementById("locationTable");
  if (locTable) locTable.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 24px; color: var(--text-muted);">データを取得中...</td></tr>';
  destroyChart("location");

  // AIアドバイザーの回答枠を閉じる
  const aiBox = document.getElementById("aiResponseBox");
  if (aiBox) aiBox.style.display = "none";
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
    // 各クエリを安全に実行（どれか1つが失敗しても他は表示できるようにフォールバック）
    const [overviewCur, overviewPrev, channelRes, deviceRes, osRes, locationRes] = await Promise.all([
      runReportSafe(propId, dateConf.current, [], ["sessions", "activeUsers", "engagementRate", "keyEvents"], headers),
      runReportSafe(propId, dateConf.previous, [], ["sessions", "activeUsers", "engagementRate", "keyEvents"], headers),
      runReportSafe(propId, dateConf.current, ["sessionDefaultChannelGroup"], ["sessions", "activeUsers"], headers),
      runReportSafe(propId, dateConf.current, ["deviceCategory"], ["sessions", "activeUsers"], headers),
      runReportSafe(propId, dateConf.current, ["operatingSystem"], ["sessions", "activeUsers"], headers),
      runReportSafe(propId, dateConf.current, ["city", "country"], ["sessions", "activeUsers"], headers)
    ]);

    // 整形
    state.data = {
      overview: {
        current: parseOverviewRow(overviewCur ? overviewCur.rows : null),
        previous: parseOverviewRow(overviewPrev ? overviewPrev.rows : null)
      },
      channel: parseRows(channelRes ? channelRes.rows : null, "sessionDefaultChannelGroup"),
      device: parseRows(deviceRes ? deviceRes.rows : null, "deviceCategory"),
      os: parseRows(osRes ? osRes.rows : null, "operatingSystem"),
      location: parseLocationRows(locationRes ? locationRes.rows : null)
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

async function runReportSafe(propId, dateRange, dimensions, metrics, headers) {
  try {
    return await runReport(propId, dateRange, dimensions, metrics, headers);
  } catch (err) {
    console.warn(`Query failed for dimensions [${dimensions.join(", ")}]:`, err.message);
    // 権限エラー(403)などの場合はそのまま伝播してモーダルを出す
    if (err.message.includes("403") || err.message.includes("閲覧権限")) {
      throw err;
    }
    return { rows: [] };
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
    const errJson = await res.json().catch(() => ({}));
    const rawMsg = errJson.error?.message || "";
    if (res.status === 429) throw new Error("GA4 APIの読み取り制限（クォータ）に達しました。");
    if (res.status === 403) {
      showPermissionErrorModal(
        `Google Analytics Data API へのアクセスが拒否されました（403 Forbidden）。<br /><br />` +
        `<strong>Google API からのメッセージ:</strong><br /><code>${rawMsg || "プロパティの閲覧権限が不足しています。"}</code>`
      );
      throw new Error("プロパティの閲覧権限がありません（Google Cloud で Data API が有効化されているか、アカウント権限をご確認ください）。");
    }
    throw new Error(`Data API エラー (${res.status}): ${rawMsg || res.statusText}`);
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

function parseLocationRows(rows) {
  if (!rows) return [];
  return rows.map(r => {
    const city = r.dimensionValues?.[0]?.value || "その他";
    const country = r.dimensionValues?.[1]?.value || "日本";
    const label = city !== "(not set)" && city !== "その他" ? city : country;
    const sessions = parseInt(r.metricValues?.[0]?.value || "0", 10);
    const users = parseInt(r.metricValues?.[1]?.value || "0", 10);
    return { key: city, label, country, sessions, users };
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
      ],
      location: [
        { key: "Tokyo", label: "東京都", country: "日本", sessions: 7600, users: 4100 },
        { key: "Osaka", label: "大阪府", country: "日本", sessions: 2900, users: 1650 },
        { key: "Aichi", label: "愛知県", country: "日本", sessions: 1800, users: 1020 },
        { key: "United States", label: "アメリカ（海外）", country: "アメリカ", sessions: 650, users: 380 }
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
  renderLocation(state.data.location);
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
  const cur = overview?.current || { sessions: 0, activeUsers: 0, engagementRate: 0, keyEvents: 0 };
  const prev = overview?.previous || cur;

  const sDiff = prev.sessions > 0 ? ((cur.sessions - prev.sessions) / prev.sessions) * 100 : 0;
  const uDiff = prev.activeUsers > 0 ? ((cur.activeUsers - prev.activeUsers) / prev.activeUsers) * 100 : 0;

  const sSign = sDiff >= 0 ? "+" : "";
  const uSign = uDiff >= 0 ? "+" : "";

  document.getElementById("metricSessions").textContent = fmt(cur.sessions);
  document.getElementById("metricSessionsDiff").textContent = prev.sessions > 0 ? `前期間比: ${sSign}${sDiff.toFixed(1)}%` : "前期間比: -";
  document.getElementById("metricSessionsDiff").style.color = sDiff >= 0 ? "var(--diff-down)" : "var(--diff-up)";

  document.getElementById("metricUsers").textContent = fmt(cur.activeUsers);
  document.getElementById("metricUsersDiff").textContent = prev.activeUsers > 0 ? `前期間比: ${uSign}${uDiff.toFixed(1)}%` : "前期間比: -";
  document.getElementById("metricUsersDiff").style.color = uDiff >= 0 ? "var(--diff-down)" : "var(--diff-up)";

  // 結論文
  if (cur.sessions === 0 && cur.activeUsers === 0) {
    document.getElementById("overviewVerdict").textContent =
      "直近の訪問データはまだ計測されていません。タグがサイトに正しく設置されているかご確認ください。";
  } else {
    const diffTxt = prev.sessions > 0 ? `（前期間比 ${sSign}${sDiff.toFixed(1)}%）` : "";
    document.getElementById("overviewVerdict").textContent =
      `直近の訪問回数は ${fmt(cur.sessions)}回 ${diffTxt}、訪れた人数は ${fmt(cur.activeUsers)}人 です。`;
  }
}

// 2. 見ているか
function renderEngagement(cur) {
  const ratePct = cur ? Math.round((cur.engagementRate || 0) * 100) : 0;
  document.getElementById("engagementRateText").textContent = `${ratePct}%`;
  document.getElementById("engagementBar").style.width = `${ratePct}%`;

  if (!cur || (cur.sessions === 0 && cur.activeUsers === 0)) {
    document.getElementById("engagementVerdict").textContent =
      "まだ滞在・閲覧データがありません。訪問が計測されると比率が自動計算されます。";
    return;
  }

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
  destroyChart("channel");
  const tbody = document.getElementById("channelTable");

  if (!channelRows || channelRows.length === 0) {
    document.getElementById("channelVerdict").textContent = "この期間の流入経路データはまだありません（0件）。";
    if (tbody) {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 24px; color: var(--text-muted);">まだ流入データが計測されていません</td></tr>';
    }
    return;
  }

  const sorted = [...channelRows].sort((a, b) => b.sessions - a.sessions).slice(0, 6);
  const totalS = channelRows.reduce((a, r) => a + r.sessions, 0);
  const totalU = channelRows.reduce((a, r) => a + r.users, 0);

  // 結論文
  const top1 = sorted[0];
  const topPct = pct(top1.sessions, totalS);
  document.getElementById("channelVerdict").textContent =
    `最も多い流入は「${top1.label}」で、全体の ${topPct}（${fmt(top1.sessions)}回）を占めています。`;

  // 表
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
  const ctx = document.getElementById("channelChart").getContext("2d");
  state.charts.channel = new Chart(ctx, {
    type: "bar",
    data: {
      labels: sorted.map(r => r.label),
      datasets: [{
        label: "回数",
        data: sorted.map(r => r.sessions),
        backgroundColor: "#118ab2", // Blue NCS
        borderRadius: 6
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
  const count = cur?.keyEvents || 0;
  document.getElementById("metricKeyEvents").textContent = fmt(count);

  if (count > 0) {
    document.getElementById("keyEventsVerdict").textContent =
      `期間中に ${fmt(count)}回 の目標アクション（キーイベント）が達成されました。`;
  } else {
    document.getElementById("keyEventsVerdict").textContent =
      `成果アクションは 0回 です。サイトの目標（お問い合わせや購入など）が GA4 側でまだ「キーイベント」として設定されていないか、この期間の達成がありません。`;
  }
}

// 5. どんな端末か
function renderDevices(deviceRows) {
  destroyChart("device");
  const tbody = document.getElementById("deviceTable");

  if (!deviceRows || deviceRows.length === 0) {
    document.getElementById("deviceVerdict").textContent = "この期間の端末データはまだありません（0件）。";
    if (tbody) {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 24px; color: var(--text-muted);">まだ端末データが計測されていません</td></tr>';
    }
    return;
  }

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
  const ctx = document.getElementById("deviceChart").getContext("2d");
  const colors = ["#118ab2", "#06d6a0", "#ffd166", "#ef476f", "#073b4c"];

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
  destroyChart("osSessions");
  destroyChart("osUsers");
  const tbody = document.getElementById("osTable");

  if (!osRows || osRows.length === 0) {
    document.getElementById("osVerdict").textContent = "この期間のOSデータはまだありません（0件）。";
    if (tbody) {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 24px; color: var(--text-muted);">まだOSデータが計測されていません</td></tr>';
    }
    return;
  }

  const sorted = [...osRows].sort((a, b) => b.sessions - a.sessions).slice(0, 6);
  const totalS = osRows.reduce((a, r) => a + r.sessions, 0);
  const totalU = osRows.reduce((a, r) => a + r.users, 0);

  // 結論文
  const topOS = sorted[0];
  document.getElementById("osVerdict").textContent =
    `回数も人数も「${topOS.label}」が最多（全体の ${pct(topOS.sessions, totalS)}）です。`;

  // 表
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
  const labels = sorted.map(r => r.label);

  const ctxS = document.getElementById("osSessions").getContext("2d");
  state.charts.osSessions = new Chart(ctxS, {
    type: "bar",
    data: {
      labels,
      datasets: [{
        label: "回数",
        data: sorted.map(r => r.sessions),
        backgroundColor: "#06d6a0", // Caribbean Green
        borderRadius: 6
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
        backgroundColor: "#ef476f", // Paradise Pink
        borderRadius: 6
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

// 7. どの国・地域からか
function renderLocation(locationRows) {
  destroyChart("location");
  const tbody = document.getElementById("locationTable");

  if (!locationRows || locationRows.length === 0) {
    document.getElementById("locationVerdict").textContent = "この期間の地域データはまだありません（0件）。";
    if (tbody) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 24px; color: var(--text-muted);">まだ地域データが計測されていません</td></tr>';
    }
    return;
  }

  const sorted = [...locationRows].sort((a, b) => b.sessions - a.sessions).slice(0, 7);
  const totalS = locationRows.reduce((a, r) => a + r.sessions, 0);
  const totalU = locationRows.reduce((a, r) => a + r.users, 0);

  // 結論文
  const top1 = sorted[0];
  const topPct = pct(top1.sessions, totalS);
  document.getElementById("locationVerdict").textContent =
    `アクセスが最も多い地域は「${top1.label}」で、全体の ${topPct}（${fmt(top1.sessions)}回）です。`;

  // 表
  tbody.innerHTML = sorted.map(r => `
    <tr>
      <td>${r.label}</td>
      <td>${r.country}</td>
      <td class="num">${fmt(r.sessions)}</td>
      <td class="num">${pct(r.sessions, totalS)}</td>
      <td class="num">${fmt(r.users)}</td>
      <td class="num">${pct(r.users, totalU)}</td>
    </tr>
  `).join("");

  // グラフ (Orange Yellow Crayola)
  const ctx = document.getElementById("locationChart").getContext("2d");
  state.charts.location = new Chart(ctx, {
    type: "bar",
    data: {
      labels: sorted.map(r => r.label),
      datasets: [{
        label: "回数",
        data: sorted.map(r => r.sessions),
        backgroundColor: "#ffd166", // Orange Yellow Crayola
        borderRadius: 6
      }]
    },
    options: {
      indexAxis: "y",
      responsive: true,
      plugins: {
        legend: { display: false },
        title: { display: true, text: "地域・都市別の回数（上位）" }
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
async function handleGenerateTag() {
  const siteName = document.getElementById("wizardSiteName").value.trim() || "マイサイト";
  const siteUrl = document.getElementById("wizardSiteUrl").value.trim() || "https://example.com";
  const siteType = document.querySelector('input[name="wizardSiteType"]:checked')?.value || "corporate";
  const wizardMode = document.querySelector('input[name="wizardMode"]:checked')?.value || "auto";
  const manualMeasurementId = document.getElementById("wizardManualMeasurementId")?.value.trim() || "";

  const goalInquiry = document.getElementById("goalInquiry").checked;
  const goalDocument = document.getElementById("goalDocument").checked;
  const goalTel = document.getElementById("goalTel").checked;
  const goalMember = document.getElementById("goalMember").checked;
  const goalPurchase = document.getElementById("goalPurchase").checked;

  const progressDiv = document.getElementById("wizardProgress");
  const progressText = document.getElementById("wizardProgressText");
  const resultTitle = document.getElementById("wizardResultTitle");
  const resultSubtitle = document.getElementById("wizardResultSubtitle");
  const btnGen = document.getElementById("btnGenerateTag");

  let measurementId = manualMeasurementId ? manualMeasurementId.toUpperCase() : "G-XXXXXXXXXX";
  let isLiveCreated = false;

  // --------------------------------------------------------------------------
  // Google ログイン済み かつ 自動作成モードの場合: GA4 Admin API で直接作成を試みる
  // --------------------------------------------------------------------------
  if (state.auth.token && wizardMode === "auto") {
    const accountSelect = document.getElementById("wizardAccountSelect");
    const parentAccount = accountSelect?.value || state.accounts[0]?.id;

    if (!parentAccount) {
      showToast("作成先の Google アナリティクス アカウントが選択されていません");
      return;
    }

    try {
      btnGen.disabled = true;
      progressDiv.style.display = "block";

      // 1. プロパティ作成
      progressText.textContent = "⏳ 1/3 Google アナリティクスに新しいプロパティを作成中...";
      const propRes = await fetch("https://analyticsadmin.googleapis.com/v1beta/properties", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${state.auth.token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          parent: parentAccount,
          displayName: siteName,
          timeZone: "Asia/Tokyo",
          currencyCode: "JPY"
        })
      });

      if (!propRes.ok) {
        const errJson = await propRes.json().catch(() => ({}));
        const rawMsg = errJson.error?.message || propRes.statusText;
        if (propRes.status === 403) {
          const selectedAccountName = accountSelect?.options[accountSelect.selectedIndex]?.text || parentAccount;
          showPermissionErrorModal(
            `選択したアカウント（<strong>${selectedAccountName}</strong>）に対する<strong>「プロパティ作成権限（編集者以上）」</strong>がありません。<br /><br />` +
            `<strong>Google API メッセージ:</strong><br /><code>${rawMsg}</code><br /><br />` +
            `※ 既存のレポートを閲覧する権限（閲覧者）はあっても、新しいプロパティを作成する権限がない場合に発生します。<br />` +
            `下のボタンから「計測タグだけ発行」に切り替えていただくか、ご自身が管理者になっている別のアカウントを選択してください。`
          );
        }
        throw new Error(`プロパティ作成エラー: ${rawMsg}`);
      }

      const propData = await propRes.json();
      const propertyName = propData.name; // "properties/12345678"

      // 2. Web データストリーム作成 (測定ID発行)
      progressText.textContent = "⏳ 2/3 Webデータストリームを作成し、測定IDを発行中...";
      const cleanUri = siteUrl.startsWith("http") ? siteUrl : `https://${siteUrl}`;
      const streamRes = await fetch(`https://analyticsadmin.googleapis.com/v1beta/${propertyName}/dataStreams`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${state.auth.token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          type: "WEB_DATA_STREAM",
          displayName: `${siteName} Webストリーム`,
          webStreamData: {
            defaultUri: cleanUri
          }
        })
      });

      if (!streamRes.ok) {
        const errJson = await streamRes.json().catch(() => ({}));
        throw new Error(`データストリーム作成エラー: ${errJson.error?.message || streamRes.statusText}`);
      }

      const streamData = await streamRes.json();
      if (streamData.webStreamData && streamData.webStreamData.measurementId) {
        measurementId = streamData.webStreamData.measurementId;
      }

      // 3. キーイベント（成果）登録
      progressText.textContent = "⏳ 3/3 成果（キーイベント）をGA4に自動登録中...";
      const keyEventsToRegister = [];
      if (goalInquiry) keyEventsToRegister.push("generate_lead");
      if (goalDocument) keyEventsToRegister.push("file_download");
      if (goalTel) keyEventsToRegister.push("click");
      if (goalMember) keyEventsToRegister.push("sign_up");
      if (goalPurchase) keyEventsToRegister.push("purchase");

      for (const evtName of keyEventsToRegister) {
        try {
          await fetch(`https://analyticsadmin.googleapis.com/v1beta/${propertyName}/keyEvents`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${state.auth.token}`,
              "Content-Type": "application/json"
            },
            body: JSON.stringify({ eventName: evtName })
          });
        } catch (e) {
          console.warn(`Key event ${evtName} registration failed:`, e);
        }
      }

      isLiveCreated = true;
      progressText.textContent = "✅ GA4への全設定が完了しました！";
      showToast("GA4 へのプロパティ・ストリーム・キーイベントの作成が完了しました！");

      // 作成したプロパティを一覧に追加＆選択
      await fetchProperties();
      const rawPropId = propertyName.replace("properties/", "");
      state.selectedPropertyId = rawPropId;
      const propSel = document.getElementById("propertySelect");
      if (propSel) propSel.value = rawPropId;

    } catch (err) {
      console.error("Live GA4 creation error:", err);
      showToast(`GA4自動設定エラー: ${err.message}`);
      progressText.textContent = `⚠️ 自動作成エラー: ${err.message}（ひな形タグのみ生成します）`;
    } finally {
      btnGen.disabled = false;
    }
  }

  // 自動計測イベント設定コードの生成
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

  if (isLiveCreated) {
    resultTitle.textContent = `🎉 GA4設定完了＆本物の測定ID（${measurementId}）を発行しました！`;
    resultSubtitle.innerHTML = `Google アナリティクス側に新しいプロパティ、データストリーム、成果イベント（キーイベント）を<strong>すべて自動作成しました</strong>。以下のタグをサイトに貼り付けるだけで計測が始まります。`;
  } else if (manualMeasurementId) {
    resultTitle.textContent = `🎉 指定の測定ID（${measurementId}）で計測タグを生成しました！`;
    resultSubtitle.innerHTML = `ご指定の測定ID（<code>${measurementId}</code>）と選択された成果イベントコードを組み込んだタグです。このタグをあなたのWebサイトの <code>&lt;head&gt;</code> 内に貼り付けてください。`;
  } else {
    resultTitle.textContent = `📋 計測タグのひな形を生成しました`;
    resultSubtitle.innerHTML = `仮の測定ID（<code>${measurementId}</code>）としてタグを生成しました。Google アナリティクス（<a href="https://analytics.google.com" target="_blank" style="color: var(--toy-blue); font-weight: bold;">analytics.google.com ↗</a>）でプロパティを作成後、発行された測定ID（G-xxxxxx）に書き換えるか、上の入力欄に測定IDを入れて再度生成してください。`;
  }

  const resultArea = document.getElementById("wizardResult");
  resultArea.style.display = "block";
  resultArea.scrollIntoView({ behavior: "smooth", block: "start" });

  // タグ生成完了を初期設定済みとして記録し、ダッシュボードのゲートを更新
  state.isConfigured = true;
  localStorage.setItem("yomiyasui_configured", "true");
  updateConfigurationGate();
}

function handleCopyTag() {
  const code = document.getElementById("generatedTagCode").textContent;
  if (!code) return;

  navigator.clipboard.writeText(code).then(() => {
    const btn = document.getElementById("btnCopyTag");
    const originalText = btn.textContent;
    btn.textContent = "✅ コピー完了！";
    btn.style.backgroundColor = "#06d6a0";
    btn.style.color = "#073b4c";
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

// ============================================================================
// AI アクセス解析アドバイザー (AI Consultant)
// ============================================================================
function setupAIAdvisor() {
  document.querySelectorAll(".ai-chip").forEach(btn => {
    btn.addEventListener("click", () => {
      const q = btn.dataset.query;
      generateAIAdvice(q);
    });
  });
}

function generateAIAdvice(queryType) {
  const d = state.data;
  if (!d) return;

  const resBox = document.getElementById("aiResponseBox");
  const resTitle = document.getElementById("aiResponseTitle");
  const resContent = document.getElementById("aiResponseContent");

  const cur = d.overview?.current || { sessions: 0, activeUsers: 0, engagementRate: 0, keyEvents: 0 };
  const prev = d.overview?.previous || cur;
  const engRate = Math.round((cur.engagementRate || 0) * 100);

  const devices = d.device || [];
  const totDev = devices.reduce((a, r) => a + r.sessions, 0);
  const mob = devices.find(x => x.key === "mobile")?.sessions || 0;
  const mobPct = totDev ? Math.round((mob / totDev) * 100) : 0;

  const topChannel = d.channel?.[0]?.label || "検索エンジン";
  const topLoc = d.location?.[0]?.label || "東京都";

  resBox.style.display = "block";
  resBox.scrollIntoView({ behavior: "smooth", block: "nearest" });

  if (queryType === "priority") {
    resTitle.innerHTML = `
      <svg class="svg-icon" viewBox="0 0 24 24"><path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3z"/></svg>
      今週の最優先改善アクション 3選
    `;
    resContent.innerHTML = `
      <ul>
        <li><strong>1. スマホ表示の最適化（スマホ利用率 ${mobPct}%）:</strong> 訪問者の過半数がスマホです。スマートフォンでの読み込み速度向上と、ファーストビュー（画面を開いて最初に見える範囲）で価値が3秒で伝わるよう整えましょう。</li>
        <li><strong>2. 見ている割合の改善（現在 ${engRate}%）:</strong> ${engRate < 50 ? "直帰率が高めです。記事やページの末尾に「次に読んでほしい関連記事」や「おすすめサービス」への誘導ボタンを配置し、回遊率を高めましょう。" : "滞在率は ${engRate}% と良好です！各ページの目立つ位置にお問い合わせやLINE等の導線を配置してアクションを促しましょう。"}</li>
        <li><strong>3. 最大の流入元「${topChannel}」の強化:</strong> 最も人を集めている流入経路に合わせたコンテンツの拡充やキーワード対策を行い、強みをさらに伸ばしましょう。</li>
      </ul>
    `;
  } else if (queryType === "mobile") {
    resTitle.innerHTML = `
      <svg class="svg-icon" viewBox="0 0 24 24"><rect width="14" height="20" x="5" y="2" rx="2" ry="2"/><path d="M12 18h.01"/></svg>
      スマホ訪問者の離脱を防ぐ処方箋
    `;
    resContent.innerHTML = `
      <p>現在のアクセスでは、<strong>スマホが全体の ${mobPct}%</strong> を占めています。</p>
      <ul>
        <li><strong>タップしやすいボタンサイズ:</strong> 重要なリンクや「お問い合わせ」ボタンの高さを 44px 以上確保し、親指で楽に押せるようにしましょう。</li>
        <li><strong>画面下部の追従バー（Sticky Footer）:</strong> スマホ画面の最下部に「電話する」「WEB予約」「LINE相談」などの固定ボタンを配置すると、成果率が平均1.3〜1.8倍に向上します。</li>
        <li><strong>入力項目の極小化:</strong> スマホでの文字入力はユーザーの離脱原因第1位です。お問い合わせフォームの必須項目を必要最小限（3〜4項目）に絞り込みましょう。</li>
      </ul>
    `;
  } else if (queryType === "conversion") {
    resTitle.innerHTML = `
      <svg class="svg-icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>
      お問い合わせ（成果）を増やす施策
    `;
    resContent.innerHTML = `
      <p>現在のキーイベント達成数: <strong>${cur.keyEvents}回</strong></p>
      <ul>
        <li>${cur.keyEvents === 0 ? "<strong>まずは計測設定の確認:</strong> 成果が0件です。お問い合わせ完了ページ（サンクスページ）への到達がGA4側で「キーイベント」として登録されているか、または初期設定ウィザードの自動タグを導入してください。" : "<strong>成果獲得は順調です！</strong> さらなる拡大に向けて以下の施策を推奨します。"}</li>
        <li><strong>アクションの心理的ハードルを下げる:</strong> 「今すぐ契約」だけでなく「まずは無料資料を見る」「3分でカンタン見積もり」など、気軽に申し込める入り口（マイクロコンバージョン）を用意しましょう。</li>
        <li><strong>お客様の声・実績の掲載:</strong> フォームの直前に「利用者の声」や「安心の実績」を添えることで、送信直前の離脱を大きく減らせます。</li>
      </ul>
    `;
  } else if (queryType === "location") {
    resTitle.innerHTML = `
      <svg class="svg-icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20M2 12h20"/></svg>
      地域傾向から見た集客・プロモーションのヒント
    `;
    resContent.innerHTML = `
      <p>最も訪問者が多い地域は <strong>「${topLoc}」</strong> です。</p>
      <ul>
        <li><strong>地域特化のメッセージング:</strong> トップページや見出しに「${topLoc}エリア対応」「${topLoc}のお客様へ」といった地域名を記載すると、共感度と成約率が跳ね上がります。</li>
        <li><strong>Google 広告の地域ターゲティング:</strong> 予算が限られている場合、訪問実績の多い「${topLoc}」や上位都市に限定してWeb広告を配信することで、費用対効果（ROI）を最大化できます。</li>
      </ul>
    `;
  }
}


