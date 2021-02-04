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
    this._limit = null;
    this._order = model[OPTIONS].order || null;
    this._join = {};
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
   * @param {Model} modelQuery 
   * @param {object} [options]
   * @param {string} [options.from]
   * @param {string} [options.fk]
   * @param {string} [options.type]
   * @param {string} [options.as]
   * @param {Where | { [key: string]: any }} [options.on]
   * @returns {Finder}
   */
  join(modelQuery, options) {
    const joinModel = modelQuery(this._query);
    options = Object.assign({
      // 来源
      from: this._model[OPTIONS].name,
      // 外键
      fk: joinModel[OPTIONS].name + '_' + joinModel[OPTIONS].pk,
      // join 表的引用键，默认为主键
      ref: this._model[OPTIONS].pk,
      // join 模式
      type: 'INNER',
      // 输出别名，默认 {this.name}， 可以使用 -> 命名空间
      as: joinModel[OPTIONS].name,
      // join 结果为列表
      asList: false,
    }, options);
    if (this._join[options.as]) {
      throw new Error(`duplicate as: ${options.as}`);
    }
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
      if (this._where) builder.where(this._where);
      if (this._order) builder.order(...this._order);
      if (_one) builder.one();
      else if (this._limit) builder.limit(...this._limit);
    });
    if (!resutl || resutl.length === 0) return resutl;
    if (_one) return this._model._createInstance(resutl);
    /** @type {Instance} */
    let instance;
    /** @type {Map<any, Instance>} */
    let instanceMap;
    if (isOne) {
      instance = this._model._createInstance(resutl[0][this._model[OPTIONS].name]);
    } else {
      instanceMap = new Map();
    }
    // 处理列表结果
    resutl.forEach(row => {
      // 无 join
      if (_join.length === 0) {
        const pkval = row[this._model[OPTIONS].pk];
        instanceMap.set(pkval, this._model._createInstance(row));
        return;
      }
      // 有 join
      if (!isOne) {
        // 多条结果 join 结果组合
        const thisData = row[this._model[OPTIONS].name];
        const pkval = thisData[this._model[OPTIONS].pk];
        if (!instanceMap.has(pkval)) {
          instanceMap.set(pkval, this._model._createInstance(thisData));
        }
        instance = instanceMap.get(pkval);
      }
      _join.forEach(([model, options]) => {
        if (row[options.as]) {
          const joinInstance = model._createInstance(row[options.as]);
          if (options.asList) {
            propertyAt(instance, options._asPath, []).push(joinInstance);
          } else {
            propertyAt(instance, options._asPath, joinInstance);
          }
        }
      });
    });
    return isOne ? instance : Array.from(instanceMap.values());
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
      if (this._where) builder.where(this._where);
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
      if (this._where) builder.where(this._where);
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
      if (this._where) builder.where(this._where);
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
      if (this._where) builder.where(this._where);
      if (this._order) builder.order(...this._order);
      if (this._limit) builder.limit(...this._limit);
    });
    return result.affectedRows;
  }
}

module.exports = Finder;
