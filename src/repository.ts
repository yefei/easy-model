import { Query, ColumnList, DataValue, ModelClass, DataResult, ModelOption, QueryResult } from './types';
import { Builder, JsonWhere } from 'sql-easy-builder';
import { Model, UPDATE, PKVAL, getModelOption, getDataMethods } from './model';
import { Finder } from './finder';

export class Repository<T extends Model> {
  readonly modelClass: ModelClass<T>;
  readonly option: ModelOption;
  private readonly _query: Query;

  /**
   * @param modelClass 模型类
   * @param query 查询器实例
   * @param option 模型设置
   */
  constructor(modelClass: ModelClass<T>, query: Query) {
    this.modelClass = modelClass;
    this._query = query;
    this.option = getModelOption(modelClass);
  }

  /**
   * 数据库查询
   * @param arg0 SQL 或 Builder
   * @returns 数据库结果
   */
  query(arg0: string | ((builder: Builder) => void)) {
    return this._query.query(arg0);
  }

  /**
   * 构造模型实例
   */
  createInstance(data?: DataResult): T {
    if (!data) return null;
    const ins = new this.modelClass(data);
    // 100000次性能对比: defineProperties[136ms] > for{defineProperty}[111.5ms] > assign[16ms]
    Object.assign(ins, { [PKVAL]: data[this.option.pk] }, data);

    // 数据方法字段
    const dataMethods = getDataMethods(this.modelClass);
    if (dataMethods) {
      for (const [key, descriptor] of Object.entries(dataMethods)) {
        // 覆盖原始属性
        Object.defineProperty(ins, key, {
          enumerable: true,
          writable: !!descriptor.set,
          value: ins[key],
        });
      }
    }

    // 1. 拦截 set 操作，以备 save 方法的差异更新特性
    // 2. 实现 dataMethods 的 set 方法调用
    const proxy = new Proxy(<any> ins, {
      // obj 是原始的 ins 对象
      set(obj, prop, value) {
        // console.log('Proxy set:', prop, value);
        if (typeof prop === 'string') {
          if (prop in dataMethods) {
            if (!dataMethods[prop].set) return false;
            dataMethods[prop].set.call(proxy, value);
          }
          // 如果修改的是数据库值并且不是子实例对象
          else if (prop in data && !(typeof obj[prop] === 'object' && Reflect.has(obj[prop], PKVAL))) {
            if (!ins[UPDATE]) ins[UPDATE] = new Set();
            ins[UPDATE].add(prop);
          }
        }
        obj[prop] = value;
        return true;
      }
    });

    return proxy;
  }

  /**
   * 查找
   */
  find(where?: JsonWhere) {
    const find = new Finder<T>(this);
    where && find.where(where);
    return find;
  }

  /**
   * 通过主键取得一条数据
   */
  findByPk(pk: DataValue, ...columns: ColumnList) {
    return this.find({ [this.option.pk]: pk }).get(...columns);
  }

  /**
   * 查询条数
   */
  count(where?: JsonWhere, column?: string) {
    return this.find(where).count(column);
  }

  /**
   * 通过条件查询数据是否存在
   */
  exists(where?: JsonWhere) {
    return this.find(where).exists();
  }

  /**
   * 创建一条数据
   * @returns 主键值
   */
  async create(data: T): Promise<DataValue> {
    const r = <QueryResult> await this.query(builder => {
      builder.insert(this.option.table, data);
    });
    // 表不为自增主键无法获取 insertId 则尝试使用插入值
    return r.insertId || data[this.option.pk] || r.insertId;
  }

  /**
   * 创建一条数据并返回数据
   */
  async createAndGet(data: T, ...getColumns: ColumnList) {
    const pk = await this.create(data);
    return this.findByPk(pk, ...getColumns);
  }

  /**
   * 保存实例数据
   * @returns 更新条数
   */
  async save(ins: T): Promise<number> {
    if (ins[PKVAL] === undefined) {
      throw new Error('Missing primary key value.');
    }
    const updateSet = ins[UPDATE];
    if (!updateSet || updateSet.size === 0) return;
    const data: DataResult = {};
    for (const f of updateSet) {
      data[f] = ins[f];
    }
    const count = await this.find({ [this.option.pk]: ins[PKVAL] }).update(data);
    if (this.option.pk in data) {
      ins[PKVAL] = data[this.option.pk];
    }
    updateSet.clear();
    return count;
  }

  /**
   * 删除实例数据
   * @returns 删除条数
   */
  delete(ins: T): Promise<number> {
    if (ins[PKVAL] === undefined) {
      throw new Error('Missing primary key value.');
    }
    return this.find({ [this.option.pk]: ins[PKVAL] }).delete();
  }

  /**
   * 更新实例字段并保存
   */
  update(ins: T, data: DataResult): Promise<number> {
    Object.assign(ins, data);
    return this.save(ins);
  }
}
