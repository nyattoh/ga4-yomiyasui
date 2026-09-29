from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, List, Tuple
from src.schema import DimensionScope


@dataclass(frozen=True)
class QuotaLimit:
    event_dimensions: int
    user_dimensions: int
    item_dimensions: int
    custom_metrics: int


STANDARD_QUOTA = QuotaLimit(
    event_dimensions=50,
    user_dimensions=25,
    item_dimensions=10,
    custom_metrics=50,
)

GA360_QUOTA = QuotaLimit(
    event_dimensions=125,
    user_dimensions=100,
    item_dimensions=25,
    custom_metrics=125,
)


@dataclass
class QuotaUsageReport:
    is_valid: bool
    warnings: List[str]
    errors: List[str]
    usage: Dict[str, Tuple[int, int]]  # category -> (current_total, max_allowed)


def check_quotas(
    current_counts: Dict[str, int],
    to_add_counts: Dict[str, int],
    is_ga360: bool = False,
) -> QuotaUsageReport:
    """Validate planned resources against GA4 tier quotas.
    
    current_counts / to_add_counts keys:
      - "event_dimensions"
      - "user_dimensions"
      - "item_dimensions"
      - "custom_metrics"
    """
    limit = GA360_QUOTA if is_ga360 else STANDARD_QUOTA
    tier_name = "GA4 360" if is_ga360 else "GA4 Standard"

    limits_map = {
        "event_dimensions": limit.event_dimensions,
        "user_dimensions": limit.user_dimensions,
        "item_dimensions": limit.item_dimensions,
        "custom_metrics": limit.custom_metrics,
    }

    warnings: List[str] = []
    errors: List[str] = []
    usage_map: Dict[str, Tuple[int, int]] = {}

    for key, max_limit in limits_map.items():
        curr = current_counts.get(key, 0)
        adding = to_add_counts.get(key, 0)
        total = curr + adding
        usage_map[key] = (total, max_limit)

        readable_name = key.replace("_", " ").title()

        if total > max_limit:
            errors.append(
                f"[Quota Exceeded] {readable_name}: planned {total} exceeds {tier_name} limit of {max_limit} "
                f"(current: {curr}, adding: {adding})"
            )
        elif total >= int(max_limit * 0.8):
            warnings.append(
                f"[Quota Warning] {readable_name}: reaching {total}/{max_limit} "
                f"({int((total / max_limit) * 100)}% capacity of {tier_name})"
            )

    return QuotaUsageReport(
        is_valid=len(errors) == 0,
        warnings=warnings,
        errors=errors,
        usage=usage_map,
    )
