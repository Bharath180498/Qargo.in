import { useMemo, useState } from 'react';
import { LayoutChangeEvent, StyleSheet, Text, View } from 'react-native';

interface SignaturePoint {
  x: number;
  y: number;
}

interface ParsedSignature {
  width: number;
  height: number;
  strokes: SignaturePoint[][];
}

interface DeliverySignaturePreviewProps {
  signature: unknown;
  height?: number;
}

const DEFAULT_CANVAS_HEIGHT = 110;
const STROKE_WIDTH = 2.6;

function distance(a: SignaturePoint, b: SignaturePoint) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function parseSignaturePayload(raw: unknown): ParsedSignature | null {
  const payload = (() => {
    if (typeof raw === 'string') {
      try {
        return JSON.parse(raw) as unknown;
      } catch {
        return null;
      }
    }
    return raw;
  })();

  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const candidate = payload as {
    width?: unknown;
    height?: unknown;
    strokes?: unknown;
  };

  const width = Number(candidate.width);
  const height = Number(candidate.height);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return null;
  }

  if (!Array.isArray(candidate.strokes) || candidate.strokes.length === 0) {
    return null;
  }

  const strokes = candidate.strokes
    .map((stroke) => {
      if (!Array.isArray(stroke)) {
        return [] as SignaturePoint[];
      }

      return stroke
        .map((point) => {
          if (!point || typeof point !== 'object') {
            return null;
          }

          const row = point as { x?: unknown; y?: unknown };
          const x = Number(row.x);
          const y = Number(row.y);

          if (!Number.isFinite(x) || !Number.isFinite(y)) {
            return null;
          }

          return { x, y };
        })
        .filter((point): point is SignaturePoint => point !== null);
    })
    .filter((stroke) => stroke.length >= 2);

  if (strokes.length === 0) {
    return null;
  }

  return { width, height, strokes };
}

export function DeliverySignaturePreview({
  signature,
  height = DEFAULT_CANVAS_HEIGHT
}: DeliverySignaturePreviewProps) {
  const [canvasWidth, setCanvasWidth] = useState(0);

  const parsedSignature = useMemo(() => parseSignaturePayload(signature), [signature]);

  const segments = useMemo(() => {
    if (!parsedSignature || canvasWidth <= 0) {
      return [];
    }

    const scaleX = canvasWidth / parsedSignature.width;
    const scaleY = height / parsedSignature.height;

    return parsedSignature.strokes.flatMap((stroke, strokeIndex) => {
      const normalizedStroke = stroke.map((point) => ({
        x: Number((point.x * scaleX).toFixed(2)),
        y: Number((point.y * scaleY).toFixed(2))
      }));

      return normalizedStroke.flatMap((point, pointIndex) => {
        if (pointIndex === 0) {
          return [];
        }

        const from = normalizedStroke[pointIndex - 1];
        const to = normalizedStroke[pointIndex];
        const segmentLength = distance(from, to);
        if (segmentLength < 0.5) {
          return [];
        }

        return [
          {
            key: `${strokeIndex}-${pointIndex}`,
            left: (from.x + to.x) / 2 - segmentLength / 2,
            top: (from.y + to.y) / 2 - STROKE_WIDTH / 2,
            width: segmentLength,
            angle: Math.atan2(to.y - from.y, to.x - from.x)
          }
        ];
      });
    });
  }, [canvasWidth, height, parsedSignature]);

  const onLayout = (event: LayoutChangeEvent) => {
    const width = event.nativeEvent.layout.width;
    if (width > 0 && Number.isFinite(width)) {
      setCanvasWidth(width);
    }
  };

  if (!parsedSignature) {
    return (
      <View style={[styles.canvas, { height }]}>
        <Text style={styles.emptyText}>Signature not available</Text>
      </View>
    );
  }

  return (
    <View style={[styles.canvas, { height }]} onLayout={onLayout}>
      {segments.map((segment) => (
        <View
          key={segment.key}
          pointerEvents="none"
          style={[
            styles.segment,
            {
              left: segment.left,
              top: segment.top,
              width: segment.width,
              transform: [{ rotateZ: `${segment.angle}rad` }]
            }
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  canvas: {
    width: '100%',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: '#F8FAFC',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center'
  },
  segment: {
    position: 'absolute',
    height: STROKE_WIDTH,
    borderRadius: 999,
    backgroundColor: '#111827'
  },
  emptyText: {
    color: '#64748B',
    fontSize: 12
  }
});
