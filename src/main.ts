import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { VRM, VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm';
import { Holistic, Results } from '@mediapipe/holistic';
import { drawConnectors, drawLandmarks } from '@mediapipe/drawing_utils';
import * as Kalidokit from 'kalidokit';

// Types
interface PreviousRig {
  hips?: Kalidokit.TPose;
  spine?: Kalidokit.TPose;
  chest?: Kalidokit.TPose;
  head?: Kalidokit.TFace;
  leftUpperArm?: Kalidokit.TPose;
  leftLowerArm?: Kalidokit.TPose;
  rightUpperArm?: Kalidokit.TPose;
  rightLowerArm?: Kalidokit.TPose;
  leftUpperLeg?: Kalidokit.TPose;
  leftLowerLeg?: Kalidokit.TPose;
  rightUpperLeg?: Kalidokit.TPose;
  rightLowerLeg?: Kalidokit.TPose;
}

// Global variables
let scene: THREE.Scene;
let camera: THREE.PerspectiveCamera;
let renderer: THREE.WebGLRenderer;
let currentVrm: VRM | null = null;
let clock: THREE.Clock;
let previousRig: PreviousRig = {};

// Elements
const video = document.getElementById('video') as HTMLVideoElement;
const guides = document.getElementById('guides') as HTMLCanvasElement;
const threeCanvas = document.getElementById('three-canvas') as HTMLCanvasElement;
const startBtn = document.getElementById('start-btn') as HTMLButtonElement;
const vrmUpload = document.getElementById('vrm-upload') as HTMLInputElement;
const status = document.getElementById('status') as HTMLDivElement;

// Initialize Three.js
function initThree() {
  // Scene
  scene = new THREE.Scene();
  
  // Camera - fixed at (0, 1.4, 2)
  camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
  );
  camera.position.set(0, 1.4, 2);
  
  // Renderer with transparent background
  renderer = new THREE.WebGLRenderer({
    canvas: threeCanvas,
    alpha: true,
    antialias: true
  });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(window.devicePixelRatio);
  
  // Lighting
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
  scene.add(ambientLight);
  
  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
  directionalLight.position.set(0, 1, 2);
  scene.add(directionalLight);
  
  // Clock for deltaTime
  clock = new THREE.Clock();
  
  // Handle window resize
  window.addEventListener('resize', onWindowResize);
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  guides.width = window.innerWidth;
  guides.height = window.innerHeight;
}

// Load VRM
async function loadVRM(url: string) {
  const loader = new GLTFLoader();
  loader.register((parser) => new VRMLoaderPlugin(parser));
  
  try {
    const gltf = await loader.loadAsync(url);
    const vrm = gltf.userData.vrm as VRM;
    
    // Remove old VRM
    if (currentVrm) {
      scene.remove(currentVrm.scene);
      VRMUtils.deepDispose(currentVrm.scene);
    }
    
    // Add new VRM
    currentVrm = vrm;
    scene.add(vrm.scene);
    
    // Rotate to face camera
    vrm.scene.rotation.y = Math.PI;
    
    // Reset rig data
    previousRig = {};
    
    status.textContent = 'VRMロード完了';
  } catch (error) {
    console.error('VRM load error:', error);
    status.textContent = 'VRMロードエラー';
  }
}

// Initialize MediaPipe Holistic
function initHolistic() {
  const holistic = new Holistic({
    locateFile: (file) => {
      return `https://cdn.jsdelivr.net/npm/@mediapipe/holistic/${file}`;
    }
  });
  
  holistic.setOptions({
    modelComplexity: 1,
    smoothLandmarks: true,
    enableSegmentation: false,
    smoothSegmentation: false,
    refineFaceLandmarks: true,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5,
    selfieMode: true
  });
  
  holistic.onResults(onHolisticResults);
  
  return holistic;
}

// Check if pose landmarks are complete
function isCompletePose(landmarks: any): boolean {
  if (!landmarks || !Array.isArray(landmarks) || landmarks.length !== 33) {
    return false;
  }
  
  // Check key indices
  const keyIndices = [11, 12, 23, 24];
  return keyIndices.every(i => 
    landmarks[i] && 
    typeof landmarks[i].x === 'number' &&
    typeof landmarks[i].y === 'number' &&
    typeof landmarks[i].z === 'number'
  );
}

// Safe solve wrapper
function safeSolve<T>(solveFn: () => T, fallback: T | undefined): T | undefined {
  try {
    return solveFn();
  } catch (error) {
    console.warn('Solve error:', error);
    return fallback;
  }
}

// Rigging functions with damping
function rigRotation(
  bone: THREE.Object3D | null,
  rotation?: { x: number; y: number; z: number },
  damping = 0.7
) {
  if (!bone || !rotation) return;
  
  const quaternion = new THREE.Quaternion().setFromEuler(
    new THREE.Euler(rotation.x, rotation.y, rotation.z)
  );
  
  bone.quaternion.slerp(quaternion, damping);
}

function rigPosition(
  bone: THREE.Object3D | null,
  position?: { x: number; y: number; z: number },
  damping = 0.7
) {
  if (!bone || !position) return;
  
  bone.position.lerp(
    new THREE.Vector3(position.x, position.y, position.z),
    damping
  );
}

// Process holistic results
function onHolisticResults(results: Results) {
  // Draw guides
  const ctx = guides.getContext('2d')!;
  ctx.save();
  ctx.clearRect(0, 0, guides.width, guides.height);
  
  // Draw landmarks and connectors
  if (results.poseLandmarks) {
    drawConnectors(ctx, results.poseLandmarks, POSE_CONNECTIONS, {
      color: '#00FF00',
      lineWidth: 4
    });
    drawLandmarks(ctx, results.poseLandmarks, {
      color: '#FF0000',
      lineWidth: 2
    });
  }
  
  if (results.faceLandmarks) {
    drawConnectors(ctx, results.faceLandmarks, FACEMESH_TESSELATION, {
      color: '#C0C0C070',
      lineWidth: 1
    });
  }
  
  if (results.leftHandLandmarks) {
    drawConnectors(ctx, results.leftHandLandmarks, HAND_CONNECTIONS, {
      color: '#CC0000',
      lineWidth: 5
    });
    drawLandmarks(ctx, results.leftHandLandmarks, {
      color: '#00FF00',
      lineWidth: 2
    });
  }
  
  if (results.rightHandLandmarks) {
    drawConnectors(ctx, results.rightHandLandmarks, HAND_CONNECTIONS, {
      color: '#00CC00',
      lineWidth: 5
    });
    drawLandmarks(ctx, results.rightHandLandmarks, {
      color: '#FF0000',
      lineWidth: 2
    });
  }
  
  ctx.restore();
  
  // Apply to VRM if available
  if (currentVrm) {
    rigVRM(results);
  }
}

// Apply rigging to VRM
function rigVRM(results: Results) {
  if (!currentVrm) return;
  
  const humanoid = currentVrm.humanoid;
  if (!humanoid) return;
  
  // Face
  if (results.faceLandmarks && results.faceLandmarks.length === 478) {
    const face = safeSolve(
      () => Kalidokit.Face.solve(results.faceLandmarks!, {
        runtime: 'mediapipe',
        video: video
      }),
      previousRig.head
    );
    
    if (face) {
      previousRig.head = face;
      rigRotation(humanoid.getRawBoneNode('head'), face.head, 0.7);
      
      // Expressions
      const expressionManager = currentVrm.expressionManager;
      if (expressionManager) {
        expressionManager.setValue('blink', face.blink ?? 0);
        expressionManager.setValue('blinkLeft', face.blink?.l ?? 0);
        expressionManager.setValue('blinkRight', face.blink?.r ?? 0);
        
        // Mouth
        expressionManager.setValue('aa', face.mouth?.shape.A ?? 0);
        expressionManager.setValue('ee', face.mouth?.shape.E ?? 0);
        expressionManager.setValue('ih', face.mouth?.shape.I ?? 0);
        expressionManager.setValue('oh', face.mouth?.shape.O ?? 0);
        expressionManager.setValue('ou', face.mouth?.shape.U ?? 0);
      }
    }
  }
  
  // Pose
  if (isCompletePose(results.poseLandmarks)) {
    // Hips
    const hips = safeSolve(
      () => Kalidokit.Pose.solve(results.poseLandmarks!, results.poseWorldLandmarks!, {
        runtime: 'mediapipe',
        video: video,
        imageSize: { width: video.videoWidth, height: video.videoHeight },
        enableLegs: true
      }),
      previousRig.hips
    );
    
    if (hips) {
      previousRig.hips = hips;
      rigPosition(humanoid.getRawBoneNode('hips'), {
        x: hips.hips.position?.x ?? 0,
        y: hips.hips.position?.y ?? 0 + 1,
        z: -hips.hips.position?.z ?? 0
      }, 0.7);
      
      rigRotation(humanoid.getRawBoneNode('hips'), hips.hips.rotation, 0.7);
      rigRotation(humanoid.getRawBoneNode('spine'), hips.spine, 0.7);
      
      // Arms
      rigRotation(humanoid.getRawBoneNode('leftUpperArm'), hips.leftUpperArm, 0.7);
      rigRotation(humanoid.getRawBoneNode('leftLowerArm'), hips.leftLowerArm, 0.7);
      rigRotation(humanoid.getRawBoneNode('rightUpperArm'), hips.rightUpperArm, 0.7);
      rigRotation(humanoid.getRawBoneNode('rightLowerArm'), hips.rightLowerArm, 0.7);
      
      // Legs
      rigRotation(humanoid.getRawBoneNode('leftUpperLeg'), hips.leftUpperLeg, 0.7);
      rigRotation(humanoid.getRawBoneNode('leftLowerLeg'), hips.leftLowerLeg, 0.7);
      rigRotation(humanoid.getRawBoneNode('rightUpperLeg'), hips.rightUpperLeg, 0.7);
      rigRotation(humanoid.getRawBoneNode('rightLowerLeg'), hips.rightLowerLeg, 0.7);
    }
  }
  
  // Hands
  if (results.leftHandLandmarks && humanoid.getRawBoneNode('leftHand')) {
    const leftHand = safeSolve(
      () => Kalidokit.Hand.solve(results.leftHandLandmarks!, 'Left'),
      undefined
    );
    if (leftHand) {
      rigRotation(humanoid.getRawBoneNode('leftHand'), leftHand.LeftWrist, 0.7);
      if (humanoid.getRawBoneNode('leftRingProximal')) {
        Kalidokit.Utils.rigFingers(leftHand, 'Left', humanoid.getRawBoneNode.bind(humanoid) as any);
      }
    }
  }
  
  if (results.rightHandLandmarks && humanoid.getRawBoneNode('rightHand')) {
    const rightHand = safeSolve(
      () => Kalidokit.Hand.solve(results.rightHandLandmarks!, 'Right'),
      undefined
    );
    if (rightHand) {
      rigRotation(humanoid.getRawBoneNode('rightHand'), rightHand.RightWrist, 0.7);
      if (humanoid.getRawBoneNode('rightRingProximal')) {
        Kalidokit.Utils.rigFingers(rightHand, 'Right', humanoid.getRawBoneNode.bind(humanoid) as any);
      }
    }
  }
}

// Animation loop
function animate() {
  requestAnimationFrame(animate);
  
  const deltaTime = clock.getDelta();
  
  // Update VRM
  if (currentVrm) {
    currentVrm.update(deltaTime);
  }
  
  // Render
  renderer.render(scene, camera);
}

// Start camera and detection
async function startCamera() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        width: 1280,
        height: 720,
        facingMode: 'user'
      }
    });
    
    video.srcObject = stream;
    await video.play();
    
    // Set canvas sizes
    guides.width = window.innerWidth;
    guides.height = window.innerHeight;
    
    // Start holistic detection
    const holistic = initHolistic();
    
    const detectFrame = async () => {
      await holistic.send({ image: video });
      requestAnimationFrame(detectFrame);
    };
    
    detectFrame();
    
    status.textContent = '検出中...';
    startBtn.textContent = 'カメラを停止';
    startBtn.onclick = stopCamera;
  } catch (error) {
    console.error('Camera error:', error);
    status.textContent = 'カメラエラー';
  }
}

function stopCamera() {
  const stream = video.srcObject as MediaStream;
  if (stream) {
    stream.getTracks().forEach(track => track.stop());
    video.srcObject = null;
  }
  
  startBtn.textContent = 'カメラを開始';
  startBtn.onclick = startCamera;
  status.textContent = 'カメラ停止';
}

// MediaPipe landmark connections
const POSE_CONNECTIONS = [
  [0, 1], [1, 2], [2, 3], [3, 7], [0, 4], [4, 5],
  [5, 6], [6, 8], [9, 10], [11, 12], [11, 13],
  [13, 15], [15, 17], [15, 19], [15, 21], [17, 19],
  [12, 14], [14, 16], [16, 18], [16, 20], [16, 22],
  [18, 20], [11, 23], [12, 24], [23, 24], [23, 25],
  [24, 26], [25, 27], [26, 28], [27, 29], [28, 30],
  [29, 31], [30, 32], [27, 31], [28, 32]
];

const FACEMESH_TESSELATION = [
  [127, 34], [34, 139], [139, 127], [11, 0], [0, 269],
  [269, 11], [270, 271], [271, 272], [272, 270], [267, 269],
  [269, 270], [270, 267], [0, 267], [267, 269], [269, 0]
  // ... truncated for brevity
];

const HAND_CONNECTIONS = [
  [0, 1], [1, 2], [2, 3], [3, 4], [0, 5], [5, 6],
  [6, 7], [7, 8], [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16], [13, 17],
  [0, 17], [17, 18], [18, 19], [19, 20]
];

// Initialize
initThree();
animate();

// Load default VRM
loadVRM('/avatar.vrm').catch(() => {
  status.textContent = 'デフォルトVRMが見つかりません';
});

// Event listeners
startBtn.onclick = startCamera;

vrmUpload.onchange = (e) => {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (file) {
    const url = URL.createObjectURL(file);
    loadVRM(url);
  }
};

status.textContent = '準備完了';