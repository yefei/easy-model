import { OPTIONS, UPDATE, MODEL, QUERY, PKVAL } from './symbols';
import { Finder } from './finder';
import { ModelOptions, Query, ResultRow, ColumnList, ColumnValue } from './types';
import { Instance } from './instance';
import { JsonWhere } from 'sql-easy-builder';

export class Model<T extends Instance> {
  [OPTIONS]: ModelOptions;
  [QUERY]: Query;

  /**
   * @param options 模型设置
   * @param query 查询器实例
   */
  constructor(options: ModelOptions, query: Query) {
    this[OPTIONS] = options;
    this[QUERY] = query;
  }

  /**
   * 数据库表名
   */
  get table(): string {
    return this[OPTIONS].table;
  }

  /**
   * 构造数据实例
   */
  private _createInstance(result: ResultRow): T {
    const properties: PropertyDescriptorMap = {
      [UPDATE]: {
        value: new Set(),
      },
      [PKVAL]: {
        value: result[this[OPTIONS].pk],
      },
      [MODEL]: {
        value: this,
      },
    };
    const origFields = new Set();
    for (const [key, value] of Object.entries(result)) {
      origFields.add(key);
      properties[key] = {
        value,
        configurable: true,
        enumerable: true,
        writable: true,
      };
    }
    // virtuals define
    if (this[OPTIONS].virtuals) {
      for (const [key, value] of Object.entries(this[OPTIONS].virtuals)) {
        properties[key] = {
          configurable: true,
          enumerable: true,
          get: value.get,
          set: value.set,
        };
      }
    }
    const ins = Object.create(Instance.prototype, properties);
    return new Proxy(ins, {
      set(obj, prop, value) {
        if (origFields.has(prop)) {
          obj[UPDATE].add(prop);
        }
        obj[prop] = value;
        return true;
      }
    });
  }

  /**
   * 查找
   */
  find(where?: JsonWhere) {
    return new Finder(this, where);
  }

  /**
   * 通过主键取得一条数据
   */
  findByPk(pk: ColumnValue, ...columns: ColumnList) {
    return this.find({ [this[OPTIONS].pk]: pk }).get(...columns);
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
  _virtualsSetter(row: ResultRow) {
    // virtuals setter
    if (this[OPTIONS].virtuals) {
      row = Object.assign({}, row);
      const virtuals: [string, ColumnValue][] = [];
      for (const key of Object.keys(row)) {
        if (this[OPTIONS].virtuals[key]) {
          virtuals.push([key, row[key]]);
          delete row[key];
        }
      }
      if (virtuals.length) {
        const ins = this._createInstance(row);
        for (const [key, value] of virtuals) {
          ins[key] = value;
        }
        // append columns
        for (const key of Object.keys(ins)) {
          if (!this[OPTIONS].virtuals[key] && !row[key]) {
            row[key] = ins[key];
          }
        }
      }
    }
    return row;
  }

  /**
   * 创建一条数据
   */
  async create(columns: ResultRow): Promise<number | ColumnValue> {
    columns = this._virtualsSetter(columns);
    const r = await this[QUERY].query(builder => {
      builder.insert(this.table, columns);
    });
    // 表不为自增主键无法获取 insertId 则尝试使用插入值
    return r.insertId || columns[this[OPTIONS].pk] || r.insertId;
  }

  /**
   * 创建一条数据并返回数据
   */
  async createAndGet(columns: ResultRow, ...getColumns: ColumnList) {
    const pk = await this.create(columns);
    return this.findByPk(pk, ...getColumns);
  }
}
