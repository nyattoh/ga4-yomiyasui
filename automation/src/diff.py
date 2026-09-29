from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Dict, List, Optional
from src.schema import (
    CustomDimensionConfig,
    CustomMetricConfig,
    DataStreamConfig,
    DimensionScope,
    GA4ConfigFile,
    MetricScope,
    PropertyConfig,
)
from src.quota import check_quotas, QuotaUsageReport


class ActionType(str, Enum):
    CREATE = "CREATE"
    UPDATE = "UPDATE"
    NOOP = "NOOP"
    SKIP = "SKIP"


@dataclass
class PlanAction:
    resource_type: str  # "property", "data_stream", "custom_dimension", "custom_metric"
    identifier: str     # e.g., "event_category [EVENT]"
    action: ActionType
    details: Dict[str, Any]
    reason: str = ""


@dataclass
class ExecutionPlan:
    property_action: Optional[PlanAction]
    data_stream_actions: List[PlanAction] = field(default_factory=list)
    custom_dimension_actions: List[PlanAction] = field(default_factory=list)
    custom_metric_actions: List[PlanAction] = field(default_factory=list)
    quota_report: Optional[QuotaUsageReport] = None

    @property
    def total_creates(self) -> int:
        count = 0
        if self.property_action and self.property_action.action == ActionType.CREATE:
            count += 1
        count += sum(1 for a in self.data_stream_actions if a.action == ActionType.CREATE)
        count += sum(1 for a in self.custom_dimension_actions if a.action == ActionType.CREATE)
        count += sum(1 for a in self.custom_metric_actions if a.action == ActionType.CREATE)
        return count

    @property
    def total_updates(self) -> int:
        count = 0
        if self.property_action and self.property_action.action == ActionType.UPDATE:
            count += 1
        count += sum(1 for a in self.data_stream_actions if a.action == ActionType.UPDATE)
        count += sum(1 for a in self.custom_dimension_actions if a.action == ActionType.UPDATE)
        count += sum(1 for a in self.custom_metric_actions if a.action == ActionType.UPDATE)
        return count

    @property
    def total_noops(self) -> int:
        count = 0
        if self.property_action and self.property_action.action == ActionType.NOOP:
            count += 1
        count += sum(1 for a in self.data_stream_actions if a.action == ActionType.NOOP)
        count += sum(1 for a in self.custom_dimension_actions if a.action == ActionType.NOOP)
        count += sum(1 for a in self.custom_metric_actions if a.action == ActionType.NOOP)
        return count


def compute_plan(
    config: GA4ConfigFile,
    remote_property: Optional[Dict[str, Any]],
    remote_streams: List[Dict[str, Any]],
    remote_dimensions: List[Dict[str, Any]],
    remote_metrics: List[Dict[str, Any]],
    is_ga360: bool = False,
) -> ExecutionPlan:
    """Compare local configuration with current remote GA4 state and generate an execution plan."""

    # 1. Property Action
    property_action: Optional[PlanAction] = None
    if remote_property is None:
        property_action = PlanAction(
            resource_type="property",
            identifier=config.property.display_name,
            action=ActionType.CREATE,
            details={
                "display_name": config.property.display_name,
                "time_zone": config.property.time_zone,
                "currency_code": config.property.currency_code,
                "account_id": config.normalized_account_id(),
            },
            reason="Property does not exist or property_id is not specified.",
        )
    else:
        # Check updates for property
        diffs = {}
        if remote_property.get("display_name") != config.property.display_name:
            diffs["display_name"] = (remote_property.get("display_name"), config.property.display_name)
        if remote_property.get("time_zone") != config.property.time_zone:
            diffs["time_zone"] = (remote_property.get("time_zone"), config.property.time_zone)
        if remote_property.get("currency_code") != config.property.currency_code:
            diffs["currency_code"] = (remote_property.get("currency_code"), config.property.currency_code)

        if diffs:
            property_action = PlanAction(
                resource_type="property",
                identifier=remote_property.get("name", config.property.display_name),
                action=ActionType.UPDATE,
                details=diffs,
                reason="Property metadata updated in config.",
            )
        else:
            property_action = PlanAction(
                resource_type="property",
                identifier=remote_property.get("name", config.property.display_name),
                action=ActionType.NOOP,
                details={},
                reason="Property configuration matches remote state.",
            )

    # 2. Data Streams Action
    stream_actions: List[PlanAction] = []
    # Map remote streams by URI or name
    existing_stream_keys = set()
    for s in remote_streams:
        # uri for web, or display_name
        uri = s.get("default_uri", "").rstrip("/")
        name = s.get("display_name", "")
        if uri:
            existing_stream_keys.add(uri)
        if name:
            existing_stream_keys.add(name)

    for stream in config.data_streams:
        key = (stream.default_uri or "").rstrip("/") or stream.name
        if key in existing_stream_keys:
            stream_actions.append(
                PlanAction(
                    resource_type="data_stream",
                    identifier=f"{stream.name} ({stream.type.value})",
                    action=ActionType.NOOP,
                    details={"name": stream.name, "default_uri": stream.default_uri},
                    reason="Stream already exists on remote.",
                )
            )
        else:
            stream_actions.append(
                PlanAction(
                    resource_type="data_stream",
                    identifier=f"{stream.name} ({stream.type.value})",
                    action=ActionType.CREATE,
                    details={"name": stream.name, "type": stream.type.value, "default_uri": stream.default_uri},
                    reason="New stream to create.",
                )
            )

    # 3. Custom Dimensions
    dim_actions: List[PlanAction] = []
    remote_dim_map: Dict[tuple, Dict[str, Any]] = {}
    for d in remote_dimensions:
        pkey = (d.get("parameter_name"), d.get("scope"))
        remote_dim_map[pkey] = d

    current_dim_counts = {
        "event_dimensions": sum(1 for d in remote_dimensions if d.get("scope") == "EVENT"),
        "user_dimensions": sum(1 for d in remote_dimensions if d.get("scope") == "USER"),
        "item_dimensions": sum(1 for d in remote_dimensions if d.get("scope") == "ITEM"),
    }
    to_add_dim_counts = {
        "event_dimensions": 0,
        "user_dimensions": 0,
        "item_dimensions": 0,
    }

    for dim in config.custom_dimensions:
        pkey = (dim.parameter_name, dim.scope.value)
        identifier = f"{dim.parameter_name} [{dim.scope.value}]"

        if pkey in remote_dim_map:
            remote_d = remote_dim_map[pkey]
            diffs = {}
            if remote_d.get("display_name") != dim.display_name:
                diffs["display_name"] = (remote_d.get("display_name"), dim.display_name)
            if remote_d.get("description", "") != (dim.description or ""):
                diffs["description"] = (remote_d.get("description", ""), dim.description or "")
            if remote_d.get("disallow_ads_personalization", False) != dim.disallow_ads_personalization:
                diffs["disallow_ads_personalization"] = (
                    remote_d.get("disallow_ads_personalization", False),
                    dim.disallow_ads_personalization,
                )

            if diffs:
                dim_actions.append(
                    PlanAction(
                        resource_type="custom_dimension",
                        identifier=identifier,
                        action=ActionType.UPDATE,
                        details={"resource_name": remote_d.get("name"), "diffs": diffs},
                        reason="Display name or description modified.",
                    )
                )
            else:
                dim_actions.append(
                    PlanAction(
                        resource_type="custom_dimension",
                        identifier=identifier,
                        action=ActionType.NOOP,
                        details={"resource_name": remote_d.get("name")},
                        reason="Matches remote configuration.",
                    )
                )
        else:
            # Count to add
            if dim.scope == DimensionScope.EVENT:
                to_add_dim_counts["event_dimensions"] += 1
            elif dim.scope == DimensionScope.USER:
                to_add_dim_counts["user_dimensions"] += 1
            elif dim.scope == DimensionScope.ITEM:
                to_add_dim_counts["item_dimensions"] += 1

            dim_actions.append(
                PlanAction(
                    resource_type="custom_dimension",
                    identifier=identifier,
                    action=ActionType.CREATE,
                    details={
                        "parameter_name": dim.parameter_name,
                        "display_name": dim.display_name,
                        "description": dim.description,
                        "scope": dim.scope.value,
                        "disallow_ads_personalization": dim.disallow_ads_personalization,
                    },
                    reason="New custom dimension to create.",
                )
            )

    # 4. Custom Metrics
    metric_actions: List[PlanAction] = []
    remote_metric_map: Dict[tuple, Dict[str, Any]] = {}
    for m in remote_metrics:
        pkey = (m.get("parameter_name"), m.get("scope"))
        remote_metric_map[pkey] = m

    current_metric_counts = {
        "custom_metrics": len(remote_metrics),
    }
    to_add_metric_counts = {
        "custom_metrics": 0,
    }

    for metric in config.custom_metrics:
        pkey = (metric.parameter_name, metric.scope.value)
        identifier = f"{metric.parameter_name} [{metric.scope.value}]"

        if pkey in remote_metric_map:
            remote_m = remote_metric_map[pkey]
            diffs = {}
            if remote_m.get("display_name") != metric.display_name:
                diffs["display_name"] = (remote_m.get("display_name"), metric.display_name)
            if remote_m.get("description", "") != (metric.description or ""):
                diffs["description"] = (remote_m.get("description", ""), metric.description or "")
            if remote_m.get("measurement_unit") != metric.measurement_unit.value:
                diffs["measurement_unit"] = (remote_m.get("measurement_unit"), metric.measurement_unit.value)

            if diffs:
                metric_actions.append(
                    PlanAction(
                        resource_type="custom_metric",
                        identifier=identifier,
                        action=ActionType.UPDATE,
                        details={"resource_name": remote_m.get("name"), "diffs": diffs},
                        reason="Metadata or unit modified.",
                    )
                )
            else:
                metric_actions.append(
                    PlanAction(
                        resource_type="custom_metric",
                        identifier=identifier,
                        action=ActionType.NOOP,
                        details={"resource_name": remote_m.get("name")},
                        reason="Matches remote configuration.",
                    )
                )
        else:
            to_add_metric_counts["custom_metrics"] += 1
            metric_actions.append(
                PlanAction(
                    resource_type="custom_metric",
                    identifier=identifier,
                    action=ActionType.CREATE,
                    details={
                        "parameter_name": metric.parameter_name,
                        "display_name": metric.display_name,
                        "description": metric.description,
                        "measurement_unit": metric.measurement_unit.value,
                        "scope": metric.scope.value,
                    },
                    reason="New custom metric to create.",
                )
            )

    # 5. Check Quotas
    current_counts = {**current_dim_counts, **current_metric_counts}
    to_add_counts = {**to_add_dim_counts, **to_add_metric_counts}
    quota_report = check_quotas(current_counts, to_add_counts, is_ga360=is_ga360)

    return ExecutionPlan(
        property_action=property_action,
        data_stream_actions=stream_actions,
        custom_dimension_actions=dim_actions,
        custom_metric_actions=metric_actions,
        quota_report=quota_report,
    )
