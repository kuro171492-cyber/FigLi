# TODO_STATE

## Current Status
Прототип собран: базовая графика (rect, circle, triangle, line, poly, image), канвас (zoom/pan), слои, colour correction для изображений, precise-режим. Dev-сервер запускается через `Запустить сервер.bat` (WinForms GUI). UI-аудит проведён, основные issues исправлены. Проект готов к дальнейшей разработке.

## Active Tasks
- [ ] Избавиться от any-типов, включить strict mode в tsconfig
- [x] Touch-старт не сбрасывает showAddMenu / imageQuickMenu (в отличие от mouse-обработчика)
- [x] poly-point drag не обновляет bounding box (w/h) — SVG viewBox обрезал фигуру при перемещении точки за границы
- [x] Settings panel: swipe-to-close, lock in header, close at bottom, keep proportions/keep length, stroke/fill icon toggles, duplicate for all shapes
- [x] Settings panel: swipe-to-close, lock in header, close at bottom, keep proportions/keep length, stroke/fill icon toggles, duplicate for all shapes
- [x] Precision mode (double-tap): redesigned with same drawer pattern — swipe-to-close, header with lock/keep/duplicate, stroke/fill icon toggles, close+delete at bottom
- [x] favicon для index.html
- [x] preconnect / preload для Google Fonts в index.html
- [x] Добавить `aria-label` на икончатые кнопки (тулбар, слои, полноэкран)
- [x] Добавить `aria-hidden="true"` на декоративные иконки в Icon.tsx
- [x] `transition-all` → `transition` (Tailwind — исключает layout-свойства)
- [x] Добавить `color-scheme`, `theme-color`, `description` meta в index.html
- [x] Поддержать `prefers-reduced-motion` (CSS media query)
- [x] Подтверждение удаления фигуры через `window.confirm`

## Backlog
- [ ] Выделить хендлеры жестов и трансформаций в отдельные хуки-файлы
- [ ] Автосохранение состояния в localStorage
- [ ] undo/redo (история изменений)
- [ ] Экспорт в PNG/SVG
- [ ] Темы (светлая/тёмная)

## Known Issues
- shapeStyle useMemo зависим от lineHitPad, который пересоздаётся на каждый рендер (регенерирует useMemo)
- dependency-массивы в useCallback не всегда полные (потенциальные stale closures)
- defaultPrevented не проверяется в handleCanvasTouchStart — может ломать скролл на тач-устройствах вне канваса
- Icon-компонент без `aria-hidden="true"` по умолчанию (Screen Reader читает иконки)
- `transition-all` на десятках элементов — некомпозиторные свойства могут вызывать перекомпоновку
- `touch-none` на корневом div — слишком агрессивно, блокирует всё, включая скролл браузера
- Нет `prefers-reduced-motion` — анимации не отключаются для пользователей с вестибулярными нарушениями

## Technical Debt
- `strict: false` в tsconfig — все типы any
- Весь UI в одном App.tsx (2227 строк) — нужен рефакторинг при росте
- Отсутствие unit/e2e тестов
- Netlify/GH Pages деплой через gh-pages без CI/CD

## Active Refactor Zones
- App.tsx: 2227 строк, single-file SPA
- Icon.tsx: иконки захардкожены как React-компоненты (не динамические)
