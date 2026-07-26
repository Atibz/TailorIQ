# TailorIQ

TailorIQ is a measurement workspace for tailors and clients. The project currently contains the web app, the measurement backend, and the Expo mobile app in one repository so the product can grow from one source of truth.

## Project Structure

```text
TailorIQ/
  src/              Web app source for the Vite/React app
  backend/          Node measurement service used for photo analysis
  mobile/           Expo React Native app
  public/           Web static assets
  package.json      Root scripts for web, backend, and mobile workflows
```

The web app remains at the root because Netlify and Vite are already configured around that structure. The mobile app lives in `mobile/`, with its own `package.json`, dependencies, and Expo config.

## Environment Files

Create local environment files from the examples:

```text
.env.local
backend/.env
mobile/.env
```

Web app variables:

```text
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-supabase-anon-public-key
VITE_SEGMENTATION_API_URL=http://localhost:5050/measurements/segment
```

Mobile app variables:

```text
EXPO_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-supabase-anon-public-key
EXPO_PUBLIC_SEGMENTATION_API_URL=https://your-backend-url/measurements/segment
```

Backend variables:

```text
PORT=5050
```

Never commit real `.env` files.

## Common Commands

Run the web app:

```bash
npm run web:dev
```

Run the backend:

```bash
npm run backend:dev
```

Run the mobile app:

```bash
npm run mobile:start
```

Build the web app:

```bash
npm run web:build
```

Check the current web build and Expo config:

```bash
npm run check
```

## Deployment Notes

Netlify should build the web app from the repository root using:

```bash
npm install
npm run build
```

Render should run the backend using:

```bash
npm install
npm start
```

The mobile app should be opened from the `mobile/` folder through Expo during development.

## Future Shared Code

As the mobile app grows, reusable measurement constants, shorthand rules, validation helpers, and Supabase table helpers should move into a shared package or shared folder. For now, avoid a large migration until both web and mobile flows are stable.
