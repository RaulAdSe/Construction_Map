# Branching Strategy

This document outlines our branching strategy for the Servitec Map project.

## Main Branches

The repository has two main branches:

### `development`

- **Purpose**: This is the development branch containing the local version of the application.
- **Use**: All development work, testing, and feature integration happens here first.
- **Environment**: Maps to the local development environment.
- **Stability**: May contain work in progress features and changes.

### `production`

- **Purpose**: This branch contains the code that is deployed to production.
- **Use**: Only fully tested and approved features get merged here.
- **Environment**: Maps to the cloud production environment.
- **Stability**: Should always be stable and deployable.

## Feature Branches

When developing new features:

1. Create a feature branch from `development` using the naming convention `feature/feature-name`
2. Develop and test the feature
3. Submit a pull request to merge into `development`
4. After testing in development, create a PR to merge into `production` when ready to deploy

## Bugfix Branches

For bug fixes:

1. Create a branch from the affected branch (`development` or `production`) using the naming convention `fix/bug-description`
2. Fix the bug and test thoroughly
3. Submit a pull request to merge back into the original branch
4. If the fix was made directly to `production`, make sure to merge it back to `development` as well

## Deployment Workflow

1. Develop features in feature branches
2. Merge completed features into `development`
3. Test thoroughly in the development environment
4. Create a release branch if needed (for groups of features)
5. Merge to `production` after QA approval
6. Deploy to production environment
7. Tag the production release with a version number 