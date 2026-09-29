from src.diff import ActionType, compute_plan
from src.schema import (
    CustomDimensionConfig,
    CustomMetricConfig,
    DataStreamConfig,
    DimensionScope,
    GA4ConfigFile,
    MeasurementUnit,
    PropertyConfig,
)


def test_diff_engine_creates_and_noops():
    config = GA4ConfigFile(
        version="1.0",
        property=PropertyConfig(
            property_id="12345",
            display_name="Production App",
            time_zone="Asia/Tokyo",
            currency_code="JPY",
        ),
        data_streams=[
            DataStreamConfig(name="Web Site", default_uri="https://example.com"),
            DataStreamConfig(name="New iOS App", type="IOS"),
        ],
        custom_dimensions=[
            # This one matches remote
            CustomDimensionConfig(
                parameter_name="category",
                display_name="Content Category",
                scope=DimensionScope.EVENT,
            ),
            # This one is new
            CustomDimensionConfig(
                parameter_name="author",
                display_name="Author Name",
                scope=DimensionScope.EVENT,
            ),
            # This one is updated display_name
            CustomDimensionConfig(
                parameter_name="tier",
                display_name="Updated Tier Name",
                scope=DimensionScope.USER,
            ),
        ],
        custom_metrics=[],
    )

    remote_property = {
        "name": "properties/12345",
        "display_name": "Production App",
        "time_zone": "Asia/Tokyo",
        "currency_code": "JPY",
    }
    remote_streams = [
        {"name": "streams/1", "display_name": "Web Site", "default_uri": "https://example.com"}
    ]
    remote_dimensions = [
        {
            "name": "properties/12345/customDimensions/dim1",
            "parameter_name": "category",
            "display_name": "Content Category",
            "scope": "EVENT",
        },
        {
            "name": "properties/12345/customDimensions/dim2",
            "parameter_name": "tier",
            "display_name": "Old Tier Name",
            "scope": "USER",
        },
    ]
    remote_metrics = []

    plan = compute_plan(
        config=config,
        remote_property=remote_property,
        remote_streams=remote_streams,
        remote_dimensions=remote_dimensions,
        remote_metrics=remote_metrics,
    )

    # Property
    assert plan.property_action.action == ActionType.NOOP

    # Streams: 1 NOOP, 1 CREATE
    assert len(plan.data_stream_actions) == 2
    assert plan.data_stream_actions[0].action == ActionType.NOOP
    assert plan.data_stream_actions[1].action == ActionType.CREATE

    # Dimensions: 1 NOOP, 1 CREATE, 1 UPDATE
    assert len(plan.custom_dimension_actions) == 3
    actions = {a.identifier: a.action for a in plan.custom_dimension_actions}
    assert actions["category [EVENT]"] == ActionType.NOOP
    assert actions["author [EVENT]"] == ActionType.CREATE
    assert actions["tier [USER]"] == ActionType.UPDATE

    # Total counts
    assert plan.total_creates == 2  # 1 stream + 1 dimension
    assert plan.total_updates == 1  # 1 dimension
    assert plan.total_noops == 3    # 1 property + 1 stream + 1 dimension
