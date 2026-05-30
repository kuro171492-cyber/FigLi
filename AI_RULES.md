# AI_RULES

## Retrieval Priority
1. Read `SYSTEM_CONTEXT.md` — project overview, constraints
2. Read `ARCHITECTURE_MAP.md` — module relationships, data flow
3. Read `DECISIONS.md` — before changing architecture
4. Read `TODO_STATE.md` — current state, risks
5. Do NOT scan entire project — use targeted reads

## Architecture Preservation
- Do NOT introduce new frameworks without explicit request
- Do NOT change core constraints from SYSTEM_CONTEXT.md without decision log entry
- Preserve existing patterns and conventions

## State Management
- Single source of truth pattern: one primary state array/object
- No hidden derived state
- State must be explicitly initializeable/resetable

## After Changes
- Update TODO_STATE.md if task status changed
- Update DECISIONS.md if architectural decision was made
- Update SYSTEM_CONTEXT.md if constraints or assumptions changed
- Leave clear breadcrumb comments at changed locations

## ICM Automation
- Run `tools\icm-maintain.ps1 -Mode quick` after session with changes
- Log critical changes: `icm store --topic <topic> --content "..." --importance critical`
- Run `icm extract-pending` periodically to process queued extractions

## Available Skills (локальные, `.agents/skills/`)

- **frontend-design** — создание production-grade UI с высоким дизайном, избегая AI-шаблонности
- **web-design-guidelines** — аудит UI/UX и accessibility по гайдлайнам Vercel
- **vercel-react-best-practices** — 70+ правил оптимизации React/Next.js (водопады, бандл, сервер, рендер, JS)

## Available Skills (глобальные, `~\.agents\skills\`)

- **find-skills** — поиск подходящих skills по описанию задачи

Установка локального скилла: `npx skills add <repo> --skill <name>`
Установка глобального скилла: `npx skills add <repo> --skill <name> --global`
