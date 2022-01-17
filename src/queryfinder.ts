import { DoesNotExist } from './excepts';
import { FieldType } from 'sql-easy-builder';
import { ColumnList, DataResult, DataValue, ModelClass, PageOption, PageResult, Query, QueryResult } from './types';
import { getModelOption, MODEL, Model } from './model';
import { createInstance } from './instance';
import { FINDER, Finder } from './finder';
import { propertyAt } from './utils';

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
    const qfinder = new QueryFinder<T>(this._modelClass, this._query);
    return <QueryFinder<T>> super.clone(qfinder);
  }

  protected _fetchResult(one: boolean, columns: ColumnList) {
    return this._query.query(builder => this._fetchBuilder(builder, one, columns));
  }

  protected async _fetchManyResultMerge(instances: T | T[]): Promise<void> {
    for (const opt of Object.values(this._many)) {
      const model = opt[MODEL];
      const modelOption = getModelOption(model);
      const finder = opt[FINDER];
      const refPath = opt.ref.split('.');
      const asPath = (opt.as || modelOption.table).split('->');
      const fetchManyResult = async (ins: T) => {
        const refValue = propertyAt(ins, refPath);
        if (refValue !== undefined) {
          const qfinder = new QueryFinder(model, opt.query || this._query);
          finder.clone(qfinder);
          qfinder.whereAnd({ [opt.fk]: refValue });
          var manyResults = await qfinder.all(...(opt.columns || []));
        }
        propertyAt(ins, asPath, manyResults || []);
      };
      if (Array.isArray(instances)) {
        if (opt.parallel && instances.length > 1) {
          await Promise.all(instances.map(fetchManyResult));
        } else {
          for (const ins of instances) {
            await fetchManyResult(ins);
          }
        }
      } else {
        await fetchManyResult(instances);
      }
    }
  }

  /**
   * 取得数据列表
   */
  async all(...columns: ColumnList): Promise<T[]> {
    const resutl = <DataResult[]> await this._fetchResult(false, columns);
    if (resutl.length === 0) return [];
    if (this._haveJoin) {
      var instances = this._joinResultsMerge(resutl);
    } else {
      var instances = resutl.map(row => createInstance(this._modelClass, row));
    }
    if (instances && instances.length > 0 && this._haveMany) {
      await this._fetchManyResultMerge(instances);
    }
    return instances;
  }

  /**
   * 取得一条数据
   */
  async get(...columns: ColumnList): Promise<T> {
    const resutl = <DataResult[] | DataResult> await this._fetchResult(true, columns);
    if (!resutl) return null;
    if (Array.isArray(resutl)) {
      // JOIN asList 处理
      var instance = this._joinResultsMerge(resutl)[0];
    }
    else if (this._haveJoin) {
      // 单行 join 处理
      var instance = createInstance(this._modelClass, resutl[this._option.table]);
      this._joinResultMerge(instance, resutl);
    } else {
      // 无 join 处理
      var instance = createInstance(this._modelClass, resutl);
    }
    if (instance && this._haveMany) {
      await this._fetchManyResultMerge(instance);
    }
    return instance;
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
