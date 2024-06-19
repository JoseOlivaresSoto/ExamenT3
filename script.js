import * as THREE from './build/three.module.js';
import Stats from './jsm/libs/stats.module.js';
import { OrbitControls } from './jsm/controls/OrbitControls.js';
import { FBXLoader } from './jsm/loaders/FBXLoader.js';
import { GUI } from './jsm/libs/lil-gui.module.min.js';

let camera, scene, renderer, stats, object, loader, guiMorphsFolder;
const clock = new THREE.Clock();
let mixer;
const params = {
    asset: 'Walking'
};
const assets = [
    'Walking',
    'Jump'
];
// Movement controls
const moveState = {
    forward: false,
    backward: false,
    left: false,
    right: false
};
// Jumping controls
let isJumping = false;
let jumpVelocity = 0;
const jumpSpeed = 1000; // Velocidad inicial de salto
const gravity = 3000;   // Gravedad aplicada durante el salto

init();
function init() {
    const container = document.getElementById('container');

    // Initialize camera
    camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 1, 2000);
    camera.position.set(100, 200, 300);

    // Initialize scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xa0a0a0);
    scene.fog = new THREE.Fog(0xa0a0a0, 200, 1000);

    // Lights
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 5);
    hemiLight.position.set(0, 200, 0);
    scene.add(hemiLight);

    const dirLight = new THREE.DirectionalLight(0xe80505, 5);
    dirLight.position.set(0, 200, 100);
    dirLight.castShadow = true;
    dirLight.shadow.camera.top = 180;
    dirLight.shadow.camera.bottom = -100;
    dirLight.shadow.camera.left = -120;
    dirLight.shadow.camera.right = 120;
    scene.add(dirLight);

    // Ground
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2000, 2000), new THREE.MeshPhongMaterial({ color: 0x999999, depthWrite: false }));
    mesh.rotation.x = -Math.PI / 2;
    mesh.receiveShadow = true;
    scene.add(mesh);

    const grid = new THREE.GridHelper(2000, 20, 0x000000, 0x000000);
    grid.material.opacity = 0.2;
    grid.material.transparent = true;
    scene.add(grid);

    // Loader
    loader = new FBXLoader();
    loadAsset(params.asset);

    // Renderer
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setAnimationLoop(animate);
    renderer.shadowMap.enabled = true;
    container.appendChild(renderer.domElement);

    // Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 100, 0);
    controls.update();

    // Events
    window.addEventListener('resize', onWindowResize);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    // Stats
    stats = new Stats();
    container.appendChild(stats.dom);

    // GUI
    const gui = new GUI();
    gui.add(params, 'asset', assets).onChange(function(value) {
        loadAsset(value);
    });
    guiMorphsFolder = gui.addFolder('Morphs').hide();

    // Add random objects
    addRandomCubes(15);
}

function loadAsset(asset) {
    loader.load('models/fbx/' + asset + '.fbx', function(group) {
        if (object) {
            object.traverse(function(child) {
                if (child.material) child.material.dispose();
                if (child.material && child.material.map) child.material.map.dispose();
                if (child.geometry) child.geometry.dispose();
            });
            scene.remove(object);
        }

        object = group;
        if (object.animations && object.animations.length) {
            mixer = new THREE.AnimationMixer(object);
            const action = mixer.clipAction(object.animations[0]);
            action.play();
        } else {
            mixer = null;
        }

        guiMorphsFolder.children.forEach((child) => child.destroy());
        guiMorphsFolder.hide();
        object.traverse(function(child) {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
                if (child.morphTargetDictionary) {
                    guiMorphsFolder.show();
                    const meshFolder = guiMorphsFolder.addFolder(child.name || child.uuid);
                    Object.keys(child.morphTargetDictionary).forEach((key) => {
                        meshFolder.add(child.morphTargetInfluences, child.morphTargetDictionary[key], 0, 1, 0.01);
                    });
                }
            }
        });

        scene.add(object);
    });
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function onKeyDown(event) {
    switch (event.keyCode) {
        case 87: // W
            moveState.forward = true;
            break;
        case 83: // S
            moveState.backward = true;
            break;
        case 65: // A
            moveState.left = true;
            break;
        case 68: // D
            moveState.right = true;
            break;
        case 32: // Space
            if (!isJumping) {
                isJumping = true;
                jumpVelocity = jumpSpeed;
            }
            break;
    }
}

function onKeyUp(event) {
    switch (event.keyCode) {
        case 87: // W
            moveState.forward = false;
            break;
        case 83: // S
            moveState.backward = false;
            break;
        case 65: // A
            moveState.left = false;
            break;
        case 68: // D
            moveState.right = false;
            break;
    }
}

function animate() {
    const delta = clock.getDelta();
    if (mixer) mixer.update(delta);
    moveCharacter(delta);

    // Aplicar el salto
    if (isJumping) {
        // Calcular nueva posición vertical
        const deltaY = jumpVelocity * delta - 0.5 * gravity * delta * delta;
        object.position.y += deltaY;
        // Actualizar la velocidad de salto debido a la gravedad
        jumpVelocity -= gravity * delta;
        // Si ha tocado el suelo, detener el salto
        if (object.position.y <= 0) {
            object.position.y = 0;
            isJumping = false;
        }
    }

    renderer.render(scene, camera);
    stats.update();
}

function moveCharacter(delta) {
    if (!object) return;
    const speed = 100; // Ajustar según sea necesario
    const moveDistance = speed * delta;
    if (moveState.forward) {
        object.translateZ(-moveDistance);
    }
    if (moveState.backward) {
        object.translateZ(moveDistance);
    }
    if (moveState.left) {
        object.translateX(-moveDistance);
    }
    if (moveState.right) {
        object.translateX(moveDistance);
    }
}

function addRandomCubes(numCubes) {
    const material = new THREE.MeshPhongMaterial({ color: 0x00ff00 });

    for (let i = 0; i < numCubes; i++) {
        const geometry = new THREE.BoxGeometry();
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(
            Math.random() * 2000 - 1000,
            Math.random() * 50,
            Math.random() * 2000 - 1000
        );
        mesh.scale.set(
            Math.random() * 50 + 50,  // Hacer los cubos más grandes
            Math.random() * 50 + 50,  // Hacer los cubos más grandes
            Math.random() * 50 + 50   // Hacer los cubos más grandes
        );
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        scene.add(mesh);
    }
}
