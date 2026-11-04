import * as THREE from 'three';
import * as TWEEN from '@tweenjs/tween.js';
import { TrackballControls } from 'three/addons/controls/TrackballControls.js';
import { CSS3DRenderer, CSS3DObject } from 'three/addons/renderers/CSS3DRenderer.js';

// ---- Where OAuth details are put in to connect ----
const CLIENT_ID = '265442246088-9f3v78g1ap73pgaen7atte9701s1ns5c.apps.googleusercontent.com';
const SPREADSHEET_ID = '1IB7EoP0GL9uKzD4P5ByO8QpHoetCLLWgsqfjuS0xoEg';
const SHEET_NAME = 'Sheet1';

const SCOPE = 'https://www.googleapis.com/auth/spreadsheets.readonly';

const errorBox = document.getElementById('error');
const signInButton = document.getElementById('signin');
let tokenClient = null;


// ---------- For Login page ----------

signInButton.addEventListener('click', function () {
  if (!window.google) {
    errorBox.textContent = 'Google is still loading, try again in a second.';
    return;
  }

  if (tokenClient === null) {
    tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPE,
      callback: handleToken
    });
  }

  tokenClient.requestAccessToken({ prompt: 'select_account' });
});

// This is used when user has logged in and has given access
async function handleToken(response) {
  if (response.error) {
    errorBox.textContent = 'Sign in failed: ' + response.error;
    return;
  }

  try {
    const people = await getPeople(response.access_token);
    document.getElementById('login').classList.add('hidden');
    document.getElementById('bar').hidden = false;
    startScene(people);
  } catch (err) {
    errorBox.textContent = err.message;
  }
}


// ---------- Getting all the data from the sheet provided ----------

// Everything is turned into number format
function toNumber(text) {
  const cleaned = String(text).replace(/[^0-9.]/g, '');
  return parseFloat(cleaned) || 0;
}

async function getPeople(token) {
  const url = 'https://sheets.googleapis.com/v4/spreadsheets/' + SPREADSHEET_ID +
              '/values/' + encodeURIComponent(SHEET_NAME);

  const response = await fetch(url, {
    headers: { Authorization: 'Bearer ' + token }
  });

  if (response.status === 403 || response.status === 404) {
    throw new Error('This Google account cannot open the sheet. Ask the owner to share it with you.');
  }
  if (!response.ok) {
    throw new Error('Could not load the sheet (error ' + response.status + ').');
  }

  const data = await response.json();
  const header = data.values[0];
  const rows = data.values.slice(1);

  // Find each column heading in the csv as some of them have unneccessary spacing
  function findColumn(name) {
    for (let i = 0; i < header.length; i++) {
      if (header[i].trim().toLowerCase() === name) {
        return i;
      }
    }
    return -1;
  }

  const nameCol = findColumn('name');
  const photoCol = findColumn('photo');
  const ageCol = findColumn('age');
  const countryCol = findColumn('country');
  const interestCol = findColumn('interest');
  const worthCol = findColumn('net worth');

  const people = [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    people.push({
      name: row[nameCol],
      photo: row[photoCol],
      age: row[ageCol],
      country: row[countryCol],
      interest: row[interestCol],
      worth: toNumber(row[worthCol])
    });
  }
  return people;
}


// ---------- Functions for the tiles ----------

// Anything below 100000 will appear as red, anything above 200000 will be green and everythin else will be orange as stated in the instructions
function getColor(worth) {
  if (worth < 100000) {
    return 'red';
  }
  if (worth > 200000) {
    return 'green';
  }
  return 'orange';
}

function makeTile(person) {
  const tile = document.createElement('div');
  tile.className = 'tile ' + getColor(person.worth);
  tile.title = person.name + ': $' + person.worth.toLocaleString();

  const top = document.createElement('div');
  top.className = 'top';
  const country = document.createElement('span');
  country.textContent = person.country;
  const age = document.createElement('span');
  age.textContent = person.age;
  top.appendChild(country);
  top.appendChild(age);

  const photo = document.createElement('img');
  photo.src = person.photo;
  photo.alt = person.name;

  const name = document.createElement('div');
  name.className = 'name';
  name.textContent = person.name;

  const interest = document.createElement('div');
  interest.className = 'interest';
  interest.textContent = person.interest;

  tile.appendChild(top);
  tile.appendChild(photo);
  tile.appendChild(name);
  tile.appendChild(interest);
  return tile;
}


// ---------- layouts ----------
// each one returns a list of Object3D, one per tile. they're only used
// to hold the target position/rotation that the tiles animate towards.

function tableLayout(count) {
  const targets = [];
  for (let i = 0; i < count; i++) {
    const column = i % 20;
    const row = Math.floor(i / 20);
    const target = new THREE.Object3D();
    // 20 columns x 10 rows, the -9.5 / -4.5 centres it on the screen
    target.position.x = (column - 9.5) * 140;
    target.position.y = -(row - 4.5) * 180;
    targets.push(target);
  }
  return targets;
}

function sphereLayout(count) {
  const targets = [];
  const lookAtPoint = new THREE.Vector3();
  for (let i = 0; i < count; i++) {
    const phi = Math.acos(-1 + (2 * i) / count);
    const theta = Math.sqrt(count * Math.PI) * phi;
    const target = new THREE.Object3D();
    target.position.setFromSphericalCoords(800, phi, theta);
    // look at a point further out so the tile faces away from the centre
    lookAtPoint.copy(target.position).multiplyScalar(2);
    target.lookAt(lookAtPoint);
    targets.push(target);
  }
  return targets;
}

function helixLayout(count) {
  const targets = [];
  const lookAtPoint = new THREE.Vector3();
  for (let i = 0; i < count; i++) {
    // even tiles go on strand 0, odd tiles on strand 1
    const strand = i % 2;
    const step = Math.floor(i / 2);
    // strand 1 is shifted half a turn (PI) so the two strands sit opposite each other
    const angle = step * 0.35 + strand * Math.PI;
    const height = -(step * 16) + (count / 4) * 16;
    const target = new THREE.Object3D();
    target.position.setFromCylindricalCoords(900, angle, height);
    lookAtPoint.set(target.position.x * 2, target.position.y, target.position.z * 2);
    target.lookAt(lookAtPoint);
    targets.push(target);
  }
  return targets;
}

function gridLayout(count) {
  const targets = [];
  for (let i = 0; i < count; i++) {
    const column = i % 10;                   // 10 across
    const row = Math.floor(i / 10) % 4;      // 4 down
    const layer = Math.floor(i / 40);        // 5 deep
    const target = new THREE.Object3D();
    target.position.x = (column - 4.5) * 170;
    target.position.y = -(row - 1.5) * 200;
    target.position.z = (layer - 2) * 400;
    targets.push(target);
  }
  return targets;
}

const layouts = {
  table: tableLayout,
  sphere: sphereLayout,
  helix: helixLayout,
  grid: gridLayout
};


// ---------- For the 3D effects ----------

function startScene(people) {
  const camera = new THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 1, 10000);
  camera.position.z = 3000;

  const scene = new THREE.Scene();
  const objects = [];

  // To make it one 3D object per person where it starts from a random spot
  for (let i = 0; i < people.length; i++) {
    const object = new CSS3DObject(makeTile(people[i]));
    object.position.x = Math.random() * 4000 - 2000;
    object.position.y = Math.random() * 4000 - 2000;
    object.position.z = Math.random() * 4000 - 2000;
    scene.add(object);
    objects.push(object);
  }

  const renderer = new CSS3DRenderer();
  renderer.setSize(window.innerWidth, window.innerHeight);
  document.getElementById('container').appendChild(renderer.domElement);

  const controls = new TrackballControls(camera, renderer.domElement);
  controls.minDistance = 500;
  controls.maxDistance = 6000;

  const buttons = document.querySelectorAll('#bar button');

  function showLayout(name) {
    const targets = layouts[name](objects.length);
    TWEEN.removeAll();

    for (let i = 0; i < objects.length; i++) {
      const duration = 1500 + Math.random() * 1000;

      new TWEEN.Tween(objects[i].position)
        .to({ x: targets[i].position.x, y: targets[i].position.y, z: targets[i].position.z }, duration)
        .easing(TWEEN.Easing.Exponential.InOut)
        .start();

      new TWEEN.Tween(objects[i].rotation)
        .to({ x: targets[i].rotation.x, y: targets[i].rotation.y, z: targets[i].rotation.z }, duration)
        .easing(TWEEN.Easing.Exponential.InOut)
        .start();
    }

    // Be able to highlight any active buttons
    for (let i = 0; i < buttons.length; i++) {
      buttons[i].classList.toggle('active', buttons[i].dataset.layout === name);
    }
  }

  for (let i = 0; i < buttons.length; i++) {
    buttons[i].addEventListener('click', function () {
      showLayout(this.dataset.layout);
    });
  }

  window.addEventListener('resize', function () {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  function animate() {
    requestAnimationFrame(animate);
    TWEEN.update();
    controls.update();
    renderer.render(scene, camera);
  }

  animate();
  showLayout('table');
}
