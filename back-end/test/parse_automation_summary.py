#!/usr/bin/env python3
"""
Parse the automation summary JSON produced by demo-user-automation.js
and emit human readable information for CI logs.
"""

import json
from pathlib import Path

SUMMARY_PATH = Path("automation_summary.json")

def main() -> int:
    if not SUMMARY_PATH.exists():
        print("Automation summary file not found: automation_summary.json")
        return 1

    try:
        summary = json.loads(SUMMARY_PATH.read_text())
    except json.JSONDecodeError as exc:
        print(f"Failed to parse automation summary JSON: {exc}")
        return 1

    status = "PASS" if summary.get("success") else "FAIL"
    print(f"Status: {status}")
    print(f"Username: {summary.get('username')}")
    print(f"TOTP Secret: {summary.get('totpSecret') or 'n/a'}")

    login = summary.get("login") or {}
    if login:
        print(f"Login success: {login.get('success')}")
        if login.get("error"):
            print(f"Login error: {login['error']}")
        if login.get("welcomeText"):
            print(f"Welcome text: {login['welcomeText']}")
        if login.get("tokens"):
            tokens = login["tokens"]
            print(f"Access token: {tokens.get('accessToken')}")
            print(f"Refresh token: {tokens.get('refreshToken')}")

    if not summary.get("success"):
        print(f"Failure message: {summary.get('message') or 'n/a'}")

    return 0

if __name__ == "__main__":
    raise SystemExit(main())
