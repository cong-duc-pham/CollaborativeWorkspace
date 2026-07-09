# Project Rules

## Git Branching Strategy
- **main**: Stable, production-ready code. Merged only from `develop`. No direct commits allowed.
- **develop**: Main integration branch. Merges from `feature/*` and `defect/*`.
- **feature/xxx**: For new feature development (e.g., `feature/authentication`). Creates a PR to `develop` upon completion.
- **defect/xxx**: For bug fixes (e.g., `defect/login-bug`).

## Git Commit Message Convention
Format: `<type>: <short description>`
- **feat**: Add a new feature (e.g., `feat: add JWT auth`)
- **fix**: Fix a bug (e.g., `fix: resolve token validation bug`)
- **docs**: Documentation changes (e.g., `docs: update API spec`)
- **refactor**: Code restructuring or optimization without behavior changes
- **test**: Add/update unit or integration tests
- **chore**: Build, configuration, CI/CD, project dependencies
