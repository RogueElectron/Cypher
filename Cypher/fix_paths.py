#!/usr/bin/env python3
"""
Automatically fixes hardcoded paths and import statements after refactoring.
Run this after moving files around to fix all references.
"""
import os
import re
from pathlib import Path
from typing import List, Tuple

# Configuration
PROJECT_ROOT = Path(__file__).parent
FIXES_MADE = []

# Import mappings: old -> new
IMPORT_MAPPINGS = {
    'from src.database_config': 'from Back-end.database.database_config',
    'from src.encryption_manager': 'from Back-end.database.encryption_manager',
    'from src.redis_manager': 'from Back-end.database.redis_manager',
    'from src.models': 'from Back-end.database.models',
    'import src.': 'import Back-end.database.',
}

# Alternative: if you're setting up proper Python package structure
IMPORT_MAPPINGS_SIMPLE = {
    'from src.database_config': 'from database.database_config',
    'from src.encryption_manager': 'from database.encryption_manager',
    'from src.redis_manager': 'from database.redis_manager',
    'from src.models': 'from database.models',
}


def fix_hardcoded_absolute_paths(file_path: Path) -> bool:
    """Replace hardcoded absolute paths with relative paths."""
    if not file_path.exists():
        return False
    
    content = file_path.read_text()
    original = content
    
    # Pattern: /home/rogz/Cypher/... -> use os.getenv() with relative fallback
    patterns = [
        (r"'/home/rogz/Cypher/[^']*'", "os.path.join(os.path.dirname(__file__), '.keys')"),
        (r'"/home/rogz/Cypher/[^"]*"', 'os.path.join(os.path.dirname(__file__), ".keys")'),
    ]
    
    for pattern, replacement in patterns:
        if re.search(pattern, content):
            # More intelligent replacement for key_store_path specifically
            content = re.sub(
                r"os\.getenv\('KEY_STORE_PATH',\s*'/home/rogz/Cypher/[^']*'\)",
                "os.getenv('KEY_STORE_PATH', os.path.join(os.path.dirname(__file__), '..', '..', '.keys'))",
                content
            )
            FIXES_MADE.append(f"Fixed absolute path in {file_path}")
    
    if content != original:
        file_path.write_text(content)
        return True
    
    return False


def fix_import_statements(file_path: Path, use_simple: bool = False) -> bool:
    """Fix import statements to match new structure."""
    if not file_path.exists() or file_path.suffix != '.py':
        return False
    
    content = file_path.read_text()
    original = content
    
    mappings = IMPORT_MAPPINGS_SIMPLE if use_simple else IMPORT_MAPPINGS
    
    for old_import, new_import in mappings.items():
        if old_import in content:
            content = content.replace(old_import, new_import)
            FIXES_MADE.append(f"Fixed import '{old_import}' -> '{new_import}' in {file_path}")
    
    if content != original:
        file_path.write_text(content)
        return True
    
    return False


def fix_sys_path_hacks(file_path: Path) -> bool:
    """Remove or update sys.path manipulation."""
    if not file_path.exists() or file_path.suffix != '.py':
        return False
    
    content = file_path.read_text()
    original = content
    
    # Pattern: sys.path.append(...'src'...)
    if "sys.path.append" in content and "'src'" in content:
        # Comment out the old sys.path hack
        content = re.sub(
            r"(sys\.path\.append\([^)]*'src'[^)]*\))",
            r"# FIXED: \1  # No longer needed with proper imports",
            content
        )
        FIXES_MADE.append(f"Commented out sys.path hack in {file_path}")
    
    if content != original:
        file_path.write_text(content)
        return True
    
    return False


def scan_and_fix_directory(directory: Path, use_simple_imports: bool = False):
    """Recursively scan and fix all Python files."""
    print(f"Scanning {directory}...")
    
    python_files = list(directory.rglob("*.py"))
    shell_files = list(directory.rglob("*.sh"))
    
    print(f"Found {len(python_files)} Python files")
    
    for py_file in python_files:
        # Skip virtual environments and node_modules
        if any(skip in str(py_file) for skip in ['venv', 'node_modules', '__pycache__', '.git']):
            continue
        
        print(f"Processing {py_file.relative_to(PROJECT_ROOT)}...")
        
        fix_hardcoded_absolute_paths(py_file)
        fix_import_statements(py_file, use_simple=use_simple_imports)
        fix_sys_path_hacks(py_file)


def create_init_files():
    """Create __init__.py files for proper Python package structure."""
    dirs_to_init = [
        PROJECT_ROOT / 'Back-end',
        PROJECT_ROOT / 'Back-end' / 'database',
    ]
    
    for dir_path in dirs_to_init:
        if dir_path.exists():
            init_file = dir_path / '__init__.py'
            if not init_file.exists():
                init_file.write_text("# Package initialization\n")
                FIXES_MADE.append(f"Created {init_file}")
                print(f"Created {init_file}")


def main():
    print("=" * 60)
    print("Path Fixer - Automated Import and Path Correction")
    print("=" * 60)
    print()
    
    # Ask user which approach to use
    print("Choose import style:")
    print("1. Simple relative imports (from database.models import ...)")
    print("2. Full package imports (from Back-end.database.models import ...)")
    print("3. Keep using sys.path hacks (not recommended)")
    
    choice = input("\nEnter choice (1/2/3) [default: 1]: ").strip() or "1"
    
    use_simple = choice == "1"
    
    if choice in ["1", "2"]:
        # Create proper package structure
        create_init_files()
    
    # Fix all files
    scan_and_fix_directory(PROJECT_ROOT, use_simple_imports=use_simple)
    
    print()
    print("=" * 60)
    print(f"Summary: {len(FIXES_MADE)} fixes applied")
    print("=" * 60)
    
    if FIXES_MADE:
        print("\nChanges made:")
        for fix in FIXES_MADE[:20]:  # Show first 20
            print(f"  ✓ {fix}")
        if len(FIXES_MADE) > 20:
            print(f"  ... and {len(FIXES_MADE) - 20} more")
    else:
        print("\n✓ No fixes needed - everything looks good!")
    
    print("\n" + "=" * 60)
    print("NEXT STEPS:")
    print("=" * 60)
    if choice in ["1", "2"]:
        print("1. Test imports: python -c 'from Back-end.database import models'")
        print("2. Add Back-end/ to PYTHONPATH or run from project root")
        print("3. Update .env KEY_STORE_PATH if needed")
    else:
        print("1. Review the commented-out sys.path lines")
        print("2. Consider using proper package structure instead")
    print()


if __name__ == "__main__":
    main()
