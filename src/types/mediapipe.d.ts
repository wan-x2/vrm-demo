// MediaPipe type definitions
declare module '@mediapipe/holistic' {
  export interface Results {
    poseLandmarks?: NormalizedLandmarkList;
    poseWorldLandmarks?: LandmarkList;
    faceLandmarks?: NormalizedLandmarkList;
    leftHandLandmarks?: NormalizedLandmarkList;
    rightHandLandmarks?: NormalizedLandmarkList;
    segmentationMask?: ImageData;
  }

  export interface NormalizedLandmark {
    x: number;
    y: number;
    z: number;
    visibility?: number;
  }

  export interface Landmark {
    x: number;
    y: number;
    z: number;
    visibility?: number;
  }

  export type NormalizedLandmarkList = NormalizedLandmark[];
  export type LandmarkList = Landmark[];

  export interface HolisticConfig {
    locateFile: (file: string) => string;
  }

  export interface Options {
    modelComplexity?: number;
    smoothLandmarks?: boolean;
    enableSegmentation?: boolean;
    smoothSegmentation?: boolean;
    refineFaceLandmarks?: boolean;
    minDetectionConfidence?: number;
    minTrackingConfidence?: number;
    selfieMode?: boolean;
  }

  export class Holistic {
    constructor(config: HolisticConfig);
    setOptions(options: Options): void;
    onResults(callback: (results: Results) => void): void;
    send(inputs: { image: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement }): Promise<void>;
    close(): Promise<void>;
  }
}

declare module '@mediapipe/drawing_utils' {
  export interface DrawingOptions {
    color?: string;
    lineWidth?: number;
    radius?: number;
    fillColor?: string;
  }

  export function drawConnectors(
    ctx: CanvasRenderingContext2D,
    landmarks: any[],
    connections: number[][],
    options?: DrawingOptions
  ): void;

  export function drawLandmarks(
    ctx: CanvasRenderingContext2D,
    landmarks: any[],
    options?: DrawingOptions
  ): void;
}