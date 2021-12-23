import { Model } from './model';
export { Model } from './model';
export { generate } from './generate';
import { ModelOption, ModelQuery, Query } from './types';
export { Instance } from './instance';

/**
 * 创建一个模型对象
 * @param name 模型名，默认表名，关联关系中不可重复
 * @param option 模型设置项
 */
export function model(name: string, option?: ModelOption): ModelQuery {
  const defaultOption: ModelOption = {
    pk: 'id',
    name,
    table: name,
  };
  option = Object.assign(defaultOption, option);
  return (query: Query) => new Model(option, query);
}
