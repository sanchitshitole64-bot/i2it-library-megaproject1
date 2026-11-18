/**
 * International Institute of Information Technology, Hinjewadi (I²IT Pune)
 * Central Digital Library - 3D Virtual Twin Engine
 * Built with Three.js and OrbitControls
 */

class Library3DEngine {
  constructor(canvasContainerId) {
    this.container = document.getElementById(canvasContainerId);
    if (!this.container) {
      throw new Error(`Container #${canvasContainerId} not found`);
    }

    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.controls = null;

    // Interactive Raycaster
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    this.hoveredObject = null;
    this.interactiveObjects = [];

    // State
    this.isHeatmapMode = false;
    this.isNightMode = true;
    this.activeWayfindingPath = null;
    this.activeBeacon = null;
    this.occupantAvatars = [];
    this.rackMeshes = {};
    this.deskMeshes = {};
    this.zoneLabels = [];

    // Camera preset locations
    this.cameraPresets = {
      overview: { pos: new THREE.Vector3(0, 26, 28), target: new THREE.Vector3(0, 1, 0) },
      entrance: { pos: new THREE.Vector3(0, 6, 20), target: new THREE.Vector3(0, 1.2, 10) },
      wingA: { pos: new THREE.Vector3(-14, 8, 4), target: new THREE.Vector3(-9, 2, 0) },
      wingB: { pos: new THREE.Vector3(14, 8, 4), target: new THREE.Vector3(9, 2, 0) },
      readingHall: { pos: new THREE.Vector3(0, 9, -2), target: new THREE.Vector3(0, 1, -3) }
    };

    this.init();
  }

  init() {
    // 1. Scene setup
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0a0e17);
    this.scene.fog = new THREE.FogExp2(0x0a0e17, 0.015);

    // 2. Camera setup
    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;
    const aspect = width / height;
    this.camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 1000);
    this.camera.position.copy(this.cameraPresets.overview.pos);

    // 3. Renderer setup
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;
    this.container.appendChild(this.renderer.domElement);

    // 4. OrbitControls setup
    if (typeof THREE.OrbitControls !== 'undefined') {
      this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
      this.controls.enableDamping = true;
      this.controls.dampingFactor = 0.05;
      this.controls.maxPolarAngle = Math.PI / 2.05;
      this.controls.minDistance = 4;
      this.controls.maxDistance = 55;
      this.controls.target.copy(this.cameraPresets.overview.target);
    }

    // 5. Build 3D Architectural Scene Safely
    try {
      this.setupLighting();
      this.buildFloorAndWalls();
      this.buildEntranceTurnstiles();
      this.buildCirculationDesk();
      this.buildBookRacks();
      this.buildStudyTables();
      this.buildDigitalWorkstations();
      this.buildZoneLabelBadges();
      this.spawnSimulatedOccupants(38);
    } catch (e) {
      console.warn("Notice during 3D scene construction:", e);
    }

    // 6. Events
    window.addEventListener('resize', () => this.onWindowResize());
    if (window.ResizeObserver && this.container) {
      try {
        const ro = new ResizeObserver(() => this.onWindowResize());
        ro.observe(this.container);
      } catch (e) {}
    }
    setTimeout(() => this.onWindowResize(), 100);
    setTimeout(() => this.onWindowResize(), 500);
    this.renderer.domElement.addEventListener('mousemove', (e) => this.onMouseMove(e));
    this.renderer.domElement.addEventListener('click', (e) => this.onClick(e));

    // 7. Start render loop
    this.animate = this.animate.bind(this);
    requestAnimationFrame(this.animate);
  }

  setupLighting() {
    this.ambientLight = new THREE.AmbientLight(0x232d42, 1.4);
    this.scene.add(this.ambientLight);

    this.dirLight = new THREE.DirectionalLight(0xa5c9ff, 1.5);
    this.dirLight.position.set(15, 25, 20);
    this.dirLight.castShadow = true;
    this.dirLight.shadow.mapSize.width = 1024;
    this.dirLight.shadow.mapSize.height = 1024;
    this.dirLight.shadow.camera.near = 0.5;
    this.dirLight.shadow.camera.far = 70;
    this.dirLight.shadow.camera.left = -22;
    this.dirLight.shadow.camera.right = 22;
    this.dirLight.shadow.camera.top = 22;
    this.dirLight.shadow.camera.bottom = -22;
    this.dirLight.shadow.bias = -0.0005;
    this.scene.add(this.dirLight);

    const bluePoint = new THREE.PointLight(0x06b6d4, 1.8, 25);
    bluePoint.position.set(-8, 5, 0);
    this.scene.add(bluePoint);

    const purplePoint = new THREE.PointLight(0x8b5cf6, 1.8, 25);
    purplePoint.position.set(8, 5, 0);
    this.scene.add(purplePoint);

    const warmReadingLight = new THREE.PointLight(0xfef08a, 1.2, 20);
    warmReadingLight.position.set(0, 6, -3);
    this.scene.add(warmReadingLight);
  }

  buildFloorAndWalls() {
    const floorGeo = new THREE.PlaneGeometry(36, 36);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x111827,
      roughness: 0.35,
      metalness: 0.2
    });
    this.floorMesh = new THREE.Mesh(floorGeo, floorMat);
    this.floorMesh.rotation.x = -Math.PI / 2;
    this.floorMesh.receiveShadow = true;
    this.scene.add(this.floorMesh);

    const grid = new THREE.GridHelper(36, 36, 0x1e3a8a, 0x1e293b);
    grid.position.y = 0.01;
    this.scene.add(grid);

    const wallMat = new THREE.MeshPhysicalMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.15,
      roughness: 0.1,
      transmission: 0.8
    });

    const createWall = (w, h, d, x, y, z) => {
      const geo = new THREE.BoxGeometry(w, h, d);
      const mesh = new THREE.Mesh(geo, wallMat);
      mesh.position.set(x, y, z);
      this.scene.add(mesh);

      const railGeo = new THREE.BoxGeometry(w, 0.15, d);
      const railMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.8, roughness: 0.2 });
      const rail = new THREE.Mesh(railGeo, railMat);
      rail.position.set(x, y + h / 2, z);
      this.scene.add(rail);
    };

    createWall(36, 3, 0.3, 0, 1.5, -18);
    createWall(0.3, 3, 36, -18, 1.5, 0);
    createWall(0.3, 3, 36, 18, 1.5, 0);
    createWall(12, 3, 0.3, -12, 1.5, 18);
    createWall(12, 3, 0.3, 12, 1.5, 18);
  }

  buildEntranceTurnstiles() {
    this.turnstilesGroup = new THREE.Group();
    this.turnstilesGroup.name = "turnstile_gates";

    const stanchionMat = new THREE.MeshStandardMaterial({
      color: 0x334155,
      metalness: 0.9,
      roughness: 0.2
    });

    const glassFlapMat = new THREE.MeshPhysicalMaterial({
      color: 0x10b981,
      transparent: true,
      opacity: 0.7,
      roughness: 0.1
    });

    const laneWidth = 1.8;
    for (let i = -2; i <= 2; i++) {
      const x = i * laneWidth;
      const postGeo = new THREE.BoxGeometry(0.3, 1.2, 1.2);
      const post = new THREE.Mesh(postGeo, stanchionMat);
      post.position.set(x, 0.6, 14);
      post.castShadow = true;
      post.receiveShadow = true;
      this.turnstilesGroup.add(post);

      const rfidGeo = new THREE.BoxGeometry(0.2, 0.05, 0.3);
      const rfidMat = new THREE.MeshBasicMaterial({ color: 0x10b981 });
      const rfid = new THREE.Mesh(rfidGeo, rfidMat);
      rfid.position.set(x, 1.23, 14);
      this.turnstilesGroup.add(rfid);

      if (i < 2) {
        const flapGeo = new THREE.BoxGeometry(laneWidth * 0.7, 0.8, 0.06);
        const flap = new THREE.Mesh(flapGeo, glassFlapMat);
        flap.position.set(x + laneWidth / 2, 0.7, 14);
        this.turnstilesGroup.add(flap);
      }
    }

    const signGeo = new THREE.BoxGeometry(8, 0.6, 0.2);
    const signMat = new THREE.MeshStandardMaterial({ color: 0x1e3a8a, roughness: 0.3 });
    const sign = new THREE.Mesh(signGeo, signMat);
    sign.position.set(0, 3.2, 14);
    this.turnstilesGroup.add(sign);

    this.turnstilesGroup.userData = {
      type: "turnstile",
      title: "RFID Smart Turnstiles",
      desc: "Contactless Student Identity & Real-Time Entry/Exit Counting Gate."
    };
    this.interactiveObjects.push(this.turnstilesGroup);
    this.scene.add(this.turnstilesGroup);
  }

  buildCirculationDesk() {
    this.circDeskGroup = new THREE.Group();
    this.circDeskGroup.name = "circulation_desk";

    const counterGeo = new THREE.BoxGeometry(7, 1.1, 1.6);
    const counterMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      metalness: 0.3,
      roughness: 0.4
    });
    const counter = new THREE.Mesh(counterGeo, counterMat);
    counter.position.set(0, 0.55, 10.5);
    counter.castShadow = true;
    counter.receiveShadow = true;
    this.circDeskGroup.add(counter);

    const topGeo = new THREE.BoxGeometry(7.3, 0.08, 1.9);
    const topMat = new THREE.MeshStandardMaterial({
      color: 0xd97706,
      roughness: 0.3
    });
    const top = new THREE.Mesh(topGeo, topMat);
    top.position.set(0, 1.14, 10.5);
    this.circDeskGroup.add(top);

    const createPC = (xOffset) => {
      const screenGeo = new THREE.BoxGeometry(0.8, 0.5, 0.05);
      const screenMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
      const screen = new THREE.Mesh(screenGeo, screenMat);
      screen.position.set(xOffset, 1.55, 10.5);

      const standGeo = new THREE.CylinderGeometry(0.04, 0.06, 0.3, 8);
      const standMat = new THREE.MeshStandardMaterial({ color: 0x475569 });
      const stand = new THREE.Mesh(standGeo, standMat);
      stand.position.set(xOffset, 1.3, 10.5);

      this.circDeskGroup.add(screen);
      this.circDeskGroup.add(stand);
    };

    createPC(-1.8);
    createPC(1.8);

    this.circDeskGroup.userData = {
      type: "circ_desk",
      title: "Circulation & Help Desk",
      desc: "Librarian Issuance Terminal, Book Returns Chute & RFID Tagging Point."
    };
    this.interactiveObjects.push(this.circDeskGroup);
    this.scene.add(this.circDeskGroup);
  }

  buildBookRacks() {
    const rackConfigs = [
      { id: "RACK-A1", x: -10, z: -4, name: "Rack A-1 (Algorithms & CS Core)", color: 0x2563eb, wing: "Wing A" },
      { id: "RACK-A2", x: -10, z: 0, name: "Rack A-2 (Artificial Intelligence & ML)", color: 0x7c3aed, wing: "Wing A" },
      { id: "RACK-A3", x: -10, z: 4, name: "Rack A-3 (Networks & Operating Systems)", color: 0x059669, wing: "Wing A" },
      { id: "RACK-A4", x: -6, z: -8, name: "Rack A-4 (Electronics & Embedded Systems)", color: 0x4f46e5, wing: "Wing A" },

      { id: "RACK-B1", x: 10, z: -4, name: "Rack B-1 (Database & Big Data)", color: 0xd97706, wing: "Wing B" },
      { id: "RACK-B2", x: 10, z: 0, name: "Rack B-2 (Distributed Systems & Cloud)", color: 0xe11d48, wing: "Wing B" },
      { id: "RACK-B3", x: 10, z: 4, name: "Rack B-3 (Cybersecurity & Information Security)", color: 0x0284c7, wing: "Wing B" },
      { id: "RACK-B4", x: 6, z: -8, name: "Rack B-4 (Applied Sciences & GATE)", color: 0x16a34a, wing: "Wing B" }
    ];

    rackConfigs.forEach(cfg => {
      const rackGroup = this.createSingleRack(cfg);
      this.rackMeshes[cfg.id] = rackGroup;
      this.interactiveObjects.push(rackGroup);
      this.scene.add(rackGroup);
    });
  }

  createSingleRack(config) {
    const rack = new THREE.Group();
    rack.position.set(config.x, 0, config.z);
    rack.name = config.id;
    rack.userData = {
      type: "rack",
      rackId: config.id,
      name: config.name,
      wing: config.wing
    };

    const rackWidth = 4.2;
    const rackHeight = 3.6;
    const rackDepth = 1.0;

    const frameMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      metalness: 0.7,
      roughness: 0.3
    });

    const sideGeo = new THREE.BoxGeometry(0.12, rackHeight, rackDepth);
    const leftSide = new THREE.Mesh(sideGeo, frameMat);
    leftSide.position.set(-rackWidth / 2, rackHeight / 2, 0);
    leftSide.castShadow = true;
    rack.add(leftSide);

    const rightSide = new THREE.Mesh(sideGeo, frameMat);
    rightSide.position.set(rackWidth / 2, rackHeight / 2, 0);
    rightSide.castShadow = true;
    rack.add(rightSide);

    const shelfGeo = new THREE.BoxGeometry(rackWidth, 0.08, rackDepth);
    const tiers = 4;
    for (let t = 1; t <= tiers; t++) {
      const shelfY = (rackHeight / tiers) * (t - 0.2);
      const shelf = new THREE.Mesh(shelfGeo, frameMat);
      shelf.position.set(0, shelfY, 0);
      shelf.castShadow = true;
      shelf.receiveShadow = true;
      rack.add(shelf);

      this.addBooksToShelf(rack, rackWidth - 0.4, shelfY + 0.04, config.color);
    }

    const placardGeo = new THREE.BoxGeometry(1.8, 0.4, 0.05);
    const placardMat = new THREE.MeshBasicMaterial({ color: config.color });
    const placard = new THREE.Mesh(placardGeo, placardMat);
    placard.position.set(0, rackHeight + 0.25, 0);
    rack.add(placard);

    return rack;
  }

  addBooksToShelf(parentGroup, shelfLength, baseY, baseColorHex) {
    const bookColors = [
      baseColorHex,
      0x1e40af, 0x4338ca, 0x6b21a8, 0x991b1b, 0x065f46, 0x0f766e, 0x1e293b, 0x374151
    ];

    let currentX = -shelfLength / 2;
    while (currentX < shelfLength / 2 - 0.2) {
      const bookWidth = 0.06 + Math.random() * 0.05;
      const bookHeight = 0.55 + Math.random() * 0.15;
      const bookDepth = 0.65 + Math.random() * 0.1;
      const col = bookColors[Math.floor(Math.random() * bookColors.length)];

      const bGeo = new THREE.BoxGeometry(bookWidth, bookHeight, bookDepth);
      const bMat = new THREE.MeshStandardMaterial({
        color: col,
        roughness: 0.6
      });
      const book = new THREE.Mesh(bGeo, bMat);
      book.position.set(currentX + bookWidth / 2, baseY + bookHeight / 2, 0);
      book.castShadow = true;
      parentGroup.add(book);

      currentX += bookWidth + 0.012;
    }
  }

  buildStudyTables() {
    const tableCoords = [
      { id: "DESK-01", x: -3.5, z: -3.5, name: "Silent Study Pod Alpha" },
      { id: "DESK-02", x: 3.5, z: -3.5, name: "Silent Study Pod Beta" },
      { id: "DESK-03", x: -3.5, z: 1.5, name: "Silent Study Pod Gamma" },
      { id: "DESK-04", x: 3.5, z: 1.5, name: "Silent Study Pod Delta" }
    ];

    tableCoords.forEach(c => {
      const deskGroup = this.createStudyDesk(c);
      this.deskMeshes[c.id] = deskGroup;
      this.scene.add(deskGroup);
    });
  }

  createStudyDesk(config) {
    const group = new THREE.Group();
    group.position.set(config.x, 0, config.z);
    group.name = config.id;
    group.userData = {
      type: "desk",
      deskId: config.id,
      name: config.name
    };

    const topGeo = new THREE.BoxGeometry(3.6, 0.08, 1.8);
    const topMat = new THREE.MeshStandardMaterial({
      color: 0x334155,
      roughness: 0.3
    });
    const top = new THREE.Mesh(topGeo, topMat);
    top.position.y = 0.85;
    top.castShadow = true;
    top.receiveShadow = true;
    group.add(top);

    const legGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.85, 8);
    const legMat = new THREE.MeshStandardMaterial({ color: 0x64748b, metalness: 0.8 });
    const legOffsets = [
      [-1.6, -0.7], [1.6, -0.7], [-1.6, 0.7], [1.6, 0.7]
    ];
    legOffsets.forEach(([lx, lz]) => {
      const leg = new THREE.Mesh(legGeo, legMat);
      leg.position.set(lx, 0.425, lz);
      group.add(leg);
    });

    const divGeo = new THREE.BoxGeometry(3.4, 0.35, 0.04);
    const divMat = new THREE.MeshStandardMaterial({ color: 0x0ea5e9, roughness: 0.7 });
    const divider = new THREE.Mesh(divGeo, divMat);
    divider.position.set(0, 1.05, 0);
    group.add(divider);

    const lampGeo = new THREE.CylinderGeometry(0.08, 0.15, 0.12, 12);
    const lampMat = new THREE.MeshBasicMaterial({ color: 0xfef08a });

    const lamp1 = new THREE.Mesh(lampGeo, lampMat);
    lamp1.position.set(-1.0, 1.25, 0);
    group.add(lamp1);

    const lamp2 = new THREE.Mesh(lampGeo, lampMat);
    lamp2.position.set(1.0, 1.25, 0);
    group.add(lamp2);

    const chairOffsets = [
      [-1.0, -1.2, 0], [1.0, -1.2, 0],
      [-1.0, 1.2, Math.PI], [1.0, 1.2, Math.PI]
    ];
    chairOffsets.forEach(([cx, cz, rot]) => {
      const chair = this.createChair();
      chair.position.set(cx, 0, cz);
      chair.rotation.y = rot;
      group.add(chair);
    });

    return group;
  }

  createChair() {
    const chair = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.5 });

    const seatGeo = new THREE.BoxGeometry(0.5, 0.06, 0.5);
    const seat = new THREE.Mesh(seatGeo, mat);
    seat.position.y = 0.5;
    chair.add(seat);

    const backGeo = new THREE.BoxGeometry(0.5, 0.5, 0.05);
    const back = new THREE.Mesh(backGeo, mat);
    back.position.set(0, 0.75, -0.23);
    chair.add(back);

    const stemGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.5, 8);
    const stemMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.8 });
    const stem = new THREE.Mesh(stemGeo, stemMat);
    stem.position.y = 0.25;
    chair.add(stem);
    return chair;
  }

  buildDigitalWorkstations() {
    const labGroup = new THREE.Group();
    labGroup.position.set(0, 0, -13);
    labGroup.userData = {
      type: "digital_lab",
      title: "E-Resource & IEEE Terminal Pods",
      desc: "High-performance research workstations connected to international digital libraries."
    };

    const tableGeo = new THREE.BoxGeometry(14, 0.08, 1.6);
    const tableMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.4, roughness: 0.2 });
    const table = new THREE.Mesh(tableGeo, tableMat);
    table.position.y = 0.85;
    table.castShadow = true;
    labGroup.add(table);

    for (let i = -2.5; i <= 2.5; i += 1) {
      const pcX = i * 2.2;
      const screenGeo = new THREE.BoxGeometry(0.7, 0.45, 0.03);
      const screenMat = new THREE.MeshBasicMaterial({ color: 0x06b6d4 });
      const scr = new THREE.Mesh(screenGeo, screenMat);
      scr.position.set(pcX, 1.25, -0.4);
      labGroup.add(scr);
    }

    this.interactiveObjects.push(labGroup);
    this.scene.add(labGroup);
  }

  buildZoneLabelBadges() {
    if (typeof LIBRARY_ZONES === 'undefined') return;
    LIBRARY_ZONES.forEach(z => {
      const badge = this.createFloatingTextBadge(z.name, z.color);
      badge.position.set(z.center3D.x, 4.2, z.center3D.z);
      this.zoneLabels.push(badge);
      this.scene.add(badge);
    });
  }

  createFloatingTextBadge(text, colorHex) {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');

    // Safe cross-browser background drawing
    ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
    if (typeof ctx.roundRect === 'function') {
      ctx.roundRect(10, 10, 492, 108, 25);
    } else {
      ctx.rect(10, 10, 492, 108);
    }
    ctx.fill();

    ctx.strokeStyle = colorHex;
    ctx.lineWidth = 6;
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 28px "Space Grotesk", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 256, 64);

    const texture = new THREE.CanvasTexture(canvas);
    const spriteMat = new THREE.SpriteMaterial({ map: texture, transparent: true });
    const sprite = new THREE.Sprite(spriteMat);
    sprite.scale.set(4.8, 1.2, 1);
    return sprite;
  }

  spawnSimulatedOccupants(count = 35) {
    this.occupantAvatars.forEach(a => this.scene.remove(a));
    this.occupantAvatars = [];

    const avatarMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      roughness: 0.3,
      emissive: 0x0284c7,
      emissiveIntensity: 0.2
    });

    const headMat = new THREE.MeshStandardMaterial({ color: 0xbae6fd });

    // Universal geometry supported in all Three.js versions!
    const bodyGeo = new THREE.CylinderGeometry(0.18, 0.18, 0.7, 10);
    const headGeo = new THREE.SphereGeometry(0.14, 10, 10);

    const locations = [
      { x: -0.9, z: 16.5 },
      { x: 0.9, z: 17.5 },
      { x: -0.2, z: 15.5 },
      { x: -1.2, z: 9.5 },
      { x: 1.0, z: 9.5 },
      { x: -8.2, z: -3.8 },
      { x: -11.5, z: 0.2 },
      { x: -8.0, z: 3.5 },
      { x: -5.2, z: -7.5 },
      { x: 8.2, z: -3.8 },
      { x: 11.5, z: 0.2 },
      { x: 8.0, z: 3.5 },
      { x: 5.2, z: -7.5 },
      { x: -4.5, z: -3.5 },
      { x: -2.5, z: -3.5 },
      { x: 2.5, z: -3.5 },
      { x: 4.5, z: -3.5 },
      { x: -4.5, z: 1.5 },
      { x: -2.5, z: 1.5 },
      { x: 2.5, z: 1.5 },
      { x: 4.5, z: 1.5 },
      { x: -4.0, z: -12.2 },
      { x: -1.8, z: -12.2 },
      { x: 1.8, z: -12.2 },
      { x: 4.0, z: -12.2 }
    ];

    const actualCount = Math.min(count, locations.length);
    for (let i = 0; i < actualCount; i++) {
      const loc = locations[i];
      const person = new THREE.Group();

      const body = new THREE.Mesh(bodyGeo, avatarMat);
      body.position.y = 0.35;
      body.castShadow = true;
      person.add(body);

      const head = new THREE.Mesh(headGeo, headMat);
      head.position.y = 0.8;
      head.castShadow = true;
      person.add(head);

      person.position.set(loc.x + (Math.random() - 0.5) * 0.4, 0, loc.z + (Math.random() - 0.5) * 0.4);
      this.scene.add(person);
      this.occupantAvatars.push(person);
    }
  }

  // =========================================================================
  // Book Location 3D Pinpoint & Wayfinding Path
  // =========================================================================
  highlightBookLocation(book) {
    this.clearWayfinding();

    const targetCoords = book.rackCoords;

    const camTarget = new THREE.Vector3(targetCoords.x, 1.8, targetCoords.z);
    const camPosOffset = targetCoords.x < 0 ? new THREE.Vector3(3.5, 1.8, 0) : new THREE.Vector3(-3.5, 1.8, 0);
    const desiredCamPos = new THREE.Vector3().copy(camTarget).add(camPosOffset);

    this.smoothMoveCamera(desiredCamPos, camTarget, 1400);

    this.activeBeacon = this.createHolographicBeacon(targetCoords, book.title, book.shelfTier);
    this.scene.add(this.activeBeacon);

    this.activeWayfindingPath = this.createWayfindingPath(
      new THREE.Vector3(0, 0.05, 14),
      new THREE.Vector3(targetCoords.x, 0.05, targetCoords.z)
    );
    this.scene.add(this.activeWayfindingPath);
  }

  createHolographicBeacon(coords, title, tier) {
    const beacon = new THREE.Group();
    beacon.position.set(coords.x, coords.y + 1.2, coords.z);

    const diamondGeo = new THREE.OctahedronGeometry(0.35, 0);
    const diamondMat = new THREE.MeshBasicMaterial({ color: 0x06b6d4, wireframe: false });
    const diamond = new THREE.Mesh(diamondGeo, diamondMat);
    beacon.add(diamond);

    const ringGeo = new THREE.RingGeometry(0.4, 0.55, 32);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.8
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = -0.5;
    beacon.add(ring);

    const laserGeo = new THREE.CylinderGeometry(0.04, 0.04, 2.0, 16);
    const laserMat = new THREE.MeshBasicMaterial({
      color: 0x06b6d4,
      transparent: true,
      opacity: 0.75
    });
    const laser = new THREE.Mesh(laserGeo, laserMat);
    laser.position.y = -1.0;
    beacon.add(laser);

    // 3D Floating Shelf Number Showcase Badge above the targeted shelf
    const shelfBadge = this.createFloatingTextBadge(`SHELF NUMBER: #${tier}`, '#06b6d4');
    shelfBadge.position.set(0, 0.9, 0);
    shelfBadge.scale.set(3.4, 0.85, 1);
    beacon.add(shelfBadge);

    beacon.userData = {
      diamond: diamond,
      ring: ring,
      baseY: beacon.position.y
    };

    return beacon;
  }

  createWayfindingPath(start, end) {
    const waypoints = [
      start,
      new THREE.Vector3(start.x, 0.05, 9.5),
      new THREE.Vector3(end.x < 0 ? -4.5 : 4.5, 0.05, 9.5),
      new THREE.Vector3(end.x < 0 ? -4.5 : 4.5, 0.05, end.z),
      end
    ];

    const curve = new THREE.CatmullRomCurve3(waypoints, false, 'catmullrom', 0.1);
    const points = curve.getPoints(70);
    const geometry = new THREE.BufferGeometry().setFromPoints(points);

    const material = new THREE.LineDashedMaterial({
      color: 0x06b6d4,
      linewidth: 3,
      scale: 1,
      dashSize: 0.4,
      gapSize: 0.2
    });

    const line = new THREE.Line(geometry, material);
    line.computeLineDistances();

    const tubeGeo = new THREE.TubeGeometry(curve, 64, 0.06, 8, false);
    const tubeMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.5
    });
    const tube = new THREE.Mesh(tubeGeo, tubeMat);

    const pathGroup = new THREE.Group();
    pathGroup.add(line);
    pathGroup.add(tube);
    return pathGroup;
  }

  clearWayfinding() {
    if (this.activeBeacon) {
      this.scene.remove(this.activeBeacon);
      this.activeBeacon = null;
    }
    if (this.activeWayfindingPath) {
      this.scene.remove(this.activeWayfindingPath);
      this.activeWayfindingPath = null;
    }
  }

  // =========================================================================
  // Heatmap View Mode
  // =========================================================================
  toggleHeatmapMode() {
    this.isHeatmapMode = !this.isHeatmapMode;
    const thermalColors = [0x10b981, 0x3b82f6, 0xf59e0b, 0xef4444];

    Object.values(this.rackMeshes).forEach((rack, idx) => {
      const color = this.isHeatmapMode ? thermalColors[idx % thermalColors.length] : 0x1e293b;
      rack.traverse(child => {
        if (child.isMesh && child.material && child.geometry.type === 'BoxGeometry') {
          if (this.isHeatmapMode) {
            child.userData.origColor = child.material.color.getHex();
            child.material.color.setHex(color);
            child.material.emissive = new THREE.Color(color);
            child.material.emissiveIntensity = 0.35;
          } else {
            child.material.emissiveIntensity = 0;
            if (child.userData.origColor) {
              child.material.color.setHex(child.userData.origColor);
            }
          }
        }
      });
    });

    return this.isHeatmapMode;
  }

  // =========================================================================
  // Night / Day Lighting Toggle
  // =========================================================================
  toggleLighting() {
    this.isNightMode = !this.isNightMode;
    if (this.isNightMode) {
      this.scene.background.setHex(0x0a0e17);
      this.ambientLight.color.setHex(0x232d42);
      this.ambientLight.intensity = 1.4;
      this.dirLight.intensity = 1.2;
    } else {
      this.scene.background.setHex(0x1e293b);
      this.ambientLight.color.setHex(0x94a3b8);
      this.ambientLight.intensity = 2.4;
      this.dirLight.intensity = 2.8;
    }
    return this.isNightMode;
  }

  // =========================================================================
  // Camera Navigation & Presets
  // =========================================================================
  setCameraPreset(presetKey) {
    const targetConfig = this.cameraPresets[presetKey] || this.cameraPresets.overview;
    this.smoothMoveCamera(targetConfig.pos, targetConfig.target, 1200);
  }

  recenterView() {
    this.setCameraPreset('overview');
  }

  smoothMoveCamera(endPos, endTarget, duration = 1000) {
    if (typeof TWEEN !== 'undefined' && TWEEN.Tween) {
      new TWEEN.Tween(this.camera.position)
        .to(endPos, duration)
        .easing(TWEEN.Easing.Cubic.Out)
        .start();

      if (this.controls) {
        new TWEEN.Tween(this.controls.target)
          .to(endTarget, duration)
          .easing(TWEEN.Easing.Cubic.Out)
          .start();
      }
    } else {
      this.camera.position.copy(endPos);
      if (this.controls) {
        this.controls.target.copy(endTarget);
      }
    }
  }

  // =========================================================================
  // Interaction & Raycasting
  // =========================================================================
  onMouseMove(event) {
    if (!this.container || !this.renderer) return;
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.mouse, this.camera);
    const intersects = this.raycaster.intersectObjects(this.interactiveObjects, true);

    if (intersects.length > 0) {
      let obj = intersects[0].object;
      while (obj.parent && !obj.userData.type && obj.parent !== this.scene) {
        obj = obj.parent;
      }

      if (obj.userData && obj.userData.type) {
        this.container.style.cursor = 'pointer';
        return;
      }
    }
    this.container.style.cursor = 'default';
  }

  onClick(event) {
    if (!this.container || !this.renderer) return;
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.mouse, this.camera);
    const intersects = this.raycaster.intersectObjects(this.interactiveObjects, true);

    if (intersects.length > 0) {
      let obj = intersects[0].object;
      while (obj.parent && !obj.userData.type && obj.parent !== this.scene) {
        obj = obj.parent;
      }

      if (obj.userData && obj.userData.type) {
        window.dispatchEvent(new CustomEvent('3d-object-clicked', { detail: obj.userData }));
      }
    }
  }

  onWindowResize() {
    if (!this.container || !this.renderer || !this.camera) return;
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    if (width === 0 || height === 0) return;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  // =========================================================================
  // Render Loop
  // =========================================================================
  animate(timestamp) {
    requestAnimationFrame(this.animate);

    if (typeof TWEEN !== 'undefined' && TWEEN.update) {
      TWEEN.update();
    }

    if (this.controls) {
      this.controls.update();
    }

    if (this.activeBeacon && this.activeBeacon.userData) {
      const bData = this.activeBeacon.userData;
      const time = (timestamp || 0) * 0.003;
      if (bData.diamond) bData.diamond.rotation.y += 0.03;
      this.activeBeacon.position.y = bData.baseY + Math.sin(time) * 0.15;
      if (bData.ring) bData.ring.scale.setScalar(1 + Math.sin(time * 2) * 0.15);
    }

    if (this.zoneLabels) {
      this.zoneLabels.forEach((label, i) => {
        label.position.y = 4.2 + Math.sin((timestamp || 0) * 0.0015 + i) * 0.1;
      });
    }

    if (this.renderer && this.scene && this.camera) {
      this.renderer.render(this.scene, this.camera);
    }
  }
}
