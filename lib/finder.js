'use strict';
/**
 * @typedef { import('mysql-easy-query').Builder } Builder
 * @typedef { import('mysql-easy-query').Where } Where
 * @typedef { import('mysql-easy-query').Query } Query
 * @typedef { import('./model').Model } Model
 * @typedef { import('..').Instance } Instance
 */
const { QUERY, OPTIONS } = require('./symbols');

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
   * @param {string} [options.fk]
   * @param {string} [options.type]
   * @param {string} [options.as]
   * @param {Where | { [key: string]: any }} [options.on]
   * @returns {Finder}
   */
  join(modelQuery, options) {
    const model = modelQuery(this._query);
    options = Object.assign({
      // 外键
      fk: this._model[OPTIONS].name + '_id',
      // join 模式
      type: 'INNER',
      // 别名
      as: model[OPTIONS].name,
    }, options);
    if (this._join[options.as]) {
      throw new Error(`duplicate as: ${options.as}`);
    }
    this._join[options.as] = [model, options];
    return this;
  }

  /**
   * @param {Builder} builder 
   */
  _joinPrep(builder) {
    Object.values(this._join).forEach(([model, options]) => {
      if (!options.on) {
        options.on = {
          [`${options.as}.${options.fk}`]:
            builder.quote(`${this._model[OPTIONS].name}.${this._model[OPTIONS].pk}`),
        };
      }
      builder.join(
        model[OPTIONS].table,
        // 如果和表名一致则没有必要 as
        options.as === model[OPTIONS].table ? null : options.as,
        options.on,
        options.type
      );
      builder.nestTables();
    });
  }

  /**
   * 数据结果处理
   */
  _createInstance(result) {
    const _join = Object.values(this._join);
    if (_join.length) {
      // 先处理主表结果
      const thisName = this._model[OPTIONS].name;
      const out = {
        [thisName]: this._model._createInstance(result[thisName]),
      };
      // 再处理 join 表结果
      _join.forEach(([model, options]) => {
        if (result[options.as]) {
          out[options.as] = model._createInstance(result[options.as]);
        }
      });
      return out;
    }
    return this._model._createInstance(result);
  }

  /**
   * 取得数据列表
   * @returns {Promise<Instance[]>}
   */
  async all() {
    const results = await this._query.query(builder => {
      builder.select();
      builder.from(this._model._table);
      this._joinPrep(builder);
      if (this._where) builder.where(this._where);
      if (this._order) builder.order(...this._order);
      if (this._limit) builder.limit(...this._limit);
    });
    return results.map(i => this._createInstance(i));
  }

  /**
   * 取得一条数据
   * @returns {Promise<Instance | null>}
   */
  async get() {
    const result = await this._query.query(builder => {
      builder.select();
      builder.from(this._model._table);
      this._joinPrep(builder);
      if (this._where) builder.where(this._where);
      if (this._order) builder.order(...this._order);
      builder.one();
    });
    return (result && this._createInstance(result)) || null;
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
   * @param {{ [key: string]: any }} 需要更新的字段值
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
