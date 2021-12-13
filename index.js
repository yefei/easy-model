import Model from './lib/model.js';
export { default as Model } from './lib/model.js';
export { generate } from './lib/generate.js';

/**
 * 创建一个模型对象
 * @param {string} name 模型名称，默认表名
 * @param {*} options 模型设置项
 */
export function model(name, options) {
  options = Object.assign({
    pk: 'id',
    name,
    table: name,
  }, options);
  return query => new Model(options, query);
}
