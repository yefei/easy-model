'use strict';
/**
 * @typedef { import('mysql-easy-query').Query } Query
 * @typedef { import('mysql-easy-query').Builder } Builder
 * @typedef { import('mysql-easy-query').Where } Where
 */
const { OPTIONS, UPDATE, MODEL, QUERY, PKVAL } = require('./symbols');
const Finder = require('./finder');

const Instance = {
  save() {
    return this[MODEL].save(this);
  },
  delete() {
    return this[MODEL].delete(this);
  },
};

class Model {
  /**
   * @param {*} options
   * @param {Query} query 
   */
  constructor(options, query) {
    this[OPTIONS] = options;
    this[QUERY] = query;
  }

  /**
   * @returns {string}
   */
  get _table() {
    return this[OPTIONS].table;
  }

  /**
   * 构造数据实例
   * @param {*} result
   * @private
   */
  _createInstance(result) {
    const properties = {
      [UPDATE]: {
        value: new Set(),
      },
      [PKVAL]: {
        value: result[this[OPTIONS].pk],
      },
      [MODEL]: {
        value: this,
      }
    };
    const origFields = new Set();
    for (const [key, value] of Object.entries(result)) {
      origFields.add(key);
      properties[key] = {
        value,
        enumerable: true,
        writable: true,
      };
    }
    const ins = Object.create(Instance, properties);
    return new Proxy(ins, {
      set(obj, prop, value) {
        if (origFields.has(prop)) {
          obj[UPDATE].add(prop);
        }
        obj[prop] = value;
        return true;
      }
    });
  }

  /**
   * 查找
   * @param {Where | { [key: string]: any }} where 
   */
  find(where) {
    return new Finder(this, where);
  }

  /**
   * 通过主键取得一条数据
   * @param {*} pk 
   */
  findByPk(pk) {
    return this.find({ [this[OPTIONS].pk]: pk }).get();
  }

  /**
   * 查询条数
   * @param {Where | { [key: string]: any }} where 
   */
  count(where) {
    return this.find(where).count();
  }

  /**
   * 通过条件查询数据是否存在
   * @param {Where | { [key: string]: any }} where 
   */
  exists(where) {
    return this.find(where).exists();
  }

  /**
   * 创建一条数据
   * @param {{ [key: string]: any }} columns 
   */
  async create(columns) {
    const r = await this[QUERY].query(builder => {
      builder.insert(this._table, columns);
    });
    return r.insertId;
  }

  /**
   * 创建一条数据并返回数据
   * @param {{ [key: string]: any }} columns
   */
  async createAndGet(columns) {
    const pk = await this.create(columns);
    return this.findByPk(pk);
  }

  /**
   * 保存实例数据
   * @param {Instance} instance
   * @returns {Promise<number>} 更新条数
   */
  async save(instance) {
    if (instance[PKVAL] === undefined) {
      throw new Error('Missing primary key value.');
    }
    /** @type {Set} */
    const updateSet = instance[UPDATE];
    if (updateSet.size === 0) return;
    const columns = {};
    updateSet.forEach(f => {
      columns[f] = instance[f];
    });
    const result = await this[QUERY].query(builder => {
      builder.update(this._table, columns);
      builder.where({ [this[OPTIONS].pk]: instance[PKVAL] });
    });
    return result.affectedRows;
  }

  /**
   * 删除实例数据
   * @param {Instance} instance
   * @returns {Promise<number>}  删除条数
   */
  async delete(instance) {
    if (instance[PKVAL] === undefined) {
      throw new Error('Missing primary key value.');
    }
    const result = await this[QUERY].query(builder => {
      builder.delete(this._table);
      builder.where({ [this[OPTIONS].pk]: instance[PKVAL] });
    });
    return result.affectedRows;
  }
}

module.exports = Model;
