import { Finder } from './finder';
import { Query, ColumnList, ColumnValue, ModelClass, DataRow, ModelOption } from './types';
import { Builder, JsonWhere } from 'sql-easy-builder';
import { Model, UPDATE, PKVAL, DATA } from './model';
import { getModelOption } from './utils';

export class Repository<T extends Model> {
  private readonly _modelClass: ModelClass<T>;
  private readonly _query: Query;
  readonly option: ModelOption;

  /**
   * @param modelClass 模型类
   * @param option 模型设置
   * @param query 查询器实例
   */
  constructor(modelClass: ModelClass<T>, query: Query) {
    this._modelClass = modelClass;
    this.option = getModelOption(modelClass);
    this._query = query;
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
  createInstance(data?: DataRow): T {
    const ins = new this._modelClass(data ? data[this.option.pk] : undefined, data);
    for (const key of Object.keys(data)) {
      Object.defineProperty(ins, key, {
        configurable: true,
        enumerable: true,
        get() { return this[DATA][key]; },
        set(value) {
          this[UPDATE].add(key);
          this[DATA][key] = value;
        },
      });
    }
    return ins;
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
  findByPk(pk: ColumnValue, ...columns: ColumnList) {
    return this.find({ [this.option.pk]: pk }).get(...columns);
  }

  /**
   * 查询条数
   */
  count(where: JsonWhere, column: string) {
    return this.find(where).count(column);
  }

  /**
   * 通过条件查询数据是否存在
   */
  exists(where: JsonWhere) {
    return this.find(where).exists();
  }

  /**
   * 虚拟字段设置
   */
  /*
  _virtualsSetter(row: ResultRow) {
    // virtuals setter
    if (this[OPTION].virtuals) {
      row = Object.assign({}, row);
      const virtuals: [string, ColumnValue][] = [];
      for (const key of Object.keys(row)) {
        if (this[OPTION].virtuals[key]) {
          virtuals.push([key, row[key]]);
          delete row[key];
        }
      }
      if (virtuals.length) {
        const ins: Instance = this._createInstance(row);
        for (const [key, value] of virtuals) {
          ins[key] = value;
        }
        // append columns
        for (const key of Object.keys(ins)) {
          if (!this[OPTION].virtuals[key] && !row[key]) {
            row[key] = ins[key];
          }
        }
      }
    }
    return row;
  }
  */

  /**
   * 创建一条数据
   */
  async create(data: DataRow): Promise<ColumnValue> {
    // columns = this._virtualsSetter(columns);
    const r = await this.query(builder => {
      builder.insert(this.option.table, data);
    });
    // 表不为自增主键无法获取 insertId 则尝试使用插入值
    return r.insertId || data[this.option.pk] || r.insertId;
  }

  /**
   * 创建一条数据并返回数据
   */
  async createAndGet(data: DataRow, ...getColumns: ColumnList) {
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
    if (updateSet.size === 0) return;
    const data: DataRow = {};
    updateSet.forEach(f => {
      data[f] = ins[f];
    });
    const result = await this.query((builder: Builder) => {
      builder.update(this.option.table, data);
      builder.where({ [this.option.pk]: ins[PKVAL] });
    });
    return result.affectedRows;
  }

  /**
   * 删除实例数据
   * @returns 删除条数
   */
  async delete(ins: T): Promise<number> {
    if (ins[PKVAL] === undefined) {
      throw new Error('Missing primary key value.');
    }
    const result = await this.query((builder: Builder) => {
      builder.delete(this.option.table);
      builder.where({ [this.option.pk]: ins[PKVAL] });
    });
    return result.affectedRows;
  }

  /**
   * 更新实例字段并保存
   */
  update(ins: T, data: DataRow): Promise<number> {
    Object.assign(ins, data);
    return ins.save();
  }
}
