import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { VRM, VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm';
// @ts-ignore
import { Holistic, Results } from '@mediapipe/holistic';
// @ts-ignore
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
let holisticInstance: any = null;
let isDetecting = false;

// Elements
const video = document.getElementById('video') as HTMLVideoElement;
const guides = document.getElementById('guides') as HTMLCanvasElement;
const threeCanvas = document.getElementById('three-canvas') as HTMLCanvasElement;
const startBtn = document.getElementById('start-btn') as HTMLButtonElement;
const vrmUpload = document.getElementById('vrm-upload') as HTMLInputElement;
const status = document.getElementById('status') as HTMLDivElement;

// Initialize Three.js
function initThree() {
  console.log('Initializing Three.js...');
  
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
  camera.lookAt(0, 1.4, 0);
  
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
  
  console.log('Three.js initialized');
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
  console.log('Loading VRM from:', url);
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
    
    // Log available expression names
    if (vrm.expressionManager) {
      console.log('Available expressions:', vrm.expressionManager.expressions.map(e => e.expressionName));
    }
    
    // Log available bones
    if (vrm.humanoid) {
      const boneNames = Object.keys(vrm.humanoid.humanBones);
      console.log('Available bones:', boneNames);
    }
    
    status.textContent = 'VRMロード完了';
    console.log('VRM loaded successfully');
  } catch (error) {
    console.error('VRM load error:', error);
    status.textContent = 'VRMロードエラー';
  }
}

// Initialize MediaPipe Holistic
function initHolistic() {
  console.log('Initializing MediaPipe Holistic...');
  
  // @ts-ignore
  const holistic = new window.Holistic({
    locateFile: (file: string) => {
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
  
  console.log('MediaPipe Holistic initialized');
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
    // @ts-ignore
    drawConnectors(ctx, results.poseLandmarks, window.POSE_CONNECTIONS, {
      color: '#00FF00',
      lineWidth: 4
    });
    // @ts-ignore
    drawLandmarks(ctx, results.poseLandmarks, {
      color: '#FF0000',
      lineWidth: 2
    });
  }
  
  if (results.faceLandmarks) {
    // @ts-ignore
    drawConnectors(ctx, results.faceLandmarks, window.FACEMESH_TESSELATION, {
      color: '#C0C0C070',
      lineWidth: 1
    });
  }
  
  if (results.leftHandLandmarks) {
    // @ts-ignore
    drawConnectors(ctx, results.leftHandLandmarks, window.HAND_CONNECTIONS, {
      color: '#CC0000',
      lineWidth: 5
    });
    // @ts-ignore
    drawLandmarks(ctx, results.leftHandLandmarks, {
      color: '#00FF00',
      lineWidth: 2
    });
  }
  
  if (results.rightHandLandmarks) {
    // @ts-ignore
    drawConnectors(ctx, results.rightHandLandmarks, window.HAND_CONNECTIONS, {
      color: '#00CC00',
      lineWidth: 5
    });
    // @ts-ignore
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
  if (!currentVrm || !currentVrm.humanoid) return;
  
  const humanoid = currentVrm.humanoid;
  
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
      
      // Head rotation
      const headBone = humanoid.getRawBoneNode('head');
      if (headBone && face.head) {
        rigRotation(headBone, face.head, 0.7);
      }
      
      // Expressions
      const expressionManager = currentVrm.expressionManager;
      if (expressionManager && face.blink) {
        // Try different expression names for compatibility
        const blinkValue = (face.blink.l + face.blink.r) / 2;
        
        // Common expression names in VRM
        expressionManager.setValue('blink', blinkValue);
        expressionManager.setValue('Blink', blinkValue);
        expressionManager.setValue('blinkLeft', face.blink.l);
        expressionManager.setValue('BlinkLeft', face.blink.l);
        expressionManager.setValue('blinkRight', face.blink.r);
        expressionManager.setValue('BlinkRight', face.blink.r);
        
        // Mouth shapes
        if (face.mouth) {
          expressionManager.setValue('aa', face.mouth.shape.A || 0);
          expressionManager.setValue('Aa', face.mouth.shape.A || 0);
          expressionManager.setValue('A', face.mouth.shape.A || 0);
          
          expressionManager.setValue('ee', face.mouth.shape.E || 0);
          expressionManager.setValue('Ee', face.mouth.shape.E || 0);
          expressionManager.setValue('E', face.mouth.shape.E || 0);
          
          expressionManager.setValue('ih', face.mouth.shape.I || 0);
          expressionManager.setValue('Ih', face.mouth.shape.I || 0);
          expressionManager.setValue('I', face.mouth.shape.I || 0);
          
          expressionManager.setValue('oh', face.mouth.shape.O || 0);
          expressionManager.setValue('Oh', face.mouth.shape.O || 0);
          expressionManager.setValue('O', face.mouth.shape.O || 0);
          
          expressionManager.setValue('ou', face.mouth.shape.U || 0);
          expressionManager.setValue('Ou', face.mouth.shape.U || 0);
          expressionManager.setValue('U', face.mouth.shape.U || 0);
        }
      }
    }
  }
  
  // Pose
  if (isCompletePose(results.poseLandmarks) && results.poseWorldLandmarks) {
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
      // Store for next frame
      previousRig.hips = hips;
      
      // Hips position and rotation
      const hipsBone = humanoid.getRawBoneNode('hips');
      if (hipsBone) {
        if (hips.hips.position) {
          rigPosition(hipsBone, {
            x: hips.hips.position.x,
            y: (hips.hips.position.y) + 1,
            z: -(hips.hips.position.z)
          }, 0.7);
        }
        
        if (hips.hips.rotation) {
          rigRotation(hipsBone, hips.hips.rotation, 0.7);
        }
      }
      
      // Spine
      const spineBone = humanoid.getRawBoneNode('spine');
      if (spineBone && hips.spine) {
        rigRotation(spineBone, hips.spine, 0.7);
      }
      
      // Arms
      const leftUpperArmBone = humanoid.getRawBoneNode('leftUpperArm');
      if (leftUpperArmBone && hips.leftUpperArm) {
        rigRotation(leftUpperArmBone, hips.leftUpperArm, 0.7);
      }
      
      const leftLowerArmBone = humanoid.getRawBoneNode('leftLowerArm');
      if (leftLowerArmBone && hips.leftLowerArm) {
        rigRotation(leftLowerArmBone, hips.leftLowerArm, 0.7);
      }
      
      const rightUpperArmBone = humanoid.getRawBoneNode('rightUpperArm');
      if (rightUpperArmBone && hips.rightUpperArm) {
        rigRotation(rightUpperArmBone, hips.rightUpperArm, 0.7);
      }
      
      const rightLowerArmBone = humanoid.getRawBoneNode('rightLowerArm');
      if (rightLowerArmBone && hips.rightLowerArm) {
        rigRotation(rightLowerArmBone, hips.rightLowerArm, 0.7);
      }
      
      // Legs
      const leftUpperLegBone = humanoid.getRawBoneNode('leftUpperLeg');
      if (leftUpperLegBone && hips.leftUpperLeg) {
        rigRotation(leftUpperLegBone, hips.leftUpperLeg, 0.7);
      }
      
      const leftLowerLegBone = humanoid.getRawBoneNode('leftLowerLeg');
      if (leftLowerLegBone && hips.leftLowerLeg) {
        rigRotation(leftLowerLegBone, hips.leftLowerLeg, 0.7);
      }
      
      const rightUpperLegBone = humanoid.getRawBoneNode('rightUpperLeg');
      if (rightUpperLegBone && hips.rightUpperLeg) {
        rigRotation(rightUpperLegBone, hips.rightUpperLeg, 0.7);
      }
      
      const rightLowerLegBone = humanoid.getRawBoneNode('rightLowerLeg');
      if (rightLowerLegBone && hips.rightLowerLeg) {
        rigRotation(rightLowerLegBone, hips.rightLowerLeg, 0.7);
      }
    }
  }
  
  // Hands
  if (results.leftHandLandmarks) {
    const leftHandBone = humanoid.getRawBoneNode('leftHand');
    if (leftHandBone) {
      const leftHand = safeSolve(
        () => Kalidokit.Hand.solve(results.leftHandLandmarks!, 'Left'),
        undefined
      );
      
      if (leftHand && leftHand.LeftWrist) {
        rigRotation(leftHandBone, leftHand.LeftWrist, 0.7);
      }
    }
  }
  
  if (results.rightHandLandmarks) {
    const rightHandBone = humanoid.getRawBoneNode('rightHand');
    if (rightHandBone) {
      const rightHand = safeSolve(
        () => Kalidokit.Hand.solve(results.rightHandLandmarks!, 'Right'),
        undefined
      );
      
      if (rightHand && rightHand.RightWrist) {
        rigRotation(rightHandBone, rightHand.RightWrist, 0.7);
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
    console.log('Starting camera...');
    
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        width: 1280,
        height: 720,
        facingMode: 'user'
      }
    });
    
    video.srcObject = stream;
    await video.play();
    
    console.log('Camera started');
    
    // Set canvas sizes
    guides.width = window.innerWidth;
    guides.height = window.innerHeight;
    
    // Initialize Holistic if not already done
    if (!holisticInstance) {
      holisticInstance = initHolistic();
    }
    
    // Start detection loop
    isDetecting = true;
    
    const detectFrame = async () => {
      if (!isDetecting) return;
      
      if (video.readyState >= 2) {
        await holisticInstance.send({ image: video });
      }
      
      if (isDetecting) {
        requestAnimationFrame(detectFrame);
      }
    };
    
    detectFrame();
    
    status.textContent = '検出中...';
    startBtn.textContent = 'カメラを停止';
    startBtn.onclick = stopCamera;
    
    console.log('Detection started');
  } catch (error) {
    console.error('Camera error:', error);
    status.textContent = 'カメラエラー';
  }
}

function stopCamera() {
  console.log('Stopping camera...');
  
  isDetecting = false;
  
  const stream = video.srcObject as MediaStream;
  if (stream) {
    stream.getTracks().forEach(track => track.stop());
    video.srcObject = null;
  }
  
  // Clear canvas
  const ctx = guides.getContext('2d');
  if (ctx) {
    ctx.clearRect(0, 0, guides.width, guides.height);
  }
  
  startBtn.textContent = 'カメラを開始';
  startBtn.onclick = startCamera;
  status.textContent = 'カメラ停止';
  
  console.log('Camera stopped');
}

// Wait for MediaPipe to load
window.addEventListener('load', async () => {
  console.log('Page loaded, loading MediaPipe scripts...');
  
  // Load MediaPipe scripts
  const scripts = [
    'https://cdn.jsdelivr.net/npm/@mediapipe/holistic/holistic.js',
    'https://cdn.jsdelivr.net/npm/@mediapipe/drawing_utils/drawing_utils.js',
    'https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js'
  ];
  
  for (const src of scripts) {
    await new Promise<void>((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error(`Failed to load ${src}`));
      document.head.appendChild(script);
    });
  }
  
  console.log('MediaPipe scripts loaded');
  
  // Initialize Three.js
  initThree();
  animate();
  
  // Load default VRM
  loadVRM('/avatar.vrm').catch(() => {
    status.textContent = 'デフォルトVRMが見つかりません。VRMファイルを選択してください。';
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
});