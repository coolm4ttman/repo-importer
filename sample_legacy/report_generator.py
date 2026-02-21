#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""Report generation module — depends on both user_manager and payment_processor."""

import sys
import os
import string
from user_manager import UserManager, calculate_user_stats
from payment_processor import PaymentProcessor, CurrencyConverter


class ReportGenerator:
    """Generates business reports combining user and payment data."""

    def __init__(self, user_mgr, payment_proc):
        self.user_mgr = user_mgr
        self.payment_proc = payment_proc

    def generate_summary(self):
        """Generate full business summary report."""
        user_stats = calculate_user_stats(self.user_mgr)
        revenue = self.payment_proc.calculate_total_revenue()

        # String formatting with % — works in both but Py3 prefers f-strings
        report = "=== Business Summary ===\n"
        report += "Users: %d total, %d active\n" % (user_stats["total"], user_stats["active"])
        report += "Revenue: %s\n" % revenue["revenue"]
        report += "Fees: %s\n" % revenue["fees"]
        report += "Net: %s\n" % revenue["net"]

        # Revenue per user — integer division risk
        if user_stats["active"] > 0:
            per_user = revenue["net"] / user_stats["active"]
            report += "Revenue per active user: %s\n" % per_user

        print report
        return report

    def generate_user_report(self):
        """Generate per-user transaction report."""
        report_lines = []
        for user in self.user_mgr.get_all_users():
            username = user["username"]
            txns = list(self.payment_proc.get_transaction_history(username))
            total = reduce(lambda a, b: a + b["amount"], txns, 0) if txns else 0
            line = "%s: %d transactions, total: %s" % (username, len(txns), total)
            report_lines.append(line)
            print line

        return report_lines

    def export_csv(self, filepath):
        """Export summary as CSV."""
        users = self.user_mgr.get_all_users()
        with open(filepath, "w") as f:
            f.write("username,email,role,active\n")
            for user in users:
                line = "%s,%s,%s,%s\n" % (
                    user["username"], user["email"], user["role"], user["active"]
                )
                f.write(line)
        print "CSV exported to", filepath


class _UnusedReportCache:
    """Dead code — cache class that was never integrated."""

    def __init__(self):
        self.cache = {}

    def get(self, key):
        if self.cache.has_key(key):
            return self.cache[key]
        return None

    def set(self, key, value):
        self.cache[key] = value
