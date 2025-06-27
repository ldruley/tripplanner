import { createHash } from 'crypto';

type Coordinate = { lat: number; lng: number };

type QueryValue =
  | string | number | boolean
  | null | undefined
  | Coordinate
  | Coordinate[]
  | (string | number | boolean)[];

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

const coordToString = ({ lat, lng }: Coordinate) => `${lat},${lng}`;

/** Decide how to serialise any QueryValue */
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

function stableHash(input: unknown): string {
  return createHash('sha256')
    .update(JSON.stringify(sortObjectKeys(input)))
    .digest('hex');
}

function normalizeInput(input: string, collapseWhitespace = true): string {
  let result = input.trim().toLowerCase();
  if (collapseWhitespace) {
    result = result.replace(/\s+/g, ' ');
  }
  return result;
}
