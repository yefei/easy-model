import { Model } from './model';
export { Model } from './model';
export { generate } from './generate';
import { ModelOptions, ModelQuery, Query } from './types';

/**
 * 创建一个模型对象
 * @param name 模型名，默认表名，关联关系中不可重复
 * @param {*} options 模型设置项
 */
export function model(name: string, options?: ModelOptions): ModelQuery {
  options = Object.assign({
    pk: 'id',
    name,
    table: name,
  }, options);
  return (query: Query) => new Model(options, query);
}
