module.exports = {
  apps: [
    {
      name: 'trip-backend',
      script: 'apps/trip-backend/dist/main.js',
      args: 'nx serve trip-backend',
      cwd: '/home/logan/tripplanner',
      env_staging: {
        NODE_ENV: 'staging',
        PORT: 3000,
        DATABASE_URL: process.env.DATABASE_URL,
        SUPABASE_URL: process.env.SUPABASE_URL,
        SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
        REDIS_URL: process.env.REDIS_URL,
      },
    },
  ],
};
