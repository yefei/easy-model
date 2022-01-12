import "reflect-metadata";
import { snakeCase } from 'snake-case';
import { DataValue, DataResult, ModelClass, ManyOption, DefineJoinOption, JoinOption, ModelOption } from './types';

export const MODEL = Symbol('Model#model');
export const OPTION = Symbol('Model#option');
export const UPDATE = Symbol('Model#update');
export const PKVAL = Symbol('Model#pkValue');
export const DATA = Symbol('Model#data');
export const JOIN = Symbol('Model#join');
export const MANY = Symbol('Model#many');

export interface Model {
  /**
   * 主键原始值
   * 用于更新删除操作时防止主键被修改而更新错误的数据
   */
  [PKVAL]?: DataValue;

  /**
   * 将要被更新字段
   */
  [UPDATE]?: Set<string>;

  /**
   * 数据库返回的原始数据
   */
  [DATA]?: DataResult;

  /**
   * 数据字段
   */
  [colunm: string]: any;
}

/**
 * 设置模型配置项
 */
export function model(option?: ModelOption) {
  return function <T extends Model>(modelClass: ModelClass<T>) {
    Object.assign(getModelOption(modelClass), option);
  }
}

/**
 * 取得模型配置项，如果没有则创建并设置到模型上
 */
export function getModelOption<T extends Model>(modelClass: ModelClass<T>) {
  if (!modelClass[OPTION]) {
    const name = modelClass.name;
    modelClass[OPTION] = {
      pk: 'id',
      name,
      table: snakeCase(name),
    };
  }
  return modelClass[OPTION];
}

/**
 * 设置模型的预定义 join 关系
 */
export function join<T extends Model>(modelClass: ModelClass<T>, option?: DefineJoinOption<T>) {
  return function (target: Object, propertyKey: string | symbol) {
    if (typeof propertyKey === 'symbol') {
      throw new Error('join property cannot be symbol');
    }
    const reflectMetadataType = Reflect.getMetadata('design:type', target, propertyKey);
    const ove: JoinOption<T> = {
      [MODEL]: modelClass,
      as: propertyKey,
      asList: reflectMetadataType === Array,
    };
    Reflect.defineMetadata(JOIN, Object.assign({}, option, ove), target, propertyKey);
  }
}

/**
 * 取得模型的预定义 join 关系
 */
export function getModelJoinOption<T extends Model>(modelClass: ModelClass<T>, propertyKey: string) {
  return Reflect.getMetadata(JOIN, modelClass.prototype, propertyKey);
}

/**
 * 预定义 many 关系
 */
export function many<T extends Model>(modelClass: ModelClass<T>, option?: ManyOption<T>) {
  return function (target: Object, propertyKey: string | symbol) {
    if (typeof propertyKey === 'symbol') {
      throw new Error('many property cannot be symbol');
    }
    const ove: ManyOption<T> = {
      [MODEL]: modelClass,
      as: propertyKey,
    };
    Reflect.defineMetadata(MANY, Object.assign({}, option, ove), target, propertyKey);
  }
}

/**
 * 取得模型的预定义 many 关系
 */
export function getModelManyOption<T extends Model>(modelClass: ModelClass<T>, propertyKey: string) {
  return Reflect.getMetadata(MANY, modelClass.prototype, propertyKey);
}
