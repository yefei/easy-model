import { Model } from './model';
import { Repository } from './repository';
import { ModelClass, Query } from './types';

/**
 * 创建一个仓库查询对象
 */
export function createRepositoryQuery<T extends Model>(modelClass: ModelClass<T>) {
  return (query: Query) => new Repository(modelClass, query);
}
