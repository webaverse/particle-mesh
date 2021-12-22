import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';
// import easing from './easing.js';
import metaversefile from 'metaversefile';
import {getCaretAtPoint} from 'troika-three-text';
const {useApp, useInternals, useGeometries, useMaterials, useFrame, useActivate, useLoaders, usePhysics, useTextInternal, addTrackedApp, useDefaultModules, useCleanup} = metaversefile;

const localVector = new THREE.Vector3();
const localVector2 = new THREE.Vector3();
const localVector2D = new THREE.Vector2();

export default e => {
  const app = useApp();
  const {renderer, scene, camera} = useInternals();
  const physics = usePhysics();
  // const {CapsuleGeometry} = useGeometries();
  const {WebaverseShaderMaterial} = useMaterials();
  const Text = useTextInternal();

  const redMaterial = new WebaverseShaderMaterial({
    uniforms: {
      uTime: {
        value: 0,
      },
    },
    vertexShader: `\
      uniform float uTime;
      varying vec3 vPosition;
      varying vec2 vUv;
      attribute float characterIndex;

      void main() {
        vPosition = vPosition;
        vUv = uv;
        
        const float rate = 1.5;
        const float range = 1.;

        float t = min(max(mod(uTime, 1.) - characterIndex*0.08, 0.), 1.);
        t = pow(t, 0.75);
        const float a = -20.;
        const float v = 4.;
        float y = max(0.5 * a * pow(t, 2.) + v * t, 0.);
        y *= 0.5;

        /* float characterFactorY = characterIndex * PI * 0.25;
        float timeFactorY = uTime * PI * 2. * rate;
        float factor = characterFactorY + timeFactorY;
        float sinFactor = 1. + sin(factor)*0.5;
        float y = pow(sinFactor, 0.2) * range; */

        vec3 p = position + vec3(0, y, 0);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }
    `,
    fragmentShader: `\
      varying vec3 vPosition;
      varying vec2 vUv;
      // uniform vec3 color;
      void main() {
        gl_FragColor = vec4(vUv, 0., 1.0);
      }
    `,
    side: THREE.DoubleSide,
    transparent: true,
  });
  async function makeTextMesh(
    text = '',
    font = '/fonts/Bangers-Regular.ttf',
    fontSize = 0.5,
    anchorX = 'center',
    anchorY = 'middle',
    color = 0x000000,
  ) {
    const textMesh = new Text();
    textMesh.material = redMaterial;
    textMesh.text = text;
    textMesh.font = font;
    textMesh.fontSize = fontSize;
    textMesh.color = color;
    textMesh.anchorX = anchorX;
    textMesh.anchorY = anchorY;
    textMesh.frustumCulled = false;
    // textMesh.outlineWidth = 0.1;
    // textMesh.outlineColor = 0x000000;
    await new Promise((accept, reject) => {
      textMesh.sync(accept);
    });
    const characterIndices = new Float32Array(textMesh.geometry.attributes.aTroikaGlyphIndex.array.length);
    for (let i = 0; i < characterIndices.length; i++) {
      characterIndices[i] = i;
    }
    const characterIndexAttribute = new THREE.InstancedBufferAttribute(characterIndices, 1, false);
    textMesh.geometry.setAttribute('characterIndex', characterIndexAttribute);
    return textMesh;
  }

  /* const numberStrings = Array(10);
  for (let i = 0; i < numberStrings.length; i++) {
    numberStrings[i] = i + '';
  } */
  /* const numberStrings = ['271'];
  let numberMeshes = null;
  let numberGeometries = null;
  let numberMaterials = null;
  e.waitUntil((async () => {
    numberMeshes = await Promise.all(numberStrings.map(async s => {
      // console.log('wait 1');
      const textMesh = await makeTextMesh(s);
      // console.log('wait 2');
      return textMesh;
    }));
    numberGeometries = numberMeshes.map(m => m.geometry);
    numberMaterials = numberMeshes.map(m => m.geometry);

    const tempScene = new THREE.Scene();
    for (const numberMesh of numberMeshes) {
      tempScene.add(numberMesh);
    }
    renderer.compile(tempScene, camera);
    for (const numberMesh of numberMeshes) {
      tempScene.remove(numberMesh);
    }

    window.numberMeshes = numberMeshes;
    window.numberGeometries = numberGeometries;
    window.numberMaterials = numberMaterials;
  })()); */

  let textMeshSpec = null;
  /* const textMesh = makeTextMesh('');
  textMesh.frustumCulled = false;
  scene.add(textMesh); */

  let running = false;
  useFrame(async ({timestamp}) => {
    // console.log('got', {numberGeometries, numberMaterial});
    if (!running) {
      running = true;

      if (textMeshSpec && timestamp >= textMeshSpec.endTime) {
        for (const textMesh of textMeshSpec.textMeshes) {
          scene.remove(textMesh);
        }
        textMeshSpec = null;
      }
      if (!textMeshSpec) {
        const text = Math.floor(Math.random() * 2000) + '';
        const textMesh = await makeTextMesh(text);
        textMesh.position.y = 2;
        textMesh.frustumCulled = false;
        textMesh.updateMatrixWorld();
        scene.add(textMesh);

        /* const textMesh = makeTextMesh(text, undefined, 1, 'center', 'middle', 0xffffff);
        setTimeout(() => {
          console.log('got', textMesh.geometry.attributes.aTroikaGlyphBounds?.array.length);
        }, 1000); */
        const textMeshes = [textMesh];
        textMeshSpec = {
          text,
          textMeshes,
          startTime: timestamp,
          endTime: timestamp + 1000,
        };
        window.textMeshSpec = textMeshSpec;
      }

      running = false;
    }

    if (textMeshSpec) {
      for (const textMesh of textMeshSpec.textMeshes) {
        textMesh.material.uniforms.uTime.value = (timestamp - textMeshSpec.startTime) / 1000;
      }
    }
  });

  const physicsIds = [];

  /* let activateCb = null;
  let frameCb = null;
  useActivate(() => {
    activateCb && activateCb();
  }); */
  useFrame(({timestamp, timeDiff}) => {
    // frameCb && frameCb();

    // material.uniforms.time.value = (performance.now() / 1000) % 1;
  });
  
  useCleanup(() => {
    for (const physicsId of physicsIds) {
      physics.removeGeometry(physicsId);
    }
  });

  return app;
};