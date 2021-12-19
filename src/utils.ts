/**
 * 给指定对象设置新的属性，如果属性结构不存在则创建
 * 
 * @param obj 需要处理的对象
 * @param path 对象属性
 * @param value 是否需要赋值，如果不指定则为取值
 */
export function propertyAt(obj: { [key: number | string | symbol]: any }, path: string[], value?: any) {
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
