'use strict';

const { Query, PoolQuery, PoolClusterQuery, Where, Raw, raw, Op } = require('mysql-easy-query');
const Model = require('./lib/model');

/**
 * 创建一个模型对象
 * @param {string} name 模型名称，默认表名
 * @param {*} options 模型设置项
 */
function model(name, options) {
  options = Object.assign({
    pk: 'id',
    name,
    table: name,
  }, options);
  return query => new Model(options, query);
}

module.exports = {
  model,
  Query,
  PoolQuery,
  PoolClusterQuery,
  Where,
  Raw,
  raw,
  Op,
};
