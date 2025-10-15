#!/usr/bin/env python3
"""
Validate the automation summary produced by demo-user-automation.js
and exit with non-zero status if registration or login failed.
"""

import json
from pathlib import Path

def main() -> int:
    exit_path = Path("automation_exit_code.txt")
    summary_path = Path("automation_summary.json")

    if not exit_path.exists():
        print("automation_exit_code.txt not found")
        return 1
    if not summary_path.exists():
        print("automation_summary.json not found")
        return 1

    exit_code_raw = exit_path.read_text().strip()
    try:
        exit_code = int(exit_code_raw)
    except ValueError:
        print(f"Invalid automation exit code: {exit_code_raw}")
        return 1

    summary = json.loads(summary_path.read_text())
    print(f"Automation exit code: {exit_code}")

    if exit_code != 0:
        print(f"Automation script exited with code {exit_code}")
        print(f"Summary message: {summary.get('message') or 'n/a'}")
        return 1

    if not summary.get("success"):
        print(f"Automation summary indicates failure: {summary.get('message') or 'Unknown failure'}")
        return 1

    login = summary.get("login") or {}
    if not login.get("success"):
        print(f"Login automation failed: {login.get('error') or 'Unknown login error'}")
        if login.get("welcomeText"):
            print(f"Observed welcome text: {login['welcomeText']}")
        return 1

    print(f"Login automation succeeded for user: {summary.get('username')}")
    if login.get("welcomeText"):
        print(f"Welcome text: {login['welcomeText']}")
    if login.get("tokens"):
        tokens = login["tokens"]
        print(f"Session tokens: {json.dumps(tokens)}")
        if tokens.get("accessToken"):
            print(f"Access token: {tokens['accessToken']}")
        if tokens.get("refreshToken"):
            print(f"Refresh token: {tokens['refreshToken']}")

    return 0

if __name__ == "__main__":
    raise SystemExit(main())
