// Three.js First Person Room Escape Game
let scene, camera, renderer;
let player, room, furniture = {};
let isRunning = false;
let isPaused = false;
let wakeupComplete = false;

// Room dimensions
const ROOM_WIDTH = 10;
const ROOM_HEIGHT = 3;
const ROOM_DEPTH = 10;
const PLAYER_HEIGHT = 1.6; // Eye height
const PLAYER_JUMP_HEIGHT = PLAYER_HEIGHT * 0.5; // 0.5 times player height = 0.8

// Player movement
const keys = {};
const MOVE_SPEED = 0.15;
const MOUSE_SENSITIVITY = 0.002;
const JUMP_FORCE = Math.sqrt(2 * 9.81 * PLAYER_JUMP_HEIGHT); // Physics-based jump

let mouseDown = false;
let mouseLook = { x: 0, y: 0 };
let playerVelocityY = 0;
let playerOnGround = true;

// Initialize game
function initGame() {
  // Scene setup
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);
  scene.fog = new THREE.Fog(0x000000, 20, 30);

  // Camera (first-person)
  camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
  );
  camera.position.set(0, PLAYER_HEIGHT, 0); // Eye height

  // Renderer
  const canvas = document.getElementById('gameCanvas');
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowShadowMap;

  // Lighting
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
  scene.add(ambientLight);

  // Light source on wall (bright spot)
  const pointLight = new THREE.PointLight(0xffff99, 2, 15);
  pointLight.position.set(ROOM_WIDTH / 2 - 1, ROOM_HEIGHT - 0.5, ROOM_DEPTH / 2 - 2);
  pointLight.castShadow = true;
  scene.add(pointLight);

  // Create room
  createRoom();

  // Create furniture
  createBed();
  createDressingTable();
  createStudyTable();

  // Player object
  player = {
    velocity: new THREE.Vector3(0, 0, 0),
    onGround: true
  };

  // Event listeners
  document.addEventListener('keydown', (e) => {
    keys[e.key.toLowerCase()] = true;
    if (e.key === 'p' || e.key === 'P') togglePause();
    if (e.key === ' ') {
      e.preventDefault();
      jump();
    }
  });
  document.addEventListener('keyup', (e) => {
    keys[e.key.toLowerCase()] = false;
  });

  canvas.addEventListener('mousedown', () => {
    mouseDown = true;
    canvas.requestPointerLock = canvas.requestPointerLock || canvas.mozRequestPointerLock;
    canvas.requestPointerLock();
  });

  document.addEventListener('mousemove', (e) => {
    if (mouseDown && isRunning) {
      mouseLook.x -= e.movementY * MOUSE_SENSITIVITY;
      mouseLook.y -= e.movementX * MOUSE_SENSITIVITY;

      // Clamp vertical look
      mouseLook.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, mouseLook.x));

      camera.rotation.order = 'YXZ';
      camera.rotation.y = mouseLook.y;
      camera.rotation.x = mouseLook.x;
    }
  });

  window.addEventListener('resize', onWindowResize);

  // Start wake-up animation
  startWakeupAnimation();
}

function createRoom() {
  // Floor (grey and black kite pattern marble)
  const floorCanvas = document.createElement('canvas');
  floorCanvas.width = 512;
  floorCanvas.height = 512;
  const floorCtx = floorCanvas.getContext('2d');
  
  // Create kite pattern
  floorCtx.fillStyle = '#808080'; // Grey
  floorCtx.fillRect(0, 0, 512, 512);
  floorCtx.fillStyle = '#000000'; // Black
  
  const kiteSize = 64;
  for (let x = 0; x < 512; x += kiteSize) {
    for (let y = 0; y < 512; y += kiteSize) {
      if ((x / kiteSize + y / kiteSize) % 2 === 0) {
        floorCtx.fillRect(x, y, kiteSize, kiteSize);
      }
    }
  }
  
  const floorTexture = new THREE.CanvasTexture(floorCanvas);
  floorTexture.repeat.set(3, 3);
  floorTexture.wrapS = THREE.RepeatWrapping;
  floorTexture.wrapT = THREE.RepeatWrapping;
  
  const floorGeom = new THREE.PlaneGeometry(ROOM_WIDTH, ROOM_DEPTH);
  const floorMat = new THREE.MeshStandardMaterial({ map: floorTexture });
  const floor = new THREE.Mesh(floorGeom, floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  // Ceiling (white)
  const ceilingGeom = new THREE.PlaneGeometry(ROOM_WIDTH, ROOM_DEPTH);
  const ceilingMat = new THREE.MeshStandardMaterial({ color: 0xffffff });
  const ceiling = new THREE.Mesh(ceilingGeom, ceilingMat);
  ceiling.position.y = ROOM_HEIGHT;
  ceiling.rotation.x = Math.PI / 2;
  ceiling.receiveShadow = true;
  scene.add(ceiling);

  // Walls (sky blue with triangle patterns)
  const wallMat = createTrianglePatternMaterial(0x87ceeb); // Sky blue

  // Back wall
  const backWallGeom = new THREE.PlaneGeometry(ROOM_WIDTH, ROOM_HEIGHT);
  const backWall = new THREE.Mesh(backWallGeom, wallMat);
  backWall.position.z = -ROOM_DEPTH / 2;
  backWall.receiveShadow = true;
  scene.add(backWall);

  // Front wall
  const frontWall = new THREE.Mesh(backWallGeom, wallMat);
  frontWall.position.z = ROOM_DEPTH / 2;
  frontWall.rotation.y = Math.PI;
  frontWall.receiveShadow = true;
  scene.add(frontWall);

  // Left wall - REMOVED (open design)
  // Right wall
  const sideWallGeom = new THREE.PlaneGeometry(ROOM_DEPTH, ROOM_HEIGHT);
  const rightWall = new THREE.Mesh(sideWallGeom, wallMat);
  rightWall.position.x = ROOM_WIDTH / 2;
  rightWall.rotation.y = -Math.PI / 2;
  rightWall.receiveShadow = true;
  scene.add(rightWall);
}

function createTrianglePatternMaterial(baseColor) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');

  // Fill with base color
  ctx.fillStyle = '#' + baseColor.toString(16).padStart(6, '0');
  ctx.fillRect(0, 0, 256, 256);

  // Draw triangles
  ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
  const triangleSize = 32;
  for (let x = 0; x < 256; x += triangleSize) {
    for (let y = 0; y < 256; y += triangleSize) {
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + triangleSize / 2, y + triangleSize);
      ctx.lineTo(x + triangleSize, y);
      ctx.closePath();
      ctx.fill();
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.repeat.set(2, 2);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return new THREE.MeshStandardMaterial({ map: texture });
}

function createBed() {
  // Bed with fixed dimensions
  const bedWidth = 1.8;
  const bedLength = 2.2;
  const bedHeight = 0.8;

  // Bed frame (wood color - brown)
  const bedFrameGeom = new THREE.BoxGeometry(bedWidth, bedHeight * 0.1, bedLength);
  const bedFrameMat = new THREE.MeshStandardMaterial({ color: 0x8b4513 });
  const bedFrame = new THREE.Mesh(bedFrameGeom, bedFrameMat);
  bedFrame.position.set(-3, bedHeight * 0.05, -3);
  bedFrame.castShadow = true;
  bedFrame.receiveShadow = true;
  scene.add(bedFrame);

  // Mattress
  const mattressGeom = new THREE.BoxGeometry(bedWidth - 0.1, bedHeight * 0.3, bedLength - 0.1);
  const mattressMat = new THREE.MeshStandardMaterial({ color: 0x654321 });
  const mattress = new THREE.Mesh(mattressGeom, mattressMat);
  mattress.position.set(-3, bedHeight * 0.2, -3);
  mattress.castShadow = true;
  mattress.receiveShadow = true;
  scene.add(mattress);

  // White sheet
  const sheetGeom = new THREE.BoxGeometry(bedWidth - 0.15, bedHeight * 0.25, bedLength - 0.15);
  const sheetMat = new THREE.MeshStandardMaterial({ color: 0xffffff });
  const sheet = new THREE.Mesh(sheetGeom, sheetMat);
  sheet.position.set(-3, bedHeight * 0.35, -3);
  sheet.castShadow = true;
  sheet.receiveShadow = true;
  scene.add(sheet);

  // Pillows
  const pillowGeom = new THREE.BoxGeometry(bedWidth * 0.35, bedHeight * 0.15, bedLength * 0.3);
  const pillowMat = new THREE.MeshStandardMaterial({ color: 0xfefef8 });
  for (let i = 0; i < 2; i++) {
    const pillow = new THREE.Mesh(pillowGeom, pillowMat);
    pillow.position.set(-3 + (i - 0.5) * bedWidth * 0.25, bedHeight * 0.45, -3 + bedLength * 0.3);
    pillow.castShadow = true;
    pillow.receiveShadow = true;
    scene.add(pillow);
  }

  furniture.bed = {
    position: new THREE.Vector3(-3, bedHeight * 0.35, -3),
    height: bedHeight
  };
}

function createDressingTable() {
  // Dressing table with fixed dimensions
  const dressingWidth = 1.2;
  const dressingLength = 0.9;
  const dressingHeight = 1.1;

  // Table top (brown)
  const tableGeom = new THREE.BoxGeometry(dressingWidth, dressingHeight * 0.08, dressingLength);
  const tableMat = new THREE.MeshStandardMaterial({ color: 0x8b6914 });
  const table = new THREE.Mesh(tableGeom, tableMat);
  table.position.set(3, dressingHeight * 0.5, -2.5);
  table.castShadow = true;
  table.receiveShadow = true;
  scene.add(table);

  // Table legs
  const legGeom = new THREE.BoxGeometry(dressingWidth * 0.1, dressingHeight * 0.45, dressingLength * 0.15);
  const legPositions = [
    [-dressingWidth * 0.4, 0],
    [dressingWidth * 0.4, 0],
    [-dressingWidth * 0.4, dressingLength * 0.3],
    [dressingWidth * 0.4, dressingLength * 0.3]
  ];
  legPositions.forEach(([x, z]) => {
    const leg = new THREE.Mesh(legGeom, tableMat);
    leg.position.set(3 + x, dressingHeight * 0.225, -2.5 + z);
    leg.castShadow = true;
    leg.receiveShadow = true;
    scene.add(leg);
  });

  // Broken mirror
  const mirrorGeom = new THREE.PlaneGeometry(dressingWidth * 0.85, dressingHeight * 0.4);
  const mirrorMat = new THREE.MeshStandardMaterial({
    color: 0x333333,
    metalness: 0.7,
    roughness: 0.8
  });
  const mirror = new THREE.Mesh(mirrorGeom, mirrorMat);
  mirror.position.set(3, dressingHeight * 0.75, -2.5 + dressingLength * 0.5 + 0.1);
  mirror.castShadow = true;
  scene.add(mirror);

  // Cracks on mirror (using canvas texture)
  const mirrorCanvas = document.createElement('canvas');
  mirrorCanvas.width = 256;
  mirrorCanvas.height = 256;
  const mirrorCtx = mirrorCanvas.getContext('2d');
  mirrorCtx.fillStyle = '#555555';
  mirrorCtx.fillRect(0, 0, 256, 256);
  
  // Draw cracks
  mirrorCtx.strokeStyle = '#000000';
  mirrorCtx.lineWidth = 2;
  mirrorCtx.beginPath();
  mirrorCtx.moveTo(128, 50);
  mirrorCtx.lineTo(100, 256);
  mirrorCtx.stroke();
  mirrorCtx.beginPath();
  mirrorCtx.moveTo(128, 50);
  mirrorCtx.lineTo(160, 256);
  mirrorCtx.stroke();

  const crackTexture = new THREE.CanvasTexture(mirrorCanvas);
  mirror.material.map = crackTexture;
}

function createStudyTable() {
  // Study table with fixed dimensions
  const studyWidth = 1.6;
  const studyLength = 1.2;
  const studyHeight = 0.65;

  // Table top
  const tableGeom = new THREE.BoxGeometry(studyWidth, studyHeight * 0.08, studyLength);
  const tableMat = new THREE.MeshStandardMaterial({ color: 0x8b6914 });
  const table = new THREE.Mesh(tableGeom, tableMat);
  table.position.set(2, studyHeight * 0.5, 3);
  table.castShadow = true;
  table.receiveShadow = true;
  scene.add(table);

  // Table legs
  const legGeom = new THREE.BoxGeometry(studyWidth * 0.1, studyHeight * 0.45, studyLength * 0.15);
  const legPositions = [
    [-studyWidth * 0.4, 0],
    [studyWidth * 0.4, 0],
    [-studyWidth * 0.4, studyLength * 0.4],
    [studyWidth * 0.4, studyLength * 0.4]
  ];
  legPositions.forEach(([x, z]) => {
    const leg = new THREE.Mesh(legGeom, tableMat);
    leg.position.set(2 + x, studyHeight * 0.225, 3 + z);
    leg.castShadow = true;
    leg.receiveShadow = true;
    scene.add(leg);
  });

  // Laptop (simple representation)
  const laptopGeom = new THREE.BoxGeometry(studyWidth * 0.5, studyHeight * 0.15, studyLength * 0.5);
  const laptopMat = new THREE.MeshStandardMaterial({ color: 0x222222 });
  const laptop = new THREE.Mesh(laptopGeom, laptopMat);
  laptop.position.set(2, studyHeight * 0.56, 3);
  laptop.castShadow = true;
  laptop.receiveShadow = true;
  scene.add(laptop);

  // Chair
  const chairGeom = new THREE.BoxGeometry(studyWidth * 0.4, PLAYER_HEIGHT * 0.6, studyLength * 0.4);
  const chairMat = new THREE.MeshStandardMaterial({ color: 0x4a4a4a });
  const chair = new THREE.Mesh(chairGeom, chairMat);
  chair.position.set(2 - studyWidth * 0.6, PLAYER_HEIGHT * 0.3, 3);
  chair.castShadow = true;
  chair.receiveShadow = true;
  scene.add(chair);
}

function startWakeupAnimation() {
  const wakeupMsg = document.getElementById('wakeupMessage');
  wakeupMsg.classList.remove('hidden');
  
  // Simulate waking up - camera moves from bed to standing
  const startPos = new THREE.Vector3(-3, 0.3, -3);
  const endPos = new THREE.Vector3(0, PLAYER_HEIGHT, 0);
  const duration = 3000; // 3 seconds
  const startTime = Date.now();

  function animateWakeup() {
    const elapsed = Date.now() - startTime;
    const progress = Math.min(elapsed / duration, 1);

    // Ease-in-out curve
    const easeProgress = progress < 0.5 
      ? 2 * progress * progress 
      : -1 + (4 - 2 * progress) * progress;

    camera.position.lerpVectors(startPos, endPos, easeProgress);
    camera.lookAt(0, PLAYER_HEIGHT, 0);

    if (progress < 1) {
      requestAnimationFrame(animateWakeup);
    } else {
      wakeupComplete = true;
      wakeupMsg.classList.add('hidden');
      document.getElementById('controlsHint').classList.remove('hidden');
    }
  }

  animateWakeup();
}

function togglePause() {
  if (!wakeupComplete) return;
  isPaused = !isPaused;
  document.getElementById('controlsHint').classList.toggle('hidden', isPaused);
}

function jump() {
  if (playerOnGround && !isPaused && wakeupComplete) {
    playerVelocityY = JUMP_FORCE;
    playerOnGround = false;
  }
}

function updatePlayerMovement() {
  const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
  const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);

  const movement = new THREE.Vector3();

  if (keys['w']) movement.add(forward.multiplyScalar(MOVE_SPEED));
  if (keys['s']) movement.add(forward.multiplyScalar(-MOVE_SPEED));
  if (keys['a']) movement.add(right.multiplyScalar(-MOVE_SPEED));
  if (keys['d']) movement.add(right.multiplyScalar(MOVE_SPEED));

  camera.position.add(movement);

  // Apply gravity
  const gravity = 9.81;
  playerVelocityY -= gravity * 0.016; // 60fps
  camera.position.y += playerVelocityY * 0.016;

  // Ground collision (keep player at eye height when on ground)
  if (camera.position.y <= PLAYER_HEIGHT) {
    camera.position.y = PLAYER_HEIGHT;
    playerVelocityY = 0;
    playerOnGround = true;
  } else {
    playerOnGround = false;
  }

  // Keep player in room (horizontal bounds)
  camera.position.x = Math.max(-ROOM_WIDTH / 2 + 0.3, Math.min(ROOM_WIDTH / 2 - 0.3, camera.position.x));
  camera.position.z = Math.max(-ROOM_DEPTH / 2 + 0.3, Math.min(ROOM_DEPTH / 2 - 0.3, camera.position.z));
}

function checkLightGaze() {
  const lightPos = new THREE.Vector3(ROOM_WIDTH / 2 - 1, ROOM_HEIGHT - 0.5, ROOM_DEPTH / 2 - 2);
  const directionToLight = lightPos.clone().sub(camera.position);
  const cameraDirection = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);

  const angle = cameraDirection.angleTo(directionToLight);
  const whitoutEl = document.getElementById('screenWhiteout');

  if (angle < 0.3) {
    // Looking at light
    const intensity = Math.max(0, 1 - angle / 0.3);
    whitoutEl.style.opacity = intensity * 0.8;
    whitoutEl.classList.remove('hidden');
  } else {
    // Fade out
    whitoutEl.style.opacity = Math.max(0, parseFloat(whitoutEl.style.opacity) - 0.05);
    if (parseFloat(whitoutEl.style.opacity) <= 0) {
      whitoutEl.classList.add('hidden');
    }
  }
}

function gameLoop() {
  requestAnimationFrame(gameLoop);

  if (isRunning && !isPaused && wakeupComplete) {
    updatePlayerMovement();
    checkLightGaze();
  }

  renderer.render(scene, camera);
}

function onWindowResize() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height);
}

// Start screen
document.getElementById('startBtn').addEventListener('click', () => {
  document.getElementById('startScreen').classList.add('hidden');
  isRunning = true;
  gameLoop();
});

document.getElementById('settingsBtn').addEventListener('click', () => {
  document.getElementById('settingsPanel').classList.remove('hidden');
});

document.getElementById('closeSettings').addEventListener('click', () => {
  document.getElementById('settingsPanel').classList.add('hidden');
});

// Initialize on load
window.addEventListener('load', initGame);
