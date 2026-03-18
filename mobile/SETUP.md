# Mobile App Setup

The mobile app lives in `mobile/`. It is an Expo SDK 55 app that uses Expo Router on the client side and talks to the same backend the web app uses: Cloudflare Workers for the API and frontend runtime, R2 for files, Queues for async jobs, and Supabase for auth and database state. The current deployed frontend Worker is `https://utter.duncanb013.workers.dev`, and the current deployed API Worker root is `https://utter-api-staging.duncanb013.workers.dev`.

At the moment, the mobile app is good enough for real feature work. You can sign in, browse voices, preview reference audio, generate speech, design voices, clone voices, browse history, and use the task center. Push notifications are still deferred.

The important thing to understand if you have only used Expo Go before is that the recommended workflow has changed. Expo Go is still fine for quick checks, but the normal way to test this app now is with a development build. That means you build and install your own Utter app shell once, and then you point that installed app at Metro while you work. Expo Go skips that first step, but it is less representative of the real app runtime.

That first native build can be slow on a fresh machine. Gradle, Android dependencies, and caches all need to settle the first time. That is normal. It should not be your everyday loop. Once the app is installed on the emulator or device, the normal loop is just Metro plus reopening the installed Utter app. You only need another native rebuild when you change native dependencies, config plugins, package identifiers, permissions, or other app config that affects the native shell.

If you are starting from zero, first install dependencies in `mobile/`:

```bash
cd mobile
npm install --legacy-peer-deps
```

Then copy the env file:

```bash
cp .env.example .env
```

The mobile app only needs three public env values: the Supabase URL, the Supabase anon key, and the API origin. The API origin must be the root origin only, without `/api` at the end. If you want the fastest path just to see the app working, keep the deployed staging Worker origin in `.env`. If you want the app to hit your local backend, change `EXPO_PUBLIC_API_BASE_URL` based on where you are running the app: Android emulator should use `http://10.0.2.2:8787`, iOS simulator should use `http://127.0.0.1:8787`, and a physical device should use `http://<YOUR_LAN_IP>:8787`.

If your goal is local Android emulator development on this Windows machine, the simplest starting command is:

```bash
npm run android
```

That command does the local native Android build, installs the app on the emulator, and starts Metro. Use it the first time, and again whenever native config changes.

Once the development build is installed on your emulator or device, your normal daily loop is just:

```bash
npm run dev:client
```

Then open the installed Utter dev build and connect it to Metro. That is the mobile equivalent of opening your local web frontend in the browser.

For Android emulator specifically, the easiest mental model is this:

```bash
# first time, or after native changes
npm run android

# normal daily loop after the app is already installed
npm run dev:client
```

If `npm run android` ever asks to rebuild after you only changed JavaScript or TypeScript, that usually means you used the wrong command out of habit. Use `npm run dev:client` for normal app work and keep `npm run android` for native-shell moments.

If you want a cloud-built dev client instead of a local emulator install, log in to Expo/EAS first:

```bash
npx eas-cli login
```

Then use one of these:

```bash
npm run build:dev:android
npm run build:dev:ios-simulator
npm run build:dev:ios
```

That EAS path is optional. It is useful for physical devices and shared builds, but it is not required for normal emulator development on your laptop.

If you want to test against local backend services instead of the deployed staging Worker, you usually need three terminals. In terminal 1, from the repo root, start Supabase:

```bash
supabase start
```

In terminal 2, from the repo root, start the API Worker:

```bash
npm --prefix workers/api install
cp workers/api/.dev.vars.example workers/api/.dev.vars
npm --prefix workers/api run dev
```

In terminal 3, from `mobile/`, start Metro for the dev build:

```bash
npm run dev:client
```

At that point you should be able to open the app and sign in with the same account you use on web, list voices, generate audio, design voices, clone voices, and browse history and tasks. Push notifications are intentionally deferred for now, so do not expect that part of the app to exist yet.

The most useful verification commands are:

```bash
npx expo-doctor
npx expo install --check
npx tsc --noEmit
```

If something fails in a way that looks like Metro caching or package drift, clear Metro and try again:

```bash
npx expo start --clear
```

If API calls fail, the first thing to check is the API origin in `.env`. A wrong origin is the most common local setup issue. If audio playback fails, test it in the installed dev build before assuming the backend is broken, because Expo Go is not the preferred runtime anymore. If you are on Android emulator and the app cannot reach your local Worker, make sure you are using `10.0.2.2` rather than `localhost`.
