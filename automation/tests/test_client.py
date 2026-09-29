from unittest.mock import MagicMock

import pytest
from google.api_core.exceptions import NotFound, PermissionDenied

from src.client import GA4AdminClient


def _wrap(mock_inner):
    return GA4AdminClient(client=mock_inner)


def test_get_property_not_found_returns_none():
    inner = MagicMock()
    inner.get_property.side_effect = NotFound("missing")
    assert _wrap(inner).get_property("properties/1") is None


def test_get_property_other_error_reraises():
    inner = MagicMock()
    inner.get_property.side_effect = PermissionDenied("denied")
    with pytest.raises(PermissionDenied):
        _wrap(inner).get_property("properties/1")


def test_list_data_streams_not_found_returns_empty():
    inner = MagicMock()
    inner.list_data_streams.side_effect = NotFound("missing")
    assert _wrap(inner).list_data_streams("properties/1") == []


def test_list_data_streams_other_error_reraises():
    inner = MagicMock()
    inner.list_data_streams.side_effect = PermissionDenied("denied")
    with pytest.raises(PermissionDenied):
        _wrap(inner).list_data_streams("properties/1")


def test_list_custom_dimensions_not_found_returns_empty():
    inner = MagicMock()
    inner.list_custom_dimensions.side_effect = NotFound("missing")
    assert _wrap(inner).list_custom_dimensions("properties/1") == []


def test_list_custom_dimensions_other_error_reraises():
    inner = MagicMock()
    inner.list_custom_dimensions.side_effect = PermissionDenied("denied")
    with pytest.raises(PermissionDenied):
        _wrap(inner).list_custom_dimensions("properties/1")


def test_list_custom_metrics_not_found_returns_empty():
    inner = MagicMock()
    inner.list_custom_metrics.side_effect = NotFound("missing")
    assert _wrap(inner).list_custom_metrics("properties/1") == []


def test_list_custom_metrics_other_error_reraises():
    inner = MagicMock()
    inner.list_custom_metrics.side_effect = PermissionDenied("denied")
    with pytest.raises(PermissionDenied):
        _wrap(inner).list_custom_metrics("properties/1")
