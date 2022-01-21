/**
 * 给指定对象设置新的属性，如果属性结构不存在则创建
 * 
 * @param obj 需要处理的对象
 * @param path 对象属性
 * @param value 是否需要赋值，如果不指定则为取值
 */
export function propertyAt(obj: { [key: PropertyKey]: any }, path: (string | symbol)[], value?: any) {
  let ref = obj;
  for (const p of path.slice(0, -1)) {
    if (ref[p] === undefined) {
      ref = ref[p] = {};
    } else {
      ref = ref[p];
    }
  }
  const last = path[path.length - 1];
  if (value !== undefined) {
    ref[last] = value;
  }
  return ref[last];
}

/**
 * 简单对象复制
 * 只支持值为数组、数据对象、基本类型
 */
export function simpleCopy<T>(aObject: T): T {
  const isArray = Array.isArray(aObject);
  const isObject = !isArray && aObject && typeof aObject === 'object' && Object.getPrototypeOf(aObject) === null;
  if (isArray || isObject) {
    const bObject: any = isArray ? [] : {};
    for (const k in aObject) {
      const v = aObject[k];
      bObject[k] = (typeof v === 'object') ? simpleCopy(v) : v;
    }
    return bObject;
  }
  return aObject;
}
