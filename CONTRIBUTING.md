# Contributing Guide

Thank you for your interest in contributing to **Live Crypto Tracker**.

## Development Setup

1. Fork and clone the repository.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the development server:
   ```bash
   npm run dev
   ```

## Branching

- Create a feature branch from `main`.
- Use clear branch names, for example:
  - `feat/theme-transition`
  - `fix/watchlist-persistence`
  - `docs/readme-update`

## Commit Conventions

Use concise, descriptive commit messages. Recommended format:

- `feat: add market sentiment badge`
- `fix: handle coingecko timeout fallback`
- `docs: update setup instructions`

## Pull Request Checklist

Before opening a PR, ensure:

- The app builds successfully (`npm run build`).
- Lint passes (`npm run lint`).
- Changes are scoped and easy to review.
- README/docs are updated when behavior changes.
- UI changes include screenshots when relevant.

## Code Style Expectations

- Keep components focused and reusable.
- Keep API/data parsing logic inside service or data layers.
- Avoid unnecessary dependencies and over-abstraction.
- Preserve accessibility and responsive behavior.

## Reporting Issues

When creating an issue, include:

- Expected behavior
- Actual behavior
- Steps to reproduce
- Environment details (OS, browser, Node version)
- Screenshots/logs when available

Thanks for helping improve the project.
