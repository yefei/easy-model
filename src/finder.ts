import { propertyAt, simpleCopy } from './utils';
import { UndefinedRelationException } from './excepts';
import { Builder, FieldType, JsonWhere } from 'sql-easy-builder';
import { ColumnAs, ColumnList, DataResult, DataValue, JoinOption, ManyOption, ModelClass, ModelOption, TableColumnList } from './types';
import { getModelJoinOption, getModelManyOption, getModelOption, MODEL, Model } from './model';
import { createInstance } from './instance';

export const FINDER = Symbol('Finder');
export const PKNAME = '__pk';

/**
 * Finder
 */
export class Finder<T extends Model> {
  readonly [MODEL]: ModelClass<T>;
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
    this[MODEL] = modelClass;
    this._option = getModelOption(modelClass);
  }

  /**
   * 复制当前 finder 实例
   * @param finder 复制入的目标，默认为新实例
   */
  clone(finder?: Finder<T>) {
    finder = finder || new Finder<T>(this[MODEL]);
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
  protected _whereBuilder(builder: Builder) {
    if (this._where) builder.where(this._where);
    if (this._whereAndOr.length) {
      if (this._where) {
        this._whereAndOr.forEach(args => builder.where(...args));
      } else {
        builder.where(this._whereAndOr[0][0]);
        this._whereAndOr.slice(1).forEach(args => builder.where(...args));
      }
    }
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
      if (!this._haveJoin) {
        builder.order(...defaultOrder);
        return;
      }
      // 在有 join 的情况下如果没有指定目标表则默认使用当前表
      builder.order(...defaultOrder.map(i => {
        if (i.startsWith('-')) {
          return `-${this._option.name}.${i.slice(1)}`;
        }
        return `${this._option.name}.${i}`;
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
          _options = this._getDefinedJoinOption(this[MODEL], joins[0]);
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
            const preMainModel = preJoinOptions[MODEL];
            _options = Object.assign({}, this._getDefinedJoinOption(preMainModel, cur), curJoinOptions);
            this._joinAppend(_options, getModelOption(preMainModel));
          }
          return _as;
        });
        return this;
      }
      // 一级预定义 join
      joinOption = Object.assign({}, this._getDefinedJoinOption(this[MODEL], target), joinOption);
    } else {
      if (!joinOption) {
        joinOption = {};
      }
      joinOption[MODEL] = target;
    }
    this._joinAppend(joinOption);
    return this;
  }

  protected get _haveJoin() {
    return Object.keys(this._join).length > 0;
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

  protected _joinAppend<J extends Model>(option: JoinOption<J>, mainModelOption?: ModelOption) {
    mainModelOption = mainModelOption || this._option;
    const joinModel = option[MODEL];
    const joinModelOption = getModelOption(joinModel);
    const defaultOption: JoinOption<J> = {
      from: mainModelOption.name,
      as: joinModelOption.name,
      asList: false,
    };
    if (option.type === 'OneToOne') {
      defaultOption.fk = joinModelOption.pk;
      defaultOption.ref = mainModelOption.pk;
    }
    else if (option.type === 'OneToMany') {
      defaultOption.fk = joinModelOption.pk;
      defaultOption.ref = mainModelOption.name + '_' + mainModelOption.pk;
      defaultOption.asList = true;
      defaultOption.optional = true;
    } else { // 默认 ManyToOne
      defaultOption.fk = joinModelOption.name + '_' + joinModelOption.pk;
      defaultOption.ref = mainModelOption.pk;
    }
    option = Object.assign(defaultOption, option);
    this._checkAsName(option.as);
    this._join[option.as] = option;
  }

  protected _joinBuilder(builder: Builder) {
    Object.values(this._join).forEach(opt => {
      const modelOpt = getModelOption(opt[MODEL]);
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
        opt.optional ? 'LEFT' : 'INNER',
      );
      builder.nestTables();
    });
  }

  /**
   * 在取得主表结果后查询其他关联表多条结果
   * 用于一对多或多对多场景
   */
  many<M extends Model>(target: string | ModelClass<M>, option?: ManyOption<M>) {
    if (typeof target === 'string') {
      const opt = getModelManyOption(this[MODEL], target);
      if (!opt) {
        throw new UndefinedRelationException(`${this[MODEL].name} many ${target}`);
      }
      option = Object.assign({}, option, opt);
      target = option[MODEL];
      if (option.finder) {
        var finder = new Finder(target);
        option.finder(finder);
      }
    }
    const defaultOption: ManyOption<M> = {
      [FINDER]: finder || new Finder(target),
      fk: this._option.name + '_' + this._option.pk,
      ref: this._option.pk,
      parallel: false,
    };
    option = Object.assign(defaultOption, option);
    this._checkAsName(option.as);
    this._many[option.as] = option;
    return this;
  }

  protected get _haveMany() {
    return Object.keys(this._many).length > 0;
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

  protected _joinResultsMerge(resutls: DataResult[]) {
    const mainName = this._option.name;
    // 合并 join 结果到 instance 中
    const instanceMap = new Map<DataValue, T>();
    // 处理列表结果
    for (const row of resutls) {
      // 多条结果 join 结果组合
      const thisData = row[mainName];
      const pkval = PKNAME in thisData ? thisData[PKNAME] : thisData[this._option.pk];
      if (pkval === undefined) {
        throw new Error(`join select missing primary key of '${mainName}' table`);
      }
      if (!instanceMap.has(pkval)) {
        instanceMap.set(pkval, createInstance(this[MODEL], thisData));
      }
      this._joinResultMerge(instanceMap.get(pkval), row);
    }
    return Array.from(instanceMap.values());
  }

  protected _joinResultMerge(instance: T, resutl: DataResult) {
    for (const opt of Object.values(this._join)) {
      const model = opt[MODEL];
      const modelOption = getModelOption(model);
      const data = resutl[opt.as];
      if (data) {
        // 对于 LEFT JOIN 会产生所有列为 NULL 的结果问题，必须取得主键值
        if (opt.optional) {
          const pkval = PKNAME in data ? data[PKNAME] : data[modelOption.pk];
          if (pkval === undefined) {
            throw new Error(`left join select missing primary key of '${opt.as}' table`);
          }
          // 没有结果跳过
          if (pkval === null) {
            return;
          }
        }
        const _asPath = opt.as.split('->');
        if (opt.asList) {
          if (propertyAt(instance, _asPath) === undefined) {
            propertyAt(instance, _asPath, []);
          }
          propertyAt(instance, _asPath).push(createInstance(model, data));
        } else if (propertyAt(instance, _asPath) === undefined) {
          propertyAt(instance, _asPath, createInstance(model, data));
        }
      }
    }
    // 合并其他非表结构数据到主数据中
    if (typeof resutl[''] === 'object') {
      Object.entries(resutl['']).forEach(([key, value]) => {
        propertyAt(instance, key.split('->'), value);
      });
    }
  }

  protected _formBuilder(builder: Builder) {
    builder.from(this._option.table, this._option.name !== this._option.table && this._option.name);
  }

  protected _columnPrep(col: string | ColumnAs | TableColumnList) {
    if (typeof col === 'string') {
      if (col !== '*' && !col.includes('.')) {
        return `${this._option.name}.${col}`;
      }
    }
    return col;
  }

  protected _fetchBuilder(builder: Builder, one: boolean, columns: ColumnList) {
    const isJoin = this._haveJoin;
    const isJoinList = isJoin && Object.values(this._join).findIndex(i => i.asList) !== -1;
    if (columns.length > 0) {
      // 如果指定列检出则强制加上主键检出
      columns.push({ [`${this._option.name}.${this._option.pk}`]: PKNAME });
      if (isJoin) {
        for (const j of Object.values(this._join)) {
          const jopt = getModelOption(j[MODEL]);
          columns.push({ [`${j.as}.${jopt.pk}`]: PKNAME });
        }
      }
    }
    // 在有 join 的情况下如果没有指定目标表则默认使用当前表
    builder.select(...columns.map(i => isJoin ? this._columnPrep(i) : i));
    this._formBuilder(builder);
    isJoin && this._joinBuilder(builder);
    this._whereBuilder(builder);
    this._groupBuilder(builder);
    this._orderBuilder(builder);
    if (one && !isJoinList) builder.one();
    else this._limitBuilder(builder);
  }

  protected _valueBuilder(builder: Builder, column: FieldType) {
    builder.select(typeof column === 'string' ? { [column]: 'value' } : { value: column });
    this._formBuilder(builder);
    this._joinBuilder(builder);
    builder.nestTables(false);
    this._whereBuilder(builder);
    this._groupBuilder(builder);
    this._orderBuilder(builder);
    builder.one(this._limit || 0);
  }

  protected _countBuilder(builder: Builder, column: FieldType) {
    builder.count(column, 'c');
    this._formBuilder(builder);
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
    this._formBuilder(builder);
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
