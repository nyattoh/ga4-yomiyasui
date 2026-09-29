import json
from pathlib import Path

import pytest

# Standalone package layout uses nested ga4-yomiyasui/;
# when vendored under ga4-yomiyasui/automation/, frontend lives at parent.
_candidates = [Path("ga4-yomiyasui"), Path("..")]
FRONTEND_ROOT = next(
    (p for p in _candidates if (p / "index.html").is_file()),
    Path("ga4-yomiyasui"),
)

pytestmark = pytest.mark.skipif(
    not (FRONTEND_ROOT / "index.html").is_file(),
    reason="ga4-yomiyasui frontend tree not present",
)


def test_demo_data_schema():
    data = json.loads((FRONTEND_ROOT / "demo-data.json").read_text(encoding="utf-8"))
    assert "overview" in data
    assert "channel" in data
    assert "device" in data
    assert "os" in data
    assert len(data["device"]) == 3
    assert len(data["os"]) >= 4


def test_index_html_dom_elements():
    html = (FRONTEND_ROOT / "index.html").read_text(encoding="utf-8")
    required_ids = [
        "modeBadge", "propertySelect", "btnAuth", "btnSettings", "btnRefresh",
        "overviewVerdict", "metricSessions", "metricSessionsDiff", "metricUsers", "metricUsersDiff",
        "engagementVerdict", "engagementBar", "engagementRateText",
        "channelVerdict", "channelChart", "channelTable",
        "keyEventsVerdict", "metricKeyEvents",
        "deviceVerdict", "deviceChart", "deviceTable",
        "osVerdict", "osSessions", "osUsers", "osTable",
        "settingsModal", "customClientId", "btnSaveClientId", "btnResetClientId", "btnCloseSettings", "toast",
        "tabDashboard", "tabWizard", "wizardSection", "wizardAccountSelect", "btnGenerateTag", "generatedTagCode", "btnCopyTag",
        "locationVerdict", "locationChart", "locationTable", "aiResponseBox", "aiResponseTitle", "aiResponseContent",
        "unconfiguredGate", "btnGoWizard", "btnUnlockDemo", "reportBlocks",
        "currentOriginCode", "btnCopyOrigin", "btnCloseSettingsBottom", "btnOpenSettingsFromWizard",
        "permissionModal", "permissionErrorDetail", "btnClosePermissionModal", "btnClosePermissionModalBottom",
        "wizardManualMeasurementIdGroup", "wizardManualMeasurementId", "btnSwitchToManualMode"
    ]
    for element_id in required_ids:
        assert f'id="{element_id}"' in html, f"Missing id: {element_id}"


def test_css_and_js_links():
    html = (FRONTEND_ROOT / "index.html").read_text(encoding="utf-8")
    assert 'href="style.css"' in html
    assert 'src="app.js"' in html
    assert 'src="https://cdn.jsdelivr.net/npm/chart.js@4"' in html
    assert 'src="https://accounts.google.com/gsi/client"' in html