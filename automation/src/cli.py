import sys
import warnings
from pathlib import Path
from typing import Optional

# Suppress benign urllib3/requests version mismatch warning on Windows
warnings.filterwarnings("ignore", category=UserWarning, module="requests")

import click
from rich.console import Console
from rich.panel import Panel
from rich.table import Table

from src.client import GA4AdminClient
from src.diff import ActionType, compute_plan, ExecutionPlan, PlanAction
from src.quota import check_quotas
from src.schema import (
    CustomDimensionConfig,
    CustomMetricConfig,
    DataStreamConfig,
    DataStreamType,
    DimensionScope,
    GA4ConfigFile,
    MeasurementUnit,
    MetricScope,
    PropertyConfig,
)

console = Console()


def print_plan_summary(plan: ExecutionPlan) -> None:
    table = Table(title="Execution Plan Details", show_header=True, header_style="bold magenta")
    table.add_column("Type", style="cyan", width=18)
    table.add_column("Identifier", style="bold")
    table.add_column("Action", justify="center", width=10)
    table.add_column("Details", style="dim")

    all_actions = []
    if plan.property_action:
        all_actions.append(plan.property_action)
    all_actions.extend(plan.data_stream_actions)
    all_actions.extend(plan.custom_dimension_actions)
    all_actions.extend(plan.custom_metric_actions)

    for action in all_actions:
        style_color = "green" if action.action == ActionType.CREATE else (
            "yellow" if action.action == ActionType.UPDATE else "dim"
        )
        badge = f"[{style_color}][bold]{action.action.value}[/bold][/{style_color}]"

        details_str = action.reason
        if action.action == ActionType.UPDATE and "diffs" in action.details:
            diff_lines = [f"{k}: {v[0]} -> {v[1]}" for k, v in action.details["diffs"].items()]
            details_str = f"{action.reason} ({', '.join(diff_lines)})"

        table.add_row(action.resource_type, action.identifier, badge, details_str)

    console.print(table)

    # Quota report
    if plan.quota_report:
        quota_table = Table(title="GA4 Quota Guardrail Analysis", show_header=True)
        quota_table.add_column("Quota Category", style="cyan")
        quota_table.add_column("Planned Total", justify="right")
        quota_table.add_column("Limit", justify="right")
        quota_table.add_column("Capacity %", justify="right")
        quota_table.add_column("Status", justify="center")

        for cat, (total, max_lim) in plan.quota_report.usage.items():
            pct = int((total / max_lim) * 100) if max_lim > 0 else 0
            if total > max_lim:
                status = "[bold red]EXCEEDED[/bold red]"
                pct_str = f"[bold red]{pct}%[/bold red]"
            elif pct >= 80:
                status = "[bold yellow]WARNING[/bold yellow]"
                pct_str = f"[bold yellow]{pct}%[/bold yellow]"
            else:
                status = "[green]OK[/green]"
                pct_str = f"[green]{pct}%[/green]"

            cat_readable = cat.replace("_", " ").title()
            quota_table.add_row(cat_readable, str(total), str(max_lim), pct_str, status)

        console.print(quota_table)

        if plan.quota_report.warnings:
            for w in plan.quota_report.warnings:
                console.print(f"[bold yellow]![/bold yellow] {w}")

        if plan.quota_report.errors:
            for e in plan.quota_report.errors:
                console.print(f"[bold red]X[/bold red] {e}")

    summary_panel = Panel(
        f"[green]+ {plan.total_creates} to create[/green]  |  "
        f"[yellow]~ {plan.total_updates} to update[/yellow]  |  "
        f"[dim]= {plan.total_noops} unchanged[/dim]",
        title="[bold]Plan Summary[/bold]",
        expand=False,
    )
    console.print(summary_panel)


@click.group()
def cli():
    """GA4 Setup Automation - Declarative Tracking-as-Code CLI."""
    pass


@cli.command("plan")
@click.option("--config", "-c", required=True, type=click.Path(exists=True), help="Path to YAML configuration file.")
@click.option("--credentials", "-k", type=str, default=None, help="Service Account JSON path.")
@click.option("--offline", is_flag=True, default=False, help="Run in offline mode (local validation & simulation without Google API connection).")
@click.option("--ga360", is_flag=True, default=False, help="Enable GA4 360 higher quota limits.")
def plan_command(config: str, credentials: Optional[str], offline: bool, ga360: bool):
    """Inspect differences between local config and remote GA4 property (dry-run)."""
    cfg = GA4ConfigFile.load_from_yaml(config)
    console.print(f"[bold cyan]Reading configuration:[/] {config}")
    console.print(f"Target Property: [bold]{cfg.property.display_name}[/]")

    remote_prop = None
    remote_streams = []
    remote_dims = []
    remote_metrics = []

    if offline:
        console.print("[yellow][Offline Mode][/yellow] Simulating new deployment against clean state (No Google API calls).")
    else:
        if credentials and not Path(credentials).exists():
            console.print(f"[bold red]Error: Credentials file not found:[/] {credentials}")
            console.print("[dim]Tip: If you do not have a service account key yet, run with [bold]--offline[/bold] to test locally.[/dim]")
            sys.exit(1)

        try:
            client = GA4AdminClient(credentials_path=credentials)
            prop_id = cfg.property.normalized_property_id()
            if prop_id:
                remote_prop = client.get_property(prop_id)
                if remote_prop:
                    remote_streams = client.list_data_streams(prop_id)
                    remote_dims = client.list_custom_dimensions(prop_id)
                    remote_metrics = client.list_custom_metrics(prop_id)
        except Exception as exc:
            console.print(f"[bold red]Failed to connect to Google Analytics Admin API:[/] {exc}")
            console.print("[dim]Tip: Check your service account permissions, or run with [bold]--offline[/bold] to preview without connecting.[/dim]")
            sys.exit(1)

    plan = compute_plan(
        config=cfg,
        remote_property=remote_prop,
        remote_streams=remote_streams,
        remote_dimensions=remote_dims,
        remote_metrics=remote_metrics,
        is_ga360=ga360,
    )

    print_plan_summary(plan)

    if plan.quota_report and not plan.quota_report.is_valid:
        console.print("[bold red]Plan failed quota validation. Reduce items or use GA360.[/bold red]")
        sys.exit(1)


@cli.command("apply")
@click.option("--config", "-c", required=True, type=click.Path(exists=True), help="Path to YAML configuration file.")
@click.option("--credentials", "-k", type=click.Path(exists=True), default=None, help="Service Account JSON path.")
@click.option("--auto-approve", is_flag=True, default=False, help="Skip interactive approval prompt.")
@click.option("--ga360", is_flag=True, default=False, help="Enable GA4 360 higher quota limits.")
def apply_command(config: str, credentials: Optional[str], auto_approve: bool, ga360: bool):
    """Apply the configuration to GA4 property idempotently."""
    cfg = GA4ConfigFile.load_from_yaml(config)
    client = GA4AdminClient(credentials_path=credentials)

    prop_id = cfg.property.normalized_property_id()
    remote_prop = None
    remote_streams = []
    remote_dims = []
    remote_metrics = []

    if prop_id:
        remote_prop = client.get_property(prop_id)
        if remote_prop:
            remote_streams = client.list_data_streams(prop_id)
            remote_dims = client.list_custom_dimensions(prop_id)
            remote_metrics = client.list_custom_metrics(prop_id)

    plan = compute_plan(
        config=cfg,
        remote_property=remote_prop,
        remote_streams=remote_streams,
        remote_dimensions=remote_dims,
        remote_metrics=remote_metrics,
        is_ga360=ga360,
    )

    print_plan_summary(plan)

    if plan.quota_report and not plan.quota_report.is_valid:
        console.print("[bold red]Cannot apply: Quota validation failed.[/bold red]")
        sys.exit(1)

    if plan.total_creates == 0 and plan.total_updates == 0:
        console.print("[green]No changes needed. Infrastructure matches configuration.[/green]")
        return

    if not auto_approve:
        if not click.confirm("\nDo you want to perform these actions?"):
            console.print("[yellow]Apply cancelled.[/yellow]")
            return

    console.print("\n[bold cyan]Applying changes...[/bold cyan]")

    # 1. Apply property
    target_property_name = prop_id
    if plan.property_action and plan.property_action.action == ActionType.CREATE:
        account_id = cfg.normalized_account_id()
        if not account_id:
            console.print("[bold red]Error: account_id must be provided to create a new property.[/bold red]")
            sys.exit(1)
        console.print(f"Creating property [bold]{cfg.property.display_name}[/] under {account_id}...")
        created_p = client.create_property(
            parent_account=account_id,
            display_name=cfg.property.display_name,
            time_zone=cfg.property.time_zone,
            currency_code=cfg.property.currency_code,
        )
        target_property_name = created_p["name"]
        console.print(f"[green]Created property:[/] {target_property_name}")
        # Persist so subsequent plan/apply do not attempt CREATE again
        cfg.property.property_id = target_property_name
        cfg.save_to_yaml(config)
        console.print(f"[dim]Wrote property_id back to {config}[/dim]")
    elif plan.property_action and plan.property_action.action == ActionType.UPDATE:
        diffs = plan.property_action.details
        fields_to_update = {k: v[1] for k, v in diffs.items()}
        console.print(f"Updating property metadata for {target_property_name}...")
        client.update_property(target_property_name, fields_to_update)
        console.print(f"[green]Updated property metadata.[/green]")

    if not target_property_name:
        console.print("[bold red]Target property is required to proceed with streams and dimensions.[/bold red]")
        sys.exit(1)

    # 2. Apply Data Streams
    for action in plan.data_stream_actions:
        if action.action == ActionType.CREATE:
            d = action.details
            stream_type = d.get("type")
            if stream_type == "WEB":
                console.print(f"Creating Web Data Stream [bold]{d['name']}[/] ({d.get('default_uri')})...")
                res = client.create_web_data_stream(
                    property_id=target_property_name,
                    display_name=d["name"],
                    default_uri=d.get("default_uri", ""),
                )
                console.print(f"[green]Created stream:[/] {res['display_name']} (Measurement ID: {res.get('measurement_id')})")
            else:
                console.print(
                    f"[bold red]Error: Unsupported data stream type '{stream_type}'. "
                    f"Apply currently supports WEB only; refusing to silently skip '{d.get('name')}'.[/bold red]"
                )
                sys.exit(1)

    # 3. Apply Custom Dimensions
    for action in plan.custom_dimension_actions:
        if action.action == ActionType.CREATE:
            d = action.details
            console.print(f"Creating custom dimension [bold]{d['parameter_name']}[/] [{d['scope']}]...")
            client.create_custom_dimension(
                property_id=target_property_name,
                parameter_name=d["parameter_name"],
                display_name=d["display_name"],
                description=d.get("description", ""),
                scope=d["scope"],
                disallow_ads_personalization=d.get("disallow_ads_personalization", False),
            )
            console.print(f"[green]Created dimension:[/] {d['parameter_name']}")
        elif action.action == ActionType.UPDATE:
            d = action.details
            res_name = d["resource_name"]
            diffs = d.get("diffs", {})
            updates = {}
            for field, (_, new_val) in diffs.items():
                updates[field] = new_val
            console.print(f"Updating custom dimension [bold]{action.identifier}[/]...")
            client.update_custom_dimension(
                resource_name=res_name,
                display_name=updates.get("display_name"),
                description=updates.get("description"),
                disallow_ads_personalization=updates.get("disallow_ads_personalization"),
            )
            console.print(f"[green]Updated dimension:[/] {action.identifier}")

    # 4. Apply Custom Metrics
    for action in plan.custom_metric_actions:
        if action.action == ActionType.CREATE:
            d = action.details
            console.print(f"Creating custom metric [bold]{d['parameter_name']}[/] [{d['scope']}]...")
            client.create_custom_metric(
                property_id=target_property_name,
                parameter_name=d["parameter_name"],
                display_name=d["display_name"],
                description=d.get("description", ""),
                measurement_unit=d.get("measurement_unit", "STANDARD"),
                scope=d.get("scope", "EVENT"),
            )
            console.print(f"[green]Created metric:[/] {d['parameter_name']}")
        elif action.action == ActionType.UPDATE:
            d = action.details
            res_name = d["resource_name"]
            diffs = d.get("diffs", {})
            updates = {}
            for field, (_, new_val) in diffs.items():
                updates[field] = new_val
            console.print(f"Updating custom metric [bold]{action.identifier}[/]...")
            client.update_custom_metric(
                resource_name=res_name,
                display_name=updates.get("display_name"),
                description=updates.get("description"),
                measurement_unit=updates.get("measurement_unit"),
            )
            console.print(f"[green]Updated metric:[/] {action.identifier}")

    console.print("\n[bold green]Apply complete! All resources successfully synchronized.[/bold green]")


@cli.command("inspect")
@click.option("--property-id", "-p", required=True, help="GA4 Property ID (e.g. 123456789 or properties/123456789).")
@click.option("--credentials", "-k", type=click.Path(exists=True), default=None, help="Service Account JSON path.")
@click.option("--ga360", is_flag=True, default=False, help="Calculate capacity against GA4 360 limits.")
def inspect_command(property_id: str, credentials: Optional[str], ga360: bool):
    """Inspect existing GA4 property configuration and quota consumption."""
    client = GA4AdminClient(credentials_path=credentials)
    norm_id = property_id if property_id.startswith("properties/") else f"properties/{property_id}"

    console.print(f"[bold cyan]Fetching property details for:[/] {norm_id}")
    prop = client.get_property(norm_id)
    if not prop:
        console.print(f"[bold red]Could not find property {norm_id}[/bold red]")
        sys.exit(1)

    streams = client.list_data_streams(norm_id)
    dims = client.list_custom_dimensions(norm_id)
    metrics = client.list_custom_metrics(norm_id)

    console.print(f"Property Name: [bold]{prop.get('display_name')}[/bold]")
    console.print(f"Time Zone: {prop.get('time_zone')}, Currency: {prop.get('currency_code')}")

    # Streams Table
    stream_table = Table(title="Data Streams", show_header=True)
    stream_table.add_column("Name")
    stream_table.add_column("Type")
    stream_table.add_column("URI / Measurement ID")
    for s in streams:
        uri = s.get("default_uri", "-")
        mid = s.get("measurement_id", "")
        extra = f"{uri} ({mid})" if mid else uri
        stream_table.add_row(s.get("display_name", ""), s.get("type", ""), extra)
    console.print(stream_table)

    # Dimensions Table
    dim_table = Table(title=f"Custom Dimensions ({len(dims)} total)", show_header=True)
    dim_table.add_column("Parameter Name", style="bold")
    dim_table.add_column("Display Name")
    dim_table.add_column("Scope", justify="center")
    dim_table.add_column("Description", style="dim")
    for d in dims:
        dim_table.add_row(d.get("parameter_name"), d.get("display_name"), d.get("scope"), d.get("description", ""))
    console.print(dim_table)

    # Metrics Table
    if metrics:
        metric_table = Table(title=f"Custom Metrics ({len(metrics)} total)", show_header=True)
        metric_table.add_column("Parameter Name", style="bold")
        metric_table.add_column("Display Name")
        metric_table.add_column("Unit")
        metric_table.add_column("Description", style="dim")
        for m in metrics:
            metric_table.add_row(m.get("parameter_name"), m.get("display_name"), m.get("measurement_unit"), m.get("description", ""))
        console.print(metric_table)

    # Quota report
    counts = {
        "event_dimensions": sum(1 for d in dims if d.get("scope") == "EVENT"),
        "user_dimensions": sum(1 for d in dims if d.get("scope") == "USER"),
        "item_dimensions": sum(1 for d in dims if d.get("scope") == "ITEM"),
        "custom_metrics": len(metrics),
    }
    report = check_quotas(counts, {}, is_ga360=ga360)
    quota_table = Table(title="Quota Capacity Status", show_header=True)
    quota_table.add_column("Category")
    quota_table.add_column("Used")
    quota_table.add_column("Limit")
    quota_table.add_column("Capacity")
    for cat, (used, lim) in report.usage.items():
        pct = int((used / lim) * 100) if lim > 0 else 0
        quota_table.add_row(cat.replace("_", " ").title(), str(used), str(lim), f"{pct}%")
    console.print(quota_table)


@cli.command("export")
@click.option("--property-id", "-p", required=True, help="GA4 Property ID (e.g. 123456789 or properties/123456789).")
@click.option("--output", "-o", required=True, type=click.Path(), help="Output YAML file path.")
@click.option("--credentials", "-k", type=click.Path(exists=True), default=None, help="Service Account JSON path.")
def export_command(property_id: str, output: str, credentials: Optional[str]):
    """Export existing GA4 property configuration to a declarative YAML file (Reverse Engineering / IaC)."""
    client = GA4AdminClient(credentials_path=credentials)
    norm_id = property_id if property_id.startswith("properties/") else f"properties/{property_id}"

    console.print(f"[bold cyan]Exporting GA4 property:[/] {norm_id}")
    prop = client.get_property(norm_id)
    if not prop:
        console.print(f"[bold red]Property not found: {norm_id}[/bold red]")
        sys.exit(1)

    streams = client.list_data_streams(norm_id)
    dims = client.list_custom_dimensions(norm_id)
    metrics = client.list_custom_metrics(norm_id)

    stream_configs = []
    for s in streams:
        stype = DataStreamType.WEB
        if s.get("type") == "IOS_APP_DATA_STREAM":
            stype = DataStreamType.IOS
        elif s.get("type") == "ANDROID_APP_DATA_STREAM":
            stype = DataStreamType.ANDROID
        stream_configs.append(
            DataStreamConfig(
                name=s.get("display_name", "Stream"),
                type=stype,
                default_uri=s.get("default_uri"),
            )
        )

    dim_configs = []
    for d in dims:
        scope = DimensionScope.EVENT
        if d.get("scope") == "USER":
            scope = DimensionScope.USER
        elif d.get("scope") == "ITEM":
            scope = DimensionScope.ITEM
        dim_configs.append(
            CustomDimensionConfig(
                parameter_name=d.get("parameter_name"),
                display_name=d.get("display_name"),
                description=d.get("description", ""),
                scope=scope,
                disallow_ads_personalization=d.get("disallow_ads_personalization", False),
            )
        )

    metric_configs = []
    for m in metrics:
        unit = MeasurementUnit.STANDARD
        try:
            unit = MeasurementUnit[m.get("measurement_unit", "STANDARD")]
        except Exception:
            pass
        metric_configs.append(
            CustomMetricConfig(
                parameter_name=m.get("parameter_name"),
                display_name=m.get("display_name"),
                description=m.get("description", ""),
                measurement_unit=unit,
                scope=MetricScope.EVENT,
            )
        )

    cfg = GA4ConfigFile(
        version="1.0",
        property=PropertyConfig(
            property_id=norm_id,
            display_name=prop.get("display_name", "Exported Property"),
            time_zone=prop.get("time_zone", "Asia/Tokyo"),
            currency_code=prop.get("currency_code", "JPY"),
            industry_category=prop.get("industry_category"),
        ),
        data_streams=stream_configs,
        custom_dimensions=dim_configs,
        custom_metrics=metric_configs,
    )

    cfg.save_to_yaml(output)
    console.print(f"[bold green]Successfully exported configuration to:[/] {output}")
    console.print(f"Exported {len(stream_configs)} streams, {len(dim_configs)} dimensions, {len(metric_configs)} metrics.")


def main():
    cli()


if __name__ == "__main__":
    main()
