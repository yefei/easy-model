'use strict';
/**
 * @typedef { import('mysql-easy-query').Builder } Builder
 * @typedef { import('mysql-easy-query').Where } Where
 * @typedef { import('mysql-easy-query').Query } Query
 * @typedef { import('./model').Model } Model
 * @typedef { import('..').Instance } Instance
 */
const { QUERY } = require('./symbols');

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
  }

  /**
   * @param {Builder} builder
   * @private
   */
  _fromWhere(builder) {
    builder.from(this._model._table);
    if (this._where) {
      builder.where(this._where);
    }
  }

  /**
   * @param {Builder} builder
   * @private
   */
  _whereLimit(builder) {
    if (this._where) {
      builder.where(this._where);
    }
    if (this._limit) {
      builder.limit(...this._limit);
    }
  }

  /**
   * 限制条数
   * @param {number} count
   * @param {number} [offset]
   */
  limit(count, offset = 0) {
    this._limit = [count, offset];
  }

  /**
   * 取得数据列表
   * @returns {Promise<Instance[]>}
   */
  async all() {
    const results = await this._query.query(builder => {
      builder.select();
      this._fromWhere(builder);
      if (this._limit) {
        builder.limit(...this._limit);
      }
    });
    return results.map(i => this._model._createInstance(i));
  }

  /**
   * 取得一条数据
   * @returns {Promise<Instance | null>}
   */
  async get() {
    const result = await this._query.query(builder => {
      builder.select();
      this._fromWhere(builder);
      builder.one();
    });
    return (result && this._model._createInstance(result)) || null;
  }

  /**
   * 查询条数
   * @returns {Promise<number>}
   */
  count() {
    return this._query.count(this._model._table, this._where);
  }

  /**
   * 查询数据是否存在
   * @returns {Promise<boolean>}
   */
  async exists() {
    const result = await this._query.query(builder => {
      builder.select(builder.raw(1));
      this._fromWhere(builder);
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
      this._whereLimit(builder);
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
      this._whereLimit(builder);
    });
    return result.affectedRows;
  }
}

module.exports = Finder;
