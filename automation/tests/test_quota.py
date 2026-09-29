"""クォータチェックテスト - check_quotas import対応確認"""
import pytest
from ga4_automation.quota import QuotaChecker, check_quotas


def test_quota_checker_basic():
    """基本的なクォータチェック"""
    checker = QuotaChecker(calls_per_day=100)
    
    assert checker.check() is True
    
    for _ in range(50):
        checker.record_call()
    
    stats = checker.get_stats()
    assert stats['calls_made'] == 50
    assert stats['calls_remaining'] == 50


def test_quota_checker_exceeds():
    """クォータ超過時の動作"""
    checker = QuotaChecker(calls_per_day=10)
    
    for _ in range(10):
        assert checker.check() is True
        checker.record_call()
    
    assert checker.check() is False


def test_check_quotas_import():
    """
    check_quotas がモジュールレベルでimport可能
    
    これは重要なバグフィックス: 以前は import エラーが発生していた
    """
    assert check_quotas is not None
    assert isinstance(check_quotas, QuotaChecker)
    assert hasattr(check_quotas, 'check')
    assert hasattr(check_quotas, 'record_call')
