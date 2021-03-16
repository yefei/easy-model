'use strict';
/**
 * @typedef { import('mysql-easy-query').Builder } Builder
 * @typedef { import('mysql-easy-query').Where } Where
 * @typedef { import('mysql-easy-query').Query } Query
 * @typedef { import('./model').Model } Model
 * @typedef { import('..').Instance } Instance
 */
const { QUERY, OPTIONS } = require('./symbols');
const { propertyAt } = require('./utils');

 /**
  * Finder
  */
class Finder {
  /**
   * @param {Model} model 
   * @param {Where | { [key: string]: any }} where
   */
  constructor(model, where) {
    this._model = model;
    /** @type {Query} */
    this._query = model[QUERY];
    this._where = where;
    this._whereAndOr = [];
    this._limit = null;
    this._order = model[OPTIONS].order || null;
    this._join = {};
    this._many = {};
  }

  clone() {
    const finder = new Finder(this._model, this._where);
    finder._whereAndOr = this._whereAndOr.slice();
    finder._limit = this._limit ? this._limit.slice() : null;
    finder._order = this._order ? this._order.slice() : null;
    Object.assign(finder._join, this._join);
    Object.assign(finder._many, this._many);
    return finder;
  }

  /**
   * 设置查询条件
   * @param {Where | { [key: string]: any }} where 
   */
  where(where) {
    this._where = where;
    return this;
  }

  /**
   * 追加 AND 查询
   * @param {Where | { [key: string]: any }} where 
   */
  whereAnd(where) {
    this._whereAndOr.push([where, 'AND']);
    return this;
  }

  /**
   * 追加 OR 查询
   * @param {Where | { [key: string]: any }} where 
   */
  whereOr(where) {
    this._whereAndOr.push([where, 'OR (', ')']);
    return this;
  }

  /**
   * @param {Builder} builder 
   */
  _whereBuilder(builder) {
    if (this._where) builder.where(this._where);
    this._whereAndOr.forEach(args => builder.where(...args));
  }

  /**
   * 限制条数
   * @param {number} count
   * @param {number} [offset]
   * @returns {Finder}
   */
  limit(count, offset = 0) {
    this._limit = [count, offset];
    return this;
  }

  /**
   * 排序
   * @param  {...string} columns
   * @returns {Finder}
   */
  order(...columns) {
    this._order = columns;
    return this;
  }

  /**
   * 检查别名是否冲突
   * @param {string} name 
   */
  _checkAsName(name) {
    if (this._join[name] || this._many[name]) {
      throw new Error(`duplicate as: ${name}`);
    }
  }

  /**
   * @param {Model | Finder} modelQuery 
   * @param {object} [options]
   * @param {string} [options.from] 来源表名称
   * @param {string} [options.fk] 主表外键名称
   * @param {string} [options.ref] 来源表引用键，默认为主键
   * @param {string} [options.type] join 模式
   * @param {string} [options.as] 输出别名, 可以使用 -> 命名空间
   * @param {string} [options.asList] join 结果为列表
   * @param {Where | { [key: string]: any }} [options.on] 覆盖默认 ON 查询条件
   * @returns {Finder}
   */
  join(modelQuery, options) {
    const joinModel = typeof modelQuery === 'function' ? modelQuery(this._query) : modelQuery;
    options = Object.assign({
      from: this._model[OPTIONS].name,
      fk: joinModel[OPTIONS].name + '_' + joinModel[OPTIONS].pk,
      ref: this._model[OPTIONS].pk,
      type: 'INNER',
      as: joinModel[OPTIONS].name,
      asList: false,
    }, options);
    options.type = options.type.trim().toUpperCase();
    this._checkAsName(options.as);
    this._join[options.as] = [joinModel, options];
    return this;
  }

  /**
   * @param {Builder} builder 
   */
  _joinPrep(builder) {
    Object.values(this._join).forEach(([joinModel, options]) => {
      options._asPath = options.as.split('->');
      if (!options.on) {
        options.on = {
          [`${options.as}.${options.ref}`]: builder.quote(`${options.from}.${options.fk}`),
        };
      }
      builder.join(
        joinModel[OPTIONS].table,
        // 如果和表名一致则没有必要 as
        options.as === joinModel[OPTIONS].table ? null : options.as,
        options.on,
        options.type
      );
      builder.nestTables();
    });
  }

  /**
   * 在取得主表结果后查询其他关联表多条结果
   * 用于一对多或多对多场景
   * @param {Model | Finder} manyModel 
   * @param {object} [options]
   * @param {string} [options.fk] many 表外键
   * @param {string} [options.ref] 来源表引用键，默认为主键, 在JOIN结果中可使用.命名空间，例如 user.id
   * @param {string} [options.as] 输出别名, 可以使用 -> 命名空间
   * @param {string[] | object} [options.columns] 需要的结果列
   * @param {boolean} [options.parallel] 是否使用并行查询
   * @returns {Finder}
   */
  many(manyModel, options) {
    options = Object.assign({
      fk: `${this._model[OPTIONS].name}_id`,
      ref: this._model[OPTIONS].pk,
      columns: '*',
      parallel: false,
    }, options);
    this._checkAsName(options.as);
    this._many[options.as] = [manyModel, options];
    return this;
  }

  async _fetchAfter(result) {
    const many = Object.values(this._many);
    if (many.length === 0) return result;
    for (let [model, options] of many) {
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
      const columns = Array.isArray(options.columns) ? options.columns : [options.columns];
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
          manyResults = await _finder.all(...columns);
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
   * @param {boolean} isOne 是否取单条
   * @param {(string | { [key: string]: any })[]} [columns] 需要检出的字段
   * @returns {Instance | Instance[] | null}
   */
  async _fetch(isOne = false, columns) {
    const _join = Object.values(this._join);
    // 取一条且无join情况
    const _one = isOne && _join.length === 0;
    /** @type {Array} */
    const resutl = await this._query.query(builder => {
      builder.select(...columns);
      builder.from(this._model._table);
      this._joinPrep(builder);
      this._whereBuilder(builder);
      if (this._order) builder.order(...this._order);
      if (_one) builder.one();
      else if (this._limit) builder.limit(...this._limit);
    });
    if (!resutl || resutl.length === 0) return resutl;
    if (_one) return this._fetchAfter(this._model._createInstance(resutl));
    // 无 join
    if (_join.length === 0) {
      return this._fetchAfter(resutl.map(row => this._model._createInstance(row)));
    }
    // 合并 join 结果到 instance 中
    /** @type {Map<any, Instance>} */
    const instanceMap = new Map();
    // 处理列表结果
    resutl.forEach(row => {
      // 多条结果 join 结果组合
      const mainName = this._model[OPTIONS].name;
      const thisData = row[mainName];
      const pkval = thisData[this._model[OPTIONS].pk];
      if (pkval === undefined) {
        throw new Error(`join select missing primary key of '${mainName}' table`);
      }
      if (!instanceMap.has(pkval)) {
        instanceMap.set(pkval, this._model._createInstance(thisData));
      }
      const instance = instanceMap.get(pkval);
      _join.forEach(([model, options]) => {
        // 无论是否有 join 结果都需要初始化 as 对象
        if (propertyAt(instance, options._asPath) === undefined) {
          propertyAt(instance, options._asPath, options.asList ? [] : null);
        }
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
   * @param {...(string | { [key: string]: any })} [columns] 需要检出的字段
   * @returns {Promise<Instance[]>}
   */
  all(...columns) {
    return this._fetch(false, columns);
  }

  /**
   * 取得一条数据
   * @param {...(string | { [key: string]: any })} [columns] 需要检出的字段
   * @returns {Promise<Instance | null>}
   */
  get(...columns) {
    return this._fetch(true, columns);
  }

  /**
   * 查询条数
   * @returns {Promise<number>}
   */
  async count() {
    const result = await this._query.query(builder => {
      builder.count('*', 'c');
      builder.from(this._model._table);
      this._joinPrep(builder);
      this._whereBuilder(builder);
      builder.setOne();
      builder.nestTables(false);
    });
    return result['c'];
  }

  /**
   * 查询数据是否存在
   * @returns {Promise<boolean>}
   */
  async exists() {
    const result = await this._query.query(builder => {
      builder.select(builder.raw(1));
      builder.from(this._model._table);
      this._joinPrep(builder);
      this._whereBuilder(builder);
      builder.one();
    });
    return (result && result['1'] === 1) || false;
  }

  /**
   * 更新数据
   * @param {{ [key: string]: any }} columns 需要更新的字段值
   * @returns {Promise<number>} 更新条数
   */
  async update(columns) {
    const result = await this._query.query(builder => {
      builder.update(this._model._table, columns);
      this._whereBuilder(builder);
      if (this._order) builder.order(...this._order);
      if (this._limit) builder.limit(...this._limit);
    });
    return result.affectedRows;
  }

  /**
   * 删除数据
   * @returns {Promise<number>} 删除的条数
   */
  async delete() {
    const result = await this._query.query(builder => {
      builder.delete(this._model._table);
      this._whereBuilder(builder);
      if (this._order) builder.order(...this._order);
      if (this._limit) builder.limit(...this._limit);
    });
    return result.affectedRows;
  }
}

module.exports = Finder;
