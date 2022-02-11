import * as THREE from 'three';
// import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';
// import easing from './easing.js';
import metaversefile from 'metaversefile';
// import {getCaretAtPoint} from 'troika-three-text';
const {useApp, useInternals, useMaterials, useFrame, useActivate, useLoaders, useScene, usePhysics, useDefaultModules, useCleanup} = metaversefile;

const baseUrl = import.meta.url.replace(/(\/)[^\/\\]*$/, '$1');

const localVector = new THREE.Vector3();
// const localVector2 = new THREE.Vector3();
const localVector2D = new THREE.Vector2();
const localQuaternion = new THREE.Quaternion();
// const localMatrix = new THREE.Matrix4();

const maxParticles = 256;
const canvasSize = 4096;
const frameSize = 512;
const rowSize = Math.floor(canvasSize/frameSize);
const maxNumFrames = rowSize * rowSize;

const planeGeometry = new THREE.PlaneBufferGeometry(1, 1);
const particleGeometry = new THREE.BufferGeometry();
const positions = new Float32Array(maxParticles * planeGeometry.attributes.position.array.length);
particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
const normals = new Float32Array(maxParticles * planeGeometry.attributes.normal.array.length);
particleGeometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
const uvs = new Float32Array(maxParticles * planeGeometry.attributes.uv.array.length);
particleGeometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
const indices = new Uint16Array(maxParticles * planeGeometry.index.array.length);
particleGeometry.setIndex(new THREE.BufferAttribute(indices, 1));
for (let i = 0; i < maxParticles; i++) {
  // position starts zeroed and is fileld by the mesh class
  // particleGeometry.attributes.position.array.fill(planeGeometry.attributes.position.array, i * planeGeometry.attributes.position.count);
  particleGeometry.attributes.normal.array.set(planeGeometry.attributes.normal.array, i * planeGeometry.attributes.normal.array.length);
  particleGeometry.attributes.uv.array.set(planeGeometry.attributes.uv.array, i * planeGeometry.attributes.uv.array.length);
  for (let j = 0; j < planeGeometry.index.count; j++) {
    particleGeometry.index.array[i * planeGeometry.index.count + j] = planeGeometry.index.array[j] + i * planeGeometry.attributes.position.array.length;
  }
}

let fileSpecs = [];
const fileSpecsLoadPromise = (async () => {
  const res = await fetch(`/fx-textures/fx-files.json`);
  fileSpecs = await res.json();
})();

const _makeParticleMaterial = name => {
  // console.log('_makeParticleMaterial', texture, numFrames);

  const promise = (async () => {
    await fileSpecsLoadPromise;
    
    const fileSpec = fileSpecs.find(f => f.name === name);
    const {numFrames} = fileSpec;

    const texture = await new Promise((accept, reject) => {
      const {ktx2Loader} = useLoaders();
      const u = `/fx-textures/${name}-spritesheet.ktx2`;
      ktx2Loader.load(u, accept, function onProgress() {}, reject);
    });
    texture.anisotropy = 16;
    material.uniforms.uTex.value = texture;
    material.uniforms.uTex.needsUpdate = true;
    material.uniforms.uNumFrames.value = numFrames;
    material.uniforms.uNumFrames.needsUpdate = true;
  })();

  const {WebaverseShaderMaterial} = useMaterials();
  const material = new WebaverseShaderMaterial({
    uniforms: {
      uTime: {
        value: 0,
        needsUpdate: true,
      },
      uTex: {
        value: null,
        needsUpdate: false,
      },
      uNumFrames: {
        value: 0,
        needsUpdate: false,
      },
    },
    vertexShader: `\
      precision highp float;
      precision highp int;

      uniform float uTime;
      // varying vec3 vPosition;
      varying vec2 vUv;

      /* float getBezierT(float x, float a, float b, float c, float d) {
        return float(sqrt(3.) *
          sqrt(-4. * b * d + 4. * b * x + 3. * c * c + 2. * c * d - 8. * c * x - d * d + 4. * d * x)
            + 6. * b - 9. * c + 3. * d)
            / (6. * (b - 2. * c + d));
      }
      float easing(float x) {
        return getBezierT(x, 0., 1., 0., 1.);
      }
      float easing2(float x) {
        return easing(easing(x));
      } */

      void main() {
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.);
        vUv = uv;
        // vPosition = position;
      }
    `,
    fragmentShader: `\
      precision highp float;
      precision highp int;

      #define PI 3.1415926535897932384626433832795

      uniform float uTime;
      uniform sampler2D uTex;
      uniform float uNumFrames;
      // varying vec3 vPosition;
      varying vec2 vUv;

      const vec3 lineColor1 = vec3(${new THREE.Color(0x29b6f6).toArray().join(', ')});
      const vec3 lineColor2 = vec3(${new THREE.Color(0x0288d1).toArray().join(', ')});
      const vec3 lineColor3 = vec3(${new THREE.Color(0xec407a).toArray().join(', ')});
      const vec3 lineColor4 = vec3(${new THREE.Color(0xc2185b).toArray().join(', ')});

      void main() {
        // const float maxNumFrames = ${maxNumFrames.toFixed(8)};
        const float rowSize = ${rowSize.toFixed(8)};

        float f = mod(uTime, 1.);
        float frame = floor(f * uNumFrames);
        float x = mod(frame, rowSize);
        float y = floor(frame / rowSize);

        vec2 uv = vec2(x / rowSize, y / rowSize) + vUv / rowSize;

        vec4 alphaColor = texture2D(uTex, vec2(0.));

        gl_FragColor = texture2D(uTex, uv);
        if (gl_FragColor.a < 0.5) {
          discard;
        }
      }
    `,
    side: THREE.DoubleSide,
    transparent: true,
    // alphaTest: 0.9,
  });
  material.promise = promise;
  return material;
};

class Particle extends THREE.Object3D {
  constructor(index, parent) {
    super();

    this.index = index;
    this.parent = parent;
  }
  update() {
    this.parent.updateParticle(this);
  }
}
class ParticleMesh extends THREE.InstancedMesh {
  constructor(name) {
    const geometry = particleGeometry.clone();
    const material = _makeParticleMaterial(name);
    material.promise.then(() => {
      this.visible = true;
    });
    super(geometry, material, maxParticles);

    this.name = name;
    this.particles = [];
    this.freeList = new Uint8Array(maxParticles);
    this.frustumCulled = false;
    this.visible = false;
  }
  allocIndex() {
    for (let i = 0; i < maxParticles; i++) {
      if (this.freeList[i] === 0) {
        this.freeList[i] = 1;
        return i;
      }
    }
    return -1;
  }
  freeIndex(index) {
    this.freeList[index] = 0;
  }
  addParticle() {
    const index = this.allocIndex();
    const particle = new Particle(index, this);
    this.particles.push(particle);
    return particle;
  }
  updateParticle(particle) {
    particle.updateMatrixWorld();

    // copy over the particle, with the approprite matrix transform
    for (let i = 0; i < planeGeometry.attributes.position.count; i++) {
      const index = particle.index * planeGeometry.attributes.position.count + i;

      localVector.fromArray(planeGeometry.attributes.position.array, index*3)
        .applyMatrix4(particle.matrixWorld)
        .toArray(this.geometry.attributes.position.array, index*3);
      localVector.fromArray(planeGeometry.attributes.normal.array, index*3)
        .applyQuaternion(localQuaternion.setFromRotationMatrix(particle.matrixWorld))
        .toArray(this.geometry.attributes.normal.array, index*3);
      localVector2D.fromArray(planeGeometry.attributes.uv.array, index*2)
        .toArray(this.geometry.attributes.uv.array, index*2);

      this.geometry.attributes.position.needsUpdate = true;
      this.geometry.attributes.normal.needsUpdate = true;
      this.geometry.attributes.uv.needsUpdate = true;
    }
  }
}

export default e => {
  const app = useApp();
  // const {renderer, scene, camera} = useInternals();
  const scene = useScene();
  const physics = usePhysics();
  // const {CapsuleGeometry} = useGeometries();
  // const Text = useTextInternal();

  const particleMeshes = [];
  window.particleMeshes = particleMeshes;
  app.addParticle = name => {
    let particleMesh = particleMeshes.find(m => m.name === name);
    if (!particleMesh) {
      particleMesh = new ParticleMesh(name);
      scene.add(particleMesh);
      particleMeshes.push(particleMesh);
    }
    const particle = particleMesh.addParticle();
    return particle;
  };
  /* ((async () => {
    // console.log('got file specs', fileSpecs);
    // const fileSpec = fileSpecs[0];

    // console.log('got file specs', fileSpecs);
    const startIndex = fileSpecs.findIndex(({name}) => name === 'Elements - Energy 017 Charge Up noCT noRSZ.mov');
    const numParticles = 1;
    for (let i = startIndex; i < fileSpecs.length && (i - startIndex) < numParticles; i++) {
      const fileSpec = fileSpecs[i];
      const {name, numFrames} = fileSpec;
      const texture = await new Promise((accept, reject) => {
        const u = `/fx-textures/${name}-spritesheet.ktx2`;
        ktx2Loader.load(u, accept, function onProgress() {}, reject);
      });
      texture.anisotropy = 16;
      const material = _makeParticleMaterial({
        texture,
        numFrames,
      });
      
      const particleMesh = new ParticleMesh(particleGeometry, material);
      particleMesh.position.x = i - startIndex;
      particleMesh.position.y = 1;
      particleMesh.updateMatrixWorld();
      particleMesh.frustumCulled = false;
      app.add(particleMesh);
      particleMesh.updateMatrixWorld();

      particleMeshes.push(particleMesh);
    }
  })()); */

  {
    const particle = app.addParticle('Elements - Energy 017 Charge Up noCT noRSZ.mov');
    particle.position.copy(app.position);
    particle.quaternion.copy(app.quaternion);
    particle.scale.copy(app.scale);
    particle.update();
  }

  const physicsIds = [];
  /* let activateCb = null;
  let frameCb = null;
  useActivate(() => {
    activateCb && activateCb();
  }); */
  useFrame(({timestamp, timeDiff}) => {
    // frameCb && frameCb();

    for (const particleMesh of particleMeshes) {
      particleMesh.material.uniforms.uTime.value = timestamp / 1000;
      particleMesh.material.uniforms.uTime.needsUpdate = true;
    }

    // material.uniforms.time.value = (performance.now() / 1000) % 1;
  });
  
  useCleanup(() => {
    for (const physicsId of physicsIds) {
      physics.removeGeometry(physicsId);
    }
  });

  return app;
};