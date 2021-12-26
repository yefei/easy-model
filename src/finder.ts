import { cloneDeep } from 'lodash';
import { propertyAt } from './utils';
import { DoesNotExist, UndefinedRelationException } from './excepts';
import { Builder, JsonWhere } from 'sql-easy-builder';
import { ColumnAs, ColumnList, DataRow, DefinedJoinOption, JoinOption, ManyOption, ModelClass, ModelOption, PageOption } from './types';
import { Model } from './model';
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
  private _join: { [name: string]: DefinedJoinOption<T> } = {};
  private _many: { [name: string]: ManyOption } = {};
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
    finder._where = cloneDeep(this._where);
    finder._whereAndOr = cloneDeep(this._whereAndOr);
    finder._limit = this._limit;
    finder._offset = this._offset;
    finder._order = this._order ? this._order.slice() : null;
    finder._join = cloneDeep(this._join);
    finder._many = cloneDeep(this._many);
    finder._group = this._group.slice();
    finder._having = cloneDeep(this._having);
    return finder;
  }

  /**
   * 设置查询条件
   */
  where(where: JsonWhere) {
    this._where = cloneDeep(where);
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
  join(target: string | ModelClass<T>, joinOption?: JoinOption) {
    if (typeof target === 'string') {
      // 级连 join: a->b->c
      if (target.indexOf('->') > 0) {
        const joins = target.split('->');
        let _options = this._join[joins[0]];
        // 是否需要加入第一级 join: a
        if (!_options) {
          _options = this._getDefinedJoinOption(this._repository.option, joins[0]);
          this._joinAppend(_options.model, _options);
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
            _options = this._getDefinedJoinOption(preJoinOptions._model[OPTIONS], cur, curJoinOptions);
            this._joinAppend(_options.model, _options);
          }
          return _as;
        });
        return this;
      }
      let _options = this._getDefinedJoinOption(this._options, joinModel, joinOption);
      target = _options.model;
      joinOption = _options;
    }
    this._joinAppend(target, joinOption);
    return this;
  }

  /**
   * 取得预定义 join 项的配置
   */
  _getDefinedJoinOption(targetModelOptions: ModelOption, key: string, options?: JoinOption): DefinedJoinOption {
    if (targetModelOptions.join && key in targetModelOptions.join) {
      return Object.assign({ as: key }, targetModelOptions.join[key], options);
    }
    throw new UndefinedRelationException(`${targetModelOptions.name} join ${key}`);
  }

  _getModelByName(name: string) {
    if (name in this._options.modelMap) {
      return this._options.modelMap[name];
    }
    throw new Error(`Undefined model: ${name}`);
  }

  _joinAppend(joinModel: ModelQuery | Model<T> | string, options?: JoinOptions) {
    if (typeof joinModel === 'string') {
      joinModel = this._getModelByName(joinModel);
    }
    if (typeof joinModel === 'function') {
      joinModel = joinModel(this._query);
    }
    options = Object.assign({
      from: this._options.name,
      fk: joinModel[OPTIONS].name + '_' + joinModel[OPTIONS].pk,
      ref: this._options.pk,
      type: 'INNER',
      as: joinModel[OPTIONS].name,
      asList: false,
    }, options);
    options.type = options.type.trim().toUpperCase();
    // options._model = joinModel;
    this._checkAsName(options.as);
    this._join[options.as] = options;
  }

  _joinPrep(builder: Builder) {
    Object.values(this._join).forEach(options => {
      const joinModel = options._model;
      options._asPath = options.as.split('->');
      const on = options.on || {
        [`${options.as}.${options.ref}`]: builder.quote(`${options.from}.${options.fk}`),
      };
      if (options.where) {
        Object.assign(on, options.where);
      }
      builder.join(
        joinModel[OPTIONS].table,
        // 如果和表名一致则没有必要 as
        options.as === joinModel[OPTIONS].table ? null : options.as,
        on,
        options.type
      );
      builder.nestTables();
    });
  }

  _columnPrep(col: string | ColumnAs) {
    return typeof col === 'string' && !col.includes('.') ? `${this._options.table}.${col}` : col;
  }

  /**
   * 在取得主表结果后查询其他关联表多条结果
   * 用于一对多或多对多场景
   */
  many(manyModel: string | ModelQuery | Model<T> | Finder<T>, options?: ManyOptions) {
    if (typeof manyModel === 'string') {
      if (this._options.many && manyModel in this._options.many) {
        options = Object.assign({ as: manyModel }, this._options.many[manyModel], options);
        manyModel = options.model;
      } else {
        throw new UndefinedRelationException(`${this._options.name} many ${manyModel}`);
      }
    }
    options = Object.assign({
      fk: `${this._options.name}_id`,
      ref: this._options.pk,
      parallel: false,
    }, options);
    this._checkAsName(options.as);
    this._many[options.as] = [manyModel, options];
    return this;
  }

  /**
   * GROUP BY
   * @param  {...string} columns
   * @returns {Finder}
   */
  group(...columns) {
    this._group.push(...columns);
    return this;
  }

  /**
   * GROUP BY HAVING
   * @param {Where | { [key: string]: any }} condition
   * @returns {Finder}
   */
  having(condition) {
    this._having = condition;
    return this;
  }

  /**
   * @param {Builder} builder
   */
  _groupBuilder(builder) {
    if (this._group.length) {
      builder.group(...this._group);
      if (this._having) {
        builder.having(this._having);
      }
    }
  }

  async _fetchAfter(result) {
    const many = Object.values(this._many);
    if (many.length === 0) return result;
    for (var [model, options] of many) {
      if (typeof model === 'string') {
        model = this._getModelByName(model);
      }
      // 如果是 function 类型，可能是 modelQuery 也可能是用户自定义初始化函数
      if (typeof model === 'function') {
        model = await model(this._query);
      }
      // 查询结果
      /** @type {Finder} */
      let finder;
      if (model instanceof Finder) {
        finder = model;
        model = finder._model;
      } else {
        finder = model.find();
      }
      const path = options.ref.split('.');
      const _asPath = (options.as || model[OPTIONS].name).split('->');
      const _fetchManyResult = async instance => {
        const refValue = propertyAt(instance, path);
        let manyResults;
        if (refValue !== undefined) {
          const _finder = finder.clone();
          const _where = { [options.fk]: refValue };
          if (_finder._where) {
            _finder.whereAnd(_where);
          } else {
            _finder.where(_where);
          }
          if (Array.isArray(options.columns)) {
            manyResults = await _finder.all(...options.columns);
          } else if (typeof options.columns === 'object') {
            manyResults = await _finder.all(options.columns);
          } else {
            manyResults = await _finder.all();
          }
        }
        propertyAt(instance, _asPath, manyResults || []);
      };
      if (Array.isArray(result)) {
        if (options.parallel) {
          await Promise.all(result.map(_fetchManyResult));
        } else {
          for (const instance of result) {
            await _fetchManyResult(instance);
          }
        }
      } else {
        await _fetchManyResult(result);
      }
    }
    return result;
  }

  /**
   * 取得数据
   * @param {(string | { [key: string]: any })[]} [columns] 需要检出的字段
   * @param isOne 是否取单条
   */
  async _fetch(columns: ColumnList, isOne = false): Promise<T | T[] | null> {
    const _join = Object.values(this._join);
    const _notJoin = _join.length === 0;
    // 取一条且无join情况
    const _one = isOne && _notJoin;
    /** @type {Array} */
    const resutl = await this._query.query(builder => {
      // 在有 join 的情况下如果没有指定目标表则默认使用当前表
      builder.select(...columns.map(i => _notJoin ? i : this._columnPrep(i)));
      builder.from(this._model._table);
      this._joinPrep(builder);
      this._whereBuilder(builder);
      this._groupBuilder(builder);
      this._orderBuilder(builder);
      if (_one) builder.one();
      else this._limitBuilder(builder);
    });
    if (!resutl || resutl.length === 0) {
      return isOne ? null : resutl;
    }
    if (_one) return this._fetchAfter(this._model._createInstance(resutl));
    // 无 join
    if (_notJoin) {
      return this._fetchAfter(resutl.map(row => this._model._createInstance(row)));
    }
    // 合并 join 结果到 instance 中
    /** @type {Map<any, Instance>} */
    const instanceMap = new Map();
    // 处理列表结果
    resutl.forEach(row => {
      // 多条结果 join 结果组合
      const mainName = this._options.name;
      const thisData = row[mainName];
      const pkval = thisData[this._options.pk];
      if (pkval === undefined) {
        throw new Error(`join select missing primary key of '${mainName}' table`);
      }
      if (!instanceMap.has(pkval)) {
        instanceMap.set(pkval, this._model._createInstance(thisData));
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

  /**
   * 取得数据列表
   */
  all(...columns: ColumnList): Promise<T[]> {
    return this._fetch(columns, false);
  }

  /**
   * 取得一条数据
   */
  get(...columns: ColumnList): Promise<T> {
    return this._fetch(columns, true);
  }

  /**
   * 分页取得数据列表
   */
  async page({ limit, offset, order }: PageOption, ...columns: ColumnList) {
    const total = await this.count();
    let list = [];
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
  async value(column: string, defaultValue?: any) {
    const result = await this._repository.query(builder => {
      builder.select(typeof column === 'string' ? { [column]: 'value' } : { value: column });
      builder.from(this._repository.tableName);
      this._joinPrep(builder);
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
      throw new DoesNotExist(`The requested object '${this._repository.tableName}' does not exist.`);
    }
    return defaultValue;
  }

  /**
   * 查询条数
   * @param {string | Raw} [column]
   * @returns {Promise<number>}
   */
  async count(column = '*') {
    const result = await this._repository.query(builder => {
      builder.count(column, 'c');
      builder.from(this._repository.tableName);
      this._joinPrep(builder);
      this._whereBuilder(builder);
      if (this._group.length) {
        throw new Error(`在 group() 中使用 count() 用法错误。请使用 all('${column}', { count: AB.count('${column}') }) 取得结果。`);
      }
      builder.setOne();
      builder.nestTables(false);
    });
    return result['c'];
  }

  /**
   * 查询数据是否存在
   */
  async exists(): Promise<boolean> {
    const result = await this._repository.query(builder => {
      builder.select(builder.raw('1'));
      builder.from(this._repository.tableName);
      this._joinPrep(builder);
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
  async update(data: DataRow): Promise<number> {
    const result = await this._repository.query(builder => {
      builder.update(this._repository.tableName, data);
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
  async delete(): Promise<number> {
    const result = await this._repository.query(builder => {
      builder.delete(this._repository.tableName);
      this._whereBuilder(builder);
      this._orderBuilder(builder);
      this._limitBuilder(builder);
    });
    return result.affectedRows;
  }
}
