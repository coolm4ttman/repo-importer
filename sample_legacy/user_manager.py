#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""User management module — typical Python 2 enterprise code."""

import cPickle
import cStringIO
import sys
import os
import string
from collections import OrderedDict


class UserManager:
    """Manages user accounts and permissions."""

    __metaclass__ = type

    def __init__(self, db_path):
        self.db_path = db_path
        self.users = OrderedDict()
        self._cache = {}
        self.max_users = sys.maxint

    def add_user(self, username, email, role="user"):
        if self.users.has_key(username):
            raise ValueError("User already exists: %s" % username)

        user = {
            "username": username,
            "email": email,
            "role": role,
            "active": True,
        }
        self.users[username] = user
        print "User added:", username
        return user

    def remove_user(self, username):
        if not self.users.has_key(username):
            print >> sys.stderr, "User not found:", username
            return False
        del self.users[username]
        print "User removed:", username
        return True

    def get_all_users(self):
        return self.users.values()

    def get_active_users(self):
        return filter(lambda u: u["active"], self.users.values())

    def get_user_emails(self):
        return map(lambda u: u["email"], self.users.values())

    def search_users(self, query):
        results = []
        for name, user in self.users.iteritems():
            if query.lower() in name.lower():
                results.append(user)
        return results

    def get_users_by_role(self, role):
        grouped = {}
        for name, user in self.users.iteritems():
            r = user["role"]
            if not grouped.has_key(r):
                grouped[r] = []
            grouped[r].append(user)
        return grouped.get(role, [])

    def export_users(self, filepath):
        """Export users to a pickle file."""
        data = cStringIO.StringIO()
        cPickle.dump(self.users, data)
        with open(filepath, "wb") as f:
            f.write(data.getvalue())
        print "Exported %d users to %s" % (len(self.users), filepath)

    def import_users(self, filepath):
        """Import users from a pickle file."""
        with open(filepath, "rb") as f:
            data = f.read()
        stream = cStringIO.StringIO(data)
        imported = cPickle.load(stream)
        self.users.update(imported)
        print "Imported %d users from %s" % (len(imported), filepath)

    def user_count(self):
        return len(self.users)

    def _validate_email(self, email):
        """Private helper — validates email format."""
        return "@" in email and "." in email.split("@")[1]


def _unused_helper_function():
    """This function is never called anywhere."""
    print "I am dead code"
    return 42


class DeprecatedUserFormatter:
    """This class is never used — dead code."""

    def format(self, user):
        return "%s <%s>" % (user["username"], user["email"])

    def format_all(self, users):
        return map(self.format, users)


def calculate_user_stats(manager):
    """Calculate statistics about users."""
    total = manager.user_count()
    active = len(list(manager.get_active_users()))
    inactive = total - active

    # Integer division — behavior changes in Python 3!
    active_pct = active * 100 / total if total > 0 else 0

    print "Stats: %d total, %d active (%d%%)" % (total, active, active_pct)
    return {
        "total": total,
        "active": active,
        "inactive": inactive,
        "active_percentage": active_pct,
    }


def batch_process_users(users):
    """Process users in batches."""
    batch_size = 100
    for i in xrange(0, len(users), batch_size):
        batch = users[i:i + batch_size]
        for user in batch:
            if isinstance(user.get("username"), basestring):
                user["processed"] = True
    return users


def compare_users(user_a, user_b):
    """Compare two users — uses cmp() which is removed in Python 3."""
    return cmp(user_a["username"], user_b["username"])


if __name__ == "__main__":
    mgr = UserManager("/tmp/users.db")
    mgr.add_user("alice", "alice@example.com", "admin")
    mgr.add_user("bob", "bob@example.com")
    print "Total users:", mgr.user_count()
    raw_input("Press Enter to continue...")
