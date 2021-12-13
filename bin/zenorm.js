#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import { generate } from '../lib/generate.js';

async function getConfig() {
  const configFile = path.join(process.cwd(), process.argv[3]);
  const config = configFile.endsWith('.json') ? JSON.parse(await fs.readFile(configFile)) : (await import('file://' + configFile)).default;
  const optionsDir = path.resolve(process.cwd(), config.optionsDir || 'models_options');
  const typingFile = path.resolve(process.cwd(), config.typingFile || 'models.d.ts');
  const modelsFile = path.resolve(process.cwd(), config.modelsFile || 'models.js');
  // let tsRelative = path.relative(modelsFile, tsFile).replace(/\\/g, '/').substring(3);
  // if (!tsRelative.startsWith('../')) tsRelative = `./${tsRelative}`;
  // tsRelative = tsRelative.slice(0, -5); // remove .d.ts
  return {
    ...config,
    optionsDir,
    typingFile,
    modelsFile,
  };
}

if (process.argv[2] !== 'gen' || !process.argv[3]) {
  console.log('zenorm gen config.json');
  process.exit(1);
} else {
  const config = await getConfig();
  await generate(config);
  process.exit();
}
