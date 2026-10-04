import { cpSync, copyFileSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here=dirname(fileURLToPath(import.meta.url));
const appRoot=resolve(here,'..');
const repoRoot=resolve(appRoot,'../../../..');
const source=resolve(repoRoot,'assets/characters/one/source/rig/facial-v2/generated');
const target=resolve(appRoot,'public/characters/one/rig-v2');
const layers=resolve(source,'layers');
const manifest=resolve(source,'manifest.json');

if(!existsSync(layers)||!existsSync(manifest)){
  throw new Error('ONE facial-v2 generated assets are missing. Build the canonical rig before building LAB-01.');
}

rmSync(target,{recursive:true,force:true});
mkdirSync(target,{recursive:true});
cpSync(layers,resolve(target,'layers'),{recursive:true});
copyFileSync(manifest,resolve(target,'manifest.json'));

console.log('Synced ONE facial rig v2 into LAB-01 public runtime.');
