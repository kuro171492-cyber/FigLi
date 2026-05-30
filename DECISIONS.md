# DECISIONS

## D-1: Project Initialization
**Date**: 2026-05-29
**Status**: Active
**Context**: Project initialization with template structure from _template2
**Decision**: Use OpenCode memory files + ICM for persistent context
**Reason**: Standardized documentation for AI-assisted development
**Tradeoffs**:
  + Consistent project structure across all projects
  + AI can bootstrap context from memory files
  - Requires maintaining .md files alongside code

## D-2: Single-File SPA Architecture
**Date**: 2026-05-29
**Status**: Active
**Context**: Всё состояние и логика приложения — фигуры, канвас, тулбар, слои, жесты, трансформации — находятся в одном файле App.tsx
**Decision**: Всё приложение — один большой App.tsx без выделения отдельных сторов или экранов
**Reason**: Прототипная скорость разработки; простота навигации, пока приложение < 2500 строк
**Tradeoffs**:
  + Быстрая итерация, нет оверхеда модульности
  + Один файл проще читать AI-агентам
  - Сложность рефакторинга при росте проекта
  - Нет чётких границ ответственности между подсистемами
**Rejected**: Redux, MobX, zustand — избыточны для прототипа. Feature-sliced / FSD — преждевременно.

## D-3: RAF-Batching для трансформаций
**Date**: 2026-05-29
**Status**: Active
**Context**: Move/resize фигур генерирует много событий mousemove, нужна оптимизация
**Decision**: RAF-батчинг для move/resize; точные режимы (precise-rotate/scale) без RAF
**Reason**: requestAnimationFrame даёт 60fps без лишних ререндеров; точные режимы требуют мгновенной обратной связи
**Tradeoffs**:
  + 60fps при обычном перемещении/ресайзе
  + Плавная обратная связь для точных операций
  - Дополнительная сложность в useShapeTransform

## D-4: Изображения ниже векторных фигур
**Date**: 2026-05-29
**Status**: Active
**Context**: Изображения не должны перекрывать векторные фигуры при добавлении
**Decision**: addShape вставляет изображения строго под векторы ([images..., newImage, ...vectors])
**Reason**: Логика слоёв: изображения всегда как "фон" относительно фигур
**Tradeoffs**:
  + Гарантированный z-порядок без ручной сортировки
  - Нельзя наложить изображение поверх вектора без drag-n-drop в слоях

## D-5: index.html в src/ + Vite root: 'src'
**Date**: 2026-05-29
**Status**: Active
**Context**: Корень проекта содержит AI-инструментарий (.opencode, .githooks, .md). Исходный код — в src/
**Decision**: index.html лежит в src, Vite настроен с `root: 'src'`
**Reason**: Отделение AI-инфраструктуры от кода приложения
**Tradeoffs**:
  + Чистота корня проекта
  + AI-инструментарий не смешивается с кодом
  - Нестандартный для Vite подход, требует явной конфигурации root
