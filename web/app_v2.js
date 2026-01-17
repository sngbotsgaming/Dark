// ===== THREE.JS Game Setup =====
let scene, camera, renderer;
let isRunning = false;
let isPaused = false;
let wakeupComplete = false;
let pointerLocked = false;

// Player state
const player = {
  pos: { x: 0, y: 1.7, z: 0 },
  vel: { x: 0, y: 0, z: 0 },
  onGround: false
};

// Room config
const ROOM = {
  width: 5,
  height: 4,
  depth: 5
};

// Movement config
const CONFIG = {
  moveSpeed: 0.08,
  mouseSensitivity: 0.003,
  gravity: 9.81,
  jumpForce: 8,
  eyeHeight: 1.7
};

// Keybinds (default)
const keys = {};
let keyBinds = {
  forward: 'KeyW',
  backward: 'KeyS',
  left: 'KeyA',
  right: 'KeyD',
  jump: 'Space',
  pause: 'KeyP'
};

let mouseLook = { x: 0, y: 0 };

// ===== Initialize Game =====
function initGame() {
  console.log("Initializing game...");
  
  // Scene
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x87ceeb);
  scene.fog = new THREE.Fog(0x87ceeb, 15, 25);

  // Camera
  camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
  );
  camera.position.set(0, CONFIG.eyeHeight, 0);

  // Renderer
  const container = document.getElementById('gameContainer');
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  container.appendChild(renderer.domElement);

  console.log("Scene created, adding lights...");

  // Lighting
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
  scene.add(ambientLight);

  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
  directionalLight.position.set(3, 3, -2);
  directionalLight.castShadow = true;
  scene.add(directionalLight);

  console.log("Creating room...");

  // Create room
  createRoom();
  createFurniture();

  console.log("Game initialized. Starting wake-up animation...");

  // Start wake-up animation
  startWakeupAnimation();

  // Setup event listeners
  setupEventListeners();

  // Start render loop
  gameLoop();
}

// ===== Room Creation =====
function createRoom() {
  // Floor - grey and black kite pattern
  const floorCanvas = document.createElement('canvas');
  floorCanvas.width = 256;
  floorCanvas.height = 256;
  const ctx = floorCanvas.getContext('2d');
  
  const tileSize = 32;
  for (let x = 0; x < 256; x += tileSize) {
    for (let y = 0; y < 256; y += tileSize) {
      ctx.fillStyle = ((x / tileSize) + (y / tileSize)) % 2 === 0 ? '#888888' : '#333333';
      ctx.fillRect(x, y, tileSize, tileSize);
    }
  }

  const floorTexture = new THREE.CanvasTexture(floorCanvas);
  floorTexture.repeat.set(2, 2);
  floorTexture.wrapS = THREE.RepeatWrapping;
  floorTexture.wrapT = THREE.RepeatWrapping;

  const floorGeom = new THREE.PlaneGeometry(ROOM.width, ROOM.depth);
  const floorMat = new THREE.MeshStandardMaterial({ map: floorTexture });
  const floor = new THREE.Mesh(floorGeom, floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  // Ceiling - white
  const ceilingGeom = new THREE.PlaneGeometry(ROOM.width, ROOM.depth);
  const ceilingMat = new THREE.MeshStandardMaterial({ color: 0xffffff });
  const ceiling = new THREE.Mesh(ceilingGeom, ceilingMat);
  ceiling.position.y = ROOM.height;
  ceiling.rotation.x = Math.PI / 2;
  ceiling.receiveShadow = true;
  scene.add(ceiling);

  // Walls - sky blue
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x87ceeb });

  // Back wall
  const backWallGeom = new THREE.PlaneGeometry(ROOM.width, ROOM.height);
  const backWall = new THREE.Mesh(backWallGeom, wallMat);
  backWall.position.z = -ROOM.depth / 2;
  backWall.position.y = ROOM.height / 2;
  backWall.receiveShadow = true;
  scene.add(backWall);

  // Front wall
  const frontWall = new THREE.Mesh(backWallGeom, wallMat);
  frontWall.position.z = ROOM.depth / 2;
  frontWall.position.y = ROOM.height / 2;
  frontWall.rotation.y = Math.PI;
  frontWall.receiveShadow = true;
  scene.add(frontWall);

  // Left wall
  const sideWallGeom = new THREE.PlaneGeometry(ROOM.depth, ROOM.height);
  const leftWall = new THREE.Mesh(sideWallGeom, wallMat);
  leftWall.position.x = -ROOM.width / 2;
  leftWall.position.y = ROOM.height / 2;
  leftWall.rotation.y = Math.PI / 2;
  leftWall.receiveShadow = true;
  scene.add(leftWall);

  // Right wall
  const rightWall = new THREE.Mesh(sideWallGeom, wallMat);
  rightWall.position.x = ROOM.width / 2;
  rightWall.position.y = ROOM.height / 2;
  rightWall.rotation.y = -Math.PI / 2;
  rightWall.receiveShadow = true;
  scene.add(rightWall);
}

// ===== Furniture =====
function createFurniture() {
  // Bed
  const bedGeom = new THREE.BoxGeometry(1.5, 0.8, 2);
  const bedMat = new THREE.MeshStandardMaterial({ color: 0x8b4513 });
  const bed = new THREE.Mesh(bedGeom, bedMat);
  bed.position.set(-1.5, 0.4, -2);
  bed.castShadow = true;
  bed.receiveShadow = true;
  scene.add(bed);

  // Red blanket
  const blanketGeom = new THREE.BoxGeometry(1.5, 0.15, 2);
  const blanketMat = new THREE.MeshStandardMaterial({ color: 0xff6347 });
  const blanket = new THREE.Mesh(blanketGeom, blanketMat);
  blanket.position.set(-1.5, 0.85, -2);
  blanket.castShadow = true;
  scene.add(blanket);

  // Dressing table
  const tableGeom = new THREE.BoxGeometry(1.2, 0.8, 0.9);
  const tableMat = new THREE.MeshStandardMaterial({ color: 0xd4a574 });
  const dressingTable = new THREE.Mesh(tableGeom, tableMat);
  dressingTable.position.set(1.5, 0.4, -1.5);
  dressingTable.castShadow = true;
  dressingTable.receiveShadow = true;
  scene.add(dressingTable);

  // Mirror
  const mirrorGeom = new THREE.PlaneGeometry(0.8, 1);
  const mirrorMat = new THREE.MeshStandardMaterial({ color: 0x444444, metalness: 0.3, roughness: 0.8 });
  const mirror = new THREE.Mesh(mirrorGeom, mirrorMat);
  mirror.position.set(1.5, 1.4, -1);
  mirror.castShadow = true;
  scene.add(mirror);

  // Study table
  const studyGeom = new THREE.BoxGeometry(2, 0.75, 1.2);
  const studyMat = new THREE.MeshStandardMaterial({ color: 0x654321 });
  const studyTable = new THREE.Mesh(studyGeom, studyMat);
  studyTable.position.set(-0.5, 0.4, 2);
  studyTable.castShadow = true;
  studyTable.receiveShadow = true;
  scene.add(studyTable);

  // Laptop on table
  const laptopGeom = new THREE.BoxGeometry(0.6, 0.15, 0.5);
  const laptopMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a });
  const laptop = new THREE.Mesh(laptopGeom, laptopMat);
  laptop.position.set(-0.5, 0.85, 2);
  laptop.castShadow = true;
  scene.add(laptop);

  // Chair
  const chairGeom = new THREE.BoxGeometry(0.8, 0.5, 0.8);
  const chairMat = new THREE.MeshStandardMaterial({ color: 0x2f2f2f });
  const chairSeat = new THREE.Mesh(chairGeom, chairMat);
  chairSeat.position.set(-0.5, 0.25, 2.8);
  chairSeat.castShadow = true;
  chairSeat.receiveShadow = true;
  scene.add(chairSeat);
}

// ===== Wake-up Animation =====
function startWakeupAnimation() {
  const whiteout = document.getElementById('screenWhiteout');
  whiteout.classList.remove('hidden');
  whiteout.style.opacity = '1';

  // Start on bed, looking at ceiling
  camera.position.set(-1.5, 1.2, -2);
  camera.rotation.x = Math.PI / 2; // Looking up

  let startTime = Date.now();

  function fade() {
    const elapsed = Date.now() - startTime;
    const progress = Math.min(elapsed / 2000, 1); // 2 second fade

    whiteout.style.opacity = String(1 - progress);

    if (progress < 1) {
      requestAnimationFrame(fade);
    } else {
      getUpAnimation();
    }
  }

  fade();
}

function getUpAnimation() {
  const startPos = new THREE.Vector3(-1.5, 1.2, -2);
  const endPos = new THREE.Vector3(0, CONFIG.eyeHeight, 0);
  const duration = 3000; // 3 seconds
  const startTime = Date.now();

  function animate() {
    const elapsed = Date.now() - startTime;
    const progress = Math.min(elapsed / duration, 1);

    // Ease-in-out
    const eased = progress < 0.5 ? 2 * progress * progress : -1 + (4 - 2 * progress) * progress;

    camera.position.lerpVectors(startPos, endPos, eased);
    camera.rotation.x = (Math.PI / 2) * (1 - eased); // Rotate from looking up to looking forward

    if (progress < 1) {
      requestAnimationFrame(animate);
    } else {
      wakeupComplete = true;
      document.getElementById('controlsHint').classList.remove('hidden');
    }
  }

  animate();
}

// ===== Event Listeners =====
function setupEventListeners() {
  // Keyboard
  document.addEventListener('keydown', (e) => {
    keys[e.code] = true;

    if (e.code === keyBinds.pause) {
      if (wakeupComplete) {
        isPaused = !isPaused;
        if (isPaused) {
          document.exitPointerLock?.();
        }
      }
    }

    if (e.code === keyBinds.jump && wakeupComplete && !isPaused) {
      if (player.onGround) {
        player.vel.y = CONFIG.jumpForce;
        player.onGround = false;
      }
    }
  });

  document.addEventListener('keyup', (e) => {
    keys[e.code] = false;
  });

  // Mouse look
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
    if (!pointerLocked || isPaused || !wakeupComplete) return;

    mouseLook.y -= e.movementX * CONFIG.mouseSensitivity;
    mouseLook.x -= e.movementY * CONFIG.mouseSensitivity;
    mouseLook.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, mouseLook.x));

    camera.rotation.order = 'YXZ';
    camera.rotation.y = mouseLook.y;
    camera.rotation.x = mouseLook.x;
  });

  // Window resize
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
}

// ===== Update & Render =====
function updatePlayer() {
  if (!isRunning || isPaused || !wakeupComplete) return;

  // Get forward/right vectors from camera
  const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
  forward.y = 0;
  forward.normalize();

  const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
  right.y = 0;
  right.normalize();

  // Movement
  let moveVec = new THREE.Vector3();
  if (keys[keyBinds.forward]) moveVec.add(forward);
  if (keys[keyBinds.backward]) moveVec.sub(forward);
  if (keys[keyBinds.right]) moveVec.add(right);
  if (keys[keyBinds.left]) moveVec.sub(right);

  if (moveVec.length() > 0) {
    moveVec.normalize();
    player.vel.x = moveVec.x * CONFIG.moveSpeed;
    player.vel.z = moveVec.z * CONFIG.moveSpeed;
  } else {
    player.vel.x *= 0.8;
    player.vel.z *= 0.8;
  }

  // Gravity
  player.vel.y -= CONFIG.gravity * 0.016;

  // Update position
  player.pos.x += player.vel.x;
  player.pos.y += player.vel.y;
  player.pos.z += player.vel.z;

  // Ground collision
  if (player.pos.y <= CONFIG.eyeHeight) {
    player.pos.y = CONFIG.eyeHeight;
    player.vel.y = 0;
    player.onGround = true;
  } else {
    player.onGround = false;
  }

  // Room bounds
  const margin = 0.3;
  player.pos.x = Math.max(-ROOM.width / 2 + margin, Math.min(ROOM.width / 2 - margin, player.pos.x));
  player.pos.z = Math.max(-ROOM.depth / 2 + margin, Math.min(ROOM.depth / 2 - margin, player.pos.z));

  camera.position.set(player.pos.x, player.pos.y, player.pos.z);
}

function gameLoop() {
  requestAnimationFrame(gameLoop);

  updatePlayer();

  renderer.render(scene, camera);
}

// ===== Start Game Handler =====
document.getElementById('startBtn').addEventListener('click', () => {
  console.log("Play button clicked!");
  document.getElementById('startScreen').classList.add('hidden');
  isRunning = true;
  initGame();
});

// Settings & other UI
document.getElementById('settingsBtn')?.addEventListener('click', () => {
  document.getElementById('settingsPanel').classList.toggle('hidden');
});

document.getElementById('closeSettings')?.addEventListener('click', () => {
  document.getElementById('settingsPanel').classList.add('hidden');
});

console.log("App loaded!");
