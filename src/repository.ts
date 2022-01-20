import { Query, ColumnList, DataValue, ModelClass, DataResult, ModelOption, QueryResult } from './types';
import { Builder, JsonWhere } from 'sql-easy-builder';
import { Model, UPDATE, PKVAL, getModelOption } from './model';
import { QueryFinder } from './queryfinder';

function assertPk<T extends Model>(ins: T) {
  if (!ins || ins[PKVAL] === undefined) {
    throw new Error('Missing primary key value.');
  }
}

export class Repository<T extends Model> {
  protected _modelClass: ModelClass<T>;
  protected _option: ModelOption;
  protected _query: Query;

  /**
   * @param modelClass 模型类
   * @param query 查询器实例
   * @param option 模型设置
   */
  constructor(modelClass: ModelClass<T>, query: Query) {
    this._modelClass = modelClass;
    this._query = query;
    this._option = getModelOption(modelClass);
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
   * 查找
   */
  find(where?: JsonWhere) {
    const find = new QueryFinder<T>(this._modelClass, this._query);
    where && find.where(where);
    return find;
  }

  /**
   * 通过主键取得一条数据
   */
  findByPk(pk: DataValue, ...columns: ColumnList) {
    console.log('aaa', this._option.pk);
    return this.find({ [this._option.pk]: pk }).get(...columns);
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
      builder.insert(this._option.table, data);
    });
    // 表不为自增主键无法获取 insertId 则尝试使用插入值
    return r.insertId || data[this._option.pk] || r.insertId;
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
    assertPk(ins);
    const updateSet = ins[UPDATE];
    if (!updateSet || updateSet.size === 0) return;
    const data: DataResult = {};
    for (const f of updateSet) {
      data[f] = ins[f];
    }
    const count = await this.find({ [this._option.pk]: ins[PKVAL] }).update(data);
    if (this._option.pk in data) {
      ins[PKVAL] = data[this._option.pk];
    }
    updateSet.clear();
    return count;
  }

  /**
   * 删除实例数据
   * @returns 删除条数
   */
  delete(ins: T): Promise<number> {
    assertPk(ins);
    return this.find({ [this._option.pk]: ins[PKVAL] }).delete();
  }

  /**
   * 更新实例字段并保存
   */
  update(ins: T, data: DataResult): Promise<number> {
    Object.assign(ins, data);
    return this.save(ins);
  }
}
