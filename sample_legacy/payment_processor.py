#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""Payment processing module — critical business logic."""

import sys
import os
from decimal import Decimal
from user_manager import UserManager


class PaymentProcessor:
    """Handles payment transactions."""

    def __init__(self, gateway_url):
        self.gateway_url = gateway_url
        self.transactions = []
        self.fee_rate = Decimal("0.029")

    def process_payment(self, user, amount, currency="USD"):
        if not isinstance(amount, (int, long, float, Decimal)):
            raise TypeError("Invalid amount type: %s" % type(amount))

        fee = amount * self.fee_rate
        # Integer division — semantics change in Py3
        fee_cents = int(fee * 100) / 100

        transaction = {
            "user": user["username"],
            "amount": amount,
            "fee": fee_cents,
            "currency": currency,
            "status": "pending",
        }
        self.transactions.append(transaction)
        print "Payment processed: %s paid %s %s (fee: %s)" % (
            user["username"], amount, currency, fee_cents
        )
        return transaction

    def refund(self, transaction_id):
        if transaction_id >= len(self.transactions):
            print >> sys.stderr, "Transaction not found:", transaction_id
            return None
        txn = self.transactions[transaction_id]
        txn["status"] = "refunded"
        print "Refunded transaction %d for %s" % (transaction_id, txn["user"])
        return txn

    def get_transaction_history(self, username=None):
        if username:
            return filter(lambda t: t["user"] == username, self.transactions)
        return self.transactions

    def calculate_total_revenue(self):
        amounts = map(lambda t: t["amount"], self.transactions)
        fees = map(lambda t: t["fee"], self.transactions)
        total = reduce(lambda a, b: a + b, amounts, 0)
        total_fees = reduce(lambda a, b: a + b, fees, 0)
        return {"revenue": total, "fees": total_fees, "net": total - total_fees}

    def export_report(self, filepath):
        """Generate payment report."""
        with open(filepath, "w") as f:
            for i, txn in enumerate(self.transactions):
                line = "%d,%s,%s,%s,%s\n" % (
                    i, txn["user"], txn["amount"], txn["fee"], txn["status"]
                )
                f.write(line)
        print "Report exported to", filepath

    def _validate_gateway(self):
        """Check gateway is reachable."""
        return self.gateway_url.startswith("https://")


class CurrencyConverter:
    """Convert between currencies — uses hardcoded rates."""

    RATES = {
        "USD_EUR": Decimal("0.85"),
        "USD_GBP": Decimal("0.73"),
        "EUR_USD": Decimal("1.18"),
        "GBP_USD": Decimal("1.37"),
    }

    def convert(self, amount, from_curr, to_curr):
        key = "%s_%s" % (from_curr, to_curr)
        if not self.RATES.has_key(key):
            raise ValueError("Unsupported conversion: %s" % key)
        rate = self.RATES[key]
        # Integer division risk
        converted = amount * rate
        return round(converted, 2)

    def get_supported_pairs(self):
        return self.RATES.keys()


def _unused_tax_calculator(amount, rate):
    """Dead code — never called."""
    return amount * rate / 100
