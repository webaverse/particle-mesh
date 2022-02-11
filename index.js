import * as THREE from 'three';
// import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';
// import easing from './easing.js';
import metaversefile from 'metaversefile';
// import {getCaretAtPoint} from 'troika-three-text';
const {useApp, useInternals, useGeometries, useMaterials, useFrame, useActivate, useLoaders, usePhysics, useTextInternal, addTrackedApp, useDefaultModules, useCleanup} = metaversefile;

const baseUrl = import.meta.url.replace(/(\/)[^\/\\]*$/, '$1');

const localVector = new THREE.Vector3();
const localVector2 = new THREE.Vector3();
const localVector2D = new THREE.Vector2();

export default e => {
  const app = useApp();
  const {ktx2Loader} = useLoaders();
  // const {renderer, scene, camera} = useInternals();
  const physics = usePhysics();
  // const {CapsuleGeometry} = useGeometries();
  const {WebaverseShaderMaterial} = useMaterials();
  // const Text = useTextInternal();

  const canvasSize = 4096;
  const frameSize = 512;
  const rowSize = Math.floor(canvasSize/frameSize);
  const maxNumFrames = rowSize * rowSize;

  const _makeParticleMaterial = ({
    texture,
    numFrames,
  }) => {
    // console.log('_makeParticleMaterial', texture, numFrames);
    return new WebaverseShaderMaterial({
      uniforms: {
        uTime: {
          value: 0,
          needsUpdate: true,
        },
        uTex: {
          value: texture,
          needsUpdate: true,
        },
        uNumFrames: {
          value: numFrames,
          needsUpdate: true,
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
          // float frame = floor(f * maxNumFrames);
          float frame = floor(f * uNumFrames);
          float x = mod(frame, rowSize);
          float y = floor(frame / rowSize);
  
          vec2 uv = vec2(x / rowSize, y / rowSize) + vUv / rowSize;
  
          vec4 alphaColor = texture2D(uTex, vec2(0.));
  
          gl_FragColor = texture2D(uTex, uv);
          float alphaDistance = length(gl_FragColor.rgb - alphaColor.rgb);
          // alphaDistance = pow(alphaDistance, .001);
          gl_FragColor.a = min(max(alphaDistance * 3., 0.), 1.);
          /* if (gl_FragColor.a < 0.999) {
            discard;
          } */
        }
      `,
      side: THREE.DoubleSide,
      transparent: true,
      // alphaTest: 0.9,
    });
  };

  // const texture = new THREE.Texture();
  // texture.anisotropy = 16;
  const particleGeometry = new THREE.PlaneBufferGeometry(1, 1);

  const particleMeshes = [];
  ((async () => {
    const fileSpecs = await (async () => {
      const res = await fetch(`https://webaverse.github.io/fx-textures/fx-files.json`);
      const json = await res.json();
      return json;
    })();
    // console.log('got file specs', fileSpecs);
    // const fileSpec = fileSpecs[0];

    const startIndex = 30;
    const numParticles = 30;
    for (let i = startIndex; i < fileSpecs.length && (i - startIndex) < numParticles; i++) {
      const fileSpec = fileSpecs[i];
      const {name, numFrames} = fileSpec;
      const texture = await new Promise((accept, reject) => {
        const u = `https://webaverse.github.io/fx-textures/${name + '-spritesheet.ktx2'}`;
        ktx2Loader.load(u, accept, function onProgress() {}, reject);
      });
      // console.log('got tex', texture);
      // window.THREE = THREE;
      texture.anisotropy = 16;
      // particleMaterial.uniforms.uTex.value = texture;
      // particleMaterial.uniforms.uTex.needsUpdate = true;
      // console.log('loaded', texture);
      const material = _makeParticleMaterial({
        texture,
        numFrames,
      });
      
      const particleMesh = new THREE.Mesh(particleGeometry, material);
      particleMesh.position.x = i - startIndex;
      particleMesh.position.y = 1;
      particleMesh.updateMatrixWorld();
      particleMesh.frustumCulled = false;
      app.add(particleMesh);
      particleMesh.updateMatrixWorld();

      particleMeshes.push(particleMesh);
    }
  })());

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