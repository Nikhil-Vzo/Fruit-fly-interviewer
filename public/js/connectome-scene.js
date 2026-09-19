/**
 * 3D Drosophila Anatomy & Janelia Connectome Neural Viewport
 *
 * Direct Janelia & FlyWire Integration:
 * 1. Micro-CT anatomical adult Drosophila meshes (TuragaLab/flybody):
 *    - drosophila_head.obj, thorax.obj, abdomen_1.obj, abdomen_2.obj, abdomen_3.obj
 *    - wing_left.obj, wing_right.obj, antenna_left.obj, antenna_right.obj, haltere_left.obj, haltere_right.obj
 * 2. Janelia Research Campus JRC2018 Template Brain (natverse/nat.flybrains):
 *    - jrc2018_brain.obj holographic glassmorphic neuropil shell
 * 3. Authentic FlyWire & Hemibrain Connectome Skeletons (connectome_neurons.json):
 *    - Exact axonal/dendritic arborizations parsed from PyMaid SWC reconstructions
 * 4. Biophysical modulation:
 *    - Central Complex EB/PB ring attractor & Mushroom Body Kenyon cell pulses
 *    - Giant Fiber escape jump & wing buzzing driven by Izhikevich ODE solver
 */

class ConnectomeScene {
  constructor(containerElement) {
    this.container = containerElement;
    this.animationState = 'IDLE'; // IDLE, GROOMING, AGITATED, ESCAPE_JUMP
    this.stateTimer = 0;
    this.wingbeatHz = 120.0;
    this.dopamineGlow = 0.1;
    this.octopamineGlow = 0.1;
    this.giantFiberActive = false;

    this.loadedParts = {};
    this.neuronLines = [];
    this.actionSparks = [];

    this.initThree();
    this.buildConnectomeNeuropils();
    this.loadAuthenticJaneliaConnectome();
    this.loadAuthenticFlyBody();

    this.animate = this.animate.bind(this);
    requestAnimationFrame(this.animate);

    window.addEventListener('resize', () => this.onResize());
  }

  initThree() {
    const width = this.container.clientWidth || window.innerWidth / 2;
    const height = this.container.clientHeight || window.innerHeight;

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x030712, 0.035);

    this.camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 100);
    // Camera framing the fly in dramatic 3/4 laboratory perspective
    this.camera.position.set(2.8, 1.8, 4.2);
    this.camera.lookAt(0, 0.0, 0);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.35;
    this.container.appendChild(this.renderer.domElement);

    // Multi-Point Holographic Lighting
    const ambientLight = new THREE.AmbientLight(0x0f172a, 1.9);
    this.scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0x38bdf8, 2.4); // Cyan synaptic key light
    keyLight.position.set(4, 7, 4);
    this.scene.add(keyLight);

    const crimsonAlarm = new THREE.DirectionalLight(0xf43f5e, 1.6); // Crimson escape alarm light
    crimsonAlarm.position.set(-4, -2, -3);
    this.scene.add(crimsonAlarm);

    const emeraldRim = new THREE.DirectionalLight(0x10b981, 1.5); // Emerald dopamine rim light
    emeraldRim.position.set(0, 5, -4);
    this.scene.add(emeraldRim);

    // Fly Master Hierarchy
    // Root handles world positioning, hover levitation, and idle yaw rotation
    this.flyRoot = new THREE.Group();
    this.flyRoot.position.set(0, -0.15, 0);
    this.flyRoot.rotation.y = -0.42; // Hero 3/4 turn towards camera
    this.scene.add(this.flyRoot);

    // FlyGroup transforms FlyBody coordinate system (Z=dorsal, -X=head, Y=lateral)
    // into Three.js coordinate system (Y=up, +Z=forward to camera, X=lateral)
    this.flyGroup = new THREE.Group();
    this.flyGroup.rotation.x = -Math.PI / 2;
    this.flyGroup.rotation.z = -Math.PI / 2;
    // Scale slightly for optimum framing in viewport
    this.flyGroup.scale.set(0.9, 0.9, 0.9);
    // Center the thoracic mass at origin (FlyBody thorax center is around X=0, Y=0, Z=1.18)
    this.flyGroup.position.set(0, -1.05, 0);
    this.flyRoot.add(this.flyGroup);
  }

  onResize() {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  loadAuthenticFlyBody() {
    if (typeof THREE.OBJLoader === 'undefined') {
      console.warn('OBJLoader not found, using fallback anatomical primitives.');
      this.buildFallbackAnatomy();
      return;
    }

    const loader = new THREE.OBJLoader();

    // Natural Drosophila melanogaster amber chitin PBR material
    const chitinMat = new THREE.MeshStandardMaterial({
      color: 0x8a5526,
      roughness: 0.38,
      metalness: 0.22
    });

    const eyeMat = new THREE.MeshStandardMaterial({
      color: 0x9f1239, // Drosophila ruby-red compound eye
      roughness: 0.16,
      metalness: 0.35,
      emissive: 0x881337,
      emissiveIntensity: 0.55
    });

    this.wingMat = new THREE.MeshPhysicalMaterial({
      color: 0xe2e8f0,
      transmission: 0.88,
      opacity: 0.85,
      transparent: true,
      roughness: 0.12,
      ior: 1.45,
      specularIntensity: 1.0,
      side: THREE.DoubleSide
    });

    const loadMesh = (file, material, onLoaded) => {
      loader.load(`/assets/${file}`, (obj) => {
        obj.traverse((child) => {
          if (child.isMesh) {
            child.material = material;
            child.castShadow = true;
            child.receiveShadow = true;
          }
        });
        this.flyGroup.add(obj);
        if (onLoaded) onLoaded(obj);
      }, undefined, (err) => {
        console.warn(`Could not load /assets/${file}:`, err);
      });
    };

    // 1. Thorax & Head (Micro-CT)
    loadMesh('thorax.obj', chitinMat, (obj) => { this.loadedParts.thorax = obj; });
    loadMesh('drosophila_head.obj', chitinMat, (obj) => {
      this.loadedParts.head = obj;
      this.buildCompoundEyes(eyeMat);
    });

    // 2. Segmented Abdomen
    loadMesh('abdomen_1.obj', chitinMat, (obj) => { this.loadedParts.abdomen1 = obj; });
    loadMesh('abdomen_2.obj', chitinMat, (obj) => { this.loadedParts.abdomen2 = obj; });
    loadMesh('abdomen_3.obj', chitinMat, (obj) => { this.loadedParts.abdomen3 = obj; });

    // 3. Sensory Antennae & Halteres
    loadMesh('antenna_left.obj', chitinMat, (obj) => { this.loadedParts.antLeft = obj; });
    loadMesh('antenna_right.obj', chitinMat, (obj) => { this.loadedParts.antRight = obj; });
    loadMesh('haltere_left.obj', chitinMat, (obj) => { this.loadedParts.haltereLeft = obj; });
    loadMesh('haltere_right.obj', chitinMat, (obj) => { this.loadedParts.haltereRight = obj; });

    // 4. Articulated Wings with independent pivot groups for 120-150 Hz wingbeats
    // Left Wing Pivot (FlyBody hinge: X=0.0, Y=-0.46, Z=1.32)
    this.leftWingPivot = new THREE.Group();
    this.leftWingPivot.position.set(0.0, -0.46, 1.32);
    this.flyGroup.add(this.leftWingPivot);

    loader.load('/assets/wing_left.obj', (obj) => {
      obj.traverse((c) => { if (c.isMesh) c.material = this.wingMat; });
      obj.position.set(0.0, 0.46, -1.32);
      this.leftWingPivot.add(obj);
      this.loadedParts.wingLeft = obj;
    });

    // Right Wing Pivot (FlyBody hinge: X=0.0, Y=0.46, Z=1.32)
    this.rightWingPivot = new THREE.Group();
    this.rightWingPivot.position.set(0.0, 0.46, 1.32);
    this.flyGroup.add(this.rightWingPivot);

    loader.load('/assets/wing_right.obj', (obj) => {
      obj.traverse((c) => { if (c.isMesh) c.material = this.wingMat; });
      obj.position.set(0.0, -0.46, -1.32);
      this.rightWingPivot.add(obj);
      this.loadedParts.wingRight = obj;
    });

    // 5. Build articulated legs for grooming and escape jump kicks
    this.buildLegs(chitinMat);
  }

  buildCompoundEyes(eyeMat) {
    // Drosophila ommatidia compound eye ellipsoids positioned on the lateral head capsule
    const eyeGeo = new THREE.SphereGeometry(0.24, 16, 16);
    eyeGeo.scale(1.1, 0.8, 1.3);

    this.leftEye = new THREE.Mesh(eyeGeo, eyeMat);
    this.leftEye.position.set(-0.85, -0.32, 1.18);
    this.leftEye.rotation.set(0, 0.3, -0.2);
    this.flyGroup.add(this.leftEye);

    this.rightEye = new THREE.Mesh(eyeGeo, eyeMat);
    this.rightEye.position.set(-0.85, 0.32, 1.18);
    this.rightEye.rotation.set(0, -0.3, 0.2);
    this.flyGroup.add(this.rightEye);
  }

  buildLegs(legMat) {
    this.legs = [];
    const legPositions = [
      { x: -0.4, y: -0.35, z: 0.8, side: -1, isFore: true },  // Left Foreleg (Grooming)
      { x: -0.4, y:  0.35, z: 0.8, side:  1, isFore: true },  // Right Foreleg
      { x:  0.0, y: -0.45, z: 0.7, side: -1, isFore: false }, // Left Midleg
      { x:  0.0, y:  0.45, z: 0.7, side:  1, isFore: false }, // Right Midleg
      { x:  0.3, y: -0.40, z: 0.6, side: -1, isFore: false, isHind: true }, // Left Hindleg (Escape kick)
      { x:  0.3, y:  0.40, z: 0.6, side:  1, isFore: false, isHind: true }  // Right Hindleg
    ];

    legPositions.forEach((pos) => {
      const legRoot = new THREE.Group();
      legRoot.position.set(pos.x, pos.y, pos.z);

      const femur = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.02, 0.7, 8), legMat);
      femur.position.set(0, pos.side * 0.25, -0.25);
      femur.rotation.x = pos.side * 0.6;
      legRoot.add(femur);

      const tibia = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.015, 0.8, 8), legMat);
      tibia.position.set(0, pos.side * 0.5, -0.75);
      tibia.rotation.x = -pos.side * 0.4;
      legRoot.add(tibia);

      this.flyGroup.add(legRoot);
      this.legs.push({ group: legRoot, isFore: pos.isFore, isHind: pos.isHind, side: pos.side });
    });
  }

  loadAuthenticJaneliaConnectome() {
    // Connectome Brain Group sits inside the Head capsule at (-0.83, 0, 1.17)
    this.brainGroup = new THREE.Group();
    this.brainGroup.position.set(-0.83, 0.0, 1.17);
    this.brainGroup.scale.set(0.36, 0.36, 0.36);
    // Align Janelia brain mesh with the head capsule
    this.brainGroup.rotation.set(0, 0, Math.PI / 2);
    this.flyGroup.add(this.brainGroup);

    // 1. Janelia JRC2018 Template Brain Holographic Shell
    if (typeof THREE.OBJLoader !== 'undefined') {
      const loader = new THREE.OBJLoader();
      loader.load('/assets/jrc2018_brain.obj', (obj) => {
        const brainMat = new THREE.MeshPhysicalMaterial({
          color: 0x0284c7,
          transmission: 0.86,
          opacity: 0.38,
          transparent: true,
          roughness: 0.15,
          metalness: 0.1,
          emissive: 0x0369a1,
          emissiveIntensity: 0.25,
          side: THREE.DoubleSide,
          depthWrite: false
        });

        const wireMat = new THREE.MeshBasicMaterial({
          color: 0x38bdf8,
          wireframe: true,
          transparent: true,
          opacity: 0.12
        });

        obj.traverse((child) => {
          if (child.isMesh) {
            child.material = brainMat;
            const wireMesh = new THREE.Mesh(child.geometry, wireMat);
            obj.add(wireMesh);
          }
        });

        this.brainGroup.add(obj);
        console.log('Janelia JRC2018 Template Brain Shell loaded into Connectome Viewport.');
      }, undefined, (err) => {
        console.warn('Could not load jrc2018_brain.obj:', err);
      });
    }

    // 2. Authentic FlyWire & Hemibrain Reconstructed Neurons
    fetch('/assets/connectome_neurons.json')
      .then((res) => res.json())
      .then((neurons) => {
        this.renderConnectomeNeurons(neurons);
      })
      .catch((err) => {
        console.warn('Could not fetch connectome_neurons.json:', err);
      });
  }

  renderConnectomeNeurons(neurons) {
    const colors = [
      0x38bdf8, // Cyan (Acetylcholine / projection neurons)
      0x10b981, // Emerald (Dopamine / reward / Kenyon cells)
      0xf59e0b, // Amber (Octopamine / arousal / antennal lobe)
      0xec4899, // Neon Pink (GABAergic inhibitory local interneurons)
      0xef4444  // Crimson (Giant Fiber escape circuit)
    ];

    neurons.forEach((neuron, idx) => {
      const color = colors[idx % colors.length];
      const positions = new Float32Array(neuron.linePoints);

      const lineGeo = new THREE.BufferGeometry();
      lineGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

      const lineMat = new THREE.LineBasicMaterial({
        color: color,
        transparent: true,
        opacity: 0.85,
        blending: THREE.AdditiveBlending,
        linewidth: 1.5
      });

      const lineMesh = new THREE.LineSegments(lineGeo, lineMat);
      this.brainGroup.add(lineMesh);
      this.neuronLines.push({ mesh: lineMesh, baseColor: color, idx });

      // Glowing Soma sphere at root
      if (neuron.soma) {
        const somaGeo = new THREE.SphereGeometry(neuron.soma.radius * 0.9, 10, 10);
        const somaMat = new THREE.MeshBasicMaterial({
          color: color,
          transparent: true,
          opacity: 0.95
        });
        const somaMesh = new THREE.Mesh(somaGeo, somaMat);
        somaMesh.position.set(neuron.soma.x, neuron.soma.y, neuron.soma.z);
        this.brainGroup.add(somaMesh);
      }
    });

    console.log(`Rendered ${neurons.length} authentic connectome neurons in WebGL.`);
  }

  buildConnectomeNeuropils() {
    this.neuropilGroup = new THREE.Group();
    this.neuropilGroup.position.set(-0.83, 0.0, 1.17);
    this.neuropilGroup.scale.set(0.42, 0.42, 0.42);
    this.flyGroup.add(this.neuropilGroup);

    // 1. Central Complex - Ellipsoid Body (EB) Torus Ring Attractor
    const ebGeo = new THREE.TorusGeometry(0.25, 0.04, 12, 24);
    this.ebMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      wireframe: true,
      transparent: true,
      opacity: 0.85
    });
    this.ellipsoidBody = new THREE.Mesh(ebGeo, this.ebMat);
    this.ellipsoidBody.rotation.x = Math.PI / 4;
    this.neuropilGroup.add(this.ellipsoidBody);

    // 2. Mushroom Body Calyx & Lobes (Learning & Memory)
    const mbMat = new THREE.MeshBasicMaterial({
      color: 0x10b981,
      wireframe: true,
      transparent: true,
      opacity: 0.75
    });
    const mbGeo = new THREE.CylinderGeometry(0.04, 0.07, 0.5, 8);
    this.mbLeft = new THREE.Mesh(mbGeo, mbMat);
    this.mbLeft.position.set(-0.15, -0.2, 0.1);
    this.mbLeft.rotation.z = 0.5;
    this.neuropilGroup.add(this.mbLeft);

    this.mbRight = new THREE.Mesh(mbGeo, mbMat);
    this.mbRight.position.set(-0.15, 0.2, 0.1);
    this.mbRight.rotation.z = -0.5;
    this.neuropilGroup.add(this.mbRight);

    // 3. Giant Fiber Descending Escape Tract (Neon Crimson through neck to thoracic ganglion)
    const gfGeo = new THREE.CylinderGeometry(0.035, 0.02, 1.6, 8);
    this.gfMat = new THREE.MeshBasicMaterial({
      color: 0xef4444,
      transparent: true,
      opacity: 0.3
    });
    this.giantFiberTract = new THREE.Mesh(gfGeo, this.gfMat);
    this.giantFiberTract.position.set(0.7, 0.0, -0.2);
    this.giantFiberTract.rotation.z = Math.PI / 2;
    this.neuropilGroup.add(this.giantFiberTract);

    // 4. Action Potential Spark Particles (Qwen InstancedMesh)
    const sparkCount = 140;
    const sparkGeo = new THREE.SphereGeometry(0.016, 6, 6);
    this.sparkMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending
    });
    this.sparks = new THREE.InstancedMesh(sparkGeo, this.sparkMat, sparkCount);

    this.sparkData = [];
    const dummy = new THREE.Object3D();
    for (let i = 0; i < sparkCount; i++) {
      const pos = new THREE.Vector3(
        (Math.random() - 0.5) * 0.8,
        (Math.random() - 0.5) * 0.8,
        (Math.random() - 0.5) * 0.6
      );
      dummy.position.copy(pos);
      dummy.updateMatrix();
      this.sparks.setMatrixAt(i, dummy.matrix);
      this.sparkData.push({
        pos,
        vel: new THREE.Vector3(
          (Math.random() - 0.5) * 0.01,
          (Math.random() - 0.5) * 0.01,
          (Math.random() - 0.5) * 0.01
        )
      });
    }
    this.neuropilGroup.add(this.sparks);
  }

  buildFallbackAnatomy() {
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x8a5526, roughness: 0.4 });
    const thoraxGeo = new THREE.SphereGeometry(0.7, 16, 16);
    thoraxGeo.scale(1.2, 0.9, 1.0);
    this.flyGroup.add(new THREE.Mesh(thoraxGeo, bodyMat));
  }

  updateBiophysics(state = {}) {
    this.dopamineGlow = state.dopamineLevel || 0.1;
    this.octopamineGlow = state.octopamineLevel || 0.1;
    this.wingbeatHz = state.dlmnFrequency || 120.0;
    this.giantFiberActive = state.giantFiberSpike || false;

    // Pulse Giant Fiber Tract on Action Potential Spike
    if (this.giantFiberActive) {
      this.gfMat.opacity = 1.0;
      this.gfMat.color.setHex(0xff0033);
      this.setAnimationState('ESCAPE_JUMP', 1900);
    } else {
      this.gfMat.opacity = Math.max(0.2, this.gfMat.opacity - 0.04);
    }

    // Modulate Kenyon cell Mushroom Body glow by Dopamine level
    if (this.mbLeft && this.mbLeft.material) {
      this.mbLeft.material.opacity = 0.3 + this.dopamineGlow * 0.7;
    }

    // Modulate connectome neuron tract brightness
    this.neuronLines.forEach((item) => {
      if (item.mesh && item.mesh.material) {
        item.mesh.material.opacity = 0.5 + this.dopamineGlow * 0.4 + this.octopamineGlow * 0.3;
      }
    });

    // Update Emotional States
    if (this.animationState !== 'ESCAPE_JUMP') {
      if (this.dopamineGlow > 0.6) {
        this.setAnimationState('GROOMING', 2600);
      } else if (this.octopamineGlow > 0.65) {
        this.setAnimationState('AGITATED', 1600);
      }
    }
  }

  setAnimationState(state, durationMs = 2000) {
    this.animationState = state;
    this.stateTimer = durationMs;
  }

  animate() {
    requestAnimationFrame(this.animate);
    const time = performance.now() * 0.001;

    // Decay State Timer
    if (this.stateTimer > 0) {
      this.stateTimer -= 16.6;
      if (this.stateTimer <= 0) {
        this.animationState = 'IDLE';
      }
    }

    // 1. Gentle Idle Orbit & Respiration Levitation
    this.flyRoot.rotation.y = -0.42 + Math.sin(time * 0.5) * 0.15;
    this.flyRoot.position.y = -0.15 + Math.sin(time * 1.6) * 0.05;

    // 2. Abdomen Segments Rhythmic Contraction
    if (this.loadedParts.abdomen1) {
      const breath = 1.0 + Math.sin(time * 3.2) * 0.035;
      this.loadedParts.abdomen1.scale.set(1.0, breath, breath);
    }

    // 3. Central Complex Rotation
    if (this.ellipsoidBody) {
      this.ellipsoidBody.rotation.z += 0.025;
    }

    // 4. Wing Motion (Left and Right pivots)
    if (this.leftWingPivot && this.rightWingPivot) {
      if (this.animationState === 'AGITATED') {
        // High frequency buzzing (120-150 Hz flutter around wing hinge)
        const flutter = Math.sin(time * (this.wingbeatHz * 0.2)) * 0.35;
        this.leftWingPivot.rotation.y = flutter;
        this.rightWingPivot.rotation.y = -flutter;
      } else if (this.animationState === 'ESCAPE_JUMP') {
        // Violent backflip snap open
        this.leftWingPivot.rotation.y = 0.6;
        this.rightWingPivot.rotation.y = -0.6;
      } else {
        // Idle wing quiver
        const quiver = Math.sin(time * 2.5) * 0.05;
        this.leftWingPivot.rotation.y = quiver;
        this.rightWingPivot.rotation.y = -quiver;
      }
    }

    // 5. Leg Articulation
    if (this.legs) {
      this.legs.forEach((leg) => {
        if (leg.isFore && this.animationState === 'GROOMING') {
          // Forelegs rub together over head & antennae
          leg.group.rotation.y = Math.sin(time * 14.0) * 0.35 + (leg.side * 0.2);
        } else if (leg.isHind && this.animationState === 'ESCAPE_JUMP') {
          // Powerful Giant Fiber hindleg kick
          leg.group.rotation.x = 0.85;
        } else {
          leg.group.rotation.y = Math.sin(time * 2.0 + leg.side) * 0.05;
        }
      });
    }

    // 6. Giant Fiber Escape Jump Dynamics
    if (this.animationState === 'ESCAPE_JUMP') {
      this.flyRoot.rotation.x = -0.4;
      this.flyRoot.position.z = -0.3;
    } else {
      this.flyRoot.rotation.x = 0;
      this.flyRoot.position.z = 0;
    }

    // 7. Action Potential Sparks Animation
    if (this.sparks && this.sparkData) {
      const dummy = new THREE.Object3D();
      for (let i = 0; i < this.sparkData.length; i++) {
        const item = this.sparkData[i];
        item.pos.add(item.vel);
        if (item.pos.length() > 0.65) {
          item.pos.set(
            (Math.random() - 0.5) * 0.3,
            (Math.random() - 0.5) * 0.3,
            (Math.random() - 0.5) * 0.3
          );
        }
        dummy.position.copy(item.pos);
        dummy.updateMatrix();
        this.sparks.setMatrixAt(i, dummy.matrix);
      }
      this.sparks.instanceMatrix.needsUpdate = true;
    }

    this.renderer.render(this.scene, this.camera);
  }
}

if (typeof window !== 'undefined') {
  window.ConnectomeScene = ConnectomeScene;
}
