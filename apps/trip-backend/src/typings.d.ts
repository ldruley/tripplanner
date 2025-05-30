declare var process: {
  env: {
    [key: string]: string | undefined;
    NX_PUBLIC_SUPABASE_URL?: string;
    NX_PUBLIC_SUPABASE_ANON_KEY?: string;
    NX_PUBLIC_BACKEND_API_URL?: string;
  };
};
