# Railway deployment

This repository is a monorepo. Deploy the backend and frontend as separate
Railway services, plus one PostgreSQL service.

## 1. Create services

1. Create a Railway project and add a **PostgreSQL** database. Keep its service
   name as `Postgres`, or adjust the variable references below to match its name.
2. Add a GitHub service for the backend with **Root Directory** set to `backend`.
3. Add a second GitHub service for the frontend with **Root Directory** set to
   `frontend`.

The repository already includes `backend/railway.toml`,
`frontend/railway.toml`, and Dockerfiles. Railway will use the Dockerfiles from
each service root.

## 2. Backend variables

Set these in the backend service's **Variables** tab:

```text
SPRING_PROFILES_ACTIVE=prod
DB_HOST=${{Postgres.PGHOST}}
DB_PORT=${{Postgres.PGPORT}}
DB_USER=${{Postgres.PGUSER}}
DB_PASSWORD=${{Postgres.PGPASSWORD}}
DB_NAME=${{Postgres.PGDATABASE}}
JWT_SECRET=<a new, long random secret>
JWT_EXPIRATION=86400
JWT_REFRESH_EXPIRATION=2592000
CORS_ORIGINS=https://<your-frontend-domain>
```

Do not set `PORT`; Railway supplies it automatically. Deploy the backend, then
create a public Railway domain for it. Its health check is `/api/docs`.

## 3. Frontend variables

After the backend has a public domain, set this on the frontend service:

```text
NEXT_PUBLIC_API_URL=https://<your-backend-domain>
```

`NEXT_PUBLIC_API_URL` is embedded while Next.js builds, so redeploy the
frontend after changing it. Create a public frontend domain, copy that exact
origin into the backend's `CORS_ORIGINS`, and redeploy the backend.

The frontend proxies normal `/api/v1/*` requests to the backend. The public
backend URL is also required for the browser SSE connection.

## 4. Verify

1. Open `https://<backend-domain>/api/docs` and confirm it returns successfully.
2. Open the frontend domain and log in.
3. In browser developer tools, confirm API requests and the SSE subscription
   succeed without a CORS error.

## Secrets

Never commit actual database passwords or JWT secrets. If any real value was
put into a tracked file or shared outside Railway, rotate the Postgres password
and replace `JWT_SECRET` in Railway before deploying.
