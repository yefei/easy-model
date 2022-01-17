import { ModelClass } from ".";
import { getDataMethods, getModelOption, Model, PKVAL, UPDATE } from "./model";
import { DataResult } from "./types";

const GENERATE_ID = Symbol('GenerateId');
let generateId = 1;

/**
 * 构造模型实例
 */
export function createInstance<T extends Model>(modelClass: ModelClass<T>, data?: DataResult): T {
  if (!data) return null;
  const option = getModelOption(modelClass);
  const ins = new modelClass(data);
  // 100000次性能对比: defineProperties[136ms] > for{defineProperty}[111.5ms] > assign[16ms]
  Object.assign(ins, { [GENERATE_ID]: generateId++, [PKVAL]: data[option.pk] }, data);

  // 数据方法字段
  const dataMethods = getDataMethods(modelClass);
  if (dataMethods) {
    for (const [key, descriptor] of Object.entries(dataMethods)) {
      // 覆盖原始属性
      Object.defineProperty(ins, key, {
        enumerable: true,
        writable: !!descriptor.set,
        value: ins[key],
      });
    }
  }

  // 1. 拦截 set 操作，以备 save 方法的差异更新特性
  // 2. 实现 dataMethods 的 set 方法调用
  const proxy = new Proxy(ins, {
    set(target, prop, value) {
      console.log('Proxy set:', prop, value);
      if (typeof prop === 'string') {
        if (dataMethods && prop in dataMethods) {
          if (!dataMethods[prop].set) return false;
          dataMethods[prop].set.call(proxy, value);
        }
        // 如果修改的是数据库值并且不是子实例对象
        else if (prop in data && !Reflect.has(target[prop], PKVAL)) {
          if (!target[UPDATE]) target[UPDATE] = new Set();
          target[UPDATE].add(prop);
        }
      }
      (<any> target)[prop] = value;
      console.log({target});
      return true;
    }
  });

  return proxy;
}
