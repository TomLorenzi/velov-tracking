## Env params

```
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=
NEXT_PUBLIC_GOOGLE_MAP_ID=
VELOV_API_KEY=
CLICLOCITY_API_KEY=
DATABASE_URL=
DIRECT_URL=
CRON_SECRET=
DISCORD_WEBHOOK_URL=
``` 


## Getting Started

First, run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## To run the script :

```
docker build -t velov-tracking .
docker run -d --env-file .env velov-tracking
```
