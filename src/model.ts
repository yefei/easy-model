import { snakeCase } from 'lodash';
import { ColumnValue, DataRow, ModelOption } from './types';

export const OPTION = Symbol('Model#option');
export const UPDATE = Symbol('Model#update');
export const PKVAL = Symbol('Model#pkValue');
export const DATA = Symbol('Model#data');

export class Model {
  static [OPTION]: ModelOption;

  /**
   * 主键原始值
   * 用于更新删除操作时防止主键被修改而更新错误的数据
   */
  [PKVAL]: ColumnValue;

  /**
   * 将要被更新字段
   */
  [UPDATE]: Set<string> = new Set();

  /**
   * 数据库返回的原始数据
   */
  [DATA]: DataRow;

  /**
   * 数据字段
   */
  [colunm: string]: any;

  /**
   * 原始数据，数据库返回结果
   * @param pkval 主键值
   * @param data 
   */
  constructor(pkval?: ColumnValue, data?: DataRow) {
    this[PKVAL] = pkval;
    this[DATA] = data;
  }
}
