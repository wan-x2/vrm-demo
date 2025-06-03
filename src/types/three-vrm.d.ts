// Additional type definitions for @pixiv/three-vrm
// The main types are already included in the package, but these help with some edge cases

import { VRM } from '@pixiv/three-vrm';

declare module '@pixiv/three-vrm' {
  export interface VRMExpressionManager {
    setValue(name: string, value: number): void;
    getValue(name: string): number | undefined;
    getExpressionNames(): string[];
  }

  export interface VRMHumanoid {
    getRawBoneNode(name: string): THREE.Object3D | null;
    getBone(name: string): VRMHumanBone | undefined;
    getBoneNames(): string[];
  }

  export interface VRMHumanBone {
    node: THREE.Object3D;
  }
}