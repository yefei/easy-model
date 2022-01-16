import { propertyAt, simpleCopy } from './utils';
import { UndefinedRelationException } from './excepts';
import { Builder, FieldType, JsonWhere } from 'sql-easy-builder';
import { ColumnAs, ColumnList, DataResult, DataValue, JoinOption, ManyOption, ModelClass, ModelOption } from './types';
import { getModelJoinOption, getModelManyOption, getModelOption, MODEL, Model } from './model';
import { createInstance } from './instance';

/**
 * Finder
 */
export class Finder<T extends Model> {
  protected _modelClass: ModelClass<T>;
  protected _option: ModelOption;
  protected _where: JsonWhere;
  protected _whereAndOr: [where: JsonWhere, prep?: string, after?: string][] = [];
  protected _limit: number = null;
  protected _offset: number = 0;
  protected _order: string[] = null;
  protected _join: { [name: string]: JoinOption<any> } = {};
  protected _many: { [name: string]: ManyOption<any> } = {};
  protected _group: string[] = [];
  protected _having: JsonWhere = null;

  constructor(modelClass: ModelClass<T>) {
    this._modelClass = modelClass;
    this._option = getModelOption(modelClass);
  }

  protected _clone(finder: Finder<T>) {
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
   * 复制当前 finder 实例
   */
  clone() {
    const finder = new Finder<T>(this._modelClass);
    return this._clone(finder);
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
  protected _whereBuilder(builder: Builder) {
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

  protected _limitBuilder(builder: Builder) {
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

  protected _orderBuilder(builder: Builder) {
    if (this._order && this._order.length > 0) {
      builder.order(...this._order);
      return;
    }
    const defaultOrder = this._option.order || [];
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
          return `-${this._option.table}.${i.slice(1)}`;
        }
        return `${this._option.table}.${i}`;
      }));
    }
  }

  /**
   * 检查别名是否冲突
   */
  protected _checkAsName(name: string) {
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
          _options = this._getDefinedJoinOption(this._modelClass, joins[0]);
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
      joinOption = Object.assign({}, this._getDefinedJoinOption(this._modelClass, target), joinOption);
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
  protected _getDefinedJoinOption<M extends Model>(modelClass: ModelClass<M>, key: string): JoinOption<M> {
    const opt = getModelJoinOption(modelClass, key);
    if (!opt) {
      throw new UndefinedRelationException(`${modelClass.name} join ${key}`);
    }
    return opt;
  }

  protected _joinAppend<J extends Model>(option: JoinOption<J>) {
    const joinModel = option[MODEL];
    const opt = getModelOption(joinModel);
    const defaultOption: JoinOption<J> = {
      from: this._option.table,
      fk: opt.table + '_' + opt.pk,
      ref: this._option.pk,
      type: 'INNER',
      as: opt.table,
      asList: false,
    };
    option = Object.assign(defaultOption, option);
    this._checkAsName(option.as);
    this._join[option.as] = option;
  }

  protected _joinBuilder(builder: Builder) {
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

  protected _columnPrep(col: string | ColumnAs) {
    return typeof col === 'string' && !col.includes('.') ? `${this._option.table}.${col}` : col;
  }

  /**
   * 在取得主表结果后查询其他关联表多条结果
   * 用于一对多或多对多场景
   */
  many<M extends Model>(target: string | ModelClass<M>, option?: ManyOption<M>) {
    if (typeof target === 'string') {
      const opt = getModelManyOption(this._modelClass, target);
      if (!opt) {
        throw new UndefinedRelationException(`${this._modelClass.name} many ${target}`);
      }
      option = Object.assign({}, opt, option);
      target = option[MODEL];
    }
    const targetModelOpt = getModelOption(target);
    option = Object.assign({
      fk: targetModelOpt.table + '_' + targetModelOpt.pk,
      ref: this._option.pk,
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

  protected _groupBuilder(builder: Builder) {
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

  protected _joinResult(resutls: DataResult[]) {
    // 合并 join 结果到 instance 中
    const instanceMap = new Map<DataValue, T>();
    // 处理列表结果
    resutls.forEach(row => {
      // 多条结果 join 结果组合
      const mainName = this._option.table;
      const thisData = row[mainName];
      const pkval = thisData[this._option.pk];
      if (pkval === undefined) {
        throw new Error(`join select missing primary key of '${mainName}' table`);
      }
      if (!instanceMap.has(pkval)) {
        instanceMap.set(pkval, createInstance(this._modelClass, thisData));
      }
      const instance = instanceMap.get(pkval);
      Object.values(this._join).forEach(options => {
        const model = options[MODEL];
        const modelOption = getModelOption(model);
        const _asPath = options.as.split('->');
        const data = row[options.as];
        if (data) {
          // 对于 LEFT JOIN 会产生所有列为 NULL 的结果问题，必须取得主键值
          if (options.type.startsWith('LEFT')) {
            if (data[modelOption.pk] === undefined) {
              throw new Error(`left join select missing primary key of '${options.as}' table`);
            }
            // 没有结果跳过
            if (data[modelOption.pk] === null) {
              return;
            }
          }
          // 有 join 结果再初始化 as 对象
          if (propertyAt(instance, _asPath) === undefined) {
            propertyAt(instance, _asPath, options.asList ? [] : {});
          }
          // 设置数据到 as 对象中
          const joinInstance = createInstance(model, data);
          if (options.asList) {
            propertyAt(instance, _asPath).push(joinInstance);
          } else {
            propertyAt(instance, _asPath, joinInstance);
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
    return instanceMap;
  }

  protected _fetchBuilder(builder: Builder, one: boolean, columns: ColumnList) {
    const isJoin = Object.values(this._join).length > 0;
    // 在有 join 的情况下如果没有指定目标表则默认使用当前表
    builder.select(...columns.map(i => isJoin ? this._columnPrep(i) : i));
    builder.from(this._option.table);
    isJoin && this._joinBuilder(builder);
    this._whereBuilder(builder);
    this._groupBuilder(builder);
    this._orderBuilder(builder);
    if (one && !isJoin) builder.one();
    else this._limitBuilder(builder);
  }

  protected _valueBuilder(builder: Builder, column: FieldType) {
    builder.select(typeof column === 'string' ? { [column]: 'value' } : { value: column });
    builder.from(this._option.table);
    this._joinBuilder(builder);
    builder.nestTables(false);
    this._whereBuilder(builder);
    this._groupBuilder(builder);
    this._orderBuilder(builder);
    builder.one(this._limit || 0);
  }

  protected _countBuilder(builder: Builder, column: FieldType) {
    builder.count(column, 'c');
    builder.from(this._option.table);
    this._joinBuilder(builder);
    this._whereBuilder(builder);
    if (this._group.length) {
      throw new Error(`在 group() 中使用 count() 用法错误。请使用 all('${column}', { count: AB.count('${column}') }) 取得结果。`);
    }
    builder.setOne();
    builder.nestTables(false);
  }

  protected _existsBuilder(builder: Builder) {
    builder.select(builder.raw('1'));
    builder.from(this._option.table);
    this._joinBuilder(builder);
    this._whereBuilder(builder);
    this._groupBuilder(builder);
    builder.one();
    builder.nestTables(false);
  }

  protected _updateBuilder(builder: Builder, data: DataResult) {
    builder.update(this._option.table, data);
    this._whereBuilder(builder);
    this._orderBuilder(builder);
    this._limitBuilder(builder);
  }

  protected _deleteBuilder(builder: Builder) {
    builder.delete(this._option.table);
    this._whereBuilder(builder);
    this._orderBuilder(builder);
    this._limitBuilder(builder);
  }
}
