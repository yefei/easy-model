import { Builder } from 'sql-easy-builder';
import { Model } from './model';
import { OPTION, UPDATE, MODEL, QUERY, PKVAL, DATA } from './symbols';
import { ColumnValue, ResultRow } from './types';

export class Instance {
  [MODEL]: Model<Instance>;

  /**
   * 主键值
   */
  [PKVAL]: ColumnValue;

  /**
   * 将要被更新字段
   */
  [UPDATE]: Set<string>;

  /**
   * 数据库返回的原始数据
   */
  [DATA]: ResultRow;

  /**
   * 数据字段
   */
  [colunm: string]: any;

  constructor(model: Model<Instance>, pkval: ColumnValue, data: ResultRow) {
    this[MODEL] = model;
    this[PKVAL] = pkval;
    this[DATA] = data;
  }

  /**
   * 保存实例数据
   * @returns 更新条数
   */
  async save(): Promise<number> {
    if (this[PKVAL] === undefined) {
      throw new Error('Missing primary key value.');
    }
    const model = this[MODEL];
    const updateSet = this[UPDATE];
    if (updateSet.size === 0) return;
    const columns: ResultRow = {};
    updateSet.forEach(f => {
      columns[f] = this[f];
    });
    const result = await model[QUERY].query((builder: Builder) => {
      builder.update(model.table, columns);
      builder.where({ [model[OPTION].pk]: this[PKVAL] });
    });
    return result.affectedRows;
  }

  /**
   * 删除实例数据
   * @returns 删除条数
   */
  async delete(): Promise<number> {
    if (this[PKVAL] === undefined) {
      throw new Error('Missing primary key value.');
    }
    const model = this[MODEL];
    const result = await model[QUERY].query((builder: Builder) => {
      builder.delete(model.table);
      builder.where({ [model[OPTION].pk]: this[PKVAL] });
    });
    return result.affectedRows;
  }

  /**
   * 更新实例字段并保存
   */
  update(columns: ResultRow) {
    Object.assign(this, columns);
    return this.save();
  }
}
