#!/usr/bin/env node

import * as path from 'path';
import * as mysql from 'mysql2';
import { Query } from 'mysql-easy-query';
import { generate } from '../generate';

function getConfig() {
  const configFile = path.join(process.cwd(), process.argv[3]);
  const config = require(configFile);
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

function getQuery(config: mysql.ConnectionOptions) {
  const conn = mysql.createConnection({
    host: config.host || 'localhost',
    port: config.port || 3306,
    user: config.user || 'root',
    password: config.password,
    database: config.database,
  });
  return new Query(conn);
}

async function main() {
  const config = await getConfig();
  const query = getQuery(config);
  await generate(query, config);
}

if (process.argv[2] !== 'gen' || !process.argv[3]) {
  console.log('zenorm gen config.json');
  process.exit(1);
} else {
  main().then(() => process.exit(), e => {
    console.error(e);
    process.exit(1);
  });
}
