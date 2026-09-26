/**
 * Minimal schema validator.
 *
 * Model output is untrusted. Rather than pulling in a JSON-Schema library, this
 * defines the small subset the task contracts need, with coercion that is
 * explicit about what it dropped.
 *
 * A validator returns `{ok, value, errors}`. It never throws on bad input.
 */

export const t = {
  string: (opts = {}) => ({ kind: 'string', ...opts }),
  number: (opts = {}) => ({ kind: 'number', ...opts }),
  integer: (opts = {}) => ({ kind: 'integer', ...opts }),
  boolean: (opts = {}) => ({ kind: 'boolean', ...opts }),
  enumOf: (values, opts = {}) => ({ kind: 'enum', values, ...opts }),
  array: (item, opts = {}) => ({ kind: 'array', item, ...opts }),
  object: (shape, opts = {}) => ({ kind: 'object', shape, ...opts })
};

/**
 * @param {any} value
 * @param {object} schema
 * @param {string} [path]
 * @returns {{ok: boolean, value: any, errors: string[]}}
 */
export function validate(value, schema, path = '$') {
  const errors = [];
  const out = walk(value, schema, path, errors);
  return { ok: errors.length === 0, value: out, errors };
}

function walk(value, schema, path, errors) {
  if (value === undefined || value === null) {
    if (schema.default !== undefined) return clone(schema.default);
    if (schema.optional) return undefined;
    errors.push(`${path} is required`);
    return undefined;
  }

  switch (schema.kind) {
    case 'string': {
      if (typeof value !== 'string') { errors.push(`${path} must be a string`); return undefined; }
      let s = schema.trim === false ? value : value.trim();
      if (schema.maxLength && s.length > schema.maxLength) s = s.slice(0, schema.maxLength);
      if (schema.minLength && s.length < schema.minLength) {
        errors.push(`${path} must be at least ${schema.minLength} characters`);
        return undefined;
      }
      if (schema.pattern && !schema.pattern.test(s)) {
        errors.push(`${path} does not match the required format`);
        return undefined;
      }
      return s;
    }
    case 'number':
    case 'integer': {
      const n = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
      if (typeof n !== 'number' || !Number.isFinite(n)) { errors.push(`${path} must be a number`); return undefined; }
      if (schema.kind === 'integer' && !Number.isInteger(n)) { errors.push(`${path} must be an integer`); return undefined; }
      if (schema.min !== undefined && n < schema.min) { errors.push(`${path} must be at least ${schema.min}`); return undefined; }
      if (schema.max !== undefined && n > schema.max) { errors.push(`${path} must be at most ${schema.max}`); return undefined; }
      return n;
    }
    case 'boolean': {
      if (typeof value === 'boolean') return value;
      if (value === 'true') return true;
      if (value === 'false') return false;
      errors.push(`${path} must be a boolean`);
      return undefined;
    }
    case 'enum': {
      if (!schema.values.includes(value)) {
        errors.push(`${path} must be one of: ${schema.values.join(', ')}`);
        return undefined;
      }
      return value;
    }
    case 'array': {
      if (!Array.isArray(value)) { errors.push(`${path} must be an array`); return undefined; }
      const out = [];
      const limit = schema.maxItems ?? value.length;
      for (let i = 0; i < value.length && out.length < limit; i++) {
        const itemErrors = [];
        const item = walk(value[i], schema.item, `${path}[${i}]`, itemErrors);
        if (itemErrors.length) {
          // Drop unusable items rather than failing the whole response, unless
          // the schema says otherwise.
          if (schema.strictItems) errors.push(...itemErrors);
          continue;
        }
        out.push(item);
      }
      if (schema.minItems && out.length < schema.minItems) {
        errors.push(`${path} must contain at least ${schema.minItems} item(s)`);
        return undefined;
      }
      return out;
    }
    case 'object': {
      if (typeof value !== 'object' || Array.isArray(value)) {
        errors.push(`${path} must be an object`);
        return undefined;
      }
      const out = {};
      for (const [key, sub] of Object.entries(schema.shape)) {
        if (key === '__proto__' || key === 'constructor' || key === 'prototype') continue;
        const result = walk(value[key], sub, `${path}.${key}`, errors);
        if (result !== undefined) out[key] = result;
      }
      return out;
    }
    default:
      errors.push(`${path} has an unknown schema kind`);
      return undefined;
  }
}

function clone(value) {
  return typeof value === 'object' && value !== null ? structuredClone(value) : value;
}
