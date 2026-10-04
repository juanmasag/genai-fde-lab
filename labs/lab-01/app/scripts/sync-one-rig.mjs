import { cpSync, copyFileSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here=dirname(fileURLToPath(import.meta.url));
const appRoot=resolve(here,'..');
const repoRoot=resolve(appRoot,'../../..');
const source=resolve(repoRoot,'assets/characters/one/source/rig/facial-v2/generated');
const target=resolve(appRoot,'public/characters/one/rig-v2');
const layers=resolve(source,'layers');
const manifest=resolve(source,'manifest.json');
const tabletBack=resolve(repoRoot,'assets/characters/one/source/raster/components/props/tablet-back.png');
const handGrip=resolve(repoRoot,'assets/characters/one/source/raster/components/hands/hand-fist-horizontal.png');

if(!existsSync(layers)||!existsSync(manifest)||!existsSync(tabletBack)||!existsSync(handGrip)){
  throw new Error('ONE facial-v2 or canonical tablet/hand assets are missing. Build the canonical assets before building LAB-01.');
}

rmSync(target,{recursive:true,force:true});
mkdirSync(target,{recursive:true});
cpSync(layers,resolve(target,'layers'),{recursive:true});
copyFileSync(manifest,resolve(target,'manifest.json'));
mkdirSync(resolve(target,'props'),{recursive:true});
copyFileSync(tabletBack,resolve(target,'props/tablet-back.png'));
copyFileSync(handGrip,resolve(target,'props/hand-grip.png'));

console.log('Synced ONE facial rig v2 + canonical tablet/hand props into LAB-01 public runtime.');
