import { promises as fs } from 'fs';
import * as path from 'path';
import { pascalCase } from 'pascal-case';
import { snakeCase } from 'snake-case';
import { DataResult, Query } from './types';

const zenormName = process.env.ZENORM_NAME || 'zenorm';
const codeRegionStart = '// #region auto generate code';
const codeRegionEnd = '// #endregion auto generate code';
const codeRegionTip = '// 此区域内代码请不要编辑，会在下次更新数据库结构时被覆盖';

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
    `// create at: ${datetime()}`,
    `// create by: ${process.env.USER || process.env.USERNAME || '-'}@${process.env.COMPUTERNAME || '-'}`,
    `// database: ${database}`,
  ];

  const imports: string[] = [];
  const exports: string[] = [];
  const queries: string[] = [];
  const queryProps: string[] = [];

  for (const t of tables) {
    const tableName = <string> t[`Tables_in_${database}`];
    const className = pascalCase(tableName);
    const name = snakeCase(tableName);
    const outputFilename = path.join(outputDir, name + '.ts');
    console.log('table:', tableName);
    
    let pk: string;
    let ts: string[] = [];
    const columns = <DataResult[]> await query.query('SHOW FULL COLUMNS FROM ??', [tableName]);
    for (const c of columns) {
      if (!pk && c.Key === 'PRI') pk = c.Field;
      ts.push(`  /**`);
      c.Comment && ts.push(`   * ${c.Comment}`);
      ts.push(`   * ${c.Type} ${c.Extra}`);
      ts.push(`   */`);
      ts.push(`  ${c.Field}?: ${getColumnType(<string> c.Type)};`);
    }

    if (await fileExists(outputFilename)) {
      const content = await fs.readFile(outputFilename, 'utf-8');
      const startIndex = content.indexOf(codeRegionStart);
      if (startIndex === -1) {
        console.warn('无法找到:', codeRegionStart, '跳过更新', outputFilename);
        continue;
      }
      const endIndex = content.substring(startIndex).indexOf(codeRegionEnd);
      if (endIndex === -1) {
        console.warn('无法找到:', codeRegionEnd, '跳过更新', outputFilename);
        continue;
      }
      ts = [
        content.substring(0, startIndex + codeRegionStart.length),
        '  ' + codeRegionTip,
        `  // update at: ${datetime()}`,
        ...ts,
        '  ' + content.substring(startIndex + endIndex),
      ];
    } else {
      ts = [
        ...remark,
        '// table: ' + tableName,
        '',
        `import { model } from '${zenormName}';`,
        '',
        `@model({`,
        `  pk: '${pk}',`,
        `  table: '${tableName}',`,
        `})`,
        `export default class ${className} {`,
        '  ' + codeRegionStart,
        '  ' + codeRegionTip,
        ...ts,
        '  ' + codeRegionEnd,
        `}`,
        '',
      ];
    }

    await fs.writeFile(outputFilename, ts.join('\n'));

    // queries
    imports.push(`import ${className} from './${name}'`);
    exports.push(className);
    queries.push(`export const ${className}Query = createRepositoryQuery(${className});`);
    queryProps.push(`  get ${name}() { return ${className}Query(this._query); }`);
  }

  const ts: string[] = [
    '// zenorm 自动生成文件',
    '// 请不要修改此文件，因为此文件在每次重新生成数据库结构时会被覆盖',
    ...remark,
    '',
    `import { Query, createRepositoryQuery } from '${zenormName}';`,
    ...imports,
    '',
    ...queries,
    '',
  ];

  // queries
  ts.push(`export class Queries {`);
  ts.push(`  _query: Query;`);
  ts.push(`  constructor(query: Query) { this._query = query; }`);
  ts.push(...queryProps);
  ts.push(`}`);
  ts.push(``);

  // exports
  ts.push('export {');
  ts.push('  ' + exports.join(',\n  '));
  ts.push('};');
  ts.push('');

  // 添加 Queries 到目标模块中
  if (config.declareQueriesToModules) {
    for (const mod of config.declareQueriesToModules) {
      const _m = mod.split('.');
      ts.push(`declare module '${_m[0]}' {`);
      ts.push(`  interface ${_m.slice(1, -1).join('.')} {`);
      ts.push(`    ${_m[_m.length - 1]}: Queries;`);
      ts.push(`  }`);
      ts.push(`}`);
      ts.push(``);
    }
  }

  const queriesFilename = path.join(outputDir, config.queriesFilename + '.ts');
  console.log(`write queries file: ${queriesFilename}`);
  await fs.writeFile(queriesFilename, ts.join('\n'));

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
