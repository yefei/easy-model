import { DoesNotExist } from './excepts';
import { FieldType } from 'sql-easy-builder';
import { ColumnList, DataResult, DataValue, ModelClass, PageOption, PageResult, Query, QueryResult } from './types';
import { Model } from './model';
import { createInstance } from './instance';
import { Finder } from './finder';

export class QueryFinder<T extends Model> extends Finder<T> {
  protected _query: Query;

  constructor(modelClass: ModelClass<T>, query: Query) {
    super(modelClass);
    this._query = query;
  }

  /**
   * 复制当前 QueryFinder 实例
   */
  clone(): QueryFinder<T> {
    const finder = new QueryFinder<T>(this._modelClass, this._query);
    return <QueryFinder<T>> this._clone(finder);
  }

  protected _fetchResult(one: boolean, columns: ColumnList) {
    return this._query.query(builder => this._fetchBuilder(builder, one, columns));
  }

  /**
   * 取得数据列表
   */
  async all(...columns: ColumnList): Promise<T[]> {
    const resutl = <DataResult[]> await this._fetchResult(false, columns);
    return resutl.map(row => createInstance(this._modelClass, row));
  }

  /**
   * 取得一条数据
   */
  async get(...columns: ColumnList): Promise<T> {
    const resutl = <DataResult[] | DataResult> await this._fetchResult(true, columns);
    // JOIN 处理
    if (Array.isArray(resutl)) {
      return this._joinResult(resutl).values().next().value;
    }
    return createInstance(this._modelClass, resutl);
  }

  /**
   * 分页取得数据列表
   */
  async page({ limit, offset, order }: PageOption, ...columns: ColumnList): Promise<PageResult<T>> {
    const total = await this.count();
    let list: T[] = [];
    if (total > 0) {
      this.limit(limit, offset);
      if (order) {
        this.order(...(typeof order === 'string' ? [order] : order));
      }
      list = await this.all(...columns);
    }
    return { limit, offset, order, total, list };
  }

  /**
   * 直接取得查询数据中的一个值
   * @param column
   * @param defaultValue 如果找不到返回的默认值，不指定则抛出异常 DoesNotExist
   */
  async value<D>(column: FieldType, defaultValue?: D): Promise<DataValue | D> {
    const result = <DataResult> await this._query.query(builder => this._valueBuilder(builder, column));
    if (result && result.value) {
      return result.value;
    }
    if (defaultValue === undefined) {
      throw new DoesNotExist(`The requested object '${this._option.table}' does not exist.`);
    }
    return defaultValue;
  }

  /**
   * 查询条数
   */
  async count(column: FieldType = '*') {
    const result = <DataResult> await this._query.query(builder => this._countBuilder(builder, column));
    return <number> result['c'];
  }

  /**
   * 查询数据是否存在
   */
  async exists() {
    const result = <DataResult> await this._query.query(builder => this._existsBuilder(builder));
    return (result && result['1'] === 1) || false;
  }

  /**
   * 更新数据
   * @param data 需要更新的字段值
   * @returns 更新条数
   */
  async update(data: DataResult) {
    const result = <QueryResult> await this._query.query(builder => this._updateBuilder(builder, data));
    return result.affectedRows;
  }

  /**
   * 删除数据
   * @returns 删除的条数
   */
  async delete() {
    const result = <QueryResult> await this._query.query(builder => this._deleteBuilder(builder));
    return result.affectedRows;
  }
}
