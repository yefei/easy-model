import "reflect-metadata";
import { snakeCase } from 'snake-case';
import { DataValue, DataResult, ModelClass, ManyOption, DefineJoinOption, JoinOption, ModelOption, DefineManyOption } from './types';

export const MODEL = Symbol('Model#model');
export const OPTION = Symbol('Model#option');
export const UPDATE = Symbol('Model#update');
export const PKVAL = Symbol('Model#pkValue');
export const DATA = Symbol('Model#data');
export const JOIN = Symbol('Model#join');
export const MANY = Symbol('Model#many');
export const DATA_FIELDS = Symbol('Model#dataFields');

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
  [colunm: string | symbol | number]: any;
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
    modelClass[OPTION] = {
      pk: 'id',
      table: snakeCase(modelClass.name),
    };
  }
  return modelClass[OPTION];
}

/**
 * 定义方法为数据字段，可以像数据库字段一样输出到 JSON 序列化中。
 * 只能用于 get 方法上。
 * 在初始化实例时会覆盖原始属性，使用新的【数据描述符】替代。
 * 如果有定义对应的 set 方法也会被 Proxy 拦截并重新调用到原始 set 方法上。
 * tips: 如果模型上有定义其他非 @data 类型的 set 方法内使用 this 更新数据属性会丢失无法记录目标属性的更新状态
 */
export function data(target: Object, propertyKey: string, descriptor: PropertyDescriptor) {
  if (!descriptor.get) {
    throw new Error(`the ${target.constructor.name} data property [${propertyKey}] must be get method`);
  }
  descriptor.configurable = true;
  descriptor.enumerable = true;
  const fields: PropertyDescriptorMap = Reflect.getMetadata(DATA_FIELDS, target) || {};
  fields[propertyKey] = descriptor;
  Reflect.defineMetadata(DATA_FIELDS, fields, target);
}

/**
 * 取得数据字段列表
 */
export function getDataMethods<T extends Model>(modelClass: ModelClass<T>): PropertyDescriptorMap {
  return Reflect.getMetadata(DATA_FIELDS, modelClass.prototype);
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
    };
    if (reflectMetadataType === Array) {
      ove.type = 'OneToMany';
    }
    Reflect.defineMetadata(JOIN, Object.assign({}, option, ove), target, propertyKey);
  }
}

/**
 * 取得模型的预定义 join 关系
 */
export function getModelJoinOption<T extends Model>(modelClass: ModelClass<T>, propertyKey: string): DefineJoinOption<T> {
  return Reflect.getMetadata(JOIN, modelClass.prototype, propertyKey);
}

/**
 * 预定义 many 关系
 */
export function many<T extends Model>(modelClass: ModelClass<T>, option?: DefineManyOption<T>) {
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
export function getModelManyOption<T extends Model>(modelClass: ModelClass<T>, propertyKey: string): DefineManyOption<T> {
  return Reflect.getMetadata(MANY, modelClass.prototype, propertyKey);
}
