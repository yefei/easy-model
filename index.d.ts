import { Query, Where } from 'mysql-easy-query';
import { AttrBuilder } from 'sql-easy-builder';
export { Query, PoolQuery, PoolClusterQuery, Where, Raw, raw, Op, AB, AttrBuilder } from 'mysql-easy-query';

export interface VirtualField {
  get(): any;
  set(value: any): void;
}

export interface ModelOptions {
  /** 主键名 */
  pk?: string;

  /** 模型名，默认表名，关联关系中不可重复 */
  name?: string;

  /** 表名，默认取自 name */
  table?: string;

  /** 默认排序，不设置则不排序 */
  order?: string[];

  /** 虚拟字段 */
  virtuals?: { [ key: string]: VirtualField };

  /** 预定义 join 配置项 */
  join?: { [ as: string]: JoinOptions };

  /** 预定义 many 配置项 */
  many?: { [ as: string]: ManyOptions };
}

export interface JoinOptions {
  /** 来源, 默认取 {joinModel.name} */
  from?: string;

  /** 使用的外键，默认取 {joinModel.name}_{joinModel.pk} */
  fk?: string;

  /** 引用键，默认取 {model.pk} */
  ref?: string;

  /** join 模式，默认 inner */
  type?: 'INNER' | 'LEFT' | 'RIGHT';

  /** 输出别名，默认 {joinModel.name}， 可以使用 -> 命名空间 */
  as?: string;

  /** join 结果是否转为列表 */
  asList?: boolean;

  /** 覆盖默认 ON 查询 */
  on?: { [key: string]: any };

  /** 追加 ON 查询 */
  where?: { [key: string]: any };
}

export interface DefinedJoinOptions extends JoinOptions {
  model: Model;
}

export interface ManyOptions {
  /** many 表外键 */
  fk?: string;

  /** 来源表引用键，默认为主键, 在JOIN结果中可使用.命名空间，例如 user.id */
  ref?: string;

  /** 输出别名, 可以使用 -> 命名空间 */
  as?: string;

  /** 需要的结果列 */
  columns?: string[] | object;

  /** 是否使用并行查询 */
  parallel?: boolean;
}

/**
 * 数据实例
 */
export declare class Instance {
  /**
   * 保存本条数据
   */
  save(): Promise<number>;

  /**
   * 更新字段并保存
   * @param columns 
   */
  update(columns: { [column: string]: any }): Promise<number>;

  /**
   * 删除本条数据
   */
  delete(): Promise<number>;
}

/**
 * 查找器
 */
export declare class Finder<T extends Instance> {
  constructor(model: Model<T>, where?: Where | { [key: string]: any });

  /**
   * 克隆为新实例
   */
  clone(): Finder<T>;

  /**
   * 设置查询条件
   * @param where 
   */
  where(where: Where | { [key: string]: any }): Finder<T>;

  /**
   * 追加 AND 查询
   * @param where 
   */
  whereAnd(where: Where | { [key: string]: any }): Finder<T>;

  /**
   * 追加 OR 查询
   * @param where 
   */
  whereOr(where: Where | { [key: string]: any }): Finder<T>;

  /**
   * 在取得主表结果后查询其他关联表多条结果
   * 用于一对多或多对多场景
   * @param manyModel 
   * @param options 
   */
  many(manyModel: Model<T> | Finder<T> | string, options?: ManyOptions): Finder<T>;

  /**
   * 限制查询条数
   * @param count 条数
   * @param offset 位置，默认 0
   */
  limit(count: number, offset?: number): Finder<T>;

  /**
   * 排序，如果 join 表需要指定表名称
   * order('id') => id ASC
   * order('-id') => id DESC
   * order('-join_at', 'id') => join_at DESC, id ASC
   * @param columns 
   */
  order(...columns: string[]): Finder<T>;

  /**
   * JOIN 其他表
   * @param modelQuery 需要 join 的表查询，如果传入字符串则使用预定义 join，预定义 join 支持级连 a->b->c
   * @param options join 选项
   */
  join<J extends Instance>(modelQuery: Model<J> | string, options?: JoinOptions): Finder<T>;

  /**
   * GROUP BY
   * @param columns
   */
  group(...columns: string[]): Finder<T>;

  /**
   * GROUP HAVING
   * @param condition
   */
  having(condition: Where | { [key: string]: any }): Finder<T>;

  /**
   * @param columns 需要检出的字段，默认全部
   */
  all(...columns: (string | { [key: string]: any })[]): Promise<T[]>;

  /**
   * @param columns 需要检出的字段，默认全部
   */
  get(...columns: (string | { [key: string]: any })[]): Promise<T>;

  /**
   * 取得一条数据中的一个值
   * @param column 字段名
   * @param defaultValue 默认值
   */
  value<V>(column: string, defaultValue?: V): Promise<V>;

  /**
   * 返回查询条数
   * @param column 条数列，默认 *
   */
  count(column?: string | Raw | AttrBuilder): Promise<number>;

  /**
   * 条件查询是否存在
   */
  exists(): Promise<boolean>;

  /**
   * 更新数据字段并保存
   * @param columns
   */
  update(columns: { [key: string]: any }): Promise<number>;

  /**
   * 删除数据
   */
  delete(): Promise<number>;
}

/**
 * 模型
 */
export declare class Model<T extends Instance> {
  constructor(query: Query);

  /**
   * 查找
   * @param where 查询条件
   */
  find(where?: Where): Finder<T>;

  /**
   * 通过主键取得一条数据
   * @param pk 
   */
  findByPk(pk: any): Promise<T>;

  /**
   * 查询条数
   * @param where 
   * @param column 条数列，默认 *
   */
  count(where?: Where, column?: string | Raw | AttrBuilder): Promise<number>;

  /**
   * 通过条件查询数据是否存在
   * @param where 
   */
  exists(where?: Where): Promise<boolean>;

  /**
   * 创建一条数据
   * @param columns
   * @returns {number} 插入后的ID
   */
  create(columns: { [key: string]: any }): Promise<number>;

  /**
   * 创建一条数据并返回数据
   * @param columns
   */
  createAndGet(columns: { [key: string]: any }): Promise<T>;
}

/**
 * 模型创建
 * @param name 模型名，默认表名，关联关系中不可重复
 * @param options 选项
 */
export declare function model<T extends Instance>(name: string, options?: ModelOptions): (query: Query) => Model<T>;
