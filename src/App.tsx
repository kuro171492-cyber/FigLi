import React, { useReducer, useRef, useEffect, useMemo, useCallback, useState } from 'react';
import { 
  Icon, Hand, MousePointer2, Square, Circle, Triangle, Minus, Trash2, 
  FileImage, Settings2, X, Lock, Unlock, RotateCw, Droplets, Type, 
  Layers, Eye, EyeOff, PenTool, Pentagon, Check, Hash, Sun, Palette,
  Maximize, Minimize, Contrast
} from './Icon';

interface ImageQuickMenu {
  shapeId: string;
  control: string;
  isPrecision?: boolean;
  blinkOpacity?: number | null;
  savedValues?: Record<string, number>;
}

const PRECISE_HANDLE_SPREAD = Math.PI / 6;
const DEFAULT_PRECISE_MOVE_LEVER = 92;
const DEFAULT_PRECISE_ROTATE_LEVER = DEFAULT_PRECISE_MOVE_LEVER;
const DEFAULT_PRECISE_SCALE_LEVER = DEFAULT_PRECISE_MOVE_LEVER;

const generateId = () => Math.random().toString(36).substring(2, 9);

const SHAPE_TYPES = {
    RECT: 'rect',
    CIRCLE: 'circle',
    TRIANGLE: 'triangle',
    LINE: 'line',
    POLY: 'poly',
    IMAGE: 'image',
    CURVE: 'curve'
  };
const TOOLS = { PAN: 'pan', SELECT: 'select', POLY_DRAW: 'poly_draw', CURVE_DRAW: 'curve_draw' };
const COLOR_PRESETS = [
    '#2563eb', '#7c3aed', '#db2777', '#ea580c',
    '#ca8a04', '#16a34a', '#0d9488', '#0891b2',
    '#475569', '#f8fafc'
  ];
const COLOR_GROUPS = [
  ['#2563eb', '#3b82f6', '#1d4ed8'],
  ['#db2777', '#ec4899', '#be185d'],
  ['#16a34a', '#22c55e', '#15803d']
];

const nextShadeInGroup = (current, group) => {
  const idx = group.findIndex((c) => c.toLowerCase() === String(current || '').toLowerCase());
  if (idx === -1) return group[0];
  return group[(idx + 1) % group.length];
};

const renderLineWithDivisions = (shape, shapeStyle) => {
    const x1 = shape.x - shapeStyle.left;
    const y1 = shape.y - shapeStyle.top;
    const x2 = shape.x2 - shapeStyle.left;
    const y2 = shape.y2 - shapeStyle.top;
    const divisions = shape.divisions || 1;
    const dx = x2 - x1;
    const dy = y2 - y1;
    const angle = Math.atan2(dy, dx);
    const markLength = 10;
    const longMarkLength = 20;

    const getMarkCoords = (x, y, len) => {
      const perpA = angle + Math.PI / 2;
      return {
        x1: x + Math.cos(perpA) * (len / 2),
        y1: y + Math.sin(perpA) * (len / 2),
        x2: x - Math.cos(perpA) * (len / 2),
        y2: y - Math.sin(perpA) * (len / 2)
      };
    };

    const mainMarks = [
      getMarkCoords(x1, y1, longMarkLength),
      getMarkCoords(x1 + dx * 0.5, y1 + dy * 0.5, longMarkLength),
      getMarkCoords(x2, y2, longMarkLength)
    ];

    const divisionLines = [];
    if (divisions > 1) {
      const stepSize = 1 / (divisions + 1);
      for (let j = 1; j <= divisions; j++) {
        const t = j * stepSize;
        if (Math.abs(t - 0.5) < 0.01) continue;
        const mx = x1 + dx * t;
        const my = y1 + dy * t;
        divisionLines.push(getMarkCoords(mx, my, markLength));
      }
    }

    return (
      <>
        <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={shape.stroke} strokeWidth={shape.strokeWidth} strokeLinecap="round" />
        {mainMarks.map((m, idx) => (
          <line key={`main-${idx}`} x1={m.x1} y1={m.y1} x2={m.x2} y2={m.y2} stroke={shape.stroke} strokeWidth={shape.strokeWidth} />
        ))}
        {divisionLines.map((l, idx) => (
          <line key={`div-${idx}`} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} stroke={shape.stroke} strokeWidth={shape.strokeWidth} />
        ))}
      </>
    );
  };

interface ShapeItemProps {
  shape: any;
  isSelected: boolean;
  onShapeInteraction: (e: any, id: any, mode: any, extra?: any) => void;
  onToggleLock: (id: any) => void;
  stageScale?: number;
  activeHandle: any;
  onShapeDoubleTap?: ((shapeId: any) => void) | null;
  isPrecisionMode?: boolean;
  onImagePrecisionTap?: ((shapeId: any, point: any) => void) | null;
}

const ShapeItem = React.memo(function ShapeItem({
  shape,
  isSelected,
  onShapeInteraction,
  onToggleLock,
  stageScale = 1,
  activeHandle = null,
  onShapeDoubleTap = null,
  isPrecisionMode = false,
  onImagePrecisionTap = null
}: ShapeItemProps) {
  const isLine = shape.type === 'line';
  const isPoly = shape.type === 'poly';
  const isCurve = shape.type === 'curve';
  const isImage = shape.type === 'image';
  const canRotate = shape.type !== 'line' && shape.type !== 'poly' && shape.type !== 'curve';
  const safeScale = Math.max(stageScale, 0.01);
  const inverseScale = 1 / safeScale;
  const showCrosshairHandles = safeScale > 2;
  const showRemoteHandle = showCrosshairHandles || isPrecisionMode;
  const tapRef = useRef({ ts: 0, shapeId: '' });
  const touchTapRef = useRef({ valid: false, x: 0, y: 0 });

  const isHandleActive = useCallback((mode, extra = null) => (
    isSelected
    && activeHandle
    && activeHandle.id === shape.id
    && activeHandle.mode === mode
    && activeHandle.extra === extra
  ), [isSelected, activeHandle, shape.id]);

  const renderHandleGlyph = useCallback((isActive) => {
    if (showCrosshairHandles) {
      return (
        <div className="relative w-4 h-4">
          <div className={`absolute left-1/2 top-0 bottom-0 w-px -translate-x-1/2 ${isActive ? 'bg-yellow-300' : 'bg-white'} shadow-[0_0_0_1px_rgba(59,130,246,0.9)]`} />
          <div className={`absolute top-1/2 left-0 right-0 h-px -translate-y-1/2 ${isActive ? 'bg-yellow-300' : 'bg-white'} shadow-[0_0_0_1px_rgba(59,130,246,0.9)]`} />
        </div>
      );
    }
    return (
      <div className={`w-4 h-4 border-2 rounded-full shadow-lg ${isActive ? 'bg-yellow-300 border-yellow-500 ring-2 ring-yellow-400/70' : 'bg-white border-blue-500'}`} />
    );
  }, [showCrosshairHandles]);

  const handleTouchStartForTap = useCallback((e) => {
    if (!e.touches || e.touches.length !== 1) {
      touchTapRef.current.valid = false;
      return;
    }
    touchTapRef.current = {
      valid: true,
      x: e.touches[0].clientX,
      y: e.touches[0].clientY
    };
  }, []);

  const handleTouchMoveForTap = useCallback((e) => {
    if (!touchTapRef.current.valid) return;
    if (!e.touches || e.touches.length !== 1) {
      touchTapRef.current.valid = false;
      return;
    }
    const dx = e.touches[0].clientX - touchTapRef.current.x;
    const dy = e.touches[0].clientY - touchTapRef.current.y;
    if (Math.hypot(dx, dy) > 12) touchTapRef.current.valid = false;
  }, []);

  const handleTouchTap = useCallback((e) => {
    if (!touchTapRef.current.valid) return;
    touchTapRef.current.valid = false;
    if (e.touches && e.touches.length > 0) return;
    if (!onShapeDoubleTap) return;
    if (!e.changedTouches || !e.changedTouches[0]) return;
    const now = Date.now();
    const isDouble = tapRef.current.shapeId === shape.id && (now - tapRef.current.ts) < 320;
    if (isDouble) {
      onShapeDoubleTap(shape.id);
      tapRef.current = { ts: 0, shapeId: '' };
      return;
    }
    tapRef.current = { ts: now, shapeId: shape.id };
  }, [onShapeDoubleTap, shape.id]);

  const lineHitPad = 16 * inverseScale;
  const shapeStyle = useMemo(() => (
    isLine
      ? {
        left: Math.min(shape.x, shape.x2) - lineHitPad,
        top: Math.min(shape.y, shape.y2) - lineHitPad,
        width: Math.max(Math.abs(shape.x2 - shape.x), 1) + lineHitPad * 2,
        height: Math.max(Math.abs(shape.y2 - shape.y), 1) + lineHitPad * 2
      }
      : {
        left: shape.x,
        top: shape.y,
        width: shape.w,
        height: shape.h
      }
  ), [isLine, shape.x, shape.y, shape.x2, shape.y2, shape.w, shape.h, lineHitPad]);

  const imageFilter = useMemo(
    () => `hue-rotate(${shape.hue || 0}deg) saturate(${shape.saturation ?? 100}%) brightness(${shape.brightness ?? 100}%) contrast(${shape.contrast ?? 100}%) invert(${shape.invert ? 100 : 0}%)`,
    [shape.hue, shape.saturation, shape.brightness, shape.contrast, shape.invert]
  );

  const transformOrigin = isImage
    ? `${(shape.pivotU ?? 0.5) * 100}% ${(shape.pivotU ?? 0.5) * 100}%`
    : 'center center';

  const clipPolygon = useMemo(() => {
    if (!isImage || !shape.warpCorners) return null;
    const wc = shape.warpCorners;
    const local = wc.map(c => ({ x: c.x - shape.x, y: c.y - shape.y }));
    return `polygon(${local[0].x.toFixed(0)}px ${local[0].y.toFixed(0)}px, ${local[1].x.toFixed(0)}px ${local[1].y.toFixed(0)}px, ${local[3].x.toFixed(0)}px ${local[3].y.toFixed(0)}px, ${local[2].x.toFixed(0)}px ${local[2].y.toFixed(0)}px)`;
  }, [isImage, shape.warpCorners, shape.x, shape.y, shape.w, shape.h]);

  return (
    <div
      className="absolute z-10 touch-none"
      onMouseDown={(e) => onShapeInteraction(e, shape.id, shape.isLocked ? 'locked-noop' : 'move')}
      onTouchStart={(e) => onShapeInteraction(e, shape.id, shape.isLocked ? 'locked-noop' : 'move')}
      onDoubleClick={(e) => { e.stopPropagation(); onShapeDoubleTap?.(shape.id); }}
      onTouchStartCapture={handleTouchStartForTap}
      onTouchMoveCapture={handleTouchMoveForTap}
      onTouchEnd={handleTouchTap}
      style={{
        ...shapeStyle,
        opacity: shape.opacity / 100,
        transform: isLine ? 'none' : `rotate(${shape.rotation}deg)`,
        transformOrigin,
        boxShadow: 'none',
        pointerEvents: shape.isLocked ? 'none' : 'auto',
        cursor: shape.isLocked ? 'default' : 'move',
        outline: isSelected && !shape.isLocked ? '2px dashed #3b82f6' : 'none',
        outlineOffset: 2
      }}
    >
      {isImage && shape.warpCorners ? (
        <div style={{ width: '100%', height: '100%', clipPath: clipPolygon || undefined, WebkitClipPath: clipPolygon || undefined }}>
          <img
            src={shape.src}
            loading="lazy"
            onContextMenu={(e) => e.preventDefault()}
            onDragStart={(e) => e.preventDefault()}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'fill',
              display: 'block',
              filter: imageFilter,
              WebkitTouchCallout: 'none',
              WebkitUserSelect: 'none',
              userSelect: 'none'
            }}
            draggable={false}
            alt={`Image ${shape.index}`}
          />
        </div>
      ) : isImage ? (
        <img
          src={shape.src}
          loading="lazy"
          onContextMenu={(e) => e.preventDefault()}
          onDragStart={(e) => e.preventDefault()}
          onDoubleClick={(e) => { e.stopPropagation(); onShapeDoubleTap?.(shape.id); }}
          onClick={(e) => {
            if (!isPrecisionMode || !onImagePrecisionTap) return;
            e.stopPropagation();
            const rect = e.currentTarget.getBoundingClientRect();
            onImagePrecisionTap(shape.id, {
              x: e.clientX - rect.left,
              y: e.clientY - rect.top,
              w: rect.width,
              h: rect.height
            });
          }}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'fill',
            display: 'block',
            filter: imageFilter,
            WebkitTouchCallout: 'none',
            WebkitUserSelect: 'none',
            userSelect: 'none'
          }}
          draggable={false}
          alt="Layer"
        />
      ) : (
        <svg width="100%" height="100%" viewBox={`0 0 ${shapeStyle.width} ${shapeStyle.height}`} preserveAspectRatio="none" className="overflow-visible block">
          {shape.type === 'rect' && <rect width="100%" height="100%" fill={shape.fill} stroke={shape.stroke} strokeWidth={shape.strokeWidth} />}
          {shape.type === 'circle' && <ellipse cx="50%" cy="50%" rx="50%" ry="50%" fill={shape.fill} stroke={shape.stroke} strokeWidth={shape.strokeWidth} />}
          {shape.type === 'triangle' && <polygon points={`${shape.w / 2},0 ${shape.w},${shape.h} 0,${shape.h}`} fill={shape.fill} stroke={shape.stroke} strokeWidth={shape.strokeWidth} />}
          {isLine && renderLineWithDivisions(shape, shapeStyle)}
          {isPoly && (
            <polygon
              points={shape.points.map(p => `${p.x},${p.y}`).join(' ')}
              fill={shape.isClosed ? shape.fill : 'transparent'}
              stroke={shape.stroke}
              strokeWidth={shape.strokeWidth}
            />
          )}
          {isCurve && (() => {
            const pts = shape.points;
            if (!pts || pts.length < 2) return null;
            const toPath = (pts) => {
              if (pts.length === 2) return `M ${pts[0].x},${pts[0].y} L ${pts[1].x},${pts[1].y}`;
              let d = `M ${pts[0].x},${pts[0].y}`;
              for (let i = 0; i < pts.length - 1; i++) {
                const p0 = pts[i === 0 ? 0 : i - 1];
                const p1 = pts[i];
                const p2 = pts[i + 1];
                const p3 = pts[i + 2 >= pts.length ? pts.length - 1 : i + 2];
                const cp1x = p1.x + (p2.x - p0.x) / 6;
                const cp1y = p1.y + (p2.y - p0.y) / 6;
                const cp2x = p2.x - (p3.x - p1.x) / 6;
                const cp2y = p2.y - (p3.y - p1.y) / 6;
                d += ` C ${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`;
              }
              return d;
            };
            return <path d={toPath(pts)} fill="none" stroke={shape.stroke} strokeWidth={shape.strokeWidth} strokeLinecap="round" strokeLinejoin="round" />;
          })()}
        </svg>
      )}

      {isSelected && !shape.isLocked && (
        <>
          {canRotate && !isPrecisionMode && !(isImage && shape.warpCorners) && (
            <div
              className="absolute left-1/2 flex flex-col items-center pointer-events-auto"
              style={{ top: 0, transform: `translate(-50%, -100%) scale(${inverseScale})`, transformOrigin: 'bottom center', paddingBottom: '4px' }}
              onMouseDown={(e) => onShapeInteraction(e, shape.id, 'rotate')}
              onTouchStart={(e) => onShapeInteraction(e, shape.id, 'rotate')}
            >
              <div className="w-6 h-6 bg-white border-2 border-blue-500 rounded-full flex items-center justify-center text-blue-500 shadow-lg cursor-alias"><RotateCw size={10} /></div>
              <div className="w-0.5 h-4 bg-blue-500" />
            </div>
          )}

          {(isPoly || isCurve) && shape.points.map((p, idx) => (
            <div key={idx} className="absolute z-30 pointer-events-auto" style={{ left: p.x, top: p.y }}>
              {showRemoteHandle ? (
                <div style={{ transform: `scale(${inverseScale})`, transformOrigin: 'top left' }} className="absolute left-0 top-0 pointer-events-none">
                  <div className="absolute left-0 top-0 w-2 h-2 bg-blue-500 rounded-full -translate-x-1/2 -translate-y-1/2" />
                  <svg className="absolute overflow-visible pointer-events-none" style={{ left: 0, top: 0, width: 40, height: 40 }}>
                    <path d="M 0 0 L 40 40" stroke="#3b82f6" strokeWidth="1.5" strokeDasharray="3 3" />
                  </svg>
                  <div
                    className="absolute w-12 h-12 flex items-center justify-center pointer-events-auto cursor-crosshair"
                    style={{ left: 40, top: 40, transform: 'translate(-50%, -50%)' }}
                    onMouseDown={(e) => onShapeInteraction(e, shape.id, 'poly-point', idx)}
                    onTouchStart={(e) => onShapeInteraction(e, shape.id, 'poly-point', idx)}
                  >
                    <div className={`w-8 h-8 rounded-full border-2 bg-[#222] flex items-center justify-center shadow-xl transition-colors ${isHandleActive('poly-point', idx) ? 'border-yellow-400 text-yellow-400' : 'border-blue-500 text-blue-500'}`}>
                      <MousePointer2 size={16} />
                    </div>
                  </div>
                </div>
              ) : (
                <div
                  className="absolute w-8 h-8 flex items-center justify-center cursor-crosshair z-30 pointer-events-auto"
                  style={{ left: 0, top: 0, transform: `translate(-50%, -50%) scale(${inverseScale})` }}
                  onMouseDown={(e) => onShapeInteraction(e, shape.id, 'poly-point', idx)}
                  onTouchStart={(e) => onShapeInteraction(e, shape.id, 'poly-point', idx)}
                >
                  {renderHandleGlyph(isHandleActive('poly-point', idx))}
                </div>
              )}
            </div>
          ))}

          {isImage && shape.warpCorners && shape.warpCorners.length === 4 && shape.warpCorners.map((c, i) => {
            const cx = c.x - shape.x, cy = c.y - shape.y;
            const labels = ['TL', 'TR', 'BL', 'BR'];
            return (
              <div key={i} className="absolute z-30 pointer-events-auto" style={{ left: cx, top: cy }}>
                {showRemoteHandle ? (
                  <div style={{ transform: `scale(${inverseScale})`, transformOrigin: 'top left' }} className="absolute left-0 top-0 pointer-events-none">
                    <div className="absolute left-0 top-0 w-2 h-2 bg-yellow-400 rounded-full -translate-x-1/2 -translate-y-1/2" />
                    <svg className="absolute overflow-visible pointer-events-none" style={{ left: 0, top: 0, width: 40, height: 40 }}>
                      <path d="M 0 0 L 40 40" stroke="#eab308" strokeWidth="1.5" strokeDasharray="3 3" />
                    </svg>
                    <div
                      className="absolute w-12 h-12 flex items-center justify-center pointer-events-auto cursor-crosshair"
                      style={{ left: 40, top: 40, transform: 'translate(-50%, -50%)' }}
                      onMouseDown={(e) => onShapeInteraction(e, shape.id, 'warp-point', i)}
                      onTouchStart={(e) => onShapeInteraction(e, shape.id, 'warp-point', i)}
                    >
                      <div className={`w-8 h-8 rounded-full border-2 bg-[#222] flex items-center justify-center shadow-xl transition-colors ${isHandleActive('warp-point', i) ? 'border-yellow-400 text-yellow-400' : 'border-yellow-500 text-yellow-500'}`}>
                        <span className="text-[10px] font-bold">{labels[i]}</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div
                    className="absolute w-8 h-8 flex items-center justify-center cursor-crosshair z-30 pointer-events-auto"
                    style={{ left: 0, top: 0, transform: `translate(-50%, -50%) scale(${inverseScale})` }}
                    onMouseDown={(e) => onShapeInteraction(e, shape.id, 'warp-point', i)}
                    onTouchStart={(e) => onShapeInteraction(e, shape.id, 'warp-point', i)}
                  >
                    <div className={`w-4 h-4 border-2 rounded-full shadow-lg ${isHandleActive('warp-point', i) ? 'bg-yellow-300 border-yellow-500 ring-2 ring-yellow-400/70' : 'bg-yellow-400 border-yellow-600'}`} />
                  </div>
                )}
              </div>
            );
          })}

          {isLine && (
            <>
                {[
                { id: 'start', left: shape.x <= shape.x2 ? lineHitPad : shapeStyle.width - lineHitPad, top: shape.y <= shape.y2 ? lineHitPad : shapeStyle.height - lineHitPad },
                { id: 'end', left: shape.x > shape.x2 ? lineHitPad : shapeStyle.width - lineHitPad, top: shape.y > shape.y2 ? lineHitPad : shapeStyle.height - lineHitPad }
              ].map((pt) => (
                <div key={pt.id} className="absolute z-30 pointer-events-auto" style={{ left: pt.left, top: pt.top }}>
                  {showRemoteHandle ? (
                    <div style={{ transform: `scale(${inverseScale})`, transformOrigin: 'top left' }} className="absolute left-0 top-0 pointer-events-none">
                      <div className="absolute left-0 top-0 w-2 h-2 bg-blue-500 rounded-full -translate-x-1/2 -translate-y-1/2" />
                      <svg className="absolute overflow-visible pointer-events-none" style={{ left: 0, top: 0, width: 40, height: 40 }}>
                        <path d="M 0 0 L 40 40" stroke="#3b82f6" strokeWidth="1.5" strokeDasharray="3 3" />
                      </svg>
                      <div
                        className="absolute w-12 h-12 flex items-center justify-center pointer-events-auto cursor-crosshair"
                        style={{ left: 40, top: 40, transform: 'translate(-50%, -50%)' }}
                        onMouseDown={(e) => onShapeInteraction(e, shape.id, 'line-point', pt.id)}
                        onTouchStart={(e) => onShapeInteraction(e, shape.id, 'line-point', pt.id)}
                      >
                        <div className={`w-8 h-8 rounded-full border-2 bg-[#222] flex items-center justify-center shadow-xl transition-colors ${isHandleActive('line-point', pt.id) ? 'border-yellow-400 text-yellow-400' : 'border-blue-500 text-blue-500'}`}>
                          <MousePointer2 size={16} />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div
                      className="absolute w-8 h-8 flex items-center justify-center pointer-events-auto"
                      style={{ left: 0, top: 0, transform: `translate(-50%, -50%) scale(${inverseScale})` }}
                      onMouseDown={(e) => onShapeInteraction(e, shape.id, 'line-point', pt.id)}
                      onTouchStart={(e) => onShapeInteraction(e, shape.id, 'line-point', pt.id)}
                    >
                      {renderHandleGlyph(isHandleActive('line-point', pt.id))}
                    </div>
                  )}
                </div>
              ))}
            </>
          )}

          {!isLine && !isPoly && !isCurve && !isPrecisionMode && !(isImage && shape.warpCorners) && (
            <>
              {[
                { pos: 'tl', left: 0, top: 0, cursor: 'nw-resize' },
                { pos: 'tr', left: shapeStyle.width, top: 0, cursor: 'ne-resize' },
                { pos: 'bl', left: 0, top: shapeStyle.height, cursor: 'sw-resize' },
                { pos: 'br', left: shapeStyle.width, top: shapeStyle.height, cursor: 'se-resize' },
                { pos: 't', left: shapeStyle.width / 2, top: 0, cursor: 'n-resize' },
                { pos: 'r', left: shapeStyle.width, top: shapeStyle.height / 2, cursor: 'e-resize' },
                { pos: 'b', left: shapeStyle.width / 2, top: shapeStyle.height, cursor: 's-resize' },
                { pos: 'l', left: 0, top: shapeStyle.height / 2, cursor: 'w-resize' }
              ].map(h => (
                <div key={h.pos}
                  className="absolute w-8 h-8 flex items-center justify-center pointer-events-auto"
                  style={{ left: h.left, top: h.top, transform: `translate(-50%, -50%) scale(${inverseScale})`, cursor: h.cursor }}
                  onMouseDown={(e) => onShapeInteraction(e, shape.id, 'resize', h.pos)}
                  onTouchStart={(e) => onShapeInteraction(e, shape.id, 'resize', h.pos)}
                >
                  {renderHandleGlyph(isHandleActive('resize', h.pos))}
                </div>
              ))}
            </>
          )}
        </>
      )}
    </div>
  );
});

function useStageGestures({ activeToolRef, touchState, stageRef, setStage, containerRef }) {
    const rafIdRef = useRef(0);
    const nextStageRef = useRef(null);

    const flushStageUpdate = useCallback(() => {
      rafIdRef.current = 0;
      const payload = nextStageRef.current;
      if (!payload) return;
      nextStageRef.current = null;

      if (payload.type === 'pan') {
        setStage(s => ({ ...s, x: payload.x, y: payload.y }));
        return;
      }

      if (payload.type === 'pinch') {
        setStage({ scale: payload.scale, x: payload.x, y: payload.y });
      }
    }, [setStage]);

    const scheduleStageUpdate = useCallback((payload) => {
      nextStageRef.current = payload;
      if (rafIdRef.current) return;
      rafIdRef.current = requestAnimationFrame(flushStageUpdate);
    }, [flushStageUpdate]);

    const cancelScheduledStageUpdate = useCallback(() => {
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = 0;
      }
      nextStageRef.current = null;
    }, []);

    useEffect(() => () => cancelScheduledStageUpdate(), [cancelScheduledStageUpdate]);

    const handleCanvasTouchStart = useCallback((e) => {
      if (activeToolRef.current === TOOLS.POLY_DRAW || activeToolRef.current === TOOLS.CURVE_DRAW) return;
      const currentStage = stageRef.current;

      if (e.touches.length === 1 && activeToolRef.current === TOOLS.PAN) {
        e.preventDefault();
        cancelScheduledStageUpdate();
        const touch = e.touches[0];
        touchState.current = {
          initialDist: 0,
          initialScale: currentStage.scale,
          initialX: touch.clientX,
          initialY: touch.clientY,
          initialStageX: currentStage.x,
          initialStageY: currentStage.y
        };
      } else if (e.touches.length === 2) {
        e.preventDefault();
        cancelScheduledStageUpdate();
        const t1 = e.touches[0];
        const t2 = e.touches[1];
        const dist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
        const midX = (t1.clientX + t2.clientX) / 2;
        const midY = (t1.clientY + t2.clientY) / 2;
        touchState.current = {
          initialDist: dist,
          initialScale: currentStage.scale,
          initialX: midX,
          initialY: midY,
          initialStageX: currentStage.x,
          initialStageY: currentStage.y
        };
      }
    }, [activeToolRef, touchState, stageRef, cancelScheduledStageUpdate]);

    const handleCanvasTouchMove = useCallback((e) => {
      if (activeToolRef.current === TOOLS.POLY_DRAW || activeToolRef.current === TOOLS.CURVE_DRAW) return;

      if (e.touches.length === 1 && activeToolRef.current === TOOLS.PAN) {
        e.preventDefault();
        const touch = e.touches[0];
        const dx = touch.clientX - touchState.current.initialX;
        const dy = touch.clientY - touchState.current.initialY;
        scheduleStageUpdate({
          type: 'pan',
          x: touchState.current.initialStageX + dx,
          y: touchState.current.initialStageY + dy
        });
      } else if (e.touches.length === 2) {
        e.preventDefault();
        const currentStage = stageRef.current;
        if (!touchState.current.initialDist || !touchState.current.initialScale) {
          const t1 = e.touches[0];
          const t2 = e.touches[1];
          const dist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
          const midX = (t1.clientX + t2.clientX) / 2;
          const midY = (t1.clientY + t2.clientY) / 2;
          touchState.current = {
            initialDist: dist,
            initialScale: currentStage.scale,
            initialX: midX,
            initialY: midY,
            initialStageX: currentStage.x,
            initialStageY: currentStage.y
          };
          return;
        }
        const t1 = e.touches[0];
        const t2 = e.touches[1];
        const dist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
        const midX = (t1.clientX + t2.clientX) / 2;
        const midY = (t1.clientY + t2.clientY) / 2;
        const scaleChange = dist / touchState.current.initialDist;
        const newScale = Math.min(Math.max(0.1, touchState.current.initialScale * scaleChange), 5);
        const container = containerRef.current;
        if (!container) return;
        const rect = container.getBoundingClientRect();
        const originX = midX - rect.left;
        const originY = midY - rect.top;
        const dx = (originX - touchState.current.initialStageX) * (newScale / touchState.current.initialScale);
        const dy = (originY - touchState.current.initialStageY) * (newScale / touchState.current.initialScale);
        if (!Number.isFinite(newScale) || !Number.isFinite(dx) || !Number.isFinite(dy)) return;
        scheduleStageUpdate({
          type: 'pinch',
          scale: newScale,
          x: originX - dx,
          y: originY - dy
        });
      }
    }, [activeToolRef, touchState, containerRef, scheduleStageUpdate, stageRef]);

    const handleCanvasTouchEnd = useCallback((e) => {
      if (nextStageRef.current) {
        if (rafIdRef.current) {
          cancelAnimationFrame(rafIdRef.current);
          rafIdRef.current = 0;
        }
        flushStageUpdate();
      }

      const currentStage = stageRef.current;
      if (e && e.touches && e.touches.length === 1 && activeToolRef.current === TOOLS.PAN) {
        // РџРѕСЃР»Рµ Р·Р°РІРµСЂС€РµРЅРёСЏ pinch РїРµСЂРµСЃРѕР±РёСЂР°РµРј baseline, С‡С‚РѕР±С‹ РЅРµ Р±С‹Р»Рѕ СЂС‹РІРєР° РїСЂРё РїСЂРѕРґРѕР»Р¶РµРЅРёРё pan РѕРґРЅРёРј РїР°Р»СЊС†РµРј.
        const touch = e.touches[0];
        touchState.current = {
          initialX: touch.clientX,
          initialY: touch.clientY,
          initialStageX: currentStage.x,
          initialStageY: currentStage.y
        };
        return;
      }

      if (!e || !e.touches || e.touches.length === 0) {
        touchState.current = {
          initialDist: 0,
          initialScale: currentStage.scale,
          initialX: 0,
          initialY: 0,
          initialStageX: currentStage.x,
          initialStageY: currentStage.y
        };
      }
    }, [flushStageUpdate, activeToolRef, stageRef, touchState]);

    const handleCanvasTouchCancel = useCallback(() => {
      handleCanvasTouchEnd(null as any);
    }, [handleCanvasTouchEnd]);

    return { handleCanvasTouchStart, handleCanvasTouchMove, handleCanvasTouchEnd, handleCanvasTouchCancel };
  }

function useShapeTransform({
    activeToolRef,
    shapesRef,
    stageRef,
    containerRef,
    keepAspectRatioRef,
    setShapes,
    setSelectedId,
    setIsInteracting,
    setActiveHandle
  }) {
    const listenersRef = useRef({ onMove: null, onUp: null });
    const rafIdRef = useRef(0);
    const lastPointerRef = useRef(null);

    const cleanupListeners = useCallback(() => {
      const { onMove, onUp } = listenersRef.current;
      if (!onMove || !onUp) return;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onUp);
      window.removeEventListener('touchcancel', onUp);
      window.removeEventListener('blur', onUp);
      listenersRef.current = { onMove: null, onUp: null };

      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = 0;
      }
      lastPointerRef.current = null;
    }, []);

    useEffect(() => () => cleanupListeners(), [cleanupListeners]);

    const updateShapeById = useCallback((prevShapes, shapeId, updater) => {
      const idx = prevShapes.findIndex(s => s.id === shapeId);
      if (idx === -1) return prevShapes;
      const current = prevShapes[idx];
      const nextShape = updater(current);
      if (nextShape === current) return prevShapes;
      const nextShapes = prevShapes.slice();
      nextShapes[idx] = nextShape;
      return nextShapes;
    }, []);

    const handleShapeInteraction = useCallback((e, id, mode, extra = null) => {
      if (activeToolRef.current === TOOLS.POLY_DRAW || activeToolRef.current === TOOLS.CURVE_DRAW) return;
      if (activeToolRef.current === TOOLS.PAN) return;
      const shape = shapesRef.current.find(s => s.id === id);
      if (!shape || !shape.isVisible) return;
      if (mode === 'locked-noop') return;
      if (shape.isLocked && !['select-only', 'precise-rotate', 'precise-scale', 'precise-pivot'].includes(mode)) return;

      const isTouch = e.type.startsWith('touch');
      const startClientX = isTouch ? e.touches?.[0]?.clientX : e.clientX;
      const startClientY = isTouch ? e.touches?.[0]?.clientY : e.clientY;

      const clientToWorld = (clientX, clientY, stageSnapshot = stageRef.current) => {
        const rect = containerRef.current?.getBoundingClientRect();
        const left = rect?.left ?? 0;
        const top = rect?.top ?? 0;
        return {
          x: (clientX - left - stageSnapshot.x) / stageSnapshot.scale,
          y: (clientY - top - stageSnapshot.y) / stageSnapshot.scale
        };
      };

      const hitTestShape = (s, wx, wy) => {
        const hitSlop = 8 / Math.max(stageRef.current.scale, 0.01);
        const distancePointToSegment = (px, py, ax, ay, bx, by) => {
          const dx = bx - ax;
          const dy = by - ay;
          const len2 = dx * dx + dy * dy || 1;
          let t = ((px - ax) * dx + (py - ay) * dy) / len2;
          t = Math.max(0, Math.min(1, t));
          const sx = ax + t * dx;
          const sy = ay + t * dy;
          return Math.hypot(px - sx, py - sy);
        };

        if (s.type === SHAPE_TYPES.LINE) {
          const x1 = s.x, y1 = s.y, x2 = s.x2 ?? s.x, y2 = s.y2 ?? s.y;
          const dx = x2 - x1;
          const dy = y2 - y1;
          const len2 = dx * dx + dy * dy || 1;
          let t = ((wx - x1) * dx + (wy - y1) * dy) / len2;
          t = Math.max(0, Math.min(1, t));
          const px = x1 + t * dx;
          const py = y1 + t * dy;
          return Math.hypot(wx - px, wy - py) <= (14 / Math.max(stageRef.current.scale, 0.01));
        }
        if (s.type === SHAPE_TYPES.POLY) {
          const pts = (s.points || []).map((p) => ({ x: p.x + s.x, y: p.y + s.y }));
          if (!pts.length) return false;
          if (!s.isClosed) {
            const tol = 10 / Math.max(stageRef.current.scale, 0.01);
            for (let i = 0; i < pts.length - 1; i++) {
              const a = pts[i], b = pts[i + 1];
              const dx = b.x - a.x, dy = b.y - a.y;
              const len2 = dx * dx + dy * dy || 1;
              let t = ((wx - a.x) * dx + (wy - a.y) * dy) / len2;
              t = Math.max(0, Math.min(1, t));
              const px = a.x + t * dx, py = a.y + t * dy;
              if (Math.hypot(wx - px, wy - py) <= tol) return true;
            }
            return false;
          }
          let inside = false;
          for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
            const xi = pts[i].x, yi = pts[i].y, xj = pts[j].x, yj = pts[j].y;
            const intersect = ((yi > wy) !== (yj > wy)) && (wx < (xj - xi) * (wy - yi) / ((yj - yi) || 1e-9) + xi);
            if (intersect) inside = !inside;
          }
          if (inside) return true;
          for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
            if (distancePointToSegment(wx, wy, pts[j].x, pts[j].y, pts[i].x, pts[i].y) <= hitSlop) return true;
          }
          return false;
        }
        if (s.type === SHAPE_TYPES.CURVE) {
          const pts = (s.points || []).map((p) => ({ x: p.x + s.x, y: p.y + s.y }));
          if (!pts.length) return false;
          const tol = 10 / Math.max(stageRef.current.scale, 0.01);
          for (let i = 0; i < pts.length - 1; i++) {
            const a = pts[i], b = pts[i + 1];
            const dx = b.x - a.x, dy = b.y - a.y;
            const len2 = dx * dx + dy * dy || 1;
            let t = ((wx - a.x) * dx + (wy - a.y) * dy) / len2;
            t = Math.max(0, Math.min(1, t));
            const px = a.x + t * dx, py = a.y + t * dy;
            if (Math.hypot(wx - px, wy - py) <= tol) return true;
          }
          return false;
        }

        const cx = s.x + s.w / 2;
        const cy = s.y + s.h / 2;
        const ang = -((s.rotation || 0) * Math.PI / 180);
        const cos = Math.cos(ang), sin = Math.sin(ang);
        const lx = (wx - cx) * cos - (wy - cy) * sin + s.w / 2;
        const ly = (wx - cx) * sin + (wy - cy) * cos + s.h / 2;

        if (s.type === SHAPE_TYPES.RECT || s.type === SHAPE_TYPES.IMAGE) {
          return lx >= -hitSlop && lx <= (s.w + hitSlop) && ly >= -hitSlop && ly <= (s.h + hitSlop);
        }
        if (s.type === SHAPE_TYPES.CIRCLE) {
          const rx = (s.w / 2) + hitSlop || 1;
          const ry = (s.h / 2) + hitSlop || 1;
          const nx = (lx - rx) / rx;
          const ny = (ly - ry) / ry;
          return (nx * nx + ny * ny) <= 1;
        }
        if (s.type === SHAPE_TYPES.TRIANGLE) {
          const p0 = { x: s.w / 2, y: 0 };
          const p1 = { x: s.w, y: s.h };
          const p2 = { x: 0, y: s.h };
          const d = (p1.y - p2.y) * (p0.x - p2.x) + (p2.x - p1.x) * (p0.y - p2.y);
          const a = ((p1.y - p2.y) * (lx - p2.x) + (p2.x - p1.x) * (ly - p2.y)) / d;
          const b = ((p2.y - p0.y) * (lx - p2.x) + (p0.x - p2.x) * (ly - p2.y)) / d;
          const c = 1 - a - b;
          if (a >= 0 && b >= 0 && c >= 0) return true;
          return (
            distancePointToSegment(lx, ly, p0.x, p0.y, p1.x, p1.y) <= hitSlop
            || distancePointToSegment(lx, ly, p1.x, p1.y, p2.x, p2.y) <= hitSlop
            || distancePointToSegment(lx, ly, p2.x, p2.y, p0.x, p0.y) <= hitSlop
          );
        }
        return lx >= -hitSlop && lx <= (s.w + hitSlop) && ly >= -hitSlop && ly <= (s.h + hitSlop);
      };

      if (mode === 'move' && Number.isFinite(startClientX) && Number.isFinite(startClientY)) {
        const curStage = stageRef.current;
        const { x: wx, y: wy } = clientToWorld(startClientX, startClientY, curStage);
        if (!hitTestShape(shape, wx, wy)) return;
      }

      if (isTouch && e.touches.length > 1) {
        // РќРµ Р·Р°РїСѓСЃРєР°РµРј С‚СЂР°РЅСЃС„РѕСЂРјР°С†РёСЋ С„РёРіСѓСЂС‹ РґР»СЏ multi-touch:
        // Р¶РµСЃС‚ РґРѕР»Р¶РµРЅ РѕР±СЂР°Р±РѕС‚Р°С‚СЊСЃСЏ РЅР° СѓСЂРѕРІРЅРµ СЃС†РµРЅС‹ (pinch/pan).
        return;
      }

      if (e.type === 'touchstart') e.preventDefault();
      e.stopPropagation();
      cleanupListeners();

      setIsInteracting(true);
      setSelectedId(id);

      if (mode === 'select-only') {
        setActiveHandle(null);
        setIsInteracting(false);
        return;
      }
      setActiveHandle({ id, mode, extra });

      if (isTouch && (!e.touches || e.touches.length === 0)) return;
      const startX = isTouch ? e.touches[0].clientX : e.clientX;
      const startY = isTouch ? e.touches[0].clientY : e.clientY;
      const stageAtStart = stageRef.current;
      const { x: startWorldX, y: startWorldY } = clientToWorld(startX, startY, stageAtStart);
      const pivotWorldX0 = shape.x + shape.w * (shape.pivotU ?? 0.5);
      const pivotWorldY0 = shape.y + shape.h * (shape.pivotV ?? 0.5);
      const preciseStartDist = Math.max(8, Math.hypot(startWorldX - pivotWorldX0, startWorldY - pivotWorldY0));
      const initial = {
        x: shape.x,
        y: shape.y,
        w: shape.w,
        h: shape.h,
        x2: shape.x2,
        y2: shape.y2,
        rotation: shape.rotation,
        points: Array.isArray(shape.points) ? shape.points.map(p => ({ x: p.x, y: p.y })) : null,
        warpCorners: Array.isArray(shape.warpCorners) ? shape.warpCorners.map(c => ({ x: c.x, y: c.y })) : null,
        pivotU: shape.pivotU ?? 0.5,
        pivotV: shape.pivotV ?? 0.5,
        rotateLever: shape.rotateLever ?? DEFAULT_PRECISE_ROTATE_LEVER,
        scaleLever: shape.scaleLever ?? DEFAULT_PRECISE_SCALE_LEVER,
        preciseStartDist,
        lineLength: Math.hypot((shape.x2 ?? shape.x) - shape.x, (shape.y2 ?? shape.y) - shape.y)
      };

      const applyMoveAt = (curX, curY) => {
        const currentStage = stageRef.current;
        const dxGlobal = (curX - startX) / currentStage.scale;
        const dyGlobal = (curY - startY) / currentStage.scale;

        setShapes(prev => updateShapeById(prev, id, (s) => {
          if (mode === 'move') {
            const res = { ...s, x: initial.x + dxGlobal, y: initial.y + dyGlobal };
            if (s.type === 'line') {
              res.x2 = (initial.x2 || 0) + dxGlobal;
              res.y2 = (initial.y2 || 0) + dyGlobal;
            }
            return res;
          }
            if (mode === 'resize') {
            const angleRad = (initial.rotation * Math.PI) / 180;
            const cosA = Math.cos(angleRad);
            const sinA = Math.sin(angleRad);
            const dxLocal = dxGlobal * cosA + dyGlobal * sinA;
            const dyLocal = -dxGlobal * sinA + dyGlobal * cosA;

            const handle = extra || 'br';
            let anchorX, anchorY, newW, newH;
            const iw = initial.w, ih = initial.h;

            if (handle === 'br') { anchorX = 0; anchorY = 0; newW = iw + dxLocal; newH = ih + dyLocal; }
            else if (handle === 'tr') { anchorX = 0; anchorY = ih; newW = iw + dxLocal; newH = ih - dyLocal; }
            else if (handle === 'bl') { anchorX = iw; anchorY = 0; newW = iw - dxLocal; newH = ih + dyLocal; }
            else if (handle === 'tl') { anchorX = iw; anchorY = ih; newW = iw - dxLocal; newH = ih - dyLocal; }
            else if (handle === 'r') { anchorX = 0; anchorY = 0; newW = iw + dxLocal; newH = ih; }
            else if (handle === 'l') { anchorX = iw; anchorY = 0; newW = iw - dxLocal; newH = ih; }
            else if (handle === 'b') { anchorX = 0; anchorY = 0; newW = iw; newH = ih + dyLocal; }
            else if (handle === 't') { anchorX = 0; anchorY = ih; newW = iw; newH = ih - dyLocal; }
            else { anchorX = 0; anchorY = 0; newW = iw + dxLocal; newH = ih + dyLocal; }

            if (((s.keepProportions ?? keepAspectRatioRef.current) || s.type === SHAPE_TYPES.IMAGE) && iw !== 0 && ih !== 0) {
              const ratio = iw / ih;
              if (handle === 't' || handle === 'b') { newW = newH * ratio; }
              else if (handle === 'l' || handle === 'r') { newH = newW / ratio; }
              else { if (Math.abs(dxLocal) > Math.abs(dyLocal)) newH = newW / ratio; else newW = newH * ratio; }
            }

            newW = Math.max(20, newW);
            newH = Math.max(20, newH);

            const newX = anchorX === 0 ? initial.x : initial.x + iw - newW;
            const newY = anchorY === 0 ? initial.y : initial.y + ih - newH;
            return { ...s, x: newX, y: newY, w: newW, h: newH };
          }
          if (mode === 'rotate') {
            const centerX = initial.x + initial.w / 2;
            const centerY = initial.y + initial.h / 2;
            const { x: currentMouseX, y: currentMouseY } = clientToWorld(curX, curY, currentStage);
            const angle = Math.atan2(currentMouseY - centerY, currentMouseX - centerX);
            return { ...s, rotation: (angle * 180 / Math.PI) + 90 };
          }
          if (mode === 'line-point') {
            if (s.keepLength) {
              const anchor = extra === 'start'
                ? { x: initial.x2 ?? initial.x, y: initial.y2 ?? initial.y }
                : { x: initial.x, y: initial.y };
              const raw = extra === 'start'
                ? { x: initial.x + dxGlobal, y: initial.y + dyGlobal }
                : { x: (initial.x2 ?? initial.x) + dxGlobal, y: (initial.y2 ?? initial.y) + dyGlobal };
              let vx = raw.x - anchor.x;
              let vy = raw.y - anchor.y;
              let len = Math.hypot(vx, vy);
              if (len < 0.0001) {
                vx = extra === 'start' ? (initial.x - anchor.x) : ((initial.x2 ?? initial.x) - anchor.x);
                vy = extra === 'start' ? (initial.y - anchor.y) : ((initial.y2 ?? initial.y) - anchor.y);
                len = Math.hypot(vx, vy) || 1;
              }
              const k = (initial.lineLength || 1) / len;
              const constrained = { x: anchor.x + vx * k, y: anchor.y + vy * k };
              return extra === 'start'
                ? { ...s, x: constrained.x, y: constrained.y }
                : { ...s, x2: constrained.x, y2: constrained.y };
            }
            return extra === 'start'
              ? { ...s, x: initial.x + dxGlobal, y: initial.y + dyGlobal }
              : { ...s, x2: (initial.x2 || 0) + dxGlobal, y2: (initial.y2 || 0) + dyGlobal };
          }
          if (mode === 'precise-rotate') {
            const pivotWorldX = initial.x + initial.w * initial.pivotU;
            const pivotWorldY = initial.y + initial.h * initial.pivotV;
            const { x: mouseX, y: mouseY } = clientToWorld(curX, curY, currentStage);
            const handleAngle = Math.atan2(mouseY - pivotWorldY, mouseX - pivotWorldX);
            const angle = handleAngle + PRECISE_HANDLE_SPREAD;
            const leverWorld = Math.hypot(mouseX - pivotWorldX, mouseY - pivotWorldY);
            const lever = Math.min(420, Math.max(20, leverWorld * currentStage.scale));
            return {
              ...s,
              rotation: (angle * 180 / Math.PI) + 90,
              rotateLever: lever,
              rotateHandleAngle: handleAngle
            };
          }
          if (mode === 'precise-scale') {
            const pivotWorldX = initial.x + initial.w * initial.pivotU;
            const pivotWorldY = initial.y + initial.h * initial.pivotV;
            const { x: curPx, y: curPy } = clientToWorld(curX, curY, currentStage);
            const curDist = Math.max(8, Math.hypot(curPx - pivotWorldX, curPy - pivotWorldY));
            const currentAngle = Math.atan2(curPy - pivotWorldY, curPx - pivotWorldX);
            const factor = Math.min(8, Math.max(0.12, curDist / initial.preciseStartDist));
            const newW = Math.max(20, initial.w * factor);
            const newH = Math.max(20, initial.h * factor);
            const scaleLever = Math.min(460, Math.max(20, curDist * currentStage.scale));
            return {
              ...s,
              w: newW,
              h: newH,
              x: pivotWorldX - newW * initial.pivotU,
              y: pivotWorldY - newH * initial.pivotV,
              scaleLever,
              scaleAngle: currentAngle
            };
          }
          if (mode === 'precise-pivot') {
            const u = Math.min(1, Math.max(0, initial.pivotU + (initial.w ? dxGlobal / initial.w : 0)));
            const v = Math.min(1, Math.max(0, initial.pivotV + (initial.h ? dyGlobal / initial.h : 0)));
            return { ...s, pivotU: u, pivotV: v };
          }
          if (mode === 'poly-point') {
            const worldPts = s.points.map((p, i) =>
              i === extra
                ? { x: (initial.x + initial.points[extra].x) + dxGlobal, y: (initial.y + initial.points[extra].y) + dyGlobal }
                : { x: s.x + p.x, y: s.y + p.y }
            );
            const xs = worldPts.map(p => p.x);
            const ys = worldPts.map(p => p.y);
            const newMinX = Math.min(...xs);
            const newMinY = Math.min(...ys);
            return {
              ...s,
              x: newMinX,
              y: newMinY,
              w: Math.max(Math.max(...xs) - newMinX, 1),
              h: Math.max(Math.max(...ys) - newMinY, 1),
              points: worldPts.map(p => ({ x: p.x - newMinX, y: p.y - newMinY }))
            };
          }
          if (mode === 'warp-point') {
            const i = extra;
            const corners = initial.warpCorners.map((c, idx) =>
              idx === i
                ? { x: initial.warpCorners[i].x + dxGlobal, y: initial.warpCorners[i].y + dyGlobal }
                : { x: initial.warpCorners[idx].x, y: initial.warpCorners[idx].y }
            );
            const xs = corners.map(p => p.x);
            const ys = corners.map(p => p.y);
            const newMinX = Math.min(...xs);
            const newMinY = Math.min(...ys);
            return {
              ...s,
              x: newMinX,
              y: newMinY,
              w: Math.max(Math.max(...xs) - newMinX, 1),
              h: Math.max(Math.max(...ys) - newMinY, 1),
              warpCorners: corners
            };
          }
          return s;
        }));
      };

      const onMove = (moveEvent) => {
        const isMoveTouch = moveEvent.type.startsWith('touch');
        if (isMoveTouch && moveEvent.touches.length > 1) return;
        if (isMoveTouch && (!moveEvent.touches || moveEvent.touches.length === 0)) return;
        const curX = isMoveTouch ? moveEvent.touches[0].clientX : moveEvent.clientX;
        const curY = isMoveTouch ? moveEvent.touches[0].clientY : moveEvent.clientY;
        lastPointerRef.current = { x: curX, y: curY };
        const isPreciseMode = mode === 'precise-rotate' || mode === 'precise-scale' || mode === 'precise-pivot';

        if (isPreciseMode) {
          if (isMoveTouch && moveEvent.cancelable) moveEvent.preventDefault();
          applyMoveAt(curX, curY);
          return;
        }

        if (rafIdRef.current) return;

        rafIdRef.current = requestAnimationFrame(() => {
          rafIdRef.current = 0;
          const latest = lastPointerRef.current;
          if (!latest) return;
          applyMoveAt(latest.x, latest.y);
        });
      };

      const onUp = () => {
        const latest = lastPointerRef.current;
        if (latest) {
          if (rafIdRef.current) {
            cancelAnimationFrame(rafIdRef.current);
            rafIdRef.current = 0;
          }
          applyMoveAt(latest.x, latest.y);
        }
        cleanupListeners();
        setActiveHandle(null);
        setIsInteracting(false);
        if (mode === 'poly-point') {
          setShapes(prev => updateShapeById(prev, id, (s) => {
            const xs = s.points.map(p => p.x);
            const ys = s.points.map(p => p.y);
            const minX = Math.min(...xs);
            const minY = Math.min(...ys);
            return {
              ...s,
              x: s.x + minX,
              y: s.y + minY,
              w: Math.max(Math.max(...xs) - minX, 1),
              h: Math.max(Math.max(...ys) - minY, 1),
              points: s.points.map(p => ({ x: p.x - minX, y: p.y - minY }))
            };
          }));
        }
        if (mode === 'precise-rotate' || mode === 'precise-scale') {
          setShapes(prev => updateShapeById(prev, id, (s) => ({
            ...s,
            rotateLever: DEFAULT_PRECISE_ROTATE_LEVER,
            scaleLever: DEFAULT_PRECISE_SCALE_LEVER,
            rotateHandleAngle: null,
            scaleAngle: null
          })));
        }
      };

      listenersRef.current = { onMove, onUp };
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
      window.addEventListener('touchmove', onMove, { passive: false });
      window.addEventListener('touchend', onUp);
      window.addEventListener('touchcancel', onUp);
      window.addEventListener('blur', onUp);
    }, [activeToolRef, shapesRef, stageRef, containerRef, keepAspectRatioRef, setShapes, setSelectedId, setIsInteracting, cleanupListeners, updateShapeById, setActiveHandle]);

    return { handleShapeInteraction };
  }

const loadSavedShapes = () => {
  try {
    const saved = localStorage.getItem('figmalite_shapes');
    if (saved) return JSON.parse(saved);
  } catch {}
  return [];
};

const initialAppState = {
    stage: { x: 20, y: 80, scale: 0.5 },
    shapes: loadSavedShapes(),
    selectedId: null,
    activeTool: TOOLS.SELECT,
    showSettings: false,
    showLayers: false,
    keepAspectRatio: true,
    polyPoints: [],
    curvePoints: [],
    isInteracting: false
  };

function appReducer(state, action) {
    switch (action.type) {
      case 'SET_STAGE':
        return {
          ...state,
          stage: typeof action.payload === 'function'
            ? action.payload(state.stage)
            : action.payload
        };
      case 'SET_SHAPES':
        return {
          ...state,
          shapes: typeof action.payload === 'function'
            ? action.payload(state.shapes)
            : action.payload
        };
      case 'SET_SELECTED_ID':
        return { ...state, selectedId: action.payload };
      case 'SET_ACTIVE_TOOL':
        return { ...state, activeTool: action.payload };
      case 'SET_SHOW_SETTINGS':
        return { ...state, showSettings: action.payload };
      case 'SET_SHOW_LAYERS':
        return { ...state, showLayers: action.payload };
      case 'SET_KEEP_ASPECT_RATIO':
        return { ...state, keepAspectRatio: action.payload };
      case 'SET_POLY_POINTS':
        return {
          ...state,
          polyPoints: typeof action.payload === 'function'
            ? action.payload(state.polyPoints)
            : action.payload
        };
      case 'SET_CURVE_POINTS':
        return {
          ...state,
          curvePoints: typeof action.payload === 'function'
            ? action.payload(state.curvePoints)
            : action.payload
        };
      case 'SET_IS_INTERACTING':
        return { ...state, isInteracting: action.payload };
      default:
        return state;
    }
  }

function App() {
    const [state, dispatch] = useReducer(appReducer, initialAppState);
    const [activeHandle, setActiveHandle] = useState(null);
    const [imageQuickMenu, setImageQuickMenu] = useState<ImageQuickMenu | null>(null);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [showAddMenu, setShowAddMenu] = useState(false);
    const [dragLayerId, setDragLayerId] = useState<string | null>(null);
    const swipeStartRef = useRef(0);
    const swipeOffsetRef = useRef(0);
    const settingsPanelRef = useRef<HTMLDivElement>(null);
    const precisionPanelRef = useRef<HTMLDivElement>(null);
    const layersPanelRef = useRef<HTMLDivElement>(null);
    const {
      stage,
      shapes,
      selectedId,
      activeTool,
      showSettings,
      showLayers,
      keepAspectRatio,
      polyPoints,
      curvePoints,
      isInteracting
    } = state;

    const setStage = useCallback((payload) => dispatch({ type: 'SET_STAGE', payload }), []);
    const setShapes = useCallback((payload) => dispatch({ type: 'SET_SHAPES', payload }), []);
    const setSelectedId = useCallback((payload) => dispatch({ type: 'SET_SELECTED_ID', payload }), []);
    const setActiveTool = useCallback((payload) => dispatch({ type: 'SET_ACTIVE_TOOL', payload }), []);
    const setShowSettings = useCallback((payload) => dispatch({ type: 'SET_SHOW_SETTINGS', payload }), []);
    const setShowLayers = useCallback((payload) => dispatch({ type: 'SET_SHOW_LAYERS', payload }), []);
    const setKeepAspectRatio = useCallback((payload) => dispatch({ type: 'SET_KEEP_ASPECT_RATIO', payload }), []);
    const setPolyPoints = useCallback((payload) => dispatch({ type: 'SET_POLY_POINTS', payload }), []);
    const setCurvePoints = useCallback((payload) => dispatch({ type: 'SET_CURVE_POINTS', payload }), []);
    const setIsInteracting = useCallback((payload) => dispatch({ type: 'SET_IS_INTERACTING', payload }), []);

    useEffect(() => {
      const timer = setTimeout(() => {
        localStorage.setItem('figmalite_shapes', JSON.stringify(shapes));
      }, 500);
      return () => clearTimeout(timer);
    }, [shapes]);

    const clearCanvas = useCallback(() => {
      if (!window.confirm('Clear entire canvas?')) return;
      setShapes([]);
      setSelectedId(null);
      setActiveTool(TOOLS.SELECT);
      setPolyPoints([]);
      setCurvePoints([]);
      setShowLayers(false);
      setShowSettings(false);
      localStorage.removeItem('figmalite_shapes');
    }, [setShapes, setSelectedId, setActiveTool, setPolyPoints, setCurvePoints, setShowLayers, setShowSettings]);

    const containerRef = useRef(null);
    const fileInputRef = useRef<HTMLInputElement | null>(null);

    const touchState = useRef({
      initialDist: 0,
      initialScale: 0,
      initialX: 0,
      initialY: 0,
      initialStageX: 0,
      initialStageY: 0
    });

    const stageRef = useRef(stage);
    const shapesRef = useRef(shapes);
    const activeToolRef = useRef(activeTool);
    const keepAspectRatioRef = useRef(keepAspectRatio);

    useEffect(() => { stageRef.current = stage; }, [stage]);
    useEffect(() => { shapesRef.current = shapes; }, [shapes]);
    useEffect(() => { activeToolRef.current = activeTool; }, [activeTool]);
    useEffect(() => { keepAspectRatioRef.current = keepAspectRatio; }, [keepAspectRatio]);

    useEffect(() => {
      const handleFullscreenChange = () => setIsFullscreen(!!document.fullscreenElement);
      document.addEventListener('fullscreenchange', handleFullscreenChange);
      return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
    }, []);

    const toggleFullscreen = useCallback(() => {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {});
      } else {
        if (document.exitFullscreen) {
          document.exitFullscreen();
        }
      }
    }, []);

    const compressImage = (dataUrl: string, maxDim = 1920, quality = 0.85): Promise<string> =>
      new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
          let { width, height } = img;
          if (width > maxDim || height > maxDim) {
            const ratio = Math.min(maxDim / width, maxDim / height);
            width = Math.round(width * ratio);
            height = Math.round(height * ratio);
          }
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) { resolve(dataUrl); return; }
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', quality));
        };
        img.onerror = () => reject(new Error('Image load failed'));
        img.src = dataUrl;
      });

    const handleImageUpload = (e) => {
      const input = e.target as HTMLInputElement;
      const file = input?.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (event) => {
        const rawResult = event?.target?.result;
        if (typeof rawResult !== 'string') return;
        compressImage(rawResult).then(compressedSrc => {
          const img = new Image();
          img.onload = () => {
          const containerEl = containerRef.current;
          if (!containerEl) return;
          const container = containerEl.getBoundingClientRect();

          // Scale image to fit into the current viewport.
          const viewW = container.width / stage.scale;
          const viewH = container.height / stage.scale;

          let imgScale = 1;
          if (img.width > viewW * 0.8 || img.height > viewH * 0.8) {
            imgScale = Math.min((viewW * 0.8) / img.width, (viewH * 0.8) / img.height);
          }

          const finalW = img.width * imgScale;
          const finalH = img.height * imgScale;

          const centerX = (container.width / 2 - stage.x) / stage.scale;
          const centerY = (container.height / 2 - stage.y) / stage.scale;

          const newImageShape = {
            id: generateId(),
            type: SHAPE_TYPES.IMAGE,
            index: shapes.length + 1,
            src: compressedSrc,
            x: centerX - finalW / 2,
            y: centerY - finalH / 2,
            w: finalW,
            h: finalH,
            rotation: 0,
            opacity: 100,
            isLocked: false,
            isVisible: true,
            // Image filter controls.
            hue: 0,
            saturation: 100,
            brightness: 100,
            contrast: 100,
            invert: false,
            pivotU: 0.5,
            pivotV: 0.5,
            rotateLever: DEFAULT_PRECISE_ROTATE_LEVER,
            scaleLever: DEFAULT_PRECISE_SCALE_LEVER,
            scaleAngle: null,
            rotateHandleAngle: null,
            warpCorners: null
          };

          // Images are always placed below vector shapes,
          // but above previously added images.
          setShapes(prev => {
            const images = prev.filter(s => s.type === SHAPE_TYPES.IMAGE);
            const vectors = prev.filter(s => s.type !== SHAPE_TYPES.IMAGE);
            return [...images, newImageShape, ...vectors];
          });

          setSelectedId(newImageShape.id);
          setActiveTool(TOOLS.SELECT);
          input.value = '';
        };
        img.src = compressedSrc;
      }).catch(() => {});
      };
      reader.readAsDataURL(file);
    };

    const addShape = (type) => {
      if (type === SHAPE_TYPES.POLY) {
        setActiveTool(TOOLS.POLY_DRAW);
        setPolyPoints([]);
        setSelectedId(null);
        return;
      }

      const containerEl = containerRef.current;
      if (!containerEl) return;
      const container = containerEl.getBoundingClientRect();
      const centerX = (container.width / 2 - stage.x) / stage.scale;
      const centerY = (container.height / 2 - stage.y) / stage.scale;

      const isLine = type === SHAPE_TYPES.LINE;
      const isTriangle = type === SHAPE_TYPES.TRIANGLE;

      const defaultWidth = 100;
      const defaultHeight = isLine ? 2 : (isTriangle ? defaultWidth * (Math.sqrt(3) / 2) : 100);

      const newShape = {
        id: generateId(),
        type,
        index: shapes.length + 1,
        x: centerX - defaultWidth / 2,
        y: centerY - defaultHeight / 2,
        w: defaultWidth,
        h: defaultHeight,
        x2: isLine ? centerX + 50 : null,
        y2: isLine ? centerY : null,
        rotation: 0,
        fill: isLine ? 'transparent' : '#3b82f6',
        stroke: '#3b82f6',
        strokeWidth: 2,
        divisions: 1,
        opacity: 60,
        keepProportions: true,
        keepLength: false,
        isLocked: false,
        isVisible: true
      };
      setShapes([...shapes, newShape]);
      setSelectedId(newShape.id);
      setActiveTool(TOOLS.SELECT);
    };

    const finalizePoly = (closed = true) => {
      if (polyPoints.length < (closed ? 3 : 2)) {
        setActiveTool(TOOLS.SELECT);
        setPolyPoints([]);
        return;
      }

      const MERGE_THRESHOLD = 10;
      const mergedPoints = [];

      for (let i = 0; i < polyPoints.length; i++) {
        const current = polyPoints[i];
        if (mergedPoints.length === 0) {
          mergedPoints.push(current);
        } else {
          const last = mergedPoints[mergedPoints.length - 1];
          const dist = Math.hypot(current.x - last.x, current.y - last.y);
          if (dist > MERGE_THRESHOLD) {
            mergedPoints.push(current);
          }
        }
      }

      if (closed && mergedPoints.length > 2) {
        const first = mergedPoints[0];
        const last = mergedPoints[mergedPoints.length - 1];
        const dist = Math.hypot(first.x - last.x, first.y - last.y);
        if (dist <= MERGE_THRESHOLD) {
          mergedPoints.pop();
        }
      }

      const xs = mergedPoints.map(p => p.x);
      const ys = mergedPoints.map(p => p.y);
      const minX = Math.min(...xs);
      const minY = Math.min(...ys);
      const maxX = Math.max(...xs);
      const maxY = Math.max(...ys);
      const width = Math.max(maxX - minX, 1);
      const height = Math.max(maxY - minY, 1);

      const normalizedPoints = mergedPoints.map(p => ({
        x: p.x - minX,
        y: p.y - minY
      }));

      const newShape = {
        id: generateId(),
        type: SHAPE_TYPES.POLY,
        index: shapes.length + 1,
        x: minX,
        y: minY,
        w: width,
        h: height,
        points: normalizedPoints,
        isClosed: closed,
        rotation: 0,
        fill: closed ? '#3b82f6' : 'transparent',
        stroke: '#3b82f6',
        strokeWidth: 2,
        opacity: 60,
        keepProportions: true,
        keepLength: false,
        isLocked: false,
        isVisible: true
      };

      setShapes([...shapes, newShape]);
      setSelectedId(newShape.id);
      setPolyPoints([]);
      setActiveTool(TOOLS.SELECT);
    };

    const finalizeCurve = () => {
      if (curvePoints.length < 2) {
        setActiveTool(TOOLS.SELECT);
        setCurvePoints([]);
        return;
      }
      const xs = curvePoints.map(p => p.x);
      const ys = curvePoints.map(p => p.y);
      const minX = Math.min(...xs);
      const minY = Math.min(...ys);
      const maxX = Math.max(...xs);
      const maxY = Math.max(...ys);
      const width = Math.max(maxX - minX, 1);
      const height = Math.max(maxY - minY, 1);
      const normalizedPoints = curvePoints.map(p => ({ x: p.x - minX, y: p.y - minY }));

      const newShape = {
        id: generateId(),
        type: SHAPE_TYPES.CURVE,
        index: shapes.length + 1,
        x: minX,
        y: minY,
        w: width,
        h: height,
        points: normalizedPoints,
        rotation: 0,
        stroke: '#3b82f6',
        strokeWidth: 2,
        opacity: 60,
        keepProportions: true,
        keepLength: false,
        isLocked: false,
        isVisible: true
      };
      setShapes([...shapes, newShape]);
      setSelectedId(newShape.id);
      setCurvePoints([]);
      setActiveTool(TOOLS.SELECT);
    };

    const handleCanvasMouseDown = (e) => {
      setShowAddMenu(false);
      if (e.target.closest('button') || e.target.closest('input')) return;
      setImageQuickMenu(null);
      if (activeTool === TOOLS.PAN) return;

      if (activeTool === TOOLS.POLY_DRAW) {
        if (e.type === 'touchstart') e.preventDefault();
        const clientX = e.clientX ?? (e.touches && e.touches[0]?.clientX);
        const clientY = e.clientY ?? (e.touches && e.touches[0]?.clientY);
        if (clientX === undefined) return;
        const containerEl = containerRef.current;
        if (!containerEl) return;
        const rect = containerEl.getBoundingClientRect();
        const clickX = (clientX - rect.left - stage.x) / stage.scale;
        const clickY = (clientY - rect.top - stage.y) / stage.scale;
        if (polyPoints.length >= 3) {
          const first = polyPoints[0];
          const dist = Math.hypot(clickX - first.x, clickY - first.y);
          if (dist < 20 / stage.scale) {
            finalizePoly(true);
            return;
          }
        }
        setPolyPoints(prev => [...prev, { x: clickX, y: clickY }]);
      } else if (activeTool === TOOLS.CURVE_DRAW) {
        if (e.type === 'touchstart') e.preventDefault();
        const clientX = e.clientX ?? (e.touches && e.touches[0]?.clientX);
        const clientY = e.clientY ?? (e.touches && e.touches[0]?.clientY);
        if (clientX === undefined) return;
        const containerEl = containerRef.current;
        if (!containerEl) return;
        const rect = containerEl.getBoundingClientRect();
        const clickX = (clientX - rect.left - stage.x) / stage.scale;
        const clickY = (clientY - rect.top - stage.y) / stage.scale;
        setCurvePoints(prev => [...prev, { x: clickX, y: clickY }]);
      } else {
        setSelectedId(null);
      }
    };

    const pointHitsShape = useCallback((shape, wx, wy) => {
      if (!shape?.isVisible) return false;
      if (shape.type === SHAPE_TYPES.LINE) {
        const x1 = shape.x, y1 = shape.y, x2 = shape.x2 ?? shape.x, y2 = shape.y2 ?? shape.y;
        const dx = x2 - x1;
        const dy = y2 - y1;
        const len2 = dx * dx + dy * dy || 1;
        let t = ((wx - x1) * dx + (wy - y1) * dy) / len2;
        t = Math.max(0, Math.min(1, t));
        const px = x1 + t * dx;
        const py = y1 + t * dy;
        const dist = Math.hypot(wx - px, wy - py);
        return dist <= (18 / Math.max(stage.scale, 0.01));
      }
      return wx >= shape.x && wx <= (shape.x + shape.w) && wy >= shape.y && wy <= (shape.y + shape.h);
    }, [stage.scale]);

    const deleteShape = (id) => {
      const shape = shapes.find(s => s.id === id);
      if (!shape || !window.confirm(`Delete ${shape.type}?`)) return;
      setShapes(prev => prev.filter(s => s.id !== id));
      if (selectedId === id) setSelectedId(null);
    };

    const updateShapeById = useCallback((shapeId, updater) => {
      setShapes(prev => {
        const idx = prev.findIndex(s => s.id === shapeId);
        if (idx === -1) return prev;
        const current = prev[idx];
        const next = updater(current);
        if (next === current) return prev;
        const cloned = prev.slice();
        cloned[idx] = next;
        return cloned;
      });
    }, [setShapes]);

    const updateSelectedShape = useCallback((updater) => {
      if (!selectedId) return;
      updateShapeById(selectedId, updater);
    }, [selectedId, updateShapeById]);

    const updateShapeColor = useCallback((id, color) => {
      updateShapeById(id, (s) => ({
        ...s,
        stroke: color,
        fill: (s.type === 'line' || s.type === 'curve' || (s.type === 'poly' && !s.isClosed)) ? 'transparent' : color
      }));
    }, [updateShapeById]);

    const updateSelectedStroke = useCallback((color) => {
      updateSelectedShape((s) => ({ ...s, stroke: color }));
    }, [updateSelectedShape]);

    const updateSelectedFill = useCallback((color) => {
      updateSelectedShape((s) => ({ ...s, fill: color }));
    }, [updateSelectedShape]);

    const cycleStrokePreset = useCallback((shapeId, groupIndex) => {
      const group = COLOR_GROUPS[groupIndex] || COLOR_GROUPS[0];
      updateShapeById(shapeId, (s) => ({ ...s, stroke: nextShadeInGroup(s.stroke, group) }));
    }, [updateShapeById]);

    const cycleFillPreset = useCallback((shapeId, groupIndex) => {
      const group = COLOR_GROUPS[groupIndex] || COLOR_GROUPS[0];
      updateShapeById(shapeId, (s) => ({ ...s, fill: nextShadeInGroup(s.fill, group) }));
    }, [updateShapeById]);

    const copyLineFromShape = useCallback((shapeId) => {
      const src = shapesRef.current.find((s) => s.id === shapeId && s.type === SHAPE_TYPES.LINE);
      if (!src) return;
      const nextStroke = COLOR_PRESETS.find((c) => c.toLowerCase() !== String(src.stroke || '').toLowerCase()) || '#ef4444';
      const clone = {
        ...src,
        id: generateId(),
        index: shapesRef.current.length + 1,
        x: src.x + 20,
        y: src.y + 20,
        x2: (src.x2 ?? src.x) + 20,
        y2: (src.y2 ?? src.y) + 20,
        stroke: nextStroke,
        isLocked: false
      };
      setShapes((prev) => [...prev, clone]);
      setSelectedId(clone.id);
      setActiveTool(TOOLS.SELECT);
      setShowAddMenu(false);
      setShowSettings(false);
      setImageQuickMenu({
        shapeId: clone.id,
        control: 'opacity',
        isPrecision: true,
        blinkOpacity: null
      });
    }, [setShapes, setSelectedId, setActiveTool, setShowAddMenu, setShowSettings, setImageQuickMenu, shapesRef]);

    const duplicateShape = useCallback((shapeId) => {
      const src = shapesRef.current.find((s) => s.id === shapeId);
      if (!src) return;
      const isLine = src.type === SHAPE_TYPES.LINE;
      const clone = {
        ...src,
        id: generateId(),
        index: shapesRef.current.length + 1,
        x: src.x + 20,
        y: src.y + 20,
        x2: isLine ? (src.x2 ?? src.x) + 20 : src.x2,
        y2: isLine ? (src.y2 ?? src.y) + 20 : src.y2,
        isLocked: false
      };
      setShapes((prev) => [...prev, clone]);
      setSelectedId(clone.id);
      setActiveTool(TOOLS.SELECT);
    }, [setShapes, setSelectedId, setActiveTool, shapesRef]);

    const { handleCanvasTouchStart: handleStageTouchStart, handleCanvasTouchMove, handleCanvasTouchEnd, handleCanvasTouchCancel } = useStageGestures({
      activeToolRef,
      touchState,
      stageRef,
      setStage,
      containerRef
    });

    const { handleShapeInteraction } = useShapeTransform({
      activeToolRef,
      shapesRef,
      stageRef,
      containerRef,
      keepAspectRatioRef,
      setShapes,
      setSelectedId,
      setIsInteracting,
      setActiveHandle
    });

    const handleCanvasTouchStart = useCallback((e) => {
      if (e.target.closest('button') || e.target.closest('input')) return;
      setShowAddMenu(false);
      setImageQuickMenu(null);
      if (activeToolRef.current === TOOLS.POLY_DRAW || activeToolRef.current === TOOLS.CURVE_DRAW) {
        handleCanvasMouseDown(e);
        return;
      }
      if (activeToolRef.current !== TOOLS.PAN) {
        setSelectedId(null);
        return;
      }
      handleStageTouchStart(e);
    }, [activeToolRef, handleCanvasMouseDown, handleStageTouchStart, setSelectedId, setShowAddMenu, setImageQuickMenu]);

    const toggleLock = useCallback((id) => {
      updateShapeById(id, (s) => ({ ...s, isLocked: !s.isLocked }));
    }, [updateShapeById]);

    const toggleVisibility = useCallback((id) => {
      updateShapeById(id, (s) => ({ ...s, isVisible: !s.isVisible }));
      if (selectedId === id) setSelectedId(null);
    }, [updateShapeById, selectedId, setSelectedId]);

    const toggleAllVisibility = useCallback(() => {
      const anyVisible = shapes.some(s => s.type !== 'image' && s.isVisible);
      setShapes(prev => prev.map(s => s.type === 'image' ? s : { ...s, isVisible: !anyVisible }));
      if (anyVisible) {
        const selected = shapes.find(sh => sh.id === selectedId);
        if (selected && selected.type !== 'image') setSelectedId(null);
      }
    }, [shapes, setShapes, selectedId, setSelectedId]);

    const moveLayer = useCallback((dragId: string, overId: string) => {
      if (!dragId || !overId || dragId === overId) return;
      setShapes((prev) => {
        const from = prev.findIndex((s) => s.id === dragId);
        const to = prev.findIndex((s) => s.id === overId);
        if (from === -1 || to === -1) return prev;
        const next = prev.slice();
        const [item] = next.splice(from, 1);
        next.splice(to, 0, item);
        return next.map((s, idx) => ({ ...s, index: idx + 1 }));
      });
    }, [setShapes]);

    const moveLayerByOffset = useCallback((srcId: string, offset: number) => {
      setShapes((prev) => {
        const idx = prev.findIndex((s) => s.id === srcId);
        if (idx === -1) return prev;
        const to = Math.max(0, Math.min(prev.length - 1, idx + offset));
        if (to === idx) return prev;
        const next = prev.slice();
        const [item] = next.splice(idx, 1);
        next.splice(to, 0, item);
        return next.map((s, i) => ({ ...s, index: i + 1 }));
      });
    }, [setShapes]);

    const selectedShape = shapes.find(s => s.id === selectedId);
    // РСЃРїРѕР»СЊР·СѓРµРј useMemo РґР»СЏ СЃС‚Р°Р±РёР»СЊРЅРѕСЃС‚Рё СЃСЃС‹Р»РєРё РЅР° quickImageTarget
    const quickImageTarget = useMemo(() => {
      return imageQuickMenu ? shapes.find(s => s.id === imageQuickMenu.shapeId) : null;
    }, [imageQuickMenu, shapes]);
    const supportsFill = !!selectedShape && selectedShape.type !== 'line' && !(selectedShape.type === 'poly' && !selectedShape.isClosed) && selectedShape.type !== 'curve';

    useEffect(() => {
      if (!imageQuickMenu) return;
      const exists = shapes.some(s => s.id === imageQuickMenu.shapeId);
      if (!exists) setImageQuickMenu(null);
    }, [imageQuickMenu, shapes]);

    useEffect(() => {
      if (!imageQuickMenu?.isPrecision) return;
      if (!selectedId) return;
      const target = shapes.find((s) => s.id === selectedId);
      if (!target) return;
      if (target.id === imageQuickMenu.shapeId) return;
      setImageQuickMenu((prev) => prev ? {
        ...prev,
        shapeId: target.id,
        control: target.type === SHAPE_TYPES.IMAGE ? 'hue' : 'opacity',
        blinkOpacity: null
      } : prev);
    }, [selectedId, shapes, imageQuickMenu]);

    const openPrecisionMode = useCallback((shapeId: string) => {
      const shape = shapesRef.current.find((s) => s.id === shapeId);
      if (!shape) return;
      setShowAddMenu(false);
      setShowSettings(false);
      setSelectedId(shapeId);
      setActiveTool(TOOLS.SELECT);
      setImageQuickMenu({
        shapeId,
        control: shape.type === SHAPE_TYPES.IMAGE ? 'hue' : 'opacity',
        isPrecision: true,
        blinkOpacity: null
      });
    }, [setSelectedId, setActiveTool, shapesRef]);

    const handleShapeDoubleTap = useCallback((shapeId: string) => {
      openPrecisionMode(shapeId);
    }, [openPrecisionMode]);

    const handleCanvasDoubleClick = useCallback((e) => {
      if (e.target.closest('button') || e.target.closest('input')) return;
      const containerEl = containerRef.current;
      if (!containerEl) return;
      const rect = containerEl.getBoundingClientRect();
      const wx = (e.clientX - rect.left - stage.x) / stage.scale;
      const wy = (e.clientY - rect.top - stage.y) / stage.scale;
      const lockedTop = [...shapesRef.current].reverse().find((s) => s.isLocked && pointHitsShape(s, wx, wy));
      if (!lockedTop) return;
      e.preventDefault();
      openPrecisionMode(lockedTop.id);
    }, [containerRef, stage.x, stage.y, stage.scale, shapesRef, pointHitsShape, openPrecisionMode]);

    const updateImagePivot = useCallback((shapeId: string, payload: { x: number; y: number; w: number; h: number }) => {
      updateShapeById(shapeId, (s) => {
        if (s.type !== SHAPE_TYPES.IMAGE) return s;
        const u = Math.min(1, Math.max(0, payload.w ? payload.x / payload.w : 0.5));
        const v = Math.min(1, Math.max(0, payload.h ? payload.y / payload.h : 0.5));
        return { ...s, pivotU: u, pivotV: v };
      });
    }, [updateShapeById]);

    const applyQuickImageValue = useCallback((control, value) => {
      if (!imageQuickMenu) return;
      const roundedValue = Math.round(Number(value) * 10) / 10;
      updateShapeById(imageQuickMenu.shapeId, (s) => {
        if (s.type !== SHAPE_TYPES.IMAGE) return s;
        if (control === 'hue') return { ...s, hue: Math.round(roundedValue) };
        if (control === 'saturation') return { ...s, saturation: Math.round(roundedValue) };
        if (control === 'lightness') return { ...s, brightness: Math.round(roundedValue) };
        if (control === 'contrast') return { ...s, contrast: Math.round(roundedValue) };
        if (control === 'transparency') return { ...s, opacity: Math.max(0, 100 - Math.round(roundedValue)) };
        return s;
      });
    }, [imageQuickMenu, updateShapeById]);

    const getQuickControlConfig = useCallback((control, shape) => {
      if (!shape) return null;
      if (control === 'hue') return { label: 'Hue', min: 0, max: 360, value: shape.hue ?? 0, suffix: 'deg' };
      if (control === 'saturation') return { label: 'Saturation', min: 0, max: 200, value: shape.saturation ?? 100, suffix: '%' };
      if (control === 'lightness') return { label: 'Lightness', min: 0, max: 200, value: shape.brightness ?? 100, suffix: '%' };
      if (control === 'contrast') return { label: 'Contrast', min: 0, max: 200, value: shape.contrast ?? 100, suffix: '%' };
      if (control === 'transparency') return { label: 'Transparency', min: 0, max: 100, value: 100 - (shape.opacity ?? 100), suffix: '%' };
      return null;
    }, []);

    const isPrecisionOpen = !!imageQuickMenu?.isPrecision && !!quickImageTarget;
    const isPrecisionImage = !!quickImageTarget && quickImageTarget.type === SHAPE_TYPES.IMAGE;
    const isPrecisionShape = !!quickImageTarget && quickImageTarget.type !== SHAPE_TYPES.IMAGE;

    const toggleImageBlink = useCallback(() => {
      if (!quickImageTarget || quickImageTarget.type !== SHAPE_TYPES.IMAGE) return;
      const currentOpacity = quickImageTarget.opacity ?? 100;
      const savedOpacity = imageQuickMenu?.blinkOpacity ?? null;
      if (savedOpacity === null) {
        setImageQuickMenu(prev => prev ? { ...prev, blinkOpacity: currentOpacity } : prev);
        updateShapeById(quickImageTarget.id, (s) => ({ ...s, opacity: 0 }));
      } else {
        updateShapeById(quickImageTarget.id, (s) => ({ ...s, opacity: savedOpacity }));
        setImageQuickMenu(prev => prev ? { ...prev, blinkOpacity: null } : prev);
      }
    }, [quickImageTarget, imageQuickMenu, updateShapeById]);

    const getShapeIcon = (shape) => {
      if (!shape) return null;
      const strokeColor = shape.stroke && shape.stroke !== 'transparent' ? shape.stroke : '#9ca3af';
      const fillColor = shape.fill && shape.fill !== 'transparent' ? shape.fill : null;
      const props = { size: 18, style: { color: strokeColor } };
      const bgStyle = fillColor
        ? { background: `repeating-conic-gradient(rgba(255,255,255,0.05) 0% 25%, transparent 0% 50%) 0 0 / 6px 6px, ${fillColor}`, borderRadius: 'inherit' }
        : {};

      let icon;
      switch (shape.type) {
        case 'rect': icon = <Square {...props} />; break;
        case 'circle': icon = <Circle {...props} />; break;
        case 'triangle': icon = <Triangle {...props} />; break;
        case 'line': icon = <Minus {...props} className="rotate-45" />; break;
        case 'poly': icon = <Pentagon {...props} />; break;
        case 'curve': icon = <PenTool {...props} />; break;
        case 'image': icon = (
          <img
            src={shape.src}
            loading="lazy"
            className="w-full h-full object-cover rounded-[inherit]"
            style={{
              filter: `hue-rotate(${shape.hue || 0}deg) saturate(${shape.saturation ?? 100}%) brightness(${shape.brightness ?? 100}%) contrast(${shape.contrast ?? 100}%) invert(${shape.invert ? 100 : 0}%)`
            }}
            alt=""
          />
        ); break;
        default: return null;
      }
      return <div className="w-full h-full flex items-center justify-center rounded-[inherit]" style={bgStyle}>{icon}</div>;
    };

    const getShapeTitle = (shape) => {
      if (!shape) return 'Object';
      if (shape.type === SHAPE_TYPES.IMAGE) return 'Image';
      if (shape.type === SHAPE_TYPES.RECT) return 'Rectangle';
      if (shape.type === SHAPE_TYPES.CIRCLE) return 'Circle';
      if (shape.type === SHAPE_TYPES.TRIANGLE) return 'Triangle';
      if (shape.type === SHAPE_TYPES.LINE) return 'Line';
      if (shape.type === SHAPE_TYPES.POLY) return 'Polygon';
      if (shape.type === SHAPE_TYPES.CURVE) return 'Curve';
      return 'Shape';
    };

    const anyVisible = shapes.some(s => s.isVisible);
    const visibleShapes = useMemo(
      () => shapes.filter(s => s.isVisible),
      [shapes]
    );
    const reversedShapes = useMemo(() => [...shapes].reverse(), [shapes]);

    const openLayersPanel = useCallback(() => {
      setShowLayers(prev => !prev);
      setShowAddMenu(false);
      setShowSettings(false);
      setImageQuickMenu(null);
    }, [setShowLayers, setShowAddMenu, setShowSettings, setImageQuickMenu]);

    return (
      <div className="w-full h-screen bg-[#0a0a0a] flex flex-col overflow-hidden text-white touch-none font-sans select-none">

        {/* TOP BAR */}
        <div className="h-14 border-b border-white/5 flex items-center justify-between px-3 shrink-0 bg-[#111] z-50 relative">
          <input ref={fileInputRef} type="file" className="hidden" onChange={handleImageUpload} accept="image/*" />
          <div className="flex items-center gap-2">
            <div className="relative">
              <button
                aria-label="Add image or shape"
                onClick={() => { setShowAddMenu(p => !p); setShowSettings(false); setImageQuickMenu(null); }}
                className="p-2 bg-blue-600 rounded-lg active:scale-90 transition border border-blue-400/50 flex items-center gap-1.5"
                title="Add image or shape"
              >
                <Icon name="add" size={18} />
                <Icon name="expand_more" size={16} />
              </button>
              {showAddMenu && (
                <div className="absolute top-[calc(100%+8px)] left-0 w-44 bg-[#1a1a1a] border border-white/10 rounded-xl p-1.5 z-[90] shadow-2xl">
                  <button onClick={() => { setShowAddMenu(false); fileInputRef.current?.click(); }} className="w-full text-left px-3 py-2 rounded-lg text-sm hover:bg-white/10 flex items-center gap-2"><FileImage size={16} /><span>Image</span></button>
                  <div className="h-px bg-white/5 mx-2 my-1" role="separator" />
                  <button onClick={() => { addShape(SHAPE_TYPES.RECT); setShowAddMenu(false); }} className="w-full text-left px-3 py-2 rounded-lg text-sm hover:bg-white/10 flex items-center gap-2"><Square size={16} /><span>Rectangle</span></button>
                  <button onClick={() => { addShape(SHAPE_TYPES.CIRCLE); setShowAddMenu(false); }} className="w-full text-left px-3 py-2 rounded-lg text-sm hover:bg-white/10 flex items-center gap-2"><Circle size={16} /><span>Circle</span></button>
                  <button onClick={() => { addShape(SHAPE_TYPES.TRIANGLE); setShowAddMenu(false); }} className="w-full text-left px-3 py-2 rounded-lg text-sm hover:bg-white/10 flex items-center gap-2"><Triangle size={16} /><span>Triangle</span></button>
                  <button onClick={() => { addShape(SHAPE_TYPES.LINE); setShowAddMenu(false); }} className="w-full text-left px-3 py-2 rounded-lg text-sm hover:bg-white/10 flex items-center gap-2"><Minus className="rotate-45" size={18} /><span>Line</span></button>
                  <button onClick={() => { addShape(SHAPE_TYPES.POLY); setShowAddMenu(false); }} className="w-full text-left px-3 py-2 rounded-lg text-sm hover:bg-white/10 flex items-center gap-2"><Pentagon size={16} /><span>Polygon</span></button>
                  <button onClick={() => { setActiveTool(TOOLS.CURVE_DRAW); setCurvePoints([]); setSelectedId(null); setShowAddMenu(false); }} className="w-full text-left px-3 py-2 rounded-lg text-sm hover:bg-white/10 flex items-center gap-2"><PenTool size={16} /><span>Curve</span></button>
                </div>
              )}
            </div>
            <div className="flex bg-[#222] rounded-lg p-0.5 border border-white/10">
              <button aria-label="Select" onClick={() => { setActiveTool(TOOLS.SELECT); setPolyPoints([]); }} className={`p-2 rounded-md transition active:scale-90 ${activeTool === TOOLS.SELECT ? 'bg-white/15 text-white' : 'text-gray-500 hover:text-white'}`}><MousePointer2 size={18} /></button>
              <button aria-label="Pan" onClick={() => { setActiveTool(TOOLS.PAN); setPolyPoints([]); }} className={`p-2 rounded-md transition active:scale-90 ${activeTool === TOOLS.PAN ? 'bg-white/15 text-white' : 'text-gray-500 hover:text-white'}`}><Hand size={18} /></button>
            </div>
            <button
              aria-label="Layers"
              onClick={openLayersPanel}
              className={`p-2 rounded-lg transition active:scale-95 border ${showLayers ? 'bg-blue-500 border-blue-500 text-white' : 'bg-[#222] border-white/10 text-gray-500 hover:text-white'}`}
              title="Layers"
            >
              <Layers size={18} />
            </button>
          </div>

          <div className="flex items-center gap-2">
            {shapes.length > 0 && (
              <button
                onClick={toggleAllVisibility}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border transition active:scale-90 ${anyVisible ? 'bg-[#222] border-white/10 text-gray-400 hover:text-white' : 'bg-blue-500/20 border-blue-500/30 text-blue-400'}`}
                title={anyVisible ? "Hide all shapes" : "Show all shapes"}
              >
                {anyVisible ? <Eye size={18} /> : <EyeOff size={18} />}
                <span className="text-[10px] font-bold uppercase hidden sm:block">
                  {anyVisible ? 'Hide All' : 'Show All'}
                </span>
              </button>
            )}
            <button aria-label="Toggle Fullscreen" onClick={toggleFullscreen} className="p-2 rounded-lg border bg-[#222] border-white/10 text-gray-500 hover:text-white active:scale-95 transition" title="Toggle Fullscreen">
              {isFullscreen ? <Minimize size={20} /> : <Maximize size={20} />}
            </button>
            {shapes.length > 0 && (
              <button aria-label="Clear canvas" onClick={clearCanvas} className="p-2 rounded-lg border bg-[#222] border-white/10 text-red-500 hover:text-red-400 hover:bg-red-500/15 active:scale-95 transition" title="Clear canvas"><Trash2 size={18} /></button>
            )}
            {selectedShape && (
              <button aria-label="Settings" onClick={() => { setShowSettings(!showSettings); setShowAddMenu(false); setImageQuickMenu(null); setShowLayers(false); }} className={`p-2 rounded-lg border transition active:scale-95 ${showSettings ? 'bg-blue-500 border-blue-500 text-white' : 'bg-[#222] border-white/10 text-gray-500 hover:text-white'}`}><Settings2 size={20} /></button>
            )}
          </div>
        </div>

        {/* CANVAS AREA */}
        <div
          ref={containerRef}
          className="flex-1 relative overflow-hidden bg-[#0a0a0a]"
          onContextMenu={(e) => e.preventDefault()}
          onMouseDown={handleCanvasMouseDown}
          onDoubleClick={handleCanvasDoubleClick}
          onTouchStart={handleCanvasTouchStart}
          onTouchMove={handleCanvasTouchMove}
          onTouchEnd={handleCanvasTouchEnd}
          onTouchCancel={handleCanvasTouchCancel}
        >
          <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)', backgroundSize: '30px 30px' }} />

          <div
            className="absolute origin-top-left will-change-transform"
            style={{ transform: `translate3d(${stage.x}px, ${stage.y}px, 0) scale(${stage.scale})` }}
          >
            {visibleShapes.map(shape => (
              <ShapeItem
                key={shape.id}
                shape={shape}
                isSelected={selectedId === shape.id}
                onShapeInteraction={handleShapeInteraction}
                onToggleLock={toggleLock}
                stageScale={stage.scale}
                activeHandle={activeHandle}
                onShapeDoubleTap={handleShapeDoubleTap}
                isPrecisionMode={isPrecisionOpen && quickImageTarget?.id === shape.id}
                onImagePrecisionTap={updateImagePivot}
              />
            ))}

            {isPrecisionOpen && isPrecisionImage && quickImageTarget && (() => {
              const pivotU = quickImageTarget.pivotU ?? 0.5;
              const pivotV = quickImageTarget.pivotV ?? 0.5;
              const pivotX = quickImageTarget.x + quickImageTarget.w * pivotU;
              const pivotY = quickImageTarget.y + quickImageTarget.h * pivotV;
              const angle = ((quickImageTarget.rotation ?? 0) - 90) * Math.PI / 180;
              const isRotateActive = activeHandle?.id === quickImageTarget.id && activeHandle?.mode === 'precise-rotate';
              const isScaleActive = activeHandle?.id === quickImageTarget.id && activeHandle?.mode === 'precise-scale';
              const inv = 1 / Math.max(stage.scale, 0.01);
              // Keep handles at the same default screen distance as the yellow pivot-move handle.
              const baseRadius = DEFAULT_PRECISE_MOVE_LEVER * inv;
              const rotateRadius = isRotateActive ? (quickImageTarget.rotateLever ?? DEFAULT_PRECISE_ROTATE_LEVER) * inv : baseRadius;
              const scaleRadius = isScaleActive ? (quickImageTarget.scaleLever ?? DEFAULT_PRECISE_SCALE_LEVER) * inv : baseRadius;
              const moveRadius = baseRadius;
              const rotateHandleAngle = isRotateActive
                ? (quickImageTarget.rotateHandleAngle ?? (angle - PRECISE_HANDLE_SPREAD))
                : (angle - PRECISE_HANDLE_SPREAD);
              const scaleHandleAngle = isScaleActive
                ? (quickImageTarget.scaleAngle ?? (angle + PRECISE_HANDLE_SPREAD))
                : (angle + PRECISE_HANDLE_SPREAD);
              const rotateHandle = { x: pivotX + Math.cos(rotateHandleAngle) * rotateRadius, y: pivotY + Math.sin(rotateHandleAngle) * rotateRadius };
              const scaleHandle = { x: pivotX + Math.cos(scaleHandleAngle) * scaleRadius, y: pivotY + Math.sin(scaleHandleAngle) * scaleRadius };
              const moveHandle = { x: pivotX - Math.cos(angle) * moveRadius, y: pivotY - Math.sin(angle) * moveRadius };
              return (
                <div className="absolute z-50 pointer-events-none">
                  <svg className="overflow-visible" style={{ width: 1, height: 1 }}>
                    <line x1={pivotX} y1={pivotY} x2={rotateHandle.x} y2={rotateHandle.y} stroke="#60a5fa" strokeDasharray="4 4" strokeWidth={2 * inv} />
                    <line x1={pivotX} y1={pivotY} x2={scaleHandle.x} y2={scaleHandle.y} stroke="#34d399" strokeDasharray="4 4" strokeWidth={2 * inv} />
                    <line x1={pivotX} y1={pivotY} x2={moveHandle.x} y2={moveHandle.y} stroke="#facc15" strokeDasharray="4 4" strokeWidth={2 * inv} />
                    <circle cx={pivotX} cy={pivotY} r={3.5 * inv} fill="#facc15" stroke="#111827" strokeWidth={1.5 * inv} />
                  </svg>
                  <button
                    className="absolute pointer-events-auto bg-[#1f2937] border border-yellow-400 text-yellow-300 rounded-full p-2"
                    style={{ left: moveHandle.x, top: moveHandle.y, transform: `translate(-50%, -50%) scale(${inv})` }}
                    onMouseDown={(e) => handleShapeInteraction(e, quickImageTarget.id, 'precise-pivot')}
                    onTouchStart={(e) => handleShapeInteraction(e, quickImageTarget.id, 'precise-pivot')}
                  >
                    <Icon name="open_with" size={15} />
                  </button>
                  <button
                    className="absolute pointer-events-auto bg-[#1f2937] border border-blue-400 text-blue-300 rounded-full p-2"
                    style={{ left: rotateHandle.x, top: rotateHandle.y, transform: `translate(-50%, -50%) scale(${inv})` }}
                    onMouseDown={(e) => handleShapeInteraction(e, quickImageTarget.id, 'precise-rotate')}
                    onTouchStart={(e) => handleShapeInteraction(e, quickImageTarget.id, 'precise-rotate')}
                  >
                    <RotateCw size={16} />
                  </button>
                  <button
                    className="absolute pointer-events-auto bg-[#1f2937] border border-emerald-400 text-emerald-300 rounded-full p-2"
                    style={{ left: scaleHandle.x, top: scaleHandle.y, transform: `translate(-50%, -50%) scale(${inv})` }}
                    onMouseDown={(e) => handleShapeInteraction(e, quickImageTarget.id, 'precise-scale')}
                    onTouchStart={(e) => handleShapeInteraction(e, quickImageTarget.id, 'precise-scale')}
                  >
                    <Icon name="zoom_out_map" size={16} />
                  </button>
                </div>
              );
            })()}

            {polyPoints.length > 0 && (
              <svg className="absolute overflow-visible pointer-events-none z-40" style={{ left: 0, top: 0, width: 1, height: 1 }}>
                <polyline
                  points={polyPoints.map(p => `${p.x},${p.y}`).join(' ')}
                  fill="none"
                  stroke="#3b82f6"
                  strokeWidth={2 / stage.scale}
                  strokeDasharray="5,5"
                />
                {polyPoints.map((p, i) => (
                  <circle
                    key={i}
                    cx={p.x}
                    cy={p.y}
                    r={(i === 0 ? 8 : 4) / stage.scale}
                    fill={i === 0 ? "#10b981" : "#3b82f6"}
                    stroke="white"
                    strokeWidth={1 / stage.scale}
                  >
                    <title>{`Point ${i + 1} (${Math.round(p.x)}, ${Math.round(p.y)})`}</title>
                  </circle>
                ))}
              </svg>
            )}

            {curvePoints.length > 0 && (
              <svg className="absolute overflow-visible pointer-events-none z-40" style={{ left: 0, top: 0, width: 1, height: 1 }}>
                {curvePoints.length >= 2 && (() => {
                  const pts = curvePoints;
                  let d = `M ${pts[0].x},${pts[0].y}`;
                  for (let i = 0; i < pts.length - 1; i++) {
                    const p0 = pts[i === 0 ? 0 : i - 1];
                    const p1 = pts[i];
                    const p2 = pts[i + 1];
                    const p3 = pts[i + 2 >= pts.length ? pts.length - 1 : i + 2];
                    const cp1x = p1.x + (p2.x - p0.x) / 6;
                    const cp1y = p1.y + (p2.y - p0.y) / 6;
                    const cp2x = p2.x - (p3.x - p1.x) / 6;
                    const cp2y = p2.y - (p3.y - p1.y) / 6;
                    d += ` C ${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`;
                  }
                  return <path d={d} fill="none" stroke="#10b981" strokeWidth={2 / stage.scale} strokeLinecap="round" strokeLinejoin="round" />;
                })()}
                {curvePoints.map((p, i) => (
                  <circle
                    key={i}
                    cx={p.x}
                    cy={p.y}
                    r={(i === 0 ? 8 : 4) / stage.scale}
                    fill="#10b981"
                    stroke="white"
                    strokeWidth={1 / stage.scale}
                  >
                    <title>{`Point ${i + 1} (${Math.round(p.x)}, ${Math.round(p.y)})`}</title>
                  </circle>
                ))}
              </svg>
            )}
          </div>
          <div className="absolute bottom-6 right-4 bg-[#222] border border-white/10 px-2.5 py-1 rounded-lg text-[10px] text-gray-400 font-mono select-none z-50">{Math.round(stage.scale * 100)}%</div>
          {shapes.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none">
              <div className="text-center">
                <Icon name="add_photo_alternate" size={48} className="text-gray-700" />
                <p className="text-sm text-gray-600 mt-3">Tap <span className="text-blue-400">+</span> to add an image or shape</p>
              </div>
            </div>
          )}
        </div>

        {activeTool === TOOLS.POLY_DRAW && (
          <div className="absolute left-1/2 -translate-x-1/2 bottom-4 z-[112] flex items-center gap-2 bg-blue-600/20 px-3 py-1.5 rounded-full border border-blue-500/30">
            <span className="text-xs font-bold text-blue-400">Shape creation ({polyPoints.length})</span>
            {polyPoints.length >= 2 && (
              <button aria-label="Finish shape" onClick={() => finalizePoly(false)} className="bg-blue-500 text-white p-1 rounded-full active:scale-90 transition"><Check size={14} /></button>
            )}
            <button aria-label="Cancel" onClick={() => { setActiveTool(TOOLS.SELECT); setPolyPoints([]); }} className="text-gray-400 p-1 hover:text-white"><X size={14} /></button>
          </div>
        )}

        {activeTool === TOOLS.CURVE_DRAW && (
          <div className="absolute left-1/2 -translate-x-1/2 bottom-4 z-[112] flex items-center gap-2 bg-emerald-600/20 px-3 py-1.5 rounded-full border border-emerald-500/30">
            <span className="text-xs font-bold text-emerald-400">Curve ({curvePoints.length})</span>
            {curvePoints.length >= 2 && (
              <button aria-label="Finish curve" onClick={finalizeCurve} className="bg-emerald-500 text-white p-1 rounded-full active:scale-90 transition"><Check size={14} /></button>
            )}
            <button aria-label="Cancel" onClick={() => { setActiveTool(TOOLS.SELECT); setCurvePoints([]); }} className="text-gray-400 p-1 hover:text-white"><X size={14} /></button>
          </div>
        )}

        {showLayers && (
          <div
            ref={layersPanelRef}
            className="absolute inset-x-0 bottom-0 z-[100] flex flex-col"
            onTouchStart={(e) => {
              swipeStartRef.current = e.touches[0].clientY;
              const el = layersPanelRef.current;
              if (!el) { swipeOffsetRef.current = 0; return; }
              const m = el.style.transform.match(/translateY\(([\d.]+)px\)/);
              swipeOffsetRef.current = m ? parseFloat(m[1]) : 0;
            }}
            onTouchMove={(e) => {
              const el = layersPanelRef.current;
              if (!el) return;
              const maxY = window.innerHeight * 0.7;
              const dy = Math.max(0, Math.min(swipeOffsetRef.current + e.touches[0].clientY - swipeStartRef.current, maxY));
              if (dy > 0) e.preventDefault();
              el.style.transform = `translateY(${dy}px)`;
            }}
          >
            <div className="bg-[#1a1a1a] rounded-t-3xl border-t border-white/10 shadow-2xl pt-2 px-4 pb-2 shrink-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Layers size={18} className="text-blue-500" />
                  <span className="text-sm font-bold">Layers</span>
                  <span className="text-[10px] text-gray-500 font-mono">{shapes.length}</span>
                </div>
                <button aria-label="Close layers" onClick={() => setShowLayers(false)} className="text-gray-500 p-2 hover:bg-white/5 rounded-lg active:scale-90 transition"><X size={20} /></button>
              </div>
              <div className="w-12 h-1.5 bg-white/10 rounded-full mx-auto mt-2" />
            </div>

            <div className="bg-[#1a1a1a] border-t border-white/5 flex-1 overflow-y-auto p-2 space-y-1 pb-[env(safe-area-inset-bottom)]" style={{ overscrollBehavior: 'contain' }}>
              {shapes.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-32 opacity-20 text-center px-6">
                  <Layers size={48} className="mb-4" />
                  <p className="text-sm font-medium">No layers</p>
                </div>
              ) : (
                reversedShapes.map(shape => (
                  <div
                    key={shape.id}
                    role="button"
                    tabIndex={0}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (shape.isLocked) return;
                      setSelectedId(shape.id);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        if (shape.isLocked) return;
                        setSelectedId(shape.id);
                      }
                    }}
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      handleShapeDoubleTap(shape.id);
                    }}
                    onDragOver={(e) => { e.preventDefault(); }}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (!dragLayerId) return;
                      moveLayer(dragLayerId, shape.id);
                      setDragLayerId(null);
                    }}
                    className={`flex items-center gap-1.5 p-1.5 rounded-xl transition cursor-pointer border ${selectedId === shape.id ? 'bg-blue-600/15 border-blue-500/40' : 'hover:bg-white/5 border-transparent'}`}
                  >
                    <div className="flex items-center gap-0.5 shrink-0">
                      <div
                        draggable
                        onDragStart={(e) => {
                          e.stopPropagation();
                          setDragLayerId(shape.id);
                        }}
                        onDragEnd={() => setDragLayerId(null)}
                        className="cursor-grab active:cursor-grabbing text-gray-500 hover:text-white p-1 rounded transition"
                      >
                        <Icon name="drag_indicator" size={16} />
                      </div>
                      <button
                        aria-label="Move layer up"
                        onClick={(e) => { e.stopPropagation(); moveLayerByOffset(shape.id, -1); }}
                        className="text-gray-600 hover:text-white p-0.5 rounded transition"
                      ><Icon name="expand_less" size={14} /></button>
                      <button
                        aria-label="Move layer down"
                        onClick={(e) => { e.stopPropagation(); moveLayerByOffset(shape.id, 1); }}
                        className="text-gray-600 hover:text-white p-0.5 rounded transition"
                      ><Icon name="expand_more" size={14} /></button>
                    </div>
                    <span className="text-[10px] font-mono text-gray-600 w-5 text-center shrink-0">{shape.index}</span>
                    <label className={`w-10 h-10 flex items-center justify-center shrink-0 rounded-lg border border-white/5 transition-opacity cursor-pointer relative overflow-hidden ${shape.isVisible ? 'opacity-100' : 'opacity-30'}`}>
                      {getShapeIcon(shape)}
                    </label>
                    <div className="flex gap-1 ml-auto">
                      <button aria-label="Toggle visibility" onClick={(e) => { e.stopPropagation(); toggleVisibility(shape.id); }} className={`w-10 h-10 flex items-center justify-center rounded-lg transition active:scale-90 ${shape.isVisible ? 'text-blue-400 bg-blue-500/10' : 'text-gray-700 bg-white/5'}`}>{shape.isVisible ? <Eye size={18} /> : <EyeOff size={18} />}</button>
                      <button aria-label="Toggle lock" onClick={(e) => { e.stopPropagation(); toggleLock(shape.id); }} className={`w-10 h-10 flex items-center justify-center rounded-lg transition active:scale-90 ${shape.isLocked ? 'text-orange-500 bg-orange-500/15' : 'text-gray-700 bg-white/5'}`}><Lock size={18} /></button>
                      <button aria-label="Delete shape" onClick={(e) => { e.stopPropagation(); deleteShape(shape.id); }} className="w-10 h-10 flex items-center justify-center text-gray-700 hover:text-red-500 hover:bg-red-500/15 rounded-lg transition active:scale-90"><Trash2 size={18} /></button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {selectedShape && showSettings && (
          <div
            ref={settingsPanelRef}
            className="absolute inset-x-0 bottom-0 z-[115]"
            onTouchStart={(e) => {
              swipeStartRef.current = e.touches[0].clientY;
              const el = settingsPanelRef.current;
              if (!el) { swipeOffsetRef.current = 0; return; }
              const m = el.style.transform.match(/translateY\(([\d.]+)px\)/);
              swipeOffsetRef.current = m ? parseFloat(m[1]) : 0;
            }}
            onTouchMove={(e) => {
              const el = settingsPanelRef.current;
              if (!el) return;
              const maxY = window.innerHeight * 0.7;
              const dy = Math.max(0, Math.min(swipeOffsetRef.current + e.touches[0].clientY - swipeStartRef.current, maxY));
              if (dy > 0) e.preventDefault();
              el.style.transform = `translateY(${dy}px)`;
            }}
          >
            <div className="bg-[#1a1a1a] rounded-t-3xl border-t border-white/10 shadow-2xl pt-2 px-4 pb-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-8 h-8 bg-blue-500/20 rounded-lg flex items-center justify-center overflow-hidden shrink-0">
                    {getShapeIcon(selectedShape)}
                  </div>
                  <span className="text-sm font-bold truncate">{getShapeTitle(selectedShape)}</span>
                </div>
                <div className="flex items-center gap-1">
                  {selectedShape.type === 'line' ? (
                    <>
                      <button
                        onClick={(e) => { e.stopPropagation(); updateSelectedShape(s => ({ ...s, keepLength: !s.keepLength })); }}
                        className={`p-2 rounded-lg transition ${selectedShape.keepLength ? 'text-amber-400 bg-amber-500/15' : 'text-gray-600'}`}
                        title="Keep length" aria-label="Toggle keep length"
                      ><Icon name="straighten" size={16} /></button>
                      <button
                        onClick={(e) => { e.stopPropagation(); duplicateShape(selectedId); }}
                        className="p-2 rounded-lg text-blue-400 hover:bg-blue-500/15 transition"
                        title="Duplicate" aria-label="Duplicate"
                      ><Icon name="content_copy" size={16} /></button>
                    </>
                  ) : selectedShape.type !== 'image' ? (
                    <>
                      <button
                        onClick={(e) => { e.stopPropagation(); updateSelectedShape(s => ({ ...s, keepProportions: !(s.keepProportions ?? true) })); }}
                        className={`p-2 rounded-lg transition ${(selectedShape.keepProportions ?? true) ? 'text-emerald-400 bg-emerald-500/15' : 'text-gray-600'}`}
                        title="Keep proportions" aria-label="Toggle keep proportions"
                      ><Icon name="link" size={16} /></button>
                      <button
                        onClick={(e) => { e.stopPropagation(); duplicateShape(selectedId); }}
                        className="p-2 rounded-lg text-blue-400 hover:bg-blue-500/15 transition"
                        title="Duplicate" aria-label="Duplicate"
                      ><Icon name="content_copy" size={16} /></button>
                    </>
                  ) : (
                    <button
                      onClick={(e) => { e.stopPropagation(); duplicateShape(selectedId); }}
                      className="p-2 rounded-lg text-blue-400 hover:bg-blue-500/15 transition"
                      title="Duplicate" aria-label="Duplicate"
                    ><Icon name="content_copy" size={16} /></button>
                  )}
                  <button
                    aria-label={selectedShape.isLocked ? "Unlock" : "Lock"}
                    onClick={(e) => { e.stopPropagation(); toggleLock(selectedId); }}
                    className={`p-2 rounded-lg transition ${selectedShape.isLocked ? 'text-orange-500 bg-orange-500/15' : 'text-gray-400 hover:text-white'}`}
                  >{selectedShape.isLocked ? <Lock size={18} /> : <Unlock size={18} />}</button>
                  <button aria-label="Close settings" onClick={() => { setShowSettings(false); setShowAddMenu(false); }} className="text-gray-500 p-2 hover:bg-white/5 rounded-lg active:scale-90 transition"><X size={20} /></button>
                </div>
              </div>
              <div className="w-12 h-1.5 bg-white/10 rounded-full mx-auto mt-2" />
            </div>

            <div className="bg-[#1a1a1a] border-t border-white/5 px-4 pt-3 pb-4 overflow-y-auto" style={{ maxHeight: 'calc(85vh - 64px)', overscrollBehavior: 'contain' }}>
              <div className="flex flex-col gap-4 pb-[env(safe-area-inset-bottom)]">

                {selectedShape.type === 'line' && (
                  <div className="bg-white/5 p-3 rounded-xl space-y-3">
                    <div className="flex items-center gap-2">
                      <Hash size={16} className="text-blue-500" />
                      <span className="text-xs font-medium">Divisions ({selectedShape.divisions + 1})</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] text-gray-500 font-mono">1</span>
                      <input type="range" min="1" max="6" step="1" className="flex-1 h-1.5 bg-white/10 rounded-lg appearance-none accent-blue-500" value={selectedShape.divisions || 1} onChange={e => updateSelectedShape(s => ({ ...s, divisions: Number(e.target.value) }))} onClick={e => e.stopPropagation()} />
                      <span className="text-[10px] text-gray-500 font-mono">6</span>
                    </div>
                  </div>
                )}

                {selectedShape.type === 'image' && (
                  <div className="bg-white/5 p-3 rounded-xl space-y-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">Color correction</span>
                      <button
                        onClick={(e) => { e.stopPropagation(); updateSelectedShape(s => ({ ...s, invert: !s.invert })); }}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${selectedShape.invert ? 'bg-white text-black' : 'bg-[#222] text-gray-300 hover:bg-[#333]'}`}
                      >Invert</button>
                    </div>
                    <div className="flex items-center gap-3">
                      <Palette size={16} className="text-gray-500" />
                      <div className="flex-1">
                        <div className="flex justify-between text-[10px] text-gray-500 mb-1"><span>Hue</span><span>{selectedShape.hue || 0}&deg;</span></div>
                        <input type="range" min="0" max="360" value={selectedShape.hue || 0} onChange={e => updateSelectedShape(s => ({ ...s, hue: Number(e.target.value) }))} className="w-full h-1.5 rounded-lg appearance-none" style={{ background: 'linear-gradient(to right, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)' }} />
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Droplets size={16} className="text-gray-500" />
                      <div className="flex-1">
                        <div className="flex justify-between text-[10px] text-gray-500 mb-1"><span>Saturation</span><span>{selectedShape.saturation ?? 100}%</span></div>
                        <input type="range" min="0" max="200" value={selectedShape.saturation ?? 100} onChange={e => updateSelectedShape(s => ({ ...s, saturation: Number(e.target.value) }))} className="w-full h-1.5 bg-white/10 rounded-lg appearance-none accent-blue-500" />
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Sun size={16} className="text-gray-500" />
                      <div className="flex-1">
                        <div className="flex justify-between text-[10px] text-gray-500 mb-1"><span>Brightness</span><span>{selectedShape.brightness ?? 100}%</span></div>
                        <input type="range" min="0" max="200" value={selectedShape.brightness ?? 100} onChange={e => updateSelectedShape(s => ({ ...s, brightness: Number(e.target.value) }))} className="w-full h-1.5 bg-white/10 rounded-lg appearance-none accent-blue-500" />
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Contrast size={16} className="text-gray-500" />
                      <div className="flex-1">
                        <div className="flex justify-between text-[10px] text-gray-500 mb-1"><span>Contrast</span><span>{selectedShape.contrast ?? 100}%</span></div>
                        <input type="range" min="0" max="200" value={selectedShape.contrast ?? 100} onChange={e => updateSelectedShape(s => ({ ...s, contrast: Number(e.target.value) }))} className="w-full h-1.5 bg-white/10 rounded-lg appearance-none accent-blue-500" />
                      </div>
                    </div>
                  </div>
                )}

                {selectedShape.type !== 'image' && (
                  <div className="bg-white/5 p-3 rounded-xl space-y-4">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={(e) => { e.stopPropagation(); updateSelectedStroke(selectedShape.stroke === 'transparent' ? '#3b82f6' : 'transparent'); }}
                            className={`p-1.5 rounded-lg transition ${selectedShape.stroke === 'transparent' ? 'text-gray-600 bg-white/5' : 'text-blue-400 bg-blue-500/15'}`}
                            aria-label="Toggle stroke"
                          ><PenTool size={16} /></button>
                          <span className="text-[10px] text-gray-500 font-medium">Stroke</span>
                        </div>
                        <input type="color" className="w-7 h-7 bg-transparent border-0 cursor-pointer" value={selectedShape.stroke === 'transparent' ? '#ffffff' : selectedShape.stroke} onChange={e => updateSelectedStroke(e.target.value)} onClick={e => e.stopPropagation()} title="Custom stroke color" />
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {COLOR_PRESETS.map((color) => (
                          <button key={`s-${color}`} onClick={(e) => { e.stopPropagation(); updateSelectedStroke(color); }} className={`w-6 h-6 rounded-full border-2 transition-transform active:scale-90 ${selectedShape.stroke === color ? 'border-white scale-110' : 'border-white/20'}`} style={{ backgroundColor: color }} title={color} />
                        ))}
                      </div>
                    </div>

                    {supportsFill && (
                      <div className="border-t border-white/5 pt-3">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={(e) => { e.stopPropagation(); updateSelectedFill(selectedShape.fill === 'transparent' ? '#3b82f6' : 'transparent'); }}
                              className={`p-1.5 rounded-lg transition ${selectedShape.fill === 'transparent' ? 'text-gray-600 bg-white/5' : 'text-sky-400 bg-sky-500/15'}`}
                              aria-label="Toggle fill"
                            ><Droplets size={16} /></button>
                            <span className="text-[10px] text-gray-500 font-medium">Fill</span>
                          </div>
                          <input type="color" className="w-7 h-7 bg-transparent border-0 cursor-pointer" value={selectedShape.fill === 'transparent' ? '#ffffff' : selectedShape.fill} onChange={e => updateSelectedFill(e.target.value)} onClick={e => e.stopPropagation()} title="Custom fill color" />
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {COLOR_PRESETS.map((color) => (
                            <button key={`f-${color}`} onClick={(e) => { e.stopPropagation(); updateSelectedFill(color); }} className={`w-6 h-6 rounded-full border-2 transition-transform active:scale-90 ${selectedShape.fill === color ? 'border-white scale-110' : 'border-white/20'}`} style={{ backgroundColor: color }} title={color} />
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="border-t border-white/5 pt-3">
                      <div className="flex items-center gap-3">
                        <Type size={16} className="text-gray-500" />
                        <input type="range" className="flex-1 h-1.5 bg-white/10 rounded-lg appearance-none accent-blue-500" min="0" max="100" value={selectedShape.opacity} onChange={e => updateSelectedShape(s => ({ ...s, opacity: Number(e.target.value) }))} onClick={e => e.stopPropagation()} />
                        <span className="text-[10px] font-mono text-gray-400 w-8 text-right">{selectedShape.opacity}%</span>
                      </div>
                    </div>
                  </div>
                )}

                {selectedShape.type === 'image' && (
                  <div className="flex items-center gap-3 bg-white/5 p-3 rounded-xl">
                    <Type size={16} className="text-gray-500" />
                    <input type="range" className="flex-1 h-1.5 bg-white/10 rounded-lg appearance-none accent-blue-500" min="0" max="100" value={selectedShape.opacity} onChange={e => updateSelectedShape(s => ({ ...s, opacity: Number(e.target.value) }))} onClick={e => e.stopPropagation()} />
                    <span className="text-[10px] font-mono text-gray-400 w-8 text-right">{selectedShape.opacity}%</span>
                  </div>
                )}

                {selectedShape.type !== 'image' && (
                  <div className="flex items-center gap-3 bg-white/5 p-3 rounded-xl">
                    <PenTool size={16} className="text-gray-500 shrink-0" />
                    <input type="range" min="1" max="20" step="1" className="flex-1 h-1.5 bg-white/10 rounded-lg appearance-none accent-blue-500" value={selectedShape.strokeWidth} onChange={e => updateSelectedShape(s => ({ ...s, strokeWidth: Number(e.target.value) }))} onClick={e => e.stopPropagation()} />
                    <span className="text-[10px] font-mono text-gray-400 w-6 text-right">{selectedShape.strokeWidth}</span>
                  </div>
                )}

                <div className="flex gap-3 pt-2 pb-[env(safe-area-inset-bottom)]">
                  <button onClick={() => setShowSettings(false)} className="flex-1 py-3 rounded-xl bg-white/5 text-gray-400 font-bold text-sm transition active:scale-95 hover:bg-white/10">Close</button>
                  <button aria-label="Delete shape" onClick={(e) => { e.stopPropagation(); deleteShape(selectedId); }} className="p-3 bg-red-500/10 text-red-500 rounded-xl active:bg-red-500/20 transition border border-red-500/10"><Trash2 size={22} /></button>
                </div>
              </div>
            </div>
          </div>
        )}

                {isPrecisionOpen && quickImageTarget && (
          <div
            ref={precisionPanelRef}
            className="absolute inset-x-0 bottom-0 z-[100]"
            onTouchStart={(e) => {
              swipeStartRef.current = e.touches[0].clientY;
              const el = precisionPanelRef.current;
              if (!el) { swipeOffsetRef.current = 0; return; }
              const m = el.style.transform.match(/translateY\(([\d.]+)px\)/);
              swipeOffsetRef.current = m ? parseFloat(m[1]) : 0;
            }}
            onTouchMove={(e) => {
              const el = precisionPanelRef.current;
              if (!el) return;
              const maxY = window.innerHeight * 0.7;
              const dy = Math.max(0, Math.min(swipeOffsetRef.current + e.touches[0].clientY - swipeStartRef.current, maxY));
              if (dy > 0) e.preventDefault();
              el.style.transform = `translateY(${dy}px)`;
            }}
          >
            <div className="bg-[#1a1a1a] rounded-t-3xl border-t border-white/10 shadow-2xl pt-2 px-4 pb-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-8 h-8 bg-blue-500/20 rounded-lg flex items-center justify-center overflow-hidden shrink-0">{getShapeIcon(quickImageTarget)}</div>
                  <div className="leading-tight min-w-0">
                    <div className="text-sm font-bold truncate">{getShapeTitle(quickImageTarget)}</div>
                    <div className="text-[10px] text-gray-500 truncate">{quickImageTarget.stroke || quickImageTarget.fill || 'No color'}</div>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {isPrecisionShape && quickImageTarget.type === 'line' ? (
                    <>
                      <button onClick={() => updateShapeById(quickImageTarget.id, (s) => ({ ...s, keepLength: !s.keepLength }))} className={`p-2 rounded-lg transition ${quickImageTarget.keepLength ? 'text-amber-400 bg-amber-500/15' : 'text-gray-600'}`} title="Keep length" aria-label="Toggle keep length"><Icon name="straighten" size={16} /></button>
                      <button onClick={() => duplicateShape(quickImageTarget.id)} className="p-2 rounded-lg text-blue-400 hover:bg-blue-500/15 transition" title="Duplicate" aria-label="Duplicate"><Icon name="content_copy" size={16} /></button>
                    </>
                  ) : isPrecisionShape ? (
                    <>
                      <button onClick={() => updateShapeById(quickImageTarget.id, (s) => ({ ...s, keepProportions: !(s.keepProportions ?? true) }))} className={`p-2 rounded-lg transition ${(quickImageTarget.keepProportions ?? true) ? 'text-emerald-400 bg-emerald-500/15' : 'text-gray-600'}`} title="Keep proportions" aria-label="Toggle keep proportions"><Icon name="link" size={16} /></button>
                      <button onClick={() => duplicateShape(quickImageTarget.id)} className="p-2 rounded-lg text-blue-400 hover:bg-blue-500/15 transition" title="Duplicate" aria-label="Duplicate"><Icon name="content_copy" size={16} /></button>
                    </>
                  ) : null}
                  <button
                    aria-label={quickImageTarget.isLocked ? "Unlock" : "Lock"}
                    onClick={() => toggleLock(quickImageTarget.id)}
                    className={`p-2 rounded-lg transition ${quickImageTarget.isLocked ? 'text-orange-500 bg-orange-500/15' : 'text-gray-400 hover:text-white'}`}
                  >{quickImageTarget.isLocked ? <Lock size={18} /> : <Unlock size={18} />}</button>
                  <button aria-label="Close precision" onClick={() => setImageQuickMenu(null)} className="text-gray-500 p-2 hover:bg-white/5 rounded-lg active:scale-90 transition"><X size={20} /></button>
                </div>
              </div>
              <div className="w-12 h-1.5 bg-white/10 rounded-full mx-auto mt-2" />
            </div>

            <div className="bg-[#1a1a1a] border-t border-white/5 px-4 pt-3 pb-4 overflow-y-auto" style={{ maxHeight: 'calc(85vh - 64px)', overscrollBehavior: 'contain' }}>
              <div className="flex flex-col gap-4 pb-[env(safe-area-inset-bottom)]">

                {isPrecisionImage && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 overflow-x-auto">
                      {['hue', 'saturation', 'lightness', 'contrast', 'transparency'].map((key) => (
                        <button
                          key={key}
                          onClick={() => setImageQuickMenu(prev => prev ? { ...prev, control: key } : prev)}
                          className={`px-3 py-1.5 rounded-lg text-xs border whitespace-nowrap ${imageQuickMenu?.control === key ? 'bg-blue-500/20 border-blue-400/60 text-blue-300' : 'bg-white/5 border-white/10 text-gray-400'}`}
                        >
                          {{ hue: 'H', saturation: 'S', lightness: 'L', contrast: 'C', transparency: 'Tr' }[key]}
                        </button>
                      ))}
                      <button aria-label="Toggle blink" onClick={toggleImageBlink} className={`px-3 py-1.5 rounded-lg text-xs border whitespace-nowrap ${(imageQuickMenu?.blinkOpacity ?? null) === null ? 'bg-white/5 border-white/10 text-gray-300' : 'bg-cyan-500/20 border-cyan-400/50 text-cyan-300'}`}><Eye size={14} /></button>
                    </div>
                    {(() => {
                      const cfg = getQuickControlConfig(imageQuickMenu?.control || 'hue', quickImageTarget);
                      if (!cfg) return null;
                      return (
                        <div className="space-y-1">
                          <div className="flex justify-between text-[11px] text-gray-400">
                            <span>{cfg.label}</span>
                            <span className="font-mono text-blue-300">{Math.round(cfg.value)}{cfg.suffix}</span>
                          </div>
                          <input type="range" min={cfg.min} max={cfg.max} value={cfg.value} onChange={(e) => applyQuickImageValue(imageQuickMenu?.control || 'hue', Number(e.target.value))} className="w-full h-1.5 bg-white/10 rounded-lg appearance-none accent-blue-500" />
                        </div>
                      );
                    })()}
                  </div>
                )}

                {isPrecisionImage && (
                  <div className="bg-white/5 p-3 rounded-xl">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Icon name="transform" size={16} className="text-yellow-500" />
                        <span className="text-[10px] text-gray-500 font-medium">Free Transform</span>
                      </div>
                      <button
                        onClick={() => updateShapeById(quickImageTarget.id, (s) => {
                          if (s.warpCorners) return { ...s, warpCorners: null };
                          return {
                            ...s,
                            warpCorners: [
                              { x: s.x, y: s.y },
                              { x: s.x + s.w, y: s.y },
                              { x: s.x, y: s.y + s.h },
                              { x: s.x + s.w, y: s.y + s.h }
                            ]
                          };
                        })}
                        className={`px-3 py-1.5 rounded-lg text-xs border transition active:scale-90 ${quickImageTarget.warpCorners ? 'bg-yellow-500/20 border-yellow-400/60 text-yellow-300' : 'bg-white/5 border-white/10 text-gray-400'}`}
                      >
                        {quickImageTarget.warpCorners ? 'On' : 'Off'}
                      </button>
                    </div>
                  </div>
                )}

                {isPrecisionShape && (
                  <div className="bg-white/5 p-3 rounded-xl space-y-4">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => updateShapeById(quickImageTarget.id, (s) => ({ ...s, stroke: s.stroke === 'transparent' ? '#3b82f6' : 'transparent' }))}
                            className={`p-1.5 rounded-lg transition ${quickImageTarget.stroke === 'transparent' ? 'text-gray-600 bg-white/5' : 'text-blue-400 bg-blue-500/15'}`}
                            aria-label="Toggle stroke"
                          ><PenTool size={16} /></button>
                          <span className="text-[10px] text-gray-500 font-medium">Stroke</span>
                        </div>
                        <input type="color" className="w-7 h-7 bg-transparent border-0 cursor-pointer" value={quickImageTarget.stroke === 'transparent' ? '#ffffff' : quickImageTarget.stroke} onChange={(e) => updateShapeById(quickImageTarget.id, (s) => ({ ...s, stroke: e.target.value }))} title="Custom stroke color" />
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {COLOR_PRESETS.map((color) => (
                          <button key={`ps-${color}`} onClick={() => updateShapeById(quickImageTarget.id, (s) => ({ ...s, stroke: color }))} className={`w-6 h-6 rounded-full border-2 transition-transform active:scale-90 ${quickImageTarget.stroke === color ? 'border-white scale-110' : 'border-white/20'}`} style={{ backgroundColor: color }} title={color} />
                        ))}
                      </div>
                    </div>

                    {quickImageTarget.type !== 'line' && (
                      <div className="border-t border-white/5 pt-3">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => updateShapeById(quickImageTarget.id, (s) => ({ ...s, fill: s.fill === 'transparent' ? '#3b82f6' : 'transparent' }))}
                              className={`p-1.5 rounded-lg transition ${quickImageTarget.fill === 'transparent' ? 'text-gray-600 bg-white/5' : 'text-sky-400 bg-sky-500/15'}`}
                              aria-label="Toggle fill"
                            ><Droplets size={16} /></button>
                            <span className="text-[10px] text-gray-500 font-medium">Fill</span>
                          </div>
                          <input type="color" className="w-7 h-7 bg-transparent border-0 cursor-pointer" value={quickImageTarget.fill === 'transparent' ? '#ffffff' : quickImageTarget.fill} onChange={(e) => updateShapeById(quickImageTarget.id, (s) => ({ ...s, fill: e.target.value }))} title="Custom fill color" />
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {COLOR_PRESETS.map((color) => (
                            <button key={`pf-${color}`} onClick={() => updateShapeById(quickImageTarget.id, (s) => ({ ...s, fill: color }))} className={`w-6 h-6 rounded-full border-2 transition-transform active:scale-90 ${quickImageTarget.fill === color ? 'border-white scale-110' : 'border-white/20'}`} style={{ backgroundColor: color }} title={color} />
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="border-t border-white/5 pt-3">
                      <div className="flex justify-between text-[11px] text-gray-400">
                        <span>Opacity</span>
                        <span className="font-mono text-blue-300">{Math.round(quickImageTarget.opacity ?? 100)}%</span>
                      </div>
                      <input type="range" min={0} max={100} value={quickImageTarget.opacity ?? 100} onChange={(e) => updateShapeById(quickImageTarget.id, (s) => ({ ...s, opacity: Number(e.target.value) }))} className="w-full h-1.5 bg-white/10 rounded-lg appearance-none accent-blue-500" />
                    </div>

                    {quickImageTarget.type === 'line' && (
                      <div className="border-t border-white/5 pt-3">
                        <div className="flex justify-between text-[11px] text-gray-400">
                          <span>Division count</span>
                          <span className="font-mono text-blue-300">{(quickImageTarget.divisions || 1) + 1}</span>
                        </div>
                        <input type="range" min={1} max={6} step={1} value={quickImageTarget.divisions || 1} onChange={(e) => updateShapeById(quickImageTarget.id, (s) => ({ ...s, divisions: Number(e.target.value) }))} className="w-full h-1.5 bg-white/10 rounded-lg appearance-none accent-blue-500" />
                      </div>
                    )}
                  </div>
                )}

                <div className="flex gap-3 pt-2">
                  <button onClick={() => setImageQuickMenu(null)} className="flex-1 py-3 rounded-xl bg-white/5 text-gray-400 font-bold text-sm transition active:scale-95 hover:bg-white/10">Close</button>
                  <button aria-label="Delete shape" onClick={() => { deleteShape(quickImageTarget.id); setImageQuickMenu(null); }} className="p-3 bg-red-500/10 text-red-500 rounded-xl active:bg-red-500/20 transition border border-red-500/10"><Trash2 size={22} /></button>
                </div>

              </div>
            </div>
          </div>
        )}
      </div>
    );
  }
export default App;


