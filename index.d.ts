import { Query, Where } from 'mysql-easy-query';
export { Query, PoolQuery, PoolClusterQuery, Where, Raw, Op } from 'mysql-easy-query';

export interface ModelOptions {
  /** 主键名 */
  pk: string = 'id';

  /** 模型名，默认表名，关联关系中不可重复 */
  name: string;

  /** 表名，默认取自 name */
  table?: string;

  /** 默认排序，不设置则不排序 */
  order?: string[];
}

/**
 * 数据实例
 */
export declare class Instance {
  save(): Promise<void>;
  delete(): Promise<void>;
}

/**
 * 查找器
 */
export declare class Finder<T extends Instance> {
  constructor(model: Model, where?: Where | { [key: string]: any });
  limit(count: number, offset?: number): Finder<T>;

  /**
   * order('id') => id ASC
   * order('-id') => id DESC
   * order('-join_at', 'id') => join_at DESC, id ASC
   * @param columns 
   */
  order(...columns: string): Finder<T>;

  all(): Promise<T[]>;
  get(): Promise<T>;
  count(): Promise<number>;
  exists(): Promise<boolean>;
  update(columns: { [key: string]: any }): Promise<number>;
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
   */
  count(where?: Where): Promise<number>;

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
   * 保存实例数据
   * @param instance 
   */
  save(instance: T): Promise<void>;

  /**
   * 删除实例数据
   * @param instance 
   */
  delete(instance: T): Promise<void>;
}

/**
 * 模型创建
 * @param name 模型名，默认表名，关联关系中不可重复
 * @param options 选项
 */
export declare function model<T extends Instance>(name: string, options?: ModelOptions): (query: Query) => Model<T>;
