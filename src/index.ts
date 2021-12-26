import { Model, Repository } from './repository';
export { Model } from './repository';
export { generate } from './generate';
import { ModelClass, ModelOption, ModelQuery, Query } from './types';
export { Instance } from './model';

/**
 * 创建一个仓库查询对象
 * @param name 模型名，默认表名，关联关系中不可重复
 * @param option 模型设置项
 */
export function createRepositoryQuery<T extends Model>(modelClass: ModelClass<T>, option?: ModelOption): ModelQuery {
  const name = modelClass.name;
  const defaultOption: ModelOption = {
    pk: 'id',
    name,
    table: name,
  };
  option = Object.assign(defaultOption, option);
  return (query: Query) => new Repository(modelClass, option, query);
}
