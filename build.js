const JavaScriptObfuscator = require('javascript-obfuscator');
const fs = require('fs');
const path = require('path');

const SRC_DIR = path.join(__dirname, 'src');
const DIST_DIR = path.join(__dirname, 'dist');

fs.mkdirSync(DIST_DIR, { recursive: true });

const loaderSrc = fs.readFileSync(path.join(SRC_DIR, 'loader.js'), 'utf8');

const obfuscationConfig = {
  compact: true,
  controlFlowFlattening: true,
  controlFlowFlatteningThreshold: 0.75,
  deadCodeInjection: true,
  deadCodeInjectionThreshold: 0.4,
  debugProtection: false,
  selfDefending: false,
  stringArray: true,
  stringArrayEncoding: ['base64'],
  stringArrayThreshold: 0.75,
  stringArrayRotate: true,
  stringArrayShuffle: true,
  identifierNamesGenerator: 'hexadecimal',
  renameGlobals: false,
  renameProperties: false,
  target: 'browser',
  seed: 0,
};

console.log('Vexel Runtime — Build Pipeline\n');
console.log('Obfuscating loader...');

const startTime = Date.now();
const result = JavaScriptObfuscator.obfuscate(loaderSrc, obfuscationConfig);
const obfuscatedCode = result.getObfuscatedCode();
const elapsed = Date.now() - startTime;

const outputPath = path.join(DIST_DIR, 'scaled-loader.js');
fs.writeFileSync(outputPath, obfuscatedCode);

const srcSize = Buffer.byteLength(loaderSrc, 'utf8');
const outSize = Buffer.byteLength(obfuscatedCode, 'utf8');

console.log(`Done in ${elapsed}ms`);
console.log(`  Source:     ${(srcSize / 1024).toFixed(1)} KB`);
console.log(`  Obfuscated: ${(outSize / 1024).toFixed(1)} KB`);
console.log(`  Output:     ${outputPath}\n`);
