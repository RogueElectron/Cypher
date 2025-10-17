#!/usr/bin/env python3
"""Generate PASETO symmetric keys for secure token signing"""

import json
import sys
from paseto.keys.symmetric_key import SymmetricKey
from paseto.protocols.v4 import ProtocolVersion4

def generate_paseto_keys():
    """Generate three PASETO symmetric keys for different token types"""
    try:
        # Generate three separate keys for different purposes
        key = SymmetricKey.generate(protocol=ProtocolVersion4)
        session_key = SymmetricKey.generate(protocol=ProtocolVersion4)
        refresh_key = SymmetricKey.generate(protocol=ProtocolVersion4)
        
        # Export keys as hex strings (raw key bytes)
        # Access the raw key material and convert to hex
        key_hex = key.key.hex()
        session_key_hex = session_key.key.hex()
        refresh_key_hex = refresh_key.key.hex()
        
        # Output as JSON for easy parsing by bash script
        secrets = {
            "PASETO_KEY": key_hex,
            "PASETO_SESSION_KEY": session_key_hex,
            "PASETO_REFRESH_KEY": refresh_key_hex
        }
        
        print(json.dumps(secrets))
        
    except Exception as e:
        print(f"Error generating PASETO keys: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    generate_paseto_keys()
