import { promises as fs } from 'fs';
import * as path from 'path';
import { pascalCase } from 'pascal-case';
import { snakeCase } from 'snake-case';
import { DataResult, Query } from './types';

const zenormName = process.env.ZENORM_NAME || 'zenorm';

function getColumnType(type: string) {
  if (type.search(/timestamp|datetime|date/i) != -1) return 'Date';
  if (type.search(/int|float/i) != -1) return 'number';
  return 'string';
}

function cwdPath(p: string): string {
  if (p.startsWith('./')) {
    return path.join(process.cwd(), p.slice(2));
  }
  return p;
}

function checkFileDir(dir: string) {
  return fs.mkdir(dir, { recursive: true });
}

function fileExists(f: string) {
  return fs.access(f).then(() => true, e => false);
}

function datetime() {
  return new Date().toLocaleString();
}

async function getDatabaseName(query: Query) {
  const res = <DataResult[]> await query.query('SELECT DATABASE() AS name');
  return res[0].name;
}

interface GenerateConfig {
  host?: string;
  port?: number;
  user?: string;
  password?: string;
  database?: string;

  /**
   * 代码输出目录
   * @default './src/model'
   */
  outputDir?: string;

  /**
   * 生成数据库表结构文件名
   * 此文件每次生成都会被重新改写
   * @default '_tables'
   */
  tablesFilename?: string;

  /**
   * 生成 Queries 文件名
   * 此文件每次生成都会被重新改写
   * @default '_queries'
   */
  queriesFilename?: string;

  /**
   * 是否需将 Queries 定义到目标模块中
   * @default ['koa.DefaultContext.model']
   */
  declareQueriesToModules?: string[];
}

const defaultConfig: GenerateConfig = {
  outputDir: './src/model',
  tablesFilename: '_tables',
  queriesFilename: '_queries',
  declareQueriesToModules: ['koa.DefaultContext.model'],
}

export async function generate(query: Query, config: GenerateConfig) {
  console.log('generate models...');
  config = Object.assign({}, defaultConfig, config);

  const outputDir = cwdPath(config.outputDir);
  await checkFileDir(outputDir);

  const database = await getDatabaseName(query);
  console.log('database:', database);

  const tables = <DataResult[]> await query.query('SHOW TABLES');
  const remark = [
    '// zenorm 自动生成文件',
    '// 请不要修改此文件，因为此文件在每次重新生成数据库结构时会被覆盖',
    `// create at: ${datetime()}`,
    `// create by: ${process.env.USER || process.env.USERNAME || '-'}@${process.env.COMPUTERNAME || '-'}`,
    `// database: ${database}`,
  ];

  const structs: string[] = [...remark];
  const models: string[][] = [];

  for (const t of tables) {
    const tableName = <string> t[`Tables_in_${database}`];
    const className = pascalCase(tableName);
    const name = snakeCase(tableName);
    const outputFilename = path.join(outputDir, name + '.ts');
    console.log('table:', tableName);

    structs.push(`export class ${className}Table {`);
    let pk: string;
    const columns = <DataResult[]> await query.query('SHOW FULL COLUMNS FROM ??', [tableName]);
    for (const c of columns) {
      if (!pk && c.Key === 'PRI') pk = c.Field;
      const required = c.Null === 'NO' && c.Default === null && c.Extra !== 'auto_increment';
      structs.push(`  /**`);
      c.Comment && structs.push(`   * ${c.Comment}`);
      structs.push(`   * type: ${c.Type}`);
      structs.push(`   * collation: ${c.Collation}`);
      structs.push(`   * null: ${c.Null}`);
      structs.push(`   * default: ${c.Default}`);
      c.Extra && structs.push(`   * extra: ${c.Extra}`);
      structs.push(`   */`);
      structs.push(`  ${c.Field}${required ? '' : '?'}: ${getColumnType(<string> c.Type)};`);
    }
    structs.push('}');
    structs.push('');

    if (!await fileExists(outputFilename)) {
      const ts: string[] = [
        `import { model } from '${zenormName}';`,
        `import { ${className}Table } from './${config.tablesFilename}';`,
        '',
        `@model({`,
        `  pk: '${pk}',`,
        name != tableName ? `  name: '${name}',` : null,
        `  table: '${tableName}',`,
        `})`,
        `export default class ${className} extends ${className}Table {`,
        `}`,
        '',
      ];
      await fs.writeFile(outputFilename, ts.filter(i => i !== null).join('\n'));
    }

    models.push([name, className]);
  }

  const tablesFilename = path.join(outputDir, config.tablesFilename + '.ts');
  console.log(`write tables file: ${tablesFilename}`);
  await fs.writeFile(tablesFilename, structs.join('\n'));

  const queries: string[] = [
    ...remark,
    `import { Query, createRepositoryQuery } from '${zenormName}';`,
    ...models.map(([name, className]) => `import ${className} from './${name}'`),
    '',
    ...models.map(([name, className]) => `export const ${className}Query = createRepositoryQuery(${className});`),
    '',
    `export class Queries {`,
    `  _query: Query;`,
    `  constructor(query: Query) { this._query = query; }`,
    ...models.map(([name, className]) => `  get ${name}() { return ${className}Query(this._query); }`),
    `}`,
    '',
    'export {',
    ...models.map(([name, className]) => `  ${className},`),
    '};',
    ''
  ];

  // 添加 Queries 到目标模块中
  if (config.declareQueriesToModules) {
    for (const mod of config.declareQueriesToModules) {
      const _m = mod.split('.');
      queries.push(`declare module '${_m[0]}' {`);
      queries.push(`  interface ${_m.slice(1, -1).join('.')} {`);
      queries.push(`    ${_m[_m.length - 1]}: Queries;`);
      queries.push(`  }`);
      queries.push(`}`);
      queries.push(``);
    }
  }

  const queriesFilename = path.join(outputDir, config.queriesFilename + '.ts');
  console.log(`write queries file: ${queriesFilename}`);
  await fs.writeFile(queriesFilename, queries.join('\n'));

  // 生成 index.ts
  const indexFilename = path.join(outputDir, 'index.ts');
  if (!await fileExists(indexFilename)) {
    const index: string[] = [
      `export * from './${config.queriesFilename}';`
    ];
    console.log(`write index file: ${indexFilename}`);
    await fs.writeFile(indexFilename, index.join('\n'));
  }
}
