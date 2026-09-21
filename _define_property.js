/**
 * Polyfill for SWC runtime helper _define_property
 */
function _define_property(obj, key, value) {
  if (key in obj) {
    Object.defineProperty(obj, key, {
      value: value,
      enumerable: true,
      configurable: true,
      writable: true
    });
  } else {
    obj[key] = value;
  }
  return obj;
}

module.exports = _define_property;
module.exports.default = _define_property;
