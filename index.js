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
  const {renderer, scene, camera} = useInternals();
  const physics = usePhysics();
  // const {CapsuleGeometry} = useGeometries();
  const {WebaverseShaderMaterial} = useMaterials();
  // const Text = useTextInternal();

  const canvasSize = 4096;
  const frameSize = 512;
  const rowSize = Math.floor(canvasSize/frameSize);
  const maxNumFrames = rowSize * rowSize;

  const texture = new THREE.Texture();
  texture.anisotropy = 16;
  const particleGeometry = new THREE.PlaneBufferGeometry(1, 1);
  const particleMaterial = new WebaverseShaderMaterial({
    uniforms: {
      uTime: {
        value: 0,
        needsUpdate: true,
      },
      uTex: {
        value: texture,
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
      // varying vec3 vPosition;
      varying vec2 vUv;

      const vec3 lineColor1 = vec3(${new THREE.Color(0x29b6f6).toArray().join(', ')});
      const vec3 lineColor2 = vec3(${new THREE.Color(0x0288d1).toArray().join(', ')});
      const vec3 lineColor3 = vec3(${new THREE.Color(0xec407a).toArray().join(', ')});
      const vec3 lineColor4 = vec3(${new THREE.Color(0xc2185b).toArray().join(', ')});

      void main() {
        const float maxNumFrames = ${maxNumFrames.toFixed(8)};
        const float rowSize = ${rowSize.toFixed(8)};

        float f = mod(uTime, 1.);
        float frame = floor(f * maxNumFrames);
        float x = mod(frame, rowSize);
        float y = floor(frame / rowSize);

        vec2 uv = vec2(x / rowSize, 1. - y / rowSize) + vUv / rowSize;

        vec4 c = texture2D(uTex, uv);
        if (c.a > 0.01) {
          gl_FragColor = c;
        } else {
          discard;
        }
      }
    `,
    side: THREE.DoubleSide,
    transparent: true,
  });
  const particleMesh = new THREE.Mesh(particleGeometry, particleMaterial);
  particleMesh.position.y = 1;
  particleMesh.updateMatrixWorld();
  particleMesh.frustumCulled = false;
  scene.add(particleMesh);

  e.waitUntil((async () => {
    const video = document.createElement('video');
    video.addEventListener('canplaythrough', e => {
      console.log('can play through');

      const canvas = document.createElement('canvas');
      canvas.width = canvasSize;
      canvas.height = canvasSize;
      const ctx = canvas.getContext('2d');
      
      /* document.body.appendChild(canvas);
      canvas.style.cssText = `\
        position: absolute;
        top: 0;
        left: 0;
        width: 1024px;
        height: 1024px;
        z-index: 1;
      `; */

      // document.body.appendChild(video);
      // video.play();

      let frame = 0;
      const captureFrameRate = 1/30;
      const _recurse = async () => {
        // if (!video.paused) {
          const currentTime = frame++ * captureFrameRate;
          video.currentTime = currentTime;
          if (currentTime < video.duration) {
            console.log('wait for frame', video.currentTime, video.duration);
            await new Promise(accept => {
              video.requestVideoFrameCallback(accept);
            });

            const x = frame % rowSize;
            const y = Math.floor(frame / rowSize);
            ctx.drawImage(video, x * frameSize, y * frameSize, frameSize, frameSize);

            console.log('frame', frame);

            _recurse();
          } else {
            console.log('video done', currentTime);

            texture.image = canvas;
            texture.needsUpdate = true;
          }
        /* } else {
          console.log('frame end');
        } */
      };
      _recurse();
    }, {once: true});
    video.onerror = err => {
      console.warn('video load error', err);
    };
    video.src = `${baseUrl}Smoke_01.mov.webm`;
    video.muted = true;
    video.loop = false;
    video.controls = true;
    /* video.style.cssText = `\
      position: absolute;
      top: 0;
      left: 0;
    `; */
    // console.log('got video', video);
    //window.video = video;
  })());

  const physicsIds = [];

  /* let activateCb = null;
  let frameCb = null;
  useActivate(() => {
    activateCb && activateCb();
  }); */
  useFrame(({timestamp, timeDiff}) => {
    // frameCb && frameCb();

    particleMesh.material.uniforms.uTime.value = timestamp / 1000;
    particleMesh.material.uniforms.uTime.needsUpdate = true;

    // material.uniforms.time.value = (performance.now() / 1000) % 1;
  });
  
  useCleanup(() => {
    for (const physicsId of physicsIds) {
      physics.removeGeometry(physicsId);
    }
  });

  return app;
};