// Kalidokit type definitions
declare module 'kalidokit' {
  export interface Vector3 {
    x: number;
    y: number;
    z: number;
  }

  export interface TPose {
    rotation?: Vector3;
    position?: Vector3;
    worldPosition?: Vector3;
  }

  export interface TFace extends TPose {
    head: Vector3;
    eyes?: Vector3;
    blink?: {
      l: number;
      r: number;
    };
    pupil?: {
      x: number;
      y: number;
    };
    mouth?: {
      x: number;
      y: number;
      shape: {
        A: number;
        E: number;
        I: number;
        O: number;
        U: number;
      };
    };
  }

  export interface THand {
    [key: string]: Vector3 | undefined;
    LeftWrist?: Vector3;
    RightWrist?: Vector3;
    LeftThumb?: Vector3[];
    RightThumb?: Vector3[];
    LeftIndex?: Vector3[];
    RightIndex?: Vector3[];
    LeftMiddle?: Vector3[];
    RightMiddle?: Vector3[];
    LeftRing?: Vector3[];
    RightRing?: Vector3[];
    LeftLittle?: Vector3[];
    RightLittle?: Vector3[];
  }

  export interface PoseResult {
    hips: TPose;
    spine: Vector3;
    chest?: Vector3;
    neck?: Vector3;
    head?: Vector3;
    leftShoulder?: Vector3;
    leftUpperArm: Vector3;
    leftLowerArm: Vector3;
    leftHand?: Vector3;
    rightShoulder?: Vector3;
    rightUpperArm: Vector3;
    rightLowerArm: Vector3;
    rightHand?: Vector3;
    leftUpperLeg: Vector3;
    leftLowerLeg: Vector3;
    leftFoot?: Vector3;
    rightUpperLeg: Vector3;
    rightLowerLeg: Vector3;
    rightFoot?: Vector3;
  }

  export namespace Face {
    export function solve(
      facelandmarks: any[],
      options?: {
        runtime?: string;
        video?: HTMLVideoElement;
        imageSize?: { width: number; height: number };
        smoothBlink?: boolean;
        blinkSettings?: any[];
      }
    ): TFace;
  }

  export namespace Pose {
    export function solve(
      poseLandmarks: any[],
      poseWorldLandmarks: any[],
      options?: {
        runtime?: string;
        video?: HTMLVideoElement;
        imageSize?: { width: number; height: number };
        enableLegs?: boolean;
      }
    ): PoseResult;
  }

  export namespace Hand {
    export function solve(
      handLandmarks: any[],
      side: 'Left' | 'Right'
    ): THand;
  }

  export namespace Utils {
    export function rigFingers(
      hand: THand,
      side: 'Left' | 'Right',
      getNodeFunction: (name: string) => any
    ): void;
    
    export function rigFace(
      face: TFace,
      getNodeFunction: (name: string) => any
    ): void;
  }
}