#!/usr/bin/env python3

"""
Verify that users were created in database - for CI/CD testing
"""

import sys
from pathlib import Path

from dotenv import load_dotenv

# Add backend to path
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

# Load environment variables from backend .env
env_path = backend_dir / '.env'
load_dotenv(dotenv_path=env_path)

from backend.database import (
    init_databases, get_db_session,
    User,
    init_encryption
)

def verify_users():
    try:
        init_encryption()
        init_databases()
        
        with get_db_session() as db:
            user_count = db.query(User).count()
            print(f'Total users in database: {user_count}')
            
            if user_count == 0:
                print('ERROR: No users found - automation may have failed')
                return False
            
            # Get latest user
            latest_user = db.query(User).order_by(User.created_at.desc()).first()
            print(f'Latest user: {latest_user.username}')
            print(f'TOTP enabled: {latest_user.totp_enabled}')
            print(f'User active: {latest_user.is_active}')
            
            print('User verification PASSED')
            return True
            
    except Exception as e:
        print(f'ERROR during verification: {e}')
        return False

if __name__ == "__main__":
    success = verify_users()
    sys.exit(0 if success else 1)
