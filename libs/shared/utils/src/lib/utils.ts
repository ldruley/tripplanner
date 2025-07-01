import { createHash } from 'crypto';

type Coordinate = { lat: number; lng: number };

type QueryValue =
  | string | number | boolean
  | null | undefined
  | Coordinate
  | Coordinate[]
  | (string | number | boolean)[];

const coordToString = ({ lat, lng }: Coordinate) => `${lat},${lng}`;

/**
 * Builds a URL with optional endpoint and query parameters.
 * @param baseUrl
 * @param endpoint
 * @param queryParams
 */
export function buildUrl(
  baseUrl: string,
  endpoint?: string,
  queryParams?: Record<string, QueryValue>,
): string {
  const trimmedBase   = baseUrl.replace(/\/+$/, '');
  const trimmedEndp   = endpoint?.replace(/^\/+/, '');
  const fullUrl       = trimmedEndp ? `${trimmedBase}/${trimmedEndp}` : trimmedBase;
  const url           = new URL(fullUrl);

  if (queryParams) {
    for (const [key, value] of Object.entries(queryParams)) {
      encodeValue(key, value, url);
    }
  }
  return url.toString();
}

/**
 * Encodes a query parameter value into a URL's search parameters.
 * Handles various types of values including arrays, single coordinates,
 * and primitive types. Empty arrays are ignored.
 *
 * @param key - The query parameter key.
 * @param value - The value to encode (can be a string, number, boolean, null, undefined,
 *                single coordinate object, or an array of coordinates or primitives).
 * @param url - The URL object to which the search parameter will be added.
 */
function encodeValue(key: string, value: QueryValue, url: URL): void {
  if (value == null) return;

  // Array handling
  if (Array.isArray(value)) {
    if (!value.length) return; // ignore empty array

    // array of coordinates
    if (typeof value[0] === "object") {
      (value as Coordinate[]).forEach((c, i) =>
        url.searchParams.append(`${key}${i}`, coordToString(c)),
      );
    } else {
      // array of primitives ->  key=value&key=value2
      (value as (string | number | boolean)[]).forEach(v =>
        url.searchParams.append(key, v.toString()),
      );
    }
    return;
  }

  // Single coordinate object
  if (typeof value === "object") {
    url.searchParams.set(key, coordToString(value as Coordinate));
    return;
  }

  // Primitive
  url.searchParams.set(key, value.toString());
}

/**
 * Builds a cache key based on a namespace and an array of parts.
 * The parts are normalized and can be hashed for a stable representation.
 *
 * @param ns - The namespace for the cache key.
 * @param parts - An array of parts to include in the cache key.
 * @param useHash - Whether to use a hash of the parts for the cache key (default: false).
 * @returns A string representing the cache key.
 *
 * @example
 * // Without hashing
 * buildCacheKey('myNamespace', ['part1', { key: 'value' }, 123]);
 * // Returns: 'myNamespace:part1:{"key":"value"}:123'
 *
 * @example
 * // With hashing
 * buildCacheKey('myNamespace', ['part1', { key: 'value' }, 123], true);
 * // Returns: 'myNamespace:<hash>'
 */
export function buildCacheKey(ns: string, parts: unknown[], useHash = false): string {
  const normalizedParts = parts.map((part) => {
    if (typeof part === 'string') {
      return normalizeInput(part);
    }
    return part;
  });

  if (useHash) {
    const hash = stableHash(normalizedParts);
    return `${ns}:${hash}`;
  }

  const suffix = normalizedParts.map((part) => {
    if (part && typeof part === 'object') {
      return JSON.stringify(sortObjectKeys(part));
    }
    return String(part);
  }).join(':');

  return `${ns}:${suffix}`;
}

/**
 * Recursively sorts the keys of an object or array to ensure a stable representation.
 * This is useful for generating consistent hashes or comparisons of objects with
 * unordered properties.
 *
 * @param obj - The object or array to sort.
 * @returns A new object or array with sorted keys.
 */
function sortObjectKeys(obj: unknown): unknown {
  // Handle arrays
  if (Array.isArray(obj)) {
    return obj.map(sortObjectKeys);
  }

  // Handle objects
  if (obj && typeof obj === 'object') {
    return Object.keys(obj)
      .sort()
      .reduce((acc, key) => {
        acc[key] = sortObjectKeys((obj as Record<string, unknown>)[key]);
        return acc;
      }, {} as Record<string, unknown>);
  }

  // Return primitive values as is
  return obj;
}

/**
 * Generates a stable hash for an input object or value.
 * The hash is based on the JSON representation of the input with sorted keys,
 * ensuring that equivalent inputs always produce the same hash.
 *
 * @param input - The input to hash, can be any type (object, array, string, number, etc.).
 * @returns A SHA-256 hex string representing the hash of the input.
 */
function stableHash(input: unknown): string {
  return createHash('sha256')
    .update(JSON.stringify(sortObjectKeys(input)))
    .digest('hex');
}

/**
 * Normalizes a string input by trimming whitespace, converting to lowercase,
 * and optionally collapsing multiple whitespace into a single space.
 *
 * @param input - The string to normalize.
 * @param collapseWhitespace - Whether to collapse multiple whitespace into a single space (default: true).
 * @returns The normalized string.
 */
function normalizeInput(input: string, collapseWhitespace = true): string {
  let result = input.trim().toLowerCase();
  if (collapseWhitespace) {
    result = result.replace(/\s+/g, ' ');
  }
  return result;
}
