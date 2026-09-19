/**
 * 3D Drosophila Anatomy & Janelia Connectome Neural Viewport
 *
 * Full Adult Drosophila Anatomical Model:
 * 1. Micro-CT anatomical adult Drosophila meshes (TuragaLab/flybody):
 *    - drosophila_head.obj + ruby compound eyes + antennae (antenna_left.obj, antenna_right.obj)
 *    - thorax.obj (dorsal scutum, scutellum, thoracic pleura)
 *    - drosophila_abdomen.obj (Full 8-segment closed abdomen, dorsal + ventral plates)
 *    - drosophila_legs.obj (Full 6 articulated jointed legs: coxa, femur, tibia, tarsi)
 *    - wing_left.obj, wing_right.obj, haltere_left.obj, haltere_right.obj
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
    this.dummy = new THREE.Object3D(); // Hoisted to eliminate per-frame GC pressure

    this.initThree();
    this.buildConnectomeNeuropils();
    this.loadAuthenticJaneliaConnectome();
    this.loadAuthenticFlyBody();

    this.animate = this.animate.bind(this);
    requestAnimationFrame(this.animate);
    if (this.controls) this.controls.update();

    window.addEventListener('resize', () => this.onResize());
  }

  initThree() {
    const width = this.container.clientWidth || window.innerWidth / 2;
    const height = this.container.clientHeight || window.innerHeight;

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x030712, 0.032);

    this.camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 100);
    this.camera.position.set(2.8, 1.6, 4.4);
    this.camera.lookAt(0, -0.1, 0);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.35;
    this.container.appendChild(this.renderer.domElement);

    // Interactive OrbitControls for 360-degree anatomical exploration
    if (typeof THREE.OrbitControls !== 'undefined') {
      this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
      this.controls.enableDamping = true;
      this.controls.dampingFactor = 0.06;
      this.controls.maxDistance = 14.0;
      this.controls.minDistance = 1.2;
      this.controls.target.set(0, -0.1, 0);
    }
    this.renderer.domElement.style.cursor = 'grab';
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    this.interactiveSomas = [];
    this.selectedNeuron = null;
    this.onNeuronSelectCallback = null;
    this.rawNeurons = [];

    let isDragging = false;
    let downPos = { x: 0, y: 0 };

    this.renderer.domElement.addEventListener('mousedown', (e) => {
      isDragging = false;
      downPos = { x: e.clientX, y: e.clientY };
      this.renderer.domElement.style.cursor = 'grabbing';
    });

    this.renderer.domElement.addEventListener('mousemove', (e) => {
      const dist = Math.hypot(e.clientX - downPos.x, e.clientY - downPos.y);
      if (dist > 5) isDragging = true;

      const rect = this.renderer.domElement.getBoundingClientRect();
      this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      if (this.interactiveSomas.length > 0 && !isDragging) {
        this.raycaster.setFromCamera(this.mouse, this.camera);
        const hits = this.raycaster.intersectObjects(this.interactiveSomas);
        if (hits.length > 0) {
          this.renderer.domElement.style.cursor = 'pointer';
        } else {
          this.renderer.domElement.style.cursor = 'grab';
        }
      }
    });

    this.renderer.domElement.addEventListener('mouseup', (e) => {
      this.renderer.domElement.style.cursor = 'grab';
      if (!isDragging && this.interactiveSomas.length > 0) {
        const rect = this.renderer.domElement.getBoundingClientRect();
        this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        this.raycaster.setFromCamera(this.mouse, this.camera);
        const hits = this.raycaster.intersectObjects(this.interactiveSomas);
        if (hits.length > 0) {
          const neuronData = hits[0].object.userData;
          this.selectNeuron(neuronData);
        }
      }
    });;

    // Balanced Laboratory Lighting for True Chitin Cuticle Colors
    const ambientLight = new THREE.AmbientLight(0x1e293b, 1.8);
    this.scene.add(ambientLight);

    const warmKey = new THREE.DirectionalLight(0xfef08a, 2.0); // Warm key highlight
    warmKey.position.set(4, 7, 5);
    this.scene.add(warmKey);

    const cyanSynapse = new THREE.DirectionalLight(0x38bdf8, 1.6); // Cyan synaptic light
    cyanSynapse.position.set(-4, -2, -3);
    this.scene.add(cyanSynapse);

    const emeraldRim = new THREE.DirectionalLight(0x10b981, 1.2); // Emerald rim light
    emeraldRim.position.set(0, 5, -5);
    this.scene.add(emeraldRim);

    // Fly Master Hierarchy
    this.flyRoot = new THREE.Group();
    this.flyRoot.position.set(0, -0.1, 0);
    this.flyRoot.rotation.y = -0.45; // Hero 3/4 diagonal orientation
    this.scene.add(this.flyRoot);

    // Transform FlyBody coordinate system (Z=dorsal, -X=head, Y=lateral)
    // into Three.js coordinate system (Y=up, +Z=forward to camera, X=lateral)
    this.flyGroup = new THREE.Group();
    this.flyGroup.rotation.x = -Math.PI / 2;
    this.flyGroup.rotation.z = -Math.PI / 2;
    this.flyGroup.scale.set(0.85, 0.85, 0.85);
    this.flyGroup.position.set(0, -1.0, 0);
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

    // Natural Drosophila melanogaster warm amber-tan chitin cuticle
    const chitinMat = new THREE.MeshStandardMaterial({
      color: 0x925c27,
      roughness: 0.32,
      metalness: 0.15
    });

    // Darker jointed chitin for legs and thoracic sutures
    const legMat = new THREE.MeshStandardMaterial({
      color: 0x6b3f15,
      roughness: 0.38,
      metalness: 0.18
    });

    // Deep ruby-red compound eye
    const eyeMat = new THREE.MeshStandardMaterial({
      color: 0x9f1239,
      roughness: 0.15,
      metalness: 0.35,
      emissive: 0x881337,
      emissiveIntensity: 0.55
    });

    // Translucent iridescent wing membrane
    this.wingMat = new THREE.MeshPhysicalMaterial({
      color: 0xf1f5f9,
      transmission: 0.88,
      opacity: 0.85,
      transparent: true,
      roughness: 0.10,
      ior: 1.45,
      specularIntensity: 1.2,
      side: THREE.DoubleSide
    });

    const loadMesh = (file, material, onLoaded) => {
      loader.load(`/assets/${file}`, (obj) => {
        obj.traverse((child) => {
          if (child.isMesh) {
            if (child.geometry) child.geometry.computeVertexNormals();
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

    // 2. Complete 8-Segment Adult Drosophila Abdomen (Dorsal + Ventral Plates)
    loadMesh('drosophila_abdomen.obj', chitinMat, (obj) => {
      this.loadedParts.abdomen = obj;
      console.log('Complete 8-segment Drosophila abdomen loaded.');
    });

    // 3. Complete Articulated Micro-CT Legs (T1, T2, T3)
    loadMesh('drosophila_legs.obj', legMat, (obj) => {
      this.loadedParts.legs = obj;
      console.log('Complete articulated micro-CT legs loaded.');
    });

    // 4. Sensory Antennae & Halteres
    loadMesh('antenna_left.obj', chitinMat, (obj) => { this.loadedParts.antLeft = obj; });
    loadMesh('antenna_right.obj', chitinMat, (obj) => { this.loadedParts.antRight = obj; });
    loadMesh('haltere_left.obj', chitinMat, (obj) => { this.loadedParts.haltereLeft = obj; });
    loadMesh('haltere_right.obj', chitinMat, (obj) => { this.loadedParts.haltereRight = obj; });

    // 5. Articulated Wings with independent pivot groups for 120-150 Hz wingbeats
    this.leftWingPivot = new THREE.Group();
    this.leftWingPivot.position.set(0.0, -0.46, 1.32);
    this.flyGroup.add(this.leftWingPivot);

    loader.load('/assets/wing_left.obj', (obj) => {
      obj.traverse((c) => { if (c.isMesh) c.material = this.wingMat; });
      obj.position.set(0.0, 0.46, -1.32);
      this.leftWingPivot.add(obj);
      this.loadedParts.wingLeft = obj;
    });

    this.rightWingPivot = new THREE.Group();
    this.rightWingPivot.position.set(0.0, 0.46, 1.32);
    this.flyGroup.add(this.rightWingPivot);

    loader.load('/assets/wing_right.obj', (obj) => {
      obj.traverse((c) => { if (c.isMesh) c.material = this.wingMat; });
      obj.position.set(0.0, -0.46, -1.32);
      this.rightWingPivot.add(obj);
      this.loadedParts.wingRight = obj;
    });
  }

  buildCompoundEyes(eyeMat) {
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

  loadAuthenticJaneliaConnectome() {
    this.brainGroup = new THREE.Group();
    this.brainGroup.position.set(-0.83, 0.0, 1.17);
    this.brainGroup.scale.set(0.36, 0.36, 0.36);
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
    this.rawNeurons = neurons;
    const colors = [
      0x38bdf8, // Cyan (Acetylcholine / projection neurons)
      0x10b981, // Emerald (Dopamine / reward / Kenyon cells)
      0xf59e0b, // Amber (Octopamine / arousal / antennal lobe)
      0xa855f7, // Purple (Central complex ExR2)
      0xef4444, // Crimson (Giant Fiber escape circuit)
      0x06b6d4, // Teal (PPL1 Dopamine)
      0xf97316  // Orange (OA-VUM Octopamine)
    ];

    neurons.forEach((neuron, idx) => {
      const color = neuron.colorHex ? parseInt(neuron.colorHex.replace('#', '0x')) : colors[idx % colors.length];
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

      let somaMesh = null;
      if (neuron.soma) {
        const somaRadius = (neuron.soma.radius || 0.04) * 1.05;
        const somaGeo = new THREE.SphereGeometry(somaRadius, 14, 14);
        const somaMat = new THREE.MeshStandardMaterial({
          color: color,
          emissive: color,
          emissiveIntensity: 0.75,
          roughness: 0.2,
          metalness: 0.1
        });
        somaMesh = new THREE.Mesh(somaGeo, somaMat);
        somaMesh.position.set(neuron.soma.x, neuron.soma.y, neuron.soma.z);
        somaMesh.userData = neuron;
        this.brainGroup.add(somaMesh);
        this.interactiveSomas.push(somaMesh);
      }

      this.neuronLines.push({ mesh: lineMesh, soma: somaMesh, data: neuron, baseColor: color, idx });
    });

    this.buildAxonPulses(neurons);
  }

  /**
   * Interactive selection of specific neuron arborization and soma
   */
  
  /**
   * Generates traveling action potential bioluminescent pulses along axonal tracts
   */
  buildAxonPulses(neurons) {
    const pulsesPerNeuron = 8;
    const totalPulses = neurons.length * pulsesPerNeuron;
    const pulseGeo = new THREE.SphereGeometry(0.015, 8, 8);
    const pulseMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending
    });

    this.pulseMesh = new THREE.InstancedMesh(pulseGeo, pulseMat, totalPulses);
    this.pulseData = [];

    neurons.forEach((neuron, nIdx) => {
      const totalPoints = neuron.linePoints.length / 3;
      const step = Math.max(1, Math.floor(totalPoints / 80));
      const waypoints = [];
      for (let i = 0; i < totalPoints; i += step) {
        waypoints.push(new THREE.Vector3(
          neuron.linePoints[i * 3],
          neuron.linePoints[i * 3 + 1],
          neuron.linePoints[i * 3 + 2]
        ));
      }

      for (let p = 0; p < pulsesPerNeuron; p++) {
        this.pulseData.push({
          neuronIdx: nIdx,
          waypoints,
          progress: p / pulsesPerNeuron,
          speed: 0.0035 + (p % 3) * 0.001
        });
      }
    });

    this.brainGroup.add(this.pulseMesh);
  }

  selectNeuron(target) {
    if (!target || target === 'all') {
      this.selectedNeuron = null;
      this.neuronLines.forEach((item) => {
        if (item.mesh && item.mesh.material) {
          item.mesh.material.opacity = 0.85;
          item.mesh.material.color.setHex(item.baseColor);
        }
        if (item.soma) {
          item.soma.scale.set(1.0, 1.0, 1.0);
          item.soma.material.emissiveIntensity = 0.75;
        }
      });
      if (this.onNeuronSelectCallback) this.onNeuronSelectCallback(null);
      return;
    }

    const neuronId = typeof target === 'string' ? target : (target.name || target.flywireId);
    let matched = null;

    this.neuronLines.forEach((item) => {
      const isMatch = item.data.name === neuronId ||
                      item.data.flywireId === neuronId ||
                      item.data.shortName === neuronId ||
                      item.data === target;
      if (isMatch) {
        matched = item.data;
        this.selectedNeuron = item.data;
        if (item.mesh && item.mesh.material) {
          item.mesh.material.opacity = 1.0;
          item.mesh.material.color.setHex(0xffffff);
        }
        if (item.soma) {
          item.soma.scale.set(1.65, 1.65, 1.65);
          item.soma.material.emissiveIntensity = 1.4;
        }
      } else {
        if (item.mesh && item.mesh.material) {
          item.mesh.material.opacity = 0.18;
          item.mesh.material.color.setHex(item.baseColor);
        }
        if (item.soma) {
          item.soma.scale.set(0.85, 0.85, 0.85);
          item.soma.material.emissiveIntensity = 0.3;
        }
      }
    });

    if (this.onNeuronSelectCallback && matched) {
      this.onNeuronSelectCallback(matched);
    }
  }

  /**
   * Optogenetic channelrhodopsin depolarization pulse (+15 nA)
   */
  injectOptogeneticCurrent(amount = 15.0) {
    if (this.selectedNeuron) {
      const match = this.neuronLines.find(i => i.data === this.selectedNeuron);
      if (match && match.soma) {
        match.soma.scale.set(2.2, 2.2, 2.2);
        setTimeout(() => {
          if (match.soma) match.soma.scale.set(1.65, 1.65, 1.65);
        }, 250);
      }
    }
    this.setAnimationState('AGITATED', 800);
    return { stimulated: true, current: amount };
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

    // 3. Giant Fiber Descending Escape Tract
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

    // 4. Action Potential Spark Particles
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
    // Reusing hoisted this.dummy to avoid GC stutter
    for (let i = 0; i < sparkCount; i++) {
      const pos = new THREE.Vector3(
        (Math.random() - 0.5) * 0.8,
        (Math.random() - 0.5) * 0.8,
        (Math.random() - 0.5) * 0.6
      );
      this.dummy.position.copy(pos);
      this.dummy.updateMatrix();
      this.sparks.setMatrixAt(i, this.dummy.matrix);
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
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x925c27, roughness: 0.35 });
    const thoraxGeo = new THREE.SphereGeometry(0.7, 16, 16);
    thoraxGeo.scale(1.2, 0.9, 1.0);
    this.flyGroup.add(new THREE.Mesh(thoraxGeo, bodyMat));
  }

  updateBiophysics(state = {}) {
    this.dopamineGlow = state.dopamineLevel || 0.1;
    this.octopamineGlow = state.octopamineLevel || 0.1;
    this.wingbeatHz = state.dlmnFrequency || 120.0;
    this.giantFiberActive = state.giantFiberSpike || false;

    if (this.giantFiberActive) {
      this.gfMat.opacity = 1.0;
      this.gfMat.color.setHex(0xff0033);
      this.setAnimationState('ESCAPE_JUMP', 1900);
    } else {
      this.gfMat.opacity = Math.max(0.2, this.gfMat.opacity - 0.04);
    }

    if (this.mbLeft && this.mbLeft.material) {
      this.mbLeft.material.opacity = 0.3 + this.dopamineGlow * 0.7;
    }

    this.neuronLines.forEach((item) => {
      if (item.mesh && item.mesh.material) {
        item.mesh.material.opacity = 0.5 + this.dopamineGlow * 0.4 + this.octopamineGlow * 0.3;
      }
    });

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

    if (this.stateTimer > 0) {
      this.stateTimer -= 16.6;
      if (this.stateTimer <= 0) {
        this.animationState = 'IDLE';
      }
    }

    // 1. Gentle Idle Orbit & Respiration Levitation
    this.flyRoot.rotation.y = -0.45 + Math.sin(time * 0.5) * 0.12;
    this.flyRoot.position.y = -0.1 + Math.sin(time * 1.6) * 0.04;

    // 2. Complete Abdomen Rhythmic Respiration
    if (this.loadedParts.abdomen) {
      const breath = 1.0 + Math.sin(time * 3.2) * 0.035;
      this.loadedParts.abdomen.scale.set(1.0, breath, breath);
    }

    // 3. Central Complex Rotation
    if (this.ellipsoidBody) {
      this.ellipsoidBody.rotation.z += 0.025;
    }

    // 4. Wing Motion
    if (this.leftWingPivot && this.rightWingPivot) {
      if (this.animationState === 'AGITATED') {
        const flutter = Math.sin(time * (this.wingbeatHz * 0.2)) * 0.45;
        this.leftWingPivot.rotation.y = flutter;
        this.rightWingPivot.rotation.y = -flutter;
      } else if (this.animationState === 'ESCAPE_JUMP') {
        this.leftWingPivot.rotation.y = 0.65;
        this.rightWingPivot.rotation.y = -0.65;
      } else {
        const quiver = Math.sin(time * 2.5) * 0.05;
        this.leftWingPivot.rotation.y = quiver;
        this.rightWingPivot.rotation.y = -quiver;
      }
    }

    // 5. Escape Jump Dynamics
    if (this.animationState === 'ESCAPE_JUMP') {
      this.flyRoot.rotation.x = -0.35;
      this.flyRoot.position.z = -0.3;
    } else {
      this.flyRoot.rotation.x = 0;
      this.flyRoot.position.z = 0;
    }

    // 5.5 Axonal Action Potential Traveling Pulses
    if (this.pulseMesh && this.pulseData) {
      for (let i = 0; i < this.pulseData.length; i++) {
        const p = this.pulseData[i];
        let speedMult = 1.0;
        if (p.neuronIdx === 4 && this.giantFiberActive) speedMult = 4.5;
        if (p.neuronIdx === 5 && this.dopamineGlow > 0.4) speedMult = 2.5;
        if (p.neuronIdx === 6 && this.octopamineGlow > 0.4) speedMult = 2.8;

        p.progress = (p.progress + p.speed * speedMult) % 1.0;

        const waypoints = p.waypoints;
        if (waypoints.length >= 2) {
          const totalSegments = waypoints.length - 1;
          const floatIdx = p.progress * totalSegments;
          const idx = Math.floor(floatIdx);
          const frac = floatIdx - idx;
          const p1 = waypoints[idx];
          const p2 = waypoints[Math.min(idx + 1, totalSegments)];

          this.dummy.position.lerpVectors(p1, p2, frac);
          const scale = (this.giantFiberActive && p.neuronIdx === 4) ? 2.2 : 1.0;
          this.dummy.scale.set(scale, scale, scale);
          this.dummy.updateMatrix();
          this.pulseMesh.setMatrixAt(i, this.dummy.matrix);
        }
      }
      this.pulseMesh.instanceMatrix.needsUpdate = true;
    }

    // 6. Action Potential Sparks Animation
    if (this.sparks && this.sparkData) {
      // Reusing hoisted this.dummy
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
        this.dummy.position.copy(item.pos);
        this.dummy.updateMatrix();
        this.sparks.setMatrixAt(i, this.dummy.matrix);
      }
      this.sparks.instanceMatrix.needsUpdate = true;
    }

    this.renderer.render(this.scene, this.camera);
  }
}

if (typeof window !== 'undefined') {
  window.ConnectomeScene = ConnectomeScene;
}
