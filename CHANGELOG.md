# Changelog

All notable changes to this project will be documented in this file.

The format is inspired by [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project follows [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- Project governance files:
  - `LICENSE`
  - `CONTRIBUTING.md`
  - `CODE_OF_CONDUCT.md`
  - `SECURITY.md`
  - `CHANGELOG.md`
- CI workflow (`.github/workflows/ci.yml`) para executar `npm ci`, `npm run lint` e `npm run build` em `push` e `pull_request` na `main`.
- Deploy automático para GitHub Pages (`.github/workflows/deploy-pages.yml`) em cada `push` na `main`.
- Publicação manual opcional do deploy via `workflow_dispatch`.

### Changed

- `vite.config.ts` agora define `base` dinamicamente no GitHub Actions para suportar o subdiretório do GitHub Pages.
- `README.md` atualizado com instruções objetivas de CI/CD e ativação do GitHub Pages.
