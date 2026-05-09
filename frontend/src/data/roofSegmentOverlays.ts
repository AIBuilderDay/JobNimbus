export interface SegmentOverlay {
  segmentIndex: number;
  vertices: [number, number, number][];
}

export interface ModelOverlayConfig {
  pattern: RegExp;
  modelUrl: string;
  rotation: number;
  segments: SegmentOverlay[];
}

export const MODEL_OVERLAYS: ModelOverlayConfig[] = [
  {
    pattern: /1261\s+20th/i,
    modelUrl: "/models/1261-20th-st.glb",
    rotation: 0,
    segments: [
      { segmentIndex: 0, vertices: [[-1.5, 1.2, 0.5], [1.5, 1.2, 0.5], [1.5, 1.2, -1.5], [-1.5, 1.2, -1.5]] },
      { segmentIndex: 1, vertices: [[-1.5, 0.8, -1.5], [1.5, 0.8, -1.5], [1.5, 0.8, -3.0], [-1.5, 0.8, -3.0]] },
      { segmentIndex: 2, vertices: [[1.8, 1.0, 0.5], [3.5, 1.0, 0.5], [3.5, 1.0, -1.5], [1.8, 1.0, -1.5]] },
    ],
  },
  {
    pattern: /127\s+nw\s+13th/i,
    modelUrl: "/models/127-nw-13th-pl.glb",
    rotation: 0,
    segments: [
      { segmentIndex: 0, vertices: [[-1.2, 1.0, 0.8], [1.2, 1.0, 0.8], [1.2, 1.0, -1.2], [-1.2, 1.0, -1.2]] },
      { segmentIndex: 1, vertices: [[-1.2, 0.6, -1.2], [1.2, 0.6, -1.2], [1.2, 0.6, -2.8], [-1.2, 0.6, -2.8]] },
    ],
  },
];

export function getOverlaysForAddress(address: string): ModelOverlayConfig | null {
  for (const config of MODEL_OVERLAYS) {
    if (config.pattern.test(address)) return config;
  }
  return null;
}
