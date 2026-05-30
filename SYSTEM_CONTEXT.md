# SYSTEM_CONTEXT

## Project Purpose
FigmaLite — упрощённый векторный редактор на React + TypeScript (аналог Figma). Позволяет создавать, трансформировать и управлять векторными фигурами и изображениями на канвасе с зумом/панорамированием.

## Core Systems
- **Canvas/Stage** — трансформируемая сцена (pan, pinch-zoom, scale 0.1–5)
- **Shape Engine** — фигуры: rect, circle, triangle, line, polygon, image
- **Transform System** — move, resize, rotate, poly-point, line-point, precise-rotate/scale/pivot
- **Layer Manager** — порядок слоёв, видимость, блокировка
- **Image Controls** — hue, saturation, brightness, contrast, invert
- **Tool System** — SELECT, PAN, POLY_DRAW

## Technology Stack
- React 18, TypeScript, Vite 5, Tailwind CSS 3
- Material Symbols (иконки)
- gh-pages (деплой)

## Critical Constraints
- Фигуры не должны терять своё состояние при ререндерах (React.memo + useRef)
- Multi-touch не должен запускать трансформацию фигуры (только pan/pinch сцены)
- Полигоны должны поддерживать нормализацию точек после редактирования
- Изображения всегда ниже векторных фигур по z-index

## Important Assumptions
- Все координаты фигур хранятся в "мировых" координатах (не экранных)
- Stage offset (x, y) + scale преобразует мировые → экранные
- Привязка `touchState` пересобирается после pinch для устранения рывка pan

## Global Architecture Rules
- Состояние через useReducer (initialAppState + appReducer)
- Рефы для актуальных значений внутри колбэков (stageRef, shapesRef, activeToolRef)
- RAF-батчинг для move/resize, точные режимы (precise-*) без RAF
- useStageGestures — хук управления жестами сцены
- useShapeTransform — хук трансформации выделенной фигуры
