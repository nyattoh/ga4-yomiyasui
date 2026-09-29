from unittest.mock import MagicMock, patch
from click.testing import CliRunner
from src.cli import cli


def test_cli_help():
    runner = CliRunner()
    result = runner.invoke(cli, ["--help"])
    assert result.exit_code == 0
    assert "GA4 Setup Automation" in result.output
    assert "plan" in result.output
    assert "apply" in result.output
    assert "inspect" in result.output
    assert "export" in result.output


@patch("src.cli.GA4AdminClient")
def test_cli_plan_command_mocked(mock_client_class, tmp_path):
    mock_client = MagicMock()
    mock_client_class.return_value = mock_client

    # Remote returns 1 dimension
    mock_client.get_property.return_value = {
        "name": "properties/12345",
        "display_name": "Test Prop",
        "time_zone": "Asia/Tokyo",
        "currency_code": "JPY",
    }
    mock_client.list_data_streams.return_value = []
    mock_client.list_custom_dimensions.return_value = [
        {
            "name": "properties/12345/customDimensions/dim1",
            "parameter_name": "existing_param",
            "display_name": "Existing",
            "scope": "EVENT",
        }
    ]
    mock_client.list_custom_metrics.return_value = []

    # Config with 1 existing and 1 new dimension
    config_content = """
version: "1.0"
property:
  property_id: "properties/12345"
  display_name: "Test Prop"
  time_zone: "Asia/Tokyo"
  currency_code: "JPY"
custom_dimensions:
  - parameter_name: "existing_param"
    display_name: "Existing"
    scope: "EVENT"
  - parameter_name: "new_param"
    display_name: "New"
    scope: "EVENT"
"""
    cfg_file = tmp_path / "test_config.yaml"
    cfg_file.write_text(config_content, encoding="utf-8")

    runner = CliRunner()
    result = runner.invoke(cli, ["plan", "-c", str(cfg_file)])

    assert result.exit_code == 0
    assert "Execution Plan Details" in result.output
    assert "GA4 Quota Guardrail Analysis" in result.output
    assert "1 to create" in result.output


def test_cli_plan_command_offline(tmp_path):
    config_content = """
version: "1.0"
property:
  property_id: "properties/99999"
  display_name: "Offline Prop"
  time_zone: "Asia/Tokyo"
  currency_code: "JPY"
custom_dimensions:
  - parameter_name: "test_offline"
    display_name: "Test Offline"
    scope: "EVENT"
"""
    cfg_file = tmp_path / "offline_config.yaml"
    cfg_file.write_text(config_content, encoding="utf-8")

    runner = CliRunner()
    result = runner.invoke(cli, ["plan", "-c", str(cfg_file), "--offline"])

    assert result.exit_code == 0
    assert "[Offline Mode]" in result.output
    assert "test_offline" in result.output
    assert "[EVENT]" in result.output
    assert "2 to create" in result.output  # 1 property + 1 dimension


@patch("src.cli.GA4AdminClient")
def test_cli_inspect_command_mocked(mock_client_class):
    """Regression: inspect must import check_quotas (was NameError)."""
    mock_client = MagicMock()
    mock_client_class.return_value = mock_client
    mock_client.get_property.return_value = {
        "name": "properties/12345",
        "display_name": "Inspect Prop",
        "time_zone": "Asia/Tokyo",
        "currency_code": "JPY",
    }
    mock_client.list_data_streams.return_value = []
    mock_client.list_custom_dimensions.return_value = [
        {
            "name": "properties/12345/customDimensions/1",
            "parameter_name": "p1",
            "display_name": "P1",
            "scope": "EVENT",
            "description": "",
        }
    ]
    mock_client.list_custom_metrics.return_value = []

    runner = CliRunner()
    result = runner.invoke(cli, ["inspect", "-p", "properties/12345"])

    assert result.exit_code == 0, result.output
    assert "Inspect Prop" in result.output
    assert "Quota Capacity Status" in result.output
    assert "NameError" not in result.output


@patch("src.cli.GA4AdminClient")
def test_cli_apply_persists_property_id(mock_client_class, tmp_path):
    """After successful property CREATE, property_id is written back to YAML."""
    mock_client = MagicMock()
    mock_client_class.return_value = mock_client
    mock_client.create_property.return_value = {
        "name": "properties/999888777",
        "display_name": "New Prop",
        "time_zone": "Asia/Tokyo",
        "currency_code": "JPY",
    }

    config_content = """
version: "1.0"
account_id: "accounts/111"
property:
  display_name: "New Prop"
  time_zone: "Asia/Tokyo"
  currency_code: "JPY"
"""
    cfg_file = tmp_path / "create_prop.yaml"
    cfg_file.write_text(config_content, encoding="utf-8")

    runner = CliRunner()
    result = runner.invoke(cli, ["apply", "-c", str(cfg_file), "--auto-approve"])

    assert result.exit_code == 0, result.output
    assert "Created property" in result.output
    written = cfg_file.read_text(encoding="utf-8")
    assert "999888777" in written
    assert "property_id" in written


@patch("src.cli.GA4AdminClient")
def test_cli_apply_rejects_non_web_stream(mock_client_class, tmp_path):
    """Apply must ERROR on IOS/ANDROID CREATE instead of silently skipping."""
    mock_client = MagicMock()
    mock_client_class.return_value = mock_client
    mock_client.get_property.return_value = {
        "name": "properties/12345",
        "display_name": "Test Prop",
        "time_zone": "Asia/Tokyo",
        "currency_code": "JPY",
    }
    mock_client.list_data_streams.return_value = []
    mock_client.list_custom_dimensions.return_value = []
    mock_client.list_custom_metrics.return_value = []

    config_content = """
version: "1.0"
property:
  property_id: "properties/12345"
  display_name: "Test Prop"
  time_zone: "Asia/Tokyo"
  currency_code: "JPY"
data_streams:
  - name: "iOS App"
    type: "IOS"
"""
    cfg_file = tmp_path / "ios_stream.yaml"
    cfg_file.write_text(config_content, encoding="utf-8")

    runner = CliRunner()
    result = runner.invoke(cli, ["apply", "-c", str(cfg_file), "--auto-approve"])

    assert result.exit_code != 0, result.output
    assert "Unsupported data stream type" in result.output
    assert "IOS" in result.output
    assert "Apply complete" not in result.output
    mock_client.create_web_data_stream.assert_not_called()

@patch("src.cli.GA4AdminClient")
def test_cli_apply_rejects_android_stream(mock_client_class, tmp_path):
    """Apply must ERROR on ANDROID CREATE (fail-loud; create not implemented)."""
    mock_client = MagicMock()
    mock_client_class.return_value = mock_client
    mock_client.get_property.return_value = {
        "name": "properties/12345",
        "display_name": "Test Prop",
        "time_zone": "Asia/Tokyo",
        "currency_code": "JPY",
    }
    mock_client.list_data_streams.return_value = []
    mock_client.list_custom_dimensions.return_value = []
    mock_client.list_custom_metrics.return_value = []

    config_content = """
version: "1.0"
property:
  property_id: "properties/12345"
  display_name: "Test Prop"
  time_zone: "Asia/Tokyo"
  currency_code: "JPY"
data_streams:
  - name: "Android App"
    type: "ANDROID"
"""
    cfg_file = tmp_path / "android_stream.yaml"
    cfg_file.write_text(config_content, encoding="utf-8")

    runner = CliRunner()
    result = runner.invoke(cli, ["apply", "-c", str(cfg_file), "--auto-approve"])

    assert result.exit_code != 0, result.output
    assert "Unsupported data stream type" in result.output
    assert "ANDROID" in result.output
    assert "Apply complete" not in result.output
    mock_client.create_web_data_stream.assert_not_called()


@patch("src.cli.GA4AdminClient")
def test_cli_export_writes_yaml(mock_client_class, tmp_path):
    """export must reverse-engineer property to YAML without live Admin writes."""
    mock_client = MagicMock()
    mock_client_class.return_value = mock_client
    mock_client.get_property.return_value = {
        "name": "properties/12345",
        "display_name": "Export Prop",
        "time_zone": "Asia/Tokyo",
        "currency_code": "JPY",
        "industry_category": None,
    }
    mock_client.list_data_streams.return_value = [
        {
            "name": "properties/12345/dataStreams/1",
            "display_name": "Web Site",
            "type": "WEB_DATA_STREAM",
            "default_uri": "https://example.com",
        },
        {
            "name": "properties/12345/dataStreams/2",
            "display_name": "iOS App",
            "type": "IOS_APP_DATA_STREAM",
            "default_uri": None,
        },
    ]
    mock_client.list_custom_dimensions.return_value = [
        {
            "parameter_name": "btn_id",
            "display_name": "Button ID",
            "description": "",
            "scope": "EVENT",
            "disallow_ads_personalization": False,
        }
    ]
    mock_client.list_custom_metrics.return_value = [
        {
            "parameter_name": "score",
            "display_name": "Score",
            "description": "",
            "measurement_unit": "STANDARD",
            "scope": "EVENT",
        }
    ]

    out = tmp_path / "exported.yaml"
    runner = CliRunner()
    result = runner.invoke(
        cli, ["export", "-p", "properties/12345", "-o", str(out)]
    )

    assert result.exit_code == 0, result.output
    assert out.exists()
    text = out.read_text(encoding="utf-8")
    assert "Export Prop" in text
    assert "btn_id" in text
    assert "score" in text
    assert "Web Site" in text
    assert "Successfully exported" in result.output

