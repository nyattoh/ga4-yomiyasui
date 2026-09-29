from src.quota import check_quotas


def test_quota_within_limits():
    current = {
        "event_dimensions": 10,
        "user_dimensions": 5,
        "item_dimensions": 2,
        "custom_metrics": 5,
    }
    to_add = {
        "event_dimensions": 5,
        "user_dimensions": 2,
        "item_dimensions": 1,
        "custom_metrics": 3,
    }

    report = check_quotas(current, to_add, is_ga360=False)
    assert report.is_valid is True
    assert len(report.errors) == 0
    assert len(report.warnings) == 0


def test_quota_warning_at_80_percent():
    current = {"event_dimensions": 38}  # 38 + 2 = 40 (40/50 = 80%)
    to_add = {"event_dimensions": 2}

    report = check_quotas(current, to_add, is_ga360=False)
    assert report.is_valid is True
    assert len(report.warnings) == 1
    assert "reaching 40/50" in report.warnings[0]


def test_quota_exceeded():
    current = {"user_dimensions": 24}
    to_add = {"user_dimensions": 3}  # Total 27 > 25 limit for standard

    report = check_quotas(current, to_add, is_ga360=False)
    assert report.is_valid is False
    assert len(report.errors) == 1
    assert "exceeds GA4 Standard limit of 25" in report.errors[0]

    # Under GA360 (limit 100), 27 should be valid
    report_360 = check_quotas(current, to_add, is_ga360=True)
    assert report_360.is_valid is True
    assert len(report_360.errors) == 0
