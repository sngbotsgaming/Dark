// Three.js First Person Room Escape Game
let scene, camera, renderer;
let player, room, furniture = {};
let isRunning = false;
let isPaused = false;
let wakeupComplete = false;

// Settings
const STORAGE_KEY = 'gameSettings';
const defaultSettings = {
  audio: 80,
  brightness: 100,
  renderDistance: 10,
  speed: 1,
  graphics: 'high',
  controls: { left: 'KeyA', right: 'KeyD', forward: 'KeyW', backward: 'KeyS', jump: 'Space', pause: 'KeyP' }
};

let settings = {};

// Load settings immediately
function loadSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...defaultSettings };
    const parsed = JSON.parse(raw);
    return { ...defaultSettings, ...parsed };
  } catch (e) { return { ...defaultSettings }; }
}

function saveSettings() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

settings = loadSettings();

// Room dimensions (5x4x5 meters - normal room size)
const ROOM_WIDTH = 5;
const ROOM_HEIGHT = 4;
const ROOM_DEPTH = 5;
const PLAYER_HEIGHT = 1.7; // Eye height (average human)
const PLAYER_JUMP_HEIGHT = PLAYER_HEIGHT * 0.5; // 0.85m jump

// Player movement
const keys = {};
const MOVE_SPEED = 0.08; // Smooth movement speed
const MOUSE_SENSITIVITY = 0.003; // Mouse look sensitivity
const JUMP_FORCE = Math.sqrt(2 * 9.81 * PLAYER_JUMP_HEIGHT); // Physics-based jump
const GRAVITY = 9.81;

let pointerLocked = false;
let mouseLook = { x: 0, y: 0 };
let playerVelocityY = 0;
let playerOnGround = true;
let keysBlacklist = {}; // For keybind capture

// Initialize game
function initGame() {
  // Scene setup
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x87ceeb); // Sky blue background
  scene.fog = new THREE.Fog(0x87ceeb, 15, 25);

  // Camera (first-person eye height)
  camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
  );
  camera.position.set(0, PLAYER_HEIGHT, 2); // Start looking at ceiling from bed

  // Renderer
  const container = document.getElementById('gameContainer');
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowShadowMap;
  renderer.shadowMap.mapSize.width = 2048;
  renderer.shadowMap.mapSize.height = 2048;
  container.appendChild(renderer.domElement);

  // Lighting
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
  scene.add(ambientLight);

  // Directional light (window sunlight)
  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
  directionalLight.position.set(3, 3, -2);
  directionalLight.castShadow = true;
  directionalLight.shadow.mapSize.width = 2048;
  directionalLight.shadow.mapSize.height = 2048;
  directionalLight.shadow.camera.far = 10;
  scene.add(directionalLight);

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

  // Load settings and key bindings
  applySettingsToUI();
  setupControls();

  // Start wake-up animation
  startWakeupAnimation();
}

function setupControls() {
  document.addEventListener('keydown', (e) => {
    if (keysBlacklist[e.code]) return; // Ignore keys in bind capture mode
    
    keys[e.code] = true;
    
    // Pause key
    if (e.code === settings.controls.pause) {
      e.preventDefault();
      togglePause();
    }
    // Jump key
    if (e.code === settings.controls.jump) {
      e.preventDefault();
      jump();
    }
  });

  document.addEventListener('keyup', (e) => {
    keys[e.code] = false;
  });

  // Pointer lock for mouse control
  renderer.domElement.addEventListener('click', () => {
    if (wakeupComplete && !isPaused) {
      renderer.domElement.requestPointerLock = renderer.domElement.requestPointerLock || renderer.domElement.mozRequestPointerLock;
      renderer.domElement.requestPointerLock();
    }
  });

  document.addEventListener('pointerlockchange', () => {
    pointerLocked = document.pointerLockElement === renderer.domElement;
  });

  document.addEventListener('mousemove', (e) => {
    if (!pointerLocked || !isRunning || isPaused || !wakeupComplete) return;

    const deltaX = e.movementX || 0;
    const deltaY = e.movementY || 0;

    // Update camera rotation with mouse
    mouseLook.y -= deltaX * MOUSE_SENSITIVITY;
    mouseLook.x -= deltaY * MOUSE_SENSITIVITY;

    // Clamp vertical look (prevent flipping)
    mouseLook.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, mouseLook.x));

    // Apply rotation
    camera.rotation.order = 'YXZ';
    camera.rotation.y = mouseLook.y;
    camera.rotation.x = mouseLook.x;
  });

  window.addEventListener('resize', onWindowResize);
}

function createRoom() {
  // Floor (grey and black kite pattern)
  const floorCanvas = document.createElement('canvas');
  floorCanvas.width = 256;
  floorCanvas.height = 256;
  const floorCtx = floorCanvas.getContext('2d');
  
  // Create kite/checkerboard pattern
  const kiteSize = 32;
  for (let x = 0; x < 256; x += kiteSize) {
    for (let y = 0; y < 256; y += kiteSize) {
      floorCtx.fillStyle = ((x / kiteSize) + (y / kiteSize)) % 2 === 0 ? '#888888' : '#333333';
      floorCtx.fillRect(x, y, kiteSize, kiteSize);
    }
  }
  
  const floorTexture = new THREE.CanvasTexture(floorCanvas);
  floorTexture.repeat.set(2, 2);
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

  // Walls (sky blue)
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x87ceeb });

  // Back wall
  const backWallGeom = new THREE.PlaneGeometry(ROOM_WIDTH, ROOM_HEIGHT);
  const backWall = new THREE.Mesh(backWallGeom, wallMat);
  backWall.position.z = -ROOM_DEPTH / 2;
  backWall.position.y = ROOM_HEIGHT / 2;
  backWall.receiveShadow = true;
  scene.add(backWall);

  // Front wall
  const frontWall = new THREE.Mesh(backWallGeom, wallMat);
  frontWall.position.z = ROOM_DEPTH / 2;
  frontWall.position.y = ROOM_HEIGHT / 2;
  frontWall.rotation.y = Math.PI;
  frontWall.receiveShadow = true;
  scene.add(frontWall);

  // Left wall
  const sideWallGeom = new THREE.PlaneGeometry(ROOM_DEPTH, ROOM_HEIGHT);
  const leftWall = new THREE.Mesh(sideWallGeom, wallMat);
  leftWall.position.x = -ROOM_WIDTH / 2;
  leftWall.position.y = ROOM_HEIGHT / 2;
  leftWall.rotation.y = Math.PI / 2;
  leftWall.receiveShadow = true;
  scene.add(leftWall);

  // Right wall
  const rightWall = new THREE.Mesh(sideWallGeom, wallMat);
  rightWall.position.x = ROOM_WIDTH / 2;
  rightWall.position.y = ROOM_HEIGHT / 2;
  rightWall.rotation.y = -Math.PI / 2;
  rightWall.receiveShadow = true;
  scene.add(rightWall);
}

function createBed() {
  // Bed dimensions (5% of room volume ≈ 0.5m³)
  const bedWidth = 1.5;
  const bedLength = 2.0;
  const bedHeight = 0.8;

  // Bed frame (brown wood)
  const bedFrameGeom = new THREE.BoxGeometry(bedWidth, bedHeight * 0.1, bedLength);
  const bedFrameMat = new THREE.MeshStandardMaterial({ color: 0x8b4513 });
  const bedFrame = new THREE.Mesh(bedFrameGeom, bedFrameMat);
  bedFrame.position.set(-1.5, bedHeight * 0.05, -2);
  bedFrame.castShadow = true;
  bedFrame.receiveShadow = true;
  scene.add(bedFrame);

  // Mattress
  const mattressGeom = new THREE.BoxGeometry(bedWidth - 0.1, bedHeight * 0.3, bedLength - 0.1);
  const mattressMat = new THREE.MeshStandardMaterial({ color: 0x654321 });
  const mattress = new THREE.Mesh(mattressGeom, mattressMat);
  mattress.position.set(-1.5, bedHeight * 0.2, -2);
  mattress.castShadow = true;
  mattress.receiveShadow = true;
  scene.add(mattress);

  // White sheet/bedcover
  const sheetGeom = new THREE.BoxGeometry(bedWidth - 0.15, bedHeight * 0.25, bedLength - 0.15);
  const sheetMat = new THREE.MeshStandardMaterial({ color: 0xff6347 }); // Red blanket
  const sheet = new THREE.Mesh(sheetGeom, sheetMat);
  sheet.position.set(-1.5, bedHeight * 0.35, -2);
  sheet.castShadow = true;
  sheet.receiveShadow = true;
  scene.add(sheet);

  // Pillows
  const pillowGeom = new THREE.BoxGeometry(bedWidth * 0.35, bedHeight * 0.15, bedLength * 0.3);
  const pillowMat = new THREE.MeshStandardMaterial({ color: 0xfefef8 });
  for (let i = 0; i < 2; i++) {
    const pillow = new THREE.Mesh(pillowGeom, pillowMat);
    pillow.position.set(-1.5 + (i - 0.5) * bedWidth * 0.25, bedHeight * 0.45, -2 + bedLength * 0.3);
    pillow.castShadow = true;
    pillow.receiveShadow = true;
    scene.add(pillow);
  }

  furniture.bed = {
    position: new THREE.Vector3(-1.5, bedHeight * 0.35, -2),
    width: bedWidth,
    length: bedLength
  };
}

function createDressingTable() {
  // Dressing table with fixed dimensions
  const dressingWidth = 1.2;
  const dressingLength = 0.9;
  const dressingHeight = 1.1;

  // Table top (light wood)
  const tableGeom = new THREE.BoxGeometry(dressingWidth, dressingHeight * 0.08, dressingLength);
  const tableMat = new THREE.MeshStandardMaterial({ color: 0xd4a574 });
  const table = new THREE.Mesh(tableGeom, tableMat);
  table.position.set(1.5, dressingHeight * 0.5, -1.5);
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
    leg.position.set(1.5 + x, dressingHeight * 0.225, -1.5 + z);
    leg.castShadow = true;
    leg.receiveShadow = true;
    scene.add(leg);
  });

  // Broken mirror (dark grey - no reflection)
  const mirrorGeom = new THREE.PlaneGeometry(dressingWidth * 0.85, dressingHeight * 0.5);
  const mirrorMat = new THREE.MeshStandardMaterial({
    color: 0x444444,
    metalness: 0.3,
    roughness: 0.8
  });
  const mirror = new THREE.Mesh(mirrorGeom, mirrorMat);
  mirror.position.set(1.5, dressingHeight * 0.75, -1.5 + dressingLength * 0.5 + 0.1);
  mirror.castShadow = true;
  scene.add(mirror);

  furniture.dressingTable = {
    position: new THREE.Vector3(1.5, dressingHeight * 0.5, -1.5),
    width: dressingWidth,
    length: dressingLength
  };
}

function createStudyTable() {
  // Study table (covers ~15% of room volume)
  const studyWidth = 2.0;
  const studyLength = 1.2;
  const studyHeight = 0.75;

  // Table top (dark wood)
  const tableGeom = new THREE.BoxGeometry(studyWidth, studyHeight * 0.08, studyLength);
  const tableMat = new THREE.MeshStandardMaterial({ color: 0x654321 });
  const table = new THREE.Mesh(tableGeom, tableMat);
  table.position.set(-0.5, studyHeight * 0.5, 2);
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
    leg.position.set(-0.5 + x, studyHeight * 0.225, 2 + z);
    leg.castShadow = true;
    leg.receiveShadow = true;
    scene.add(leg);
  });

  // Laptop on table
  const laptopGeom = new THREE.BoxGeometry(studyWidth * 0.5, studyHeight * 0.15, studyLength * 0.5);
  const laptopMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a });
  const laptop = new THREE.Mesh(laptopGeom, laptopMat);
  laptop.position.set(-0.5, studyHeight * 0.58, 2);
  laptop.castShadow = true;
  laptop.receiveShadow = true;
  scene.add(laptop);

  // Laptop screen
  const screenGeom = new THREE.BoxGeometry(studyWidth * 0.5, studyHeight * 0.3, 0.02);
  const screenMat = new THREE.MeshStandardMaterial({ color: 0x00ff00, emissive: 0x00aa00 });
  const screen = new THREE.Mesh(screenGeom, screenMat);
  screen.position.set(-0.5, studyHeight * 1.0, 2 - 0.05);
  screen.castShadow = true;
  scene.add(screen);

  // Chair (office chair)
  const chairSeatGeom = new THREE.BoxGeometry(studyWidth * 0.4, 0.5, studyLength * 0.5);
  const chairMat = new THREE.MeshStandardMaterial({ color: 0x2f2f2f });
  const chairSeat = new THREE.Mesh(chairSeatGeom, chairMat);
  chairSeat.position.set(-0.5, 0.25, 2 + studyLength * 0.6);
  chairSeat.castShadow = true;
  chairSeat.receiveShadow = true;
  scene.add(chairSeat);

  // Chair back
  const chairBackGeom = new THREE.BoxGeometry(studyWidth * 0.4, 1.0, 0.1);
  const chairBack = new THREE.Mesh(chairBackGeom, chairMat);
  chairBack.position.set(-0.5, 0.8, 2 + studyLength * 0.5);
  chairBack.castShadow = true;
  chairBack.receiveShadow = true;
  scene.add(chairBack);

  furniture.studyTable = {
    position: new THREE.Vector3(-0.5, studyHeight * 0.5, 2),
    width: studyWidth,
    length: studyLength
  };
}

function startWakeupAnimation() {
  const screenWhiteout = document.getElementById('screenWhiteout');
  screenWhiteout.classList.remove('hidden');
  screenWhiteout.style.opacity = '1';
  
  // Player starts on bed, lying down (looking at ceiling)
  camera.position.set(-1.5, 1.2, -2);
  
  // Fade in from white - eyes opening
  let fadeInProgress = 1;
  const fadeInDuration = 2000; // 2 seconds
  const fadeInStart = Date.now();

  function fadeIn() {
    const elapsed = Date.now() - fadeInStart;
    fadeInProgress = Math.max(0, 1 - elapsed / fadeInDuration);
    screenWhiteout.style.opacity = String(fadeInProgress);

    if (fadeInProgress > 0) {
      requestAnimationFrame(fadeIn);
    } else {
      // Getting up animation
      getUpFromBed();
    }
  }

  fadeIn();
}

function getUpFromBed() {
  // Animate getting up - camera moves from bed to standing position
  const startPos = new THREE.Vector3(-1.5, 1.2, -2);
  const endPos = new THREE.Vector3(0, PLAYER_HEIGHT, 0);
  const duration = 3000; // 3 seconds
  const startTime = Date.now();

  function animateGetUp() {
    const elapsed = Date.now() - startTime;
    const progress = Math.min(elapsed / duration, 1);

    // Ease-in-out curve for natural motion
    const easeProgress = progress < 0.5 
      ? 2 * progress * progress 
      : -1 + (4 - 2 * progress) * progress;

    // Interpolate camera position
    camera.position.lerpVectors(startPos, endPos, easeProgress);

    // Gradually look forward instead of at ceiling
    const lookAngle = (Math.PI / 2) * (1 - easeProgress);
    camera.rotation.x = lookAngle;

    if (progress < 1) {
      requestAnimationFrame(animateGetUp);
    } else {
      // Animation complete
      wakeupComplete = true;
      document.getElementById('controlsHint').classList.remove('hidden');
      playerOnGround = true;
      playerVelocityY = 0;
    }
  }

  animateGetUp();
}

function togglePause() {
  if (!wakeupComplete) return;
  isPaused = !isPaused;
  document.getElementById('controlsHint').classList.toggle('hidden', isPaused);
  if (isPaused) document.exitPointerLock?.();
}

function jump() {
  if (playerOnGround && !isPaused && wakeupComplete) {
    playerVelocityY = JUMP_FORCE;
    playerOnGround = false;
  }
}

function updatePlayerMovement() {
  if (!isRunning || isPaused || !wakeupComplete) return;

  const speedMult = (settings.speed || 1);
  const adjustedSpeed = MOVE_SPEED * speedMult;

  // Get forward and right vectors from camera direction
  const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
  forward.y = 0; // Lock to horizontal plane
  forward.normalize();

  const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
  right.y = 0;
  right.normalize();

  const movement = new THREE.Vector3();

  // Check key codes from settings
  if (keys[settings.controls.forward]) movement.add(forward.clone().multiplyScalar(adjustedSpeed));
  if (keys[settings.controls.backward]) movement.add(forward.clone().multiplyScalar(-adjustedSpeed));
  if (keys[settings.controls.right]) movement.add(right.clone().multiplyScalar(adjustedSpeed));
  if (keys[settings.controls.left]) movement.add(right.clone().multiplyScalar(-adjustedSpeed));

  camera.position.add(movement);

  // Apply gravity
  playerVelocityY -= GRAVITY * 0.016; // ~60fps
  camera.position.y += playerVelocityY * 0.016;

  // Ground collision
  if (camera.position.y <= PLAYER_HEIGHT) {
    camera.position.y = PLAYER_HEIGHT;
    playerVelocityY = 0;
    playerOnGround = true;
  } else {
    playerOnGround = false;
  }

  // Keep player in room bounds
  const margin = 0.3;
  camera.position.x = Math.max(-ROOM_WIDTH / 2 + margin, Math.min(ROOM_WIDTH / 2 - margin, camera.position.x));
  camera.position.z = Math.max(-ROOM_DEPTH / 2 + margin, Math.min(ROOM_DEPTH / 2 - margin, camera.position.z));

  // Simple furniture collision (basic AABB)
  checkFurnitureCollisions();
}

function checkFurnitureCollisions() {
  // Collision with bed
  if (furniture.bed) {
    const bed = furniture.bed;
    const dx = camera.position.x - bed.position.x;
    const dz = camera.position.z - bed.position.z;
    const minDist = 0.4;

    if (Math.abs(dx) < bed.width / 2 + minDist && Math.abs(dz) < bed.length / 2 + minDist) {
      if (Math.abs(dx) > Math.abs(dz)) {
        camera.position.x = bed.position.x + (dx > 0 ? bed.width / 2 + minDist : -bed.width / 2 - minDist);
      } else {
        camera.position.z = bed.position.z + (dz > 0 ? bed.length / 2 + minDist : -bed.length / 2 - minDist);
      }
    }
  }

  // Collision with dressing table
  if (furniture.dressingTable) {
    const table = furniture.dressingTable;
    const dx = camera.position.x - table.position.x;
    const dz = camera.position.z - table.position.z;
    const minDist = 0.4;

    if (Math.abs(dx) < table.width / 2 + minDist && Math.abs(dz) < table.length / 2 + minDist) {
      if (Math.abs(dx) > Math.abs(dz)) {
        camera.position.x = table.position.x + (dx > 0 ? table.width / 2 + minDist : -table.width / 2 - minDist);
      } else {
        camera.position.z = table.position.z + (dz > 0 ? table.length / 2 + minDist : -table.length / 2 - minDist);
      }
    }
  }

  // Collision with study table
  if (furniture.studyTable) {
    const table = furniture.studyTable;
    const dx = camera.position.x - table.position.x;
    const dz = camera.position.z - table.position.z;
    const minDist = 0.4;

    if (Math.abs(dx) < table.width / 2 + minDist && Math.abs(dz) < table.length / 2 + minDist) {
      if (Math.abs(dx) > Math.abs(dz)) {
        camera.position.x = table.position.x + (dx > 0 ? table.width / 2 + minDist : -table.width / 2 - minDist);
      } else {
        camera.position.z = table.position.z + (dz > 0 ? table.length / 2 + minDist : -table.length / 2 - minDist);
      }
    }
  }
}

function gameLoop() {
  requestAnimationFrame(gameLoop);

  updatePlayerMovement();

  renderer.render(scene, camera);
}

function onWindowResize() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height);
}

// ===== UI Event Listeners =====
const startBtn = document.getElementById('startBtn');
const settingsBtn = document.getElementById('settingsBtn');
const settingsPanel = document.getElementById('settingsPanel');
const closeSettings = document.getElementById('closeSettings');
const startScreen = document.getElementById('startScreen');

// Apply settings to UI on initialization
function applySettingsToUI() {
  document.getElementById('audioRange').value = settings.audio;
  document.getElementById('audioValue').textContent = settings.audio;
  document.getElementById('brightnessRange').value = settings.brightness;
  document.getElementById('brightnessValue').textContent = settings.brightness;
  document.getElementById('renderDistance').value = settings.renderDistance;
  document.getElementById('renderDistanceValue').textContent = settings.renderDistance;
  
  const speedSelect = document.getElementById('speedSelect');
  if (speedSelect) speedSelect.value = String(settings.speed || 1);
  document.getElementById('graphicsSelect').value = settings.graphics;
  
  applyBrightness();
}

function applyBrightness() {
  const overlay = document.getElementById('brightnessOverlay');
  if (!overlay) return;
  const b = Number(settings.brightness);
  overlay.style.opacity = String(1 - b/100);
}

startBtn.addEventListener('click', () => {
  startScreen.classList.add('hidden');
  isRunning = true;
  gameLoop();
});

settingsBtn?.addEventListener('click', () => {
  settingsPanel.classList.toggle('hidden');
});

closeSettings?.addEventListener('click', () => {
  settingsPanel.classList.add('hidden');
});

// Settings sliders
document.getElementById('audioRange')?.addEventListener('input', (e) => {
  const v = Number(e.target.value);
  settings.audio = v;
  document.getElementById('audioValue').textContent = String(v);
  saveSettings();
});

document.getElementById('brightnessRange')?.addEventListener('input', (e) => {
  const v = Number(e.target.value);
  settings.brightness = v;
  document.getElementById('brightnessValue').textContent = String(v);
  applyBrightness();
  saveSettings();
});

document.getElementById('renderDistance')?.addEventListener('input', (e) => {
  const v = Number(e.target.value);
  settings.renderDistance = v;
  document.getElementById('renderDistanceValue').textContent = String(v);
  saveSettings();
});

const speedSelectEl = document.getElementById('speedSelect');
if (speedSelectEl) {
  speedSelectEl.addEventListener('change', (e) => {
    settings.speed = Number(e.target.value);
    saveSettings();
  });
}

document.getElementById('graphicsSelect')?.addEventListener('change', (e) => {
  settings.graphics = e.target.value;
  saveSettings();
});

// Keybind capture
let waitingForKey = null;
document.querySelectorAll('.keybind-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    btn.textContent = 'Press a key...';
    waitingForKey = btn;
  });
});

window.addEventListener('keydown', (ev) => {
  if (waitingForKey) {
    ev.preventDefault();
    const action = waitingForKey.dataset.action;
    settings.controls[action] = ev.code;
    waitingForKey.textContent = humanKeyName(ev.code);
    waitingForKey = null;
    saveSettings();
  }
});

function humanKeyName(code) {
  if (!code) return '';
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (code === 'Space') return 'Space';
  return code;
}

// Reset/Apply settings
document.getElementById('resetDefaults')?.addEventListener('click', () => {
  settings = { ...defaultSettings };
  saveSettings();
  applySettingsToUI();
});

document.getElementById('applySettings')?.addEventListener('click', () => {
  saveSettings();
  applyBrightness();
});

// Initialize on page load
window.addEventListener('load', () => {
  applySettingsToUI();
  initGame();
});
