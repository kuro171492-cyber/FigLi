# FigmaLite

Упрощённый векторный редактор на React + TypeScript (аналог Figma).

## Разработка

```powershell
npm run dev    # Vite dev server
npm run build  # tsc + Vite build
npm run deploy # gh-pages deploy
```

## Структура

```
/
├── .opencode/          ← конфиг OpenCode
├── .githooks/           ← git hooks (ICM auto-sync)
├── tools/              ← скрипты обслуживания
├── *.md                ← память проекта (система, архитектура, решения, TODO, правила)
└── src/                ← исходный код
    ├── index.html       ← точка входа Vite (root: 'src')
    ├── main.tsx         ← точка входа React
    ├── App.tsx          ← главный компонент (холст, фигуры, тулбар, слои, precise-режим)
    ├── Icon.tsx         ← компонент иконок Material Symbols
    └── index.css        ← Tailwind + стили
```

## Правила

- После крупных изменений запускай `tools\icm-maintain.ps1 -Mode quick`
- Новое архитектурное решение → запись в `DECISIONS.md` + `icm store --topic architecture`
