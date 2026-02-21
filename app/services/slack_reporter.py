"""Send migration report to Slack via webhook."""

from __future__ import annotations

import json
import urllib.request
from datetime import datetime, timezone

from app.services.project_manager import get_dashboard

WEBHOOK_URL = "https://runtime.codewords.ai/webhook/pipedream/webhook/cmlw9n5ug000811h00l0bhnql/codewords_webhook_9e187b1a/webhook_to_slack_112a3236/webhook"


def send_report(project_id: str, webhook_url: str | None = None) -> dict:
    """Gather dashboard metrics and POST them to the webhook."""
    dashboard = get_dashboard(project_id)

    money_saved = round((dashboard.dead_code_lines / 10) * 75)
    dead_pct = round(dashboard.dead_code_lines / max(dashboard.total_lines, 1) * 100, 1)

    report = {
        "project_name": dashboard.project_name,
        "status": dashboard.status.value,
        "total_files": dashboard.total_files,
        "migrated_files": dashboard.migrated_files,
        "migration_percentage": dashboard.migration_percentage,
        "total_lines": dashboard.total_lines,
        "dead_code_lines": dashboard.dead_code_lines,
        "dead_code_percentage": dead_pct,
        "lines_after_cleanup": dashboard.lines_after_cleanup,
        "estimated_savings_usd": money_saved,
        "risk_distribution": dashboard.risk_distribution,
        "confidence_distribution": dashboard.confidence_distribution,
        "blockers": dashboard.blockers,
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }

    url = webhook_url or WEBHOOK_URL
    data = json.dumps(report).encode()
    req = urllib.request.Request(url, data=data, headers={"Content-Type": "application/json"})

    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            return {"status": "sent", "project_name": dashboard.project_name, "http_status": resp.status}
    except Exception as e:
        return {"status": "error", "error": str(e)}
