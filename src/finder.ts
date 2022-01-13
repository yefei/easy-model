import { propertyAt, simpleCopy } from './utils';
import { DoesNotExist, UndefinedRelationException } from './excepts';
import { Builder, JsonWhere } from 'sql-easy-builder';
import { ColumnAs, ColumnList, DataResult, DataValue, JoinOption, ManyOption, ModelClass, ModelOption, PageOption, PageResult, QueryResult } from './types';
import { getModelJoinOption, getModelManyOption, getModelOption, MODEL, Model } from './model';
import { Repository } from './repository';

/**
 * Finder
 */
export class Finder<T extends Model> {
  private _repository: Repository<T>;
  private _where: JsonWhere;
  private _whereAndOr: [where: JsonWhere, prep?: string, after?: string][] = [];
  private _limit: number = null;
  private _offset: number = 0;
  private _order: string[] = null;
  private _join: { [name: string]: JoinOption<any> } = {};
  private _many: { [name: string]: ManyOption<any> } = {};
  private _group: string[] = [];
  private _having: JsonWhere = null;

  constructor(repository: Repository<T>) {
    this._repository = repository;
  }

  /**
   * 复制当前 finder 实例
   */
  clone() {
    const finder = new Finder<T>(this._repository);
    finder._where = simpleCopy(this._where);
    finder._whereAndOr = simpleCopy(this._whereAndOr);
    finder._limit = this._limit;
    finder._offset = this._offset;
    finder._order = simpleCopy(this._order) ;
    finder._join = simpleCopy(this._join);
    finder._many = simpleCopy(this._many);
    finder._group = simpleCopy(this._group);
    finder._having = simpleCopy(this._having);
    return finder;
  }

  /**
   * 设置查询条件
   */
  where(where: JsonWhere) {
    this._where = simpleCopy(where);
    return this;
  }

  /**
   * 追加 AND 查询
   */
  whereAnd(where: JsonWhere) {
    this._whereAndOr.push([where, 'AND']);
    return this;
  }

  /**
   * 追加 OR 查询
   */
  whereOr(where: JsonWhere) {
    this._whereAndOr.push([where, 'OR (', ')']);
    return this;
  }

  /**
   * 构造查询
   */
  _whereBuilder(builder: Builder) {
    if (this._where) builder.where(this._where);
    this._whereAndOr.forEach(args => builder.where(...args));
  }

  /**
   * 限制条数
   */
  limit(count: number, offset: number = 0) {
    this._limit = count;
    this._offset = offset;
    return this;
  }

  _limitBuilder(builder: Builder) {
    if (!this._limit) return;
    builder.limit(this._limit, this._offset);
  }

  /**
   * 排序
   */
  order(...columns: string[]) {
    this._order = columns;
    return this;
  }

  _orderBuilder(builder: Builder) {
    if (this._order && this._order.length > 0) {
      builder.order(...this._order);
      return;
    }
    const defaultOrder = this._repository.option.order || [];
    // 没有指定排序得情况下使用默认 order
    if (defaultOrder.length > 0) {
      // 没有 join 直接使用默认 order
      if (Object.keys(this._join).length === 0) {
        builder.order(...defaultOrder);
        return;
      }
      // 在有 join 的情况下如果没有指定目标表则默认使用当前表
      builder.order(...defaultOrder.map(i => {
        if (i.startsWith('-')) {
          return `-${this._repository.option.table}.${i.slice(1)}`;
        }
        return `${this._repository.option.table}.${i}`;
      }));
    }
  }

  /**
   * 检查别名是否冲突
   */
  _checkAsName(name: string) {
    if (name in this._join || name in this._many) {
      throw new Error(`duplicate as: ${name}`);
    }
  }

  /**
   * 联合查询
   */
  join<M extends Model>(target: string | ModelClass<M>, joinOption?: JoinOption<M>) {
    // string 类型为预定义 join
    if (typeof target === 'string') {
      // 级连 join: a->b->c
      if (target.indexOf('->') > 0) {
        const joins = target.split('->');
        let _options = this._join[joins[0]];
        // 是否需要加入第一级 join: a
        if (!_options) {
          _options = this._getDefinedJoinOption(this._repository.modelClass, joins[0]);
          this._joinAppend(_options);
        }
        // 依次加入后续 join: b->c
        joins.reduce((pre, cur, curIndex) => {
          const _as = `${pre}->${cur}`;
          _options = this._join[_as];
          if (!_options) {
            const preJoinOptions = this._join[pre];
            const curJoinOptions = joinOption && curIndex === joins.length - 1 ? Object.assign({}, joinOption) : {};
            Object.assign(curJoinOptions, {
              as: _as,
              from: preJoinOptions.as,
            });
            _options = Object.assign({}, this._getDefinedJoinOption(preJoinOptions[MODEL], cur), curJoinOptions);
            this._joinAppend(_options);
          }
          return _as;
        });
        return this;
      }
      // 一级预定义 join
      joinOption = Object.assign({}, this._getDefinedJoinOption(this._repository.modelClass, target), joinOption);
    } else {
      if (!joinOption) {
        joinOption = {};
      }
      joinOption[MODEL] = target;
    }
    this._joinAppend(joinOption);
    return this;
  }

  /**
   * 取得预定义 join 项的配置
   */
  _getDefinedJoinOption<M extends Model>(modelClass: ModelClass<M>, key: string): JoinOption<M> {
    const opt = getModelJoinOption(modelClass, key);
    if (!opt) {
      throw new UndefinedRelationException(`${modelClass.name} join ${key}`);
    }
    return opt;
  }

  _joinAppend<J extends Model>(option: JoinOption<J>) {
    const joinModel = option[MODEL];
    const opt = getModelOption(joinModel);
    option = Object.assign({
      from: this._repository.option.table,
      fk: opt.table + '_' + opt.pk,
      ref: this._repository.option.pk,
      type: 'INNER',
      as: opt.table,
      asList: false,
    }, option);
    this._checkAsName(option.as);
    this._join[option.as] = option;
  }

  _joinBuilder(builder: Builder) {
    Object.values(this._join).forEach(opt => {
      const modelOpt = getModelOption(opt[MODEL])
      // opt._asPath = opt.as.split('->');
      const on = opt.on || {
        [`${opt.as}.${opt.ref}`]: builder.quote(`${opt.from}.${opt.fk}`),
      };
      if (opt.where) {
        Object.assign(on, opt.where);
      }
      builder.join(
        modelOpt.table,
        // 如果和表名一致则没有必要 as
        opt.as === modelOpt.table ? null : opt.as,
        on,
        opt.type
      );
      builder.nestTables();
    });
  }

  _columnPrep(col: string | ColumnAs) {
    return typeof col === 'string' && !col.includes('.') ? `${this._repository.option.table}.${col}` : col;
  }

  /**
   * 在取得主表结果后查询其他关联表多条结果
   * 用于一对多或多对多场景
   */
  many<M extends Model>(target: string | ModelClass<M>, option?: ManyOption<M>) {
    if (typeof target === 'string') {
      const opt = getModelManyOption(this._repository.modelClass, target);
      if (!opt) {
        throw new UndefinedRelationException(`${this._repository.modelClass.name} many ${target}`);
      }
      option = Object.assign({}, opt, option);
      target = option[MODEL];
    }
    const targetModelOpt = getModelOption(target);
    option = Object.assign({
      fk: targetModelOpt.table + '_' + targetModelOpt.pk,
      ref: this._repository.option.pk,
      parallel: false,
    }, option);
    this._checkAsName(option.as);
    this._many[option.as] = option;
    return this;
  }

  /**
   * GROUP BY
   */
  group(...columns: string[]) {
    this._group.push(...columns);
    return this;
  }

  /**
   * GROUP BY HAVING
   */
  having(condition: JsonWhere) {
    this._having = condition;
    return this;
  }

  _groupBuilder(builder: Builder) {
    if (this._group.length) {
      builder.group(...this._group);
      if (this._having) {
        builder.having(this._having);
      }
    }
  }

  /*
  async _fetchAfter(resutl: DataResult | DataResult[]): Promise<T> {
    const many = Object.values(this._many);
    for (const opt of many) {
      // 查询结果
      const path = opt.ref.split('.');
      const _asPath = (opt.as || model[OPTIONS].name).split('->');
      const _fetchManyResult = async instance => {
        const refValue = propertyAt(instance, path);
        let manyResults;
        if (refValue !== undefined) {
          const _finder = finder.clone();
          const _where = { [opt.fk]: refValue };
          if (_finder._where) {
            _finder.whereAnd(_where);
          } else {
            _finder.where(_where);
          }
          if (Array.isArray(opt.columns)) {
            manyResults = await _finder.all(...opt.columns);
          } else if (typeof opt.columns === 'object') {
            manyResults = await _finder.all(opt.columns);
          } else {
            manyResults = await _finder.all();
          }
        }
        propertyAt(instance, _asPath, manyResults || []);
      };
      if (Array.isArray(result)) {
        if (opt.parallel) {
          await Promise.all(result.map(_fetchManyResult));
        } else {
          for (const instance of result) {
            await _fetchManyResult(instance);
          }
        }
      } else {
        await _fetchManyResult(this._repository.createInstance(resutl));
      }
    }
    return ins;
  }
  */

  _fetchResult(one: boolean, columns: ColumnList) {
    const isJoin = Object.values(this._join).length > 0;
    return this._repository.query(builder => {
      // 在有 join 的情况下如果没有指定目标表则默认使用当前表
      builder.select(...columns.map(i => isJoin ? this._columnPrep(i) : i));
      builder.from(this._repository.option.table);
      this._joinBuilder(builder);
      this._whereBuilder(builder);
      this._groupBuilder(builder);
      this._orderBuilder(builder);
      if (one && !isJoin) builder.one();
      else this._limitBuilder(builder);
    });
  }

  /**
   * 取得数据
   * @param columns 需要检出的字段
   * @param isOne 是否取单条
   */
  /*
  async _fetch(columns: ColumnList, isOne = false): Promise<T[] | T> {
    const _join = Object.values(this._join);
    const _notJoin = _join.length === 0;
    // 取一条且无join情况
    const _one = isOne && _notJoin;
    const resutl = <DataResult[][] | DataResult[] | DataResult> await this._fetchResult(_one, columns);
    if (!resutl || resutl.length === 0) {
      return isOne ? null : [];
    }
    if (!Array.isArray(resutl)) return this._fetchAfter(resutl);
    // 无 join
    if (_notJoin) {
      return this._fetchAfter(resutl);
    }
    // 合并 join 结果到 instance 中
    const instanceMap = new Map();
    // 处理列表结果
    resutl.forEach(row => {
      // 多条结果 join 结果组合
      const mainName = this._repository.option.table;
      const thisData = row[mainName];
      const pkval = thisData[this._repository.option.pk];
      if (pkval === undefined) {
        throw new Error(`join select missing primary key of '${mainName}' table`);
      }
      if (!instanceMap.has(pkval)) {
        instanceMap.set(pkval, this._repository.createInstance(thisData));
      }
      const instance = instanceMap.get(pkval);
      _join.forEach(options => {
        const model = options._model;
        const data = row[options.as];
        if (data) {
          // 对于 LEFT JOIN 会产生所有列为 NULL 的结果问题，必须取得主键值
          if (options.type.startsWith('LEFT')) {
            if (data[model[OPTIONS].pk] === undefined) {
              throw new Error(`left join select missing primary key of '${options.as}' table`);
            }
            // 没有结果跳过
            if (data[model[OPTIONS].pk] === null) {
              return;
            }
          }
          // 有 join 结果再初始化 as 对象
          if (propertyAt(instance, options._asPath) === undefined) {
            propertyAt(instance, options._asPath, options.asList ? [] : {});
          }
          // 设置数据到 as 对象中
          const joinInstance = model._createInstance(data);
          if (options.asList) {
            propertyAt(instance, options._asPath).push(joinInstance);
          } else {
            propertyAt(instance, options._asPath, joinInstance);
          }
        }
      });
      // 合并其他非表结构数据到主数据中
      if (typeof row[''] === 'object') {
        Object.entries(row['']).forEach(([key, value]) => {
          propertyAt(instance, key.split('->'), value);
        });
      }
    });
    return this._fetchAfter(isOne ? instanceMap.values().next().value : Array.from(instanceMap.values()));
  }
  */

  /**
   * 取得数据列表
   */
  /*
  async all(...columns: ColumnList): Promise<T[]> {
    return <T[]> await this._fetch(columns, false);
  }
  */

  /**
   * 取得一条数据
   */
  async get(...columns: ColumnList): Promise<T> {
    const resutl = <DataResult[] | DataResult> await this._fetchResult(true, columns);
    console.log({ resutl });
    if (Array.isArray(resutl)) {
      return null;
    }
    return this._repository.createInstance(resutl);
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
      // list = await this.all(...columns);
    }
    return { limit, offset, order, total, list };
  }

  /**
   * 直接取得查询数据中的一个值
   * @param column
   * @param defaultValue 如果找不到返回的默认值，不指定则抛出异常 DoesNotExist
   */
  async value<D>(column: string, defaultValue?: D): Promise<DataValue | D> {
    const result = <DataResult> await this._repository.query(builder => {
      builder.select(typeof column === 'string' ? { [column]: 'value' } : { value: column });
      builder.from(this._repository.option.table);
      this._joinBuilder(builder);
      builder.nestTables(false);
      this._whereBuilder(builder);
      this._groupBuilder(builder);
      this._orderBuilder(builder);
      builder.one(this._limit || 0);
    });
    if (result && result.value) {
      return result.value;
    }
    if (defaultValue === undefined) {
      throw new DoesNotExist(`The requested object '${this._repository.option.table}' does not exist.`);
    }
    return defaultValue;
  }

  /**
   * 查询条数
   */
  async count(column = '*') {
    const result = <DataResult> await this._repository.query(builder => {
      builder.count(column, 'c');
      builder.from(this._repository.option.table);
      this._joinBuilder(builder);
      this._whereBuilder(builder);
      if (this._group.length) {
        throw new Error(`在 group() 中使用 count() 用法错误。请使用 all('${column}', { count: AB.count('${column}') }) 取得结果。`);
      }
      builder.setOne();
      builder.nestTables(false);
    });
    return <number> result['c'];
  }

  /**
   * 查询数据是否存在
   */
  async exists() {
    const result = <DataResult> await this._repository.query(builder => {
      builder.select(builder.raw('1'));
      builder.from(this._repository.option.table);
      this._joinBuilder(builder);
      this._whereBuilder(builder);
      this._groupBuilder(builder);
      builder.one();
      builder.nestTables(false);
    });
    return (result && result['1'] === 1) || false;
  }

  /**
   * 更新数据
   * @param data 需要更新的字段值
   * @returns 更新条数
   */
  async update(data: DataResult) {
    const result = <QueryResult> await this._repository.query(builder => {
      builder.update(this._repository.option.table, data);
      this._whereBuilder(builder);
      this._orderBuilder(builder);
      this._limitBuilder(builder);
    });
    return result.affectedRows;
  }

  /**
   * 删除数据
   * @returns 删除的条数
   */
  async delete() {
    const result = <QueryResult> await this._repository.query(builder => {
      builder.delete(this._repository.option.table);
      this._whereBuilder(builder);
      this._orderBuilder(builder);
      this._limitBuilder(builder);
    });
    return result.affectedRows;
  }
}
