# Odyssey - AI-Powered Storytelling Platform

Have you ever wanted to be a wizard in the harry potter world?
Odyssey is a storytelling platform where the user is the fist character! Just jump into your favourite story :>

## Deployment

Frontend to odissea.app:

```
npm run deploy
```

Frontend to Expo:

```
npx expo start --tunnel
```

Backend to Cloudfare worker:

```
npx wrangler deploy
```

Database to Cloudfare D1 SQL:
```
npx wrangler d1 execute odissey-db --remote --file=./schema.sql
```

## Development Documentation

 - Gemini AI provider: https://ai.google.dev/gemini-api/docs/text-generation#apps-script
