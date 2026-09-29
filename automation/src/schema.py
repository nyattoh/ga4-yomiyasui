from __future__ import annotations

from enum import Enum
from pathlib import Path
from typing import List, Optional
import yaml
from pydantic import BaseModel, Field, field_validator


class DimensionScope(str, Enum):
    EVENT = "EVENT"
    USER = "USER"
    ITEM = "ITEM"


class MetricScope(str, Enum):
    EVENT = "EVENT"


class MeasurementUnit(str, Enum):
    STANDARD = "STANDARD"
    CURRENCY = "CURRENCY"
    FEET = "FEET"
    METERS = "METERS"
    KILOMETERS = "KILOMETERS"
    MILES = "MILES"
    MILLISECONDS = "MILLISECONDS"
    SECONDS = "SECONDS"
    MINUTES = "MINUTES"
    HOURS = "HOURS"


class DataStreamType(str, Enum):
    WEB = "WEB"
    IOS = "IOS"
    ANDROID = "ANDROID"


class CustomDimensionConfig(BaseModel):
    parameter_name: str = Field(..., description="GA4 Event or User parameter name (e.g., article_category)")
    display_name: str = Field(..., description="Human-readable name in GA4 UI (e.g., Article Category)")
    description: Optional[str] = Field(default="", description="Detailed description")
    scope: DimensionScope = Field(default=DimensionScope.EVENT, description="Dimension scope")
    disallow_ads_personalization: bool = Field(default=False, description="Exclude from ads personalization")

    @field_validator("parameter_name")
    def validate_parameter_name(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("parameter_name cannot be empty")
        if len(v) > 40:
            raise ValueError(f"parameter_name '{v}' exceeds max length of 40 chars")
        return v


class CustomMetricConfig(BaseModel):
    parameter_name: str = Field(..., description="GA4 Event parameter name for metric (e.g., scroll_depth_pct)")
    display_name: str = Field(..., description="Human-readable name in GA4 UI (e.g., Scroll Depth)")
    description: Optional[str] = Field(default="", description="Detailed description")
    measurement_unit: MeasurementUnit = Field(default=MeasurementUnit.STANDARD, description="Unit of measurement")
    scope: MetricScope = Field(default=MetricScope.EVENT, description="Metric scope")

    @field_validator("parameter_name")
    def validate_parameter_name(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("parameter_name cannot be empty")
        if len(v) > 40:
            raise ValueError(f"parameter_name '{v}' exceeds max length of 40 chars")
        return v


class DataStreamConfig(BaseModel):
    name: str = Field(..., description="Stream display name")
    type: DataStreamType = Field(default=DataStreamType.WEB, description="Stream platform type")
    default_uri: Optional[str] = Field(default=None, description="Required for WEB streams, e.g., https://example.com")


class PropertyConfig(BaseModel):
    property_id: Optional[str] = Field(
        default=None,
        description="Existing GA4 Property ID (e.g. '123456789' or 'properties/123456789'). If omitted, a new property can be created under account_id."
    )
    display_name: str = Field(..., description="GA4 Property display name")
    time_zone: str = Field(default="Asia/Tokyo", description="Time zone string (e.g., Asia/Tokyo, America/New_York)")
    currency_code: str = Field(default="JPY", description="Currency code (e.g., JPY, USD, EUR)")
    industry_category: Optional[str] = Field(default="TECHNOLOGY", description="Industry category")

    def normalized_property_id(self) -> Optional[str]:
        if not self.property_id:
            return None
        pid = str(self.property_id).strip()
        if pid.startswith("properties/"):
            return pid
        return f"properties/{pid}"


class GA4ConfigFile(BaseModel):
    version: str = Field(default="1.0", description="Config schema version")
    account_id: Optional[str] = Field(
        default=None,
        description="Google Analytics Account ID (e.g. 'accounts/1234567' or '1234567') required when creating a new property"
    )
    property: PropertyConfig
    data_streams: List[DataStreamConfig] = Field(default_factory=list)
    custom_dimensions: List[CustomDimensionConfig] = Field(default_factory=list)
    custom_metrics: List[CustomMetricConfig] = Field(default_factory=list)

    def normalized_account_id(self) -> Optional[str]:
        if not self.account_id:
            return None
        aid = str(self.account_id).strip()
        if aid.startswith("accounts/"):
            return aid
        return f"accounts/{aid}"

    @classmethod
    def load_from_yaml(cls, path: Path | str) -> GA4ConfigFile:
        p = Path(path)
        if not p.exists():
            raise FileNotFoundError(f"Configuration file not found: {p}")
        with open(p, "r", encoding="utf-8") as f:
            data = yaml.safe_load(f)
        return cls.model_validate(data)

    def save_to_yaml(self, path: Path | str) -> None:
        p = Path(path)
        p.parent.mkdir(parents=True, exist_ok=True)
        # Convert model to dict
        data = self.model_dump(mode="json", exclude_none=True)
        with open(p, "w", encoding="utf-8") as f:
            yaml.dump(data, f, sort_keys=False, allow_unicode=True)
