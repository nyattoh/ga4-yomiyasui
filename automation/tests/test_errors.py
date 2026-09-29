"""エラー分類テスト - NotFound vs 他のエラーを明確に区別"""
import pytest
from ga4_automation.errors import (
    classify_api_error,
    GA4NotFoundError,
    GA4PermissionError,
    GA4QuotaError,
    GA4Error,
)


def test_classify_not_found_error():
    """NotFoundエラーを正しく分類"""
    error = Exception("Resource not found")
    classified = classify_api_error(error)
    assert isinstance(classified, GA4NotFoundError)


def test_classify_404_error():
    """404エラーを正しく分類"""
    error = Exception("HTTP 404 Not Found")
    classified = classify_api_error(error)
    assert isinstance(classified, GA4NotFoundError)


def test_classify_permission_error():
    """権限エラーを正しく分類"""
    error = Exception("Permission denied")
    classified = classify_api_error(error)
    assert isinstance(classified, GA4PermissionError)


def test_classify_403_error():
    """403エラーを正しく分類"""
    error = Exception("HTTP 403 Forbidden")
    classified = classify_api_error(error)
    assert isinstance(classified, GA4PermissionError)


def test_classify_quota_error():
    """クォータエラーを正しく分類"""
    error = Exception("Quota exceeded")
    classified = classify_api_error(error)
    assert isinstance(classified, GA4QuotaError)


def test_classify_429_error():
    """429エラーを正しく分類"""
    error = Exception("HTTP 429 Too Many Requests")
    classified = classify_api_error(error)
    assert isinstance(classified, GA4QuotaError)


def test_classify_generic_error():
    """その他のエラーはGA4Errorに分類"""
    error = Exception("Unknown error")
    classified = classify_api_error(error)
    assert isinstance(classified, GA4Error)
    assert not isinstance(classified, GA4NotFoundError)
    assert not isinstance(classified, GA4PermissionError)
