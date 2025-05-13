# Project Cleanup Plan

This document outlines a comprehensive plan to clean up the project structure, remove redundant files, and establish better practices for managing configuration and secrets.

## 1. Environment Files Cleanup

### Current Issues
- Too many environment files spread across the project
- Duplicated configuration in multiple files
- Secrets stored in files committed to the repository
- Unclear which files are actually used in production

### Cleanup Actions
1. **Consolidate Environment Files**
   - Keep only essential files as described in `ENV_CLEANUP_PLAN.md`
   - Delete redundant files after backing them up
   - Move all example files to `example_env_files/` directory

2. **Implement Secret Manager**
   - Create the `secrets.py` module as described in `SECRETS_MANAGEMENT.md`
   - Update application code to use this module for accessing secrets

## 2. Temporary and Generated Files

### Current Issues
- Many temporary, backup, and log files in the repository
- Compiled Python files (.pyc) committed to the repository
- Database files checked into version control

### Cleanup Actions
1. **Remove Generated Files**
   ```bash
   # Remove all compiled Python files
   find . -name "*.pyc" -delete
   find . -name "__pycache__" -type d -exec rm -rf {} +
   
   # Remove all log files (after backing up if needed)
   find . -name "*.log" -delete
   
   # Remove backup files
   find . -name "*.bak" -delete
   
   # Remove database files
   find . -name "*.db" -delete
   ```

2. **Update .gitignore**
   - Ensure .gitignore properly excludes all generated files
   - Add specific patterns for log files, database files, backup files

## 3. Redundant Documentation

### Current Issues
- Multiple documentation files with overlapping information
- Some documentation is outdated or refers to obsolete processes
- Documentation spread across different directories

### Cleanup Actions
1. **Consolidate Documentation**
   - Merge related documentation files
   - Organize documentation by topic (deployment, API, database, etc.)
   - Remove outdated documentation after capturing relevant information

2. **Documentation to Consolidate**
   - `backend_deployment_documentation.md` and `frontend_deployment_documentation.md`
     → Create unified `DEPLOYMENT.md`
   - All database-related documentation → `DATABASE.md`
   - All API-related documentation → `API.md`

## 4. Test and Utility Scripts

### Current Issues
- Multiple test scripts with similar functionality
- Utility scripts with hard-coded values
- Scripts in the root directory that should be in subdirectories

### Cleanup Actions
1. **Organize Test Scripts**
   - Move all test scripts to a dedicated `tests/` directory
   - Consolidate duplicate test functionality

2. **Cleanup Scripts to Remove/Relocate**
   - Move `test_login.py` to `backend/tests/`
   - Move `test_api_endpoints.py` to `backend/tests/`
   - Consolidate various database fix scripts into a single utility

## 5. Duplicate Logic

### Current Issues
- Similar functionality implemented in multiple places
- Multiple scripts for database management
- Redundant configuration loading

### Cleanup Actions
1. **Consolidate Database Management**
   - Create a unified database management module
   - Consolidate `fix_database_schema.sql`, `create_db_schema.sql`, etc.

2. **Standardize Configuration Loading**
   - Implement central configuration module
   - Remove duplicate configuration loading code

## 6. Deprecated and Unused Files

### Current Issues
- Files that were used during development but are no longer needed
- Old migration files and backups
- Temporary files that were committed accidentally

### Cleanup Actions
1. **Remove Unused Files**
   - `migrations.bak/` directory
   - Temporary `.DS_Store` files
   - Empty or stub files

2. **Specific Files to Consider for Removal**
   - `token.txt` (empty file)
   - `backend/construction_map.db` (database file)
   - All `.DS_Store` files

## Implementation Plan

### Phase 1: Backup and Preparation
1. Create backups of everything before deletion
2. Document current functionality to ensure nothing breaks
3. Update .gitignore to prevent future clutter

### Phase 2: Environment and Secrets
1. Implement the secret manager module
2. Clean up environment files
3. Remove secrets from the codebase

### Phase 3: Code Cleanup
1. Remove generated files (.pyc, logs, etc.)
2. Organize and consolidate test scripts
3. Fix duplicate logic

### Phase 4: Documentation and Final Cleanup
1. Consolidate documentation
2. Remove deprecated files
3. Final verification that everything works

## Directory Structure After Cleanup

```
project/
├── .env → symlink to backend/.env
├── .env.example → symlink to example_env_files/.env.example
├── .gitignore
├── README.md
├── docker-compose.yml
├── example_env_files/
│   ├── .env.example
│   ├── .env.gcp.example
│   ├── .env.local.example
│   └── .env.frontend.example
├── backend/
│   ├── .env
│   ├── .env.gcp
│   ├── app/
│   │   ├── core/
│   │   │   └── config/
│   │   │       └── secrets.py
│   │   └── ...
│   ├── tests/
│   │   └── ...
│   ├── docs/
│   │   ├── API.md
│   │   ├── DATABASE.md
│   │   └── DEPLOYMENT.md
│   └── utils/
│       └── db/
│           └── schema_management.py
└── frontend/
    ├── .env
    ├── .env.local
    ├── .env.production
    └── ...
```

## Security Improvements

1. Remove all hardcoded secrets from scripts and code
2. Implement proper secrets management
3. Ensure no sensitive data is committed to the repository
4. Add pre-commit hooks to prevent committing secrets 