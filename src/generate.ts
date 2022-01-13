import { promises as fs } from 'fs';
import * as path from 'path';
import { pascalCase } from 'pascal-case';
import { DataResult, Query } from './types';

function getColumnType(type: string) {
  if (type.search(/timestamp|datetime/i) != -1) return 'Date';
  if (type.search(/int|float/i) != -1) return 'number';
  return 'string';
}

function checkFileDir(filename: string) {
  const dir = path.dirname(filename);
  return fs.mkdir(dir, { recursive: true });
}

interface GenerateConfig {
  optionsDir?: string;
  modelsFile?: string;
  typingFile?: string;
  declareQueriesToModule?: string;
}

async function getDatabaseName(query: Query) {
  const res = <DataResult[]> await query.query('SELECT DATABASE() AS name');
  return res[0].name;
}

export async function generate(query: Query, config: GenerateConfig) {
  console.log('generate models...');
  const database = await getDatabaseName(query);
  console.log('database:', database);
  const tables = <DataResult[]> await query.query('SHOW TABLES');
  const remark = [
    '// zenorm auto generate',
    '// This file is automatically generated',
    '// Please do not modify',
    `// date: ${new Date().toLocaleString()}`,
    `// user: ${process.env.USER || process.env.USERNAME || '-'}@${process.env.COMPUTERNAME || '-'}`,
    `// database: ${database}`,
  ];
  const ts = [
    ...remark,
    `import { Instance, Model, Query } from 'zenorm';`,
    '',
  ];
  const js = [
    ...remark,
    `import fs from 'node:fs/promises';`,
    `import { Model } from 'zenorm';`,
    '',
    'const modelMap = {};',
    '',
  ];
  const optionsJs = [];
  const queriesTs = [];
  const queriesJs = [];
  for (const t of tables) {
    const tableName = <string> t[`Tables_in_${database}`];
    const className = pascalCase(tableName);
    console.log('table:', tableName);
    const columns = <DataResult[]> await query.query('SHOW FULL COLUMNS FROM ??', [tableName]);
    let pk;
    ts.push(`/**`);
    ts.push(` * table: ${tableName}`);
    ts.push(` */`);
    ts.push(`export declare class ${className}Instance extends Instance {`);
    for (const c of columns) {
      if (!pk && c.Key === 'PRI') pk = c.Field;
      ts.push(`  /**`);
      c.Comment && ts.push(`   * ${c.Comment}`);
      ts.push(`   * ${c.Type} ${c.Extra}`);
      ts.push(`   */`);
      ts.push(`  ${c.Field}: ${getColumnType(<string> c.Type)};`);
    }
    ts.push(`}`);
    ts.push(``);
    ts.push(`export declare class ${className}Model extends Model<${className}Instance> {}`);
    ts.push(`export declare function ${className}Query(query: Query): ${className}Model;`);
    ts.push(``);

    // options
    const optionFilename = path.join(config.optionsDir, `${tableName}.js`);
    let optionRelative = path.relative(config.modelsFile, optionFilename).replace(/\\/g, '/').substring(3);
    if (!optionRelative.startsWith('../')) optionRelative = `./${optionRelative}`;
    // optionRelative = optionRelative.slice(0, -3); // remove .js
    optionsJs.push(`await loadModelOption(${className}Option, '${optionRelative}');`);

    // js
    js.push(`const ${className}Option = { name: '${tableName}', table: '${tableName}', pk: '${pk}', modelMap };`);
    js.push(`export function ${className}Query(query) { return new Model(${className}Option, query); }`);
    js.push(`modelMap['${tableName}'] = ${className}Query;`);
    js.push(``);

    // queries
    const prop = `${className.charAt(0).toLowerCase()}${className.slice(1)}`;
    queriesTs.push(`  ${prop}: ${className}Model;`);
    queriesJs.push(`  get ${prop}() { return ${className}Query(this._query); }`);
  }

  // queries
  ts.push(`export declare class Queries {`);
  ts.push(`  constructor(query: Query);`);
  ts.push(...queriesTs);
  ts.push(`}`);
  ts.push(``);
  ts.push(`export declare function queries(query: Query): Queries;`);
  ts.push(``);

  // 添加 Queries 到目标模块中
  if (config.declareQueriesToModule) {
    /** @type {string[]} */
    const _m = config.declareQueriesToModule.split('.');
    ts.push(`declare module '${_m[0]}' {`);
    ts.push(`  interface ${_m.slice(1, -1).join('.')} {`);
    ts.push(`    ${_m[_m.length - 1]}: Queries;`);
    ts.push(`  }`);
    ts.push(`}`);
    ts.push(``);
  }

  js.push(`export class Queries {`);
  js.push(`  constructor(query) { this._query = query; }`);
  js.push(...queriesJs);
  js.push(`}`);
  js.push(``);

  js.push(`export function queries(query) { return new Queries(query); }`);
  js.push(``);

  js.push(`/* options update */`);
  js.push(`async function loadModelOption(option, file) {`);
  js.push(`  const url = new URL(file, import.meta.url);`);
  js.push(`  if (await fs.access(url).then(() => true, () => false)) {`);
  js.push(`    const mod = await import(url);`);
  js.push(`    Object.assign(option, mod.default);`);
  js.push(`  }`);
  js.push(`}`);
  js.push(``);
  js.push(...optionsJs);
  js.push(``);

  console.log(`write types file: ${config.typingFile}`);
  await checkFileDir(config.typingFile);
  await fs.writeFile(config.typingFile, ts.join('\n'));

  console.log(`write models file: ${config.modelsFile}`);
  await checkFileDir(config.modelsFile);
  await fs.writeFile(config.modelsFile, js.join('\n'));
}
