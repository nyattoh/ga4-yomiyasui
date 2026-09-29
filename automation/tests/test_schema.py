import tempfile
from pathlib import Path
import pytest
from src.schema import (
    CustomDimensionConfig,
    CustomMetricConfig,
    DataStreamConfig,
    DimensionScope,
    GA4ConfigFile,
    MeasurementUnit,
    PropertyConfig,
)


def test_schema_load_and_save():
    cfg = GA4ConfigFile(
        version="1.0",
        account_id="12345",
        property=PropertyConfig(
            property_id="99887766",
            display_name="Test Property",
            time_zone="Asia/Tokyo",
            currency_code="JPY",
        ),
        data_streams=[
            DataStreamConfig(name="Web Stream", default_uri="https://example.com")
        ],
        custom_dimensions=[
            CustomDimensionConfig(
                parameter_name="test_dim",
                display_name="Test Dimension",
                scope=DimensionScope.EVENT,
            )
        ],
        custom_metrics=[
            CustomMetricConfig(
                parameter_name="test_metric",
                display_name="Test Metric",
                measurement_unit=MeasurementUnit.SECONDS,
            )
        ],
    )

    assert cfg.normalized_account_id() == "accounts/12345"
    assert cfg.property.normalized_property_id() == "properties/99887766"

    with tempfile.TemporaryDirectory() as tmpdir:
        file_path = Path(tmpdir) / "test_config.yaml"
        cfg.save_to_yaml(file_path)

        loaded = GA4ConfigFile.load_from_yaml(file_path)
        assert loaded.property.display_name == "Test Property"
        assert len(loaded.custom_dimensions) == 1
        assert loaded.custom_dimensions[0].parameter_name == "test_dim"
        assert loaded.custom_metrics[0].measurement_unit == MeasurementUnit.SECONDS


def test_custom_dimension_validation():
    # Valid
    dim = CustomDimensionConfig(
        parameter_name="valid_param_1",
        display_name="Valid",
    )
    assert dim.parameter_name == "valid_param_1"

    # Too long parameter_name (>40 chars)
    with pytest.raises(ValueError):
        CustomDimensionConfig(
            parameter_name="a" * 41,
            display_name="Too Long",
        )

    # Empty parameter_name
    with pytest.raises(ValueError):
        CustomDimensionConfig(
            parameter_name="   ",
            display_name="Empty",
        )
