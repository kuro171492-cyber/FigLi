# ARCHITECTURE_MAP

## File Ownership
```
src/
├── index.html       → Точка входа Vite, подключает Material Symbols (Google Fonts), монтирует React в #root
├── App.tsx          → Canvas, тулбар, слои, все фигуры и трансформации
├── Icon.tsx         → Компонент-обёртка Material Symbols + экспорт иконок
├── index.css        → Tailwind directives + кастомные стили
└── main.tsx         → Точка входа React, рендер App в #root
```

## Module Relationships
```
index.html → main.tsx (type="module" script)
main.tsx → App.tsx → ShapeItem (React.memo)
                     → useStageGestures (pan, pinch)
                     → useShapeTransform (move, resize, rotate, precise)
                     → appReducer (initialAppState, state management)

Icon.tsx ← используется всеми компонентами для иконок
```

## Data Flow
```
User Input (mouse/touch)
  → useShapeTransform.handleShapeInteraction()
    → RAF-batched applyMoveAt()
      → setShapes() / dispatch({ type: 'SET_SHAPES' })
        → useReducer appReducer
          → React re-render ShapeItem(s)

Stage Gestures (pan/pinch)
  → useStageGestures handlers
    → scheduleStageUpdate (RAF-batched)
      → setStage() / dispatch({ type: 'SET_STAGE' })
```

## Critical Pipelines
- **Выбор фигуры**: hitTestShape() → setSelectedId → рендер хендлов
- **Трансформация**: clientToWorld() → applyMoveAt() → RAF → setShapes
- **Добавление фигуры**: addShape() → setShapes + setSelectedId
- **Импорт изображения**: FileReader → Image → scale to viewport → addShape

## Ownership Boundaries
- `App.tsx` — ВСЁ состояние и логика (single-file SPA)
- `Icon.tsx` — только рендер иконок
