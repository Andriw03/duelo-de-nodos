#!/usr/bin/env node
/* Genera el APK de prueba (depuración) para instalar en teléfonos Android.
   Uso: npm run apk  ->  dist/duelo-de-nodos-<versión>-debug.apk

   Pasos: build.py --out www, npx cap sync android, gradlew assembleDebug.
   Android necesita JDK 17 o superior: si JAVA_HOME apunta a uno más viejo (o no existe),
   se usa el JDK que trae Android Studio (carpeta "jbr"). Igual con el SDK de Android. */
'use strict';
const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const RAIZ = path.join(__dirname, '..');
const WIN = process.platform === 'win32';

function correr(cmd, args, opts) {
  console.log('\n> ' + cmd + ' ' + args.join(' '));
  const r = spawnSync(cmd, args, Object.assign({ cwd: RAIZ, stdio: 'inherit', shell: WIN }, opts));
  if (r.status !== 0) { console.error('\nFalló: ' + cmd + ' ' + args.join(' ')); process.exit(r.status || 1); }
}

// En Windows "python3" suele ser un acceso directo a la Microsoft Store que no funciona.
function python() {
  for (const p of WIN ? ['python', 'py', 'python3'] : ['python3', 'python']) {
    if (spawnSync(p, ['--version'], { shell: WIN }).status === 0) return p;
  }
  console.error('No se encontró Python 3.'); process.exit(1);
}

function versionJava(home) {
  const java = path.join(home, 'bin', WIN ? 'java.exe' : 'java');
  if (!fs.existsSync(java)) return 0;
  const r = spawnSync(java, ['-version'], { encoding: 'utf8' });
  const m = /version "(\d+)(?:\.(\d+))?/.exec((r.stderr || '') + (r.stdout || ''));
  if (!m) return 0;
  return m[1] === '1' ? Number(m[2]) : Number(m[1]); // "1.8" -> 8
}

function buscarJava() {
  if (process.env.JAVA_HOME && versionJava(process.env.JAVA_HOME) >= 17) return process.env.JAVA_HOME;
  const candidatos = WIN
    ? ['C:\\Program Files\\Android\\Android Studio\\jbr', path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Android Studio', 'jbr')]
    : process.platform === 'darwin'
      ? ['/Applications/Android Studio.app/Contents/jbr/Contents/Home']
      : [path.join(os.homedir(), 'android-studio', 'jbr'), '/opt/android-studio/jbr', '/snap/android-studio/current/jbr'];
  const ok = candidatos.find(c => versionJava(c) >= 17);
  if (!ok) { console.error('Se necesita JDK 17+. Instala Android Studio o apunta JAVA_HOME a un JDK 17+.'); process.exit(1); }
  return ok;
}

function buscarSdk() {
  const env = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT;
  if (env && fs.existsSync(env)) return env;
  const def = WIN ? path.join(process.env.LOCALAPPDATA || '', 'Android', 'Sdk')
    : process.platform === 'darwin' ? path.join(os.homedir(), 'Library', 'Android', 'sdk')
      : path.join(os.homedir(), 'Android', 'Sdk');
  if (fs.existsSync(def)) return def;
  console.error('No se encontró el SDK de Android. Ábrelo una vez con Android Studio o define ANDROID_HOME.'); process.exit(1);
}

const javaHome = buscarJava();
const sdk = buscarSdk();
console.log('JDK: ' + javaHome + '\nSDK: ' + sdk);

correr(python(), ['build.py', '--out', 'www']);
correr('npx', ['cap', 'sync', 'android']);
// Ruta absoluta y entre comillas: en Windows cmd no busca .bat relativos al cwd de forma fiable
// y la ruta del proyecto puede tener espacios.
const gradlew = path.join(RAIZ, 'android', WIN ? 'gradlew.bat' : 'gradlew');
correr(WIN ? '"' + gradlew + '"' : gradlew, ['assembleDebug', '--console=plain'], {
  cwd: path.join(RAIZ, 'android'),
  env: Object.assign({}, process.env, { JAVA_HOME: javaHome, ANDROID_HOME: sdk })
});

const gradle = fs.readFileSync(path.join(RAIZ, 'android', 'app', 'build.gradle'), 'utf8');
const version = (/versionName\s+"([^"]+)"/.exec(gradle) || [])[1] || 'dev';
const origen = path.join(RAIZ, 'android', 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk');
const destino = path.join(RAIZ, 'dist', 'duelo-de-nodos-' + version + '-debug.apk');
fs.mkdirSync(path.dirname(destino), { recursive: true });
fs.copyFileSync(origen, destino);
console.log('\nAPK listo: ' + path.relative(RAIZ, destino) + ' (' + (fs.statSync(destino).size / 1048576).toFixed(1) + ' MB)');
