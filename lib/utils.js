/**
 * @param {object} obj
 * @param {string[]} path
 * @param {*} [value]
 */
export function propertyAt(obj, path, value) {
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
