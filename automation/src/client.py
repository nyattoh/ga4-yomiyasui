from __future__ import annotations

import os
from pathlib import Path
from typing import Any, Dict, List, Optional
from google.analytics.admin import AnalyticsAdminServiceClient
from google.analytics.admin_v1beta import (
    CreateCustomDimensionRequest,
    CreateCustomMetricRequest,
    CreateDataStreamRequest,
    CreatePropertyRequest,
    CustomDimension,
    CustomMetric,
    DataStream,
    Property,
    UpdateCustomDimensionRequest,
    UpdateCustomMetricRequest,
    UpdatePropertyRequest,
)
from google.protobuf import field_mask_pb2
from google.oauth2 import service_account
from google.api_core.exceptions import NotFound


class GA4AdminClient:
    """Wrapper around Google Analytics Admin API v1beta client."""

    def __init__(
        self,
        credentials_path: Optional[Path | str] = None,
        client: Optional[AnalyticsAdminServiceClient] = None,
    ):
        if client:
            self._client = client
        else:
            self._client = self._init_client(credentials_path)

    def _init_client(self, credentials_path: Optional[Path | str]) -> AnalyticsAdminServiceClient:
        path_str = str(credentials_path) if credentials_path else os.environ.get("GOOGLE_APPLICATION_CREDENTIALS")
        if path_str and Path(path_str).exists():
            creds = service_account.Credentials.from_service_account_file(
                path_str,
                scopes=["https://www.googleapis.com/auth/analytics.edit"],
            )
            return AnalyticsAdminServiceClient(credentials=creds)
        # Fall back to default credentials (ADC)
        return AnalyticsAdminServiceClient()

    # --- Property ---

    def get_property(self, property_id: str) -> Optional[Dict[str, Any]]:
        norm_id = property_id if property_id.startswith("properties/") else f"properties/{property_id}"
        try:
            prop = self._client.get_property(name=norm_id)
            return {
                "name": prop.name,
                "display_name": prop.display_name,
                "time_zone": prop.time_zone,
                "currency_code": prop.currency_code,
                "industry_category": str(prop.industry_category.name) if prop.industry_category else None,
            }
        except NotFound:
            return None

    def create_property(
        self,
        parent_account: str,
        display_name: str,
        time_zone: str = "Asia/Tokyo",
        currency_code: str = "JPY",
        industry_category: Optional[str] = None,
    ) -> Dict[str, Any]:
        norm_account = parent_account if parent_account.startswith("accounts/") else f"accounts/{parent_account}"
        prop = Property(
            parent=norm_account,
            display_name=display_name,
            time_zone=time_zone,
            currency_code=currency_code,
        )
        req = CreatePropertyRequest(property=prop)
        res = self._client.create_property(request=req)
        return {
            "name": res.name,
            "display_name": res.display_name,
            "time_zone": res.time_zone,
            "currency_code": res.currency_code,
        }

    def update_property(self, property_name: str, fields: Dict[str, Any]) -> Dict[str, Any]:
        prop = Property(name=property_name)
        paths = []
        for k, v in fields.items():
            setattr(prop, k, v)
            paths.append(k)

        mask = field_mask_pb2.FieldMask(paths=paths)
        req = UpdatePropertyRequest(property=prop, update_mask=mask)
        res = self._client.update_property(request=req)
        return {
            "name": res.name,
            "display_name": res.display_name,
            "time_zone": res.time_zone,
            "currency_code": res.currency_code,
        }

    # --- Data Streams ---

    def list_data_streams(self, property_id: str) -> List[Dict[str, Any]]:
        norm_id = property_id if property_id.startswith("properties/") else f"properties/{property_id}"
        results = []
        try:
            for stream in self._client.list_data_streams(parent=norm_id):
                item = {
                    "name": stream.name,
                    "display_name": stream.display_name,
                    "type": str(stream.type_.name),
                }
                if stream.web_stream_data:
                    item["default_uri"] = stream.web_stream_data.default_uri
                    item["measurement_id"] = stream.web_stream_data.measurement_id
                results.append(item)
        except NotFound:
            return []
        return results

    def create_web_data_stream(
        self, property_id: str, display_name: str, default_uri: str
    ) -> Dict[str, Any]:
        norm_id = property_id if property_id.startswith("properties/") else f"properties/{property_id}"
        stream = DataStream(
            display_name=display_name,
            type_=DataStream.DataStreamType.WEB_DATA_STREAM,
            web_stream_data=DataStream.WebStreamData(default_uri=default_uri),
        )
        req = CreateDataStreamRequest(parent=norm_id, data_stream=stream)
        res = self._client.create_data_stream(request=req)
        return {
            "name": res.name,
            "display_name": res.display_name,
            "type": "WEB_DATA_STREAM",
            "measurement_id": res.web_stream_data.measurement_id if res.web_stream_data else None,
        }

    # --- Custom Dimensions ---

    def list_custom_dimensions(self, property_id: str) -> List[Dict[str, Any]]:
        norm_id = property_id if property_id.startswith("properties/") else f"properties/{property_id}"
        results = []
        try:
            for dim in self._client.list_custom_dimensions(parent=norm_id):
                results.append({
                    "name": dim.name,
                    "parameter_name": dim.parameter_name,
                    "display_name": dim.display_name,
                    "description": dim.description,
                    "scope": str(dim.scope.name),
                    "disallow_ads_personalization": dim.disallow_ads_personalization,
                })
        except NotFound:
            return []
        return results

    def create_custom_dimension(
        self,
        property_id: str,
        parameter_name: str,
        display_name: str,
        description: str = "",
        scope: str = "EVENT",
        disallow_ads_personalization: bool = False,
    ) -> Dict[str, Any]:
        norm_id = property_id if property_id.startswith("properties/") else f"properties/{property_id}"
        dim = CustomDimension(
            parameter_name=parameter_name,
            display_name=display_name,
            description=description,
            scope=CustomDimension.DimensionScope[scope],
            disallow_ads_personalization=disallow_ads_personalization,
        )
        req = CreateCustomDimensionRequest(parent=norm_id, custom_dimension=dim)
        res = self._client.create_custom_dimension(request=req)
        return {
            "name": res.name,
            "parameter_name": res.parameter_name,
            "display_name": res.display_name,
            "scope": str(res.scope.name),
        }

    def update_custom_dimension(
        self,
        resource_name: str,
        display_name: Optional[str] = None,
        description: Optional[str] = None,
        disallow_ads_personalization: Optional[bool] = None,
    ) -> Dict[str, Any]:
        dim = CustomDimension(name=resource_name)
        paths = []
        if display_name is not None:
            dim.display_name = display_name
            paths.append("display_name")
        if description is not None:
            dim.description = description
            paths.append("description")
        if disallow_ads_personalization is not None:
            dim.disallow_ads_personalization = disallow_ads_personalization
            paths.append("disallow_ads_personalization")

        mask = field_mask_pb2.FieldMask(paths=paths)
        req = UpdateCustomDimensionRequest(custom_dimension=dim, update_mask=mask)
        res = self._client.update_custom_dimension(request=req)
        return {
            "name": res.name,
            "parameter_name": res.parameter_name,
            "display_name": res.display_name,
        }

    # --- Custom Metrics ---

    def list_custom_metrics(self, property_id: str) -> List[Dict[str, Any]]:
        norm_id = property_id if property_id.startswith("properties/") else f"properties/{property_id}"
        results = []
        try:
            for met in self._client.list_custom_metrics(parent=norm_id):
                results.append({
                    "name": met.name,
                    "parameter_name": met.parameter_name,
                    "display_name": met.display_name,
                    "description": met.description,
                    "measurement_unit": str(met.measurement_unit.name),
                    "scope": str(met.scope.name),
                })
        except NotFound:
            return []
        return results

    def create_custom_metric(
        self,
        property_id: str,
        parameter_name: str,
        display_name: str,
        description: str = "",
        measurement_unit: str = "STANDARD",
        scope: str = "EVENT",
    ) -> Dict[str, Any]:
        norm_id = property_id if property_id.startswith("properties/") else f"properties/{property_id}"
        met = CustomMetric(
            parameter_name=parameter_name,
            display_name=display_name,
            description=description,
            measurement_unit=CustomMetric.MeasurementUnit[measurement_unit],
            scope=CustomMetric.MetricScope[scope],
        )
        req = CreateCustomMetricRequest(parent=norm_id, custom_metric=met)
        res = self._client.create_custom_metric(request=req)
        return {
            "name": res.name,
            "parameter_name": res.parameter_name,
            "display_name": res.display_name,
            "measurement_unit": str(res.measurement_unit.name),
        }

    def update_custom_metric(
        self,
        resource_name: str,
        display_name: Optional[str] = None,
        description: Optional[str] = None,
        measurement_unit: Optional[str] = None,
    ) -> Dict[str, Any]:
        met = CustomMetric(name=resource_name)
        paths = []
        if display_name is not None:
            met.display_name = display_name
            paths.append("display_name")
        if description is not None:
            met.description = description
            paths.append("description")
        if measurement_unit is not None:
            met.measurement_unit = CustomMetric.MeasurementUnit[measurement_unit]
            paths.append("measurement_unit")

        mask = field_mask_pb2.FieldMask(paths=paths)
        req = UpdateCustomMetricRequest(custom_metric=met, update_mask=mask)
        res = self._client.update_custom_metric(request=req)
        return {
            "name": res.name,
            "parameter_name": res.parameter_name,
            "display_name": res.display_name,
        }
