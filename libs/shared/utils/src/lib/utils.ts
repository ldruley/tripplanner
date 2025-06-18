export function buildUrl(
  baseUrl: string,
  endpoint?: string,
  queryParams?: Record<string, string | number | boolean | undefined | null>
): string {
  const trimmedBase = baseUrl.replace(/\/+$/, '');         // remove trailing slashes
  const trimmedEndpoint = endpoint?.replace(/^\/+/, '');   // remove leading slashes

  const fullUrl = trimmedEndpoint
    ? `${trimmedBase}/${trimmedEndpoint}`
    : trimmedBase;

  const url = new URL(fullUrl);

  if (queryParams) {
    for (const [key, value] of Object.entries(queryParams)) {
      if (value !== undefined && value !== null) {
        url.searchParams.set(key, value.toString());
      }
    }
  }

  return url.toString();
}
