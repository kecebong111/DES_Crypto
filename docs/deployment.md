# Deployment

The application can be hosted without a paid database:

- FastAPI runs on a Render Free web service.
- Next.js runs on the Vercel Hobby plan.

Deploy the API first because the Next.js project needs its public URL.

## 1. Deploy FastAPI on Render

1. Sign in to [Render](https://dashboard.render.com/).
2. Select **New**, then **Blueprint**.
3. Connect the `kecebong111/DES_Crypto` repository.
4. Render reads `render.yaml` and creates the `des-explorer-api` service.
5. Wait until the deployment is complete.
6. Open `https://<service-name>.onrender.com/health` and check that it returns:

```json
{"status":"ok","service":"crypto-api"}
```

Copy the service URL without a trailing path, for example:

```text
https://des-explorer-api.onrender.com
```

The free Render service stops after 15 minutes without traffic. Its first request after that can take about one minute while the service starts again. The Next.js API routes allow up to 90 seconds for an invocation.

## 2. Deploy Next.js on Vercel

1. Sign in to [Vercel](https://vercel.com/).
2. Select **Add New**, then **Project**.
3. Import the `kecebong111/DES_Crypto` repository.
4. Set **Root Directory** to `apps/web`.
5. Keep **Framework Preset** as `Next.js`.
6. Add these environment variables for Production, Preview, and Development:

| Name | Value |
| --- | --- |
| `CRYPTO_API_URL` | The Render service URL, without `/health` |
| `CRYPTO_API_TIMEOUT_MS` | `70000` |

7. Deploy the project.
8. Open `https://<vercel-project>.vercel.app/api/health` to verify that Vercel can reach Render.
9. Test encryption with plaintext `0123456789ABCDEF` and key `133457799BBCDFF1`. The expected ciphertext is `85E813540F0AB405`.

`CRYPTO_API_URL` is server-only. Do not rename it with a `NEXT_PUBLIC_` prefix.

## Automatic deployments

Both services deploy from the `main` branch. A push to `main` triggers a new deployment on Render and Vercel after each service has been connected to the repository.

## Free-tier limits

- Vercel Hobby is intended for personal, non-commercial projects and has monthly usage limits.
- Render Free provides 750 instance hours per workspace each month and sleeps after 15 minutes without traffic.
- A sleeping Render service can make the first DES request noticeably slower. The 70-second proxy timeout allows for this cold start.

Official documentation:

- [Vercel Hobby plan](https://vercel.com/docs/plans/hobby)
- [Render free services](https://render.com/docs/free)
- [Render FastAPI deployment](https://render.com/docs/deploy-fastapi)
