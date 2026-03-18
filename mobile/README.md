# Utter Mobile

This is the Expo React Native mobile app for Utter. It talks to the same Supabase project and Cloudflare Workers API that the web app uses.

The Android and iOS workflow is not meant to rebuild the whole app every time. The slower native build is mainly a first-time setup step, or something you repeat only when native dependencies or app config change. Most normal UI and API work is just Metro plus reopening the installed Utter app.

Today this app can sign in with the same account as web, browse voices, preview voices, generate audio, clone voices, design voices, browse history, and track long-running tasks. Push notifications are intentionally not built yet.

If you are new to the mobile app, start here:

1. Install dependencies:

```bash
cd mobile
npm install --legacy-peer-deps
```

2. Copy the environment file:

```bash
cp .env.example .env
```

3. Decide what backend you want to test against.

If you just want to see the app working quickly, point `EXPO_PUBLIC_API_BASE_URL` in `.env` at the deployed staging Worker. That is already the default in this worktree.

If you want to test against your local backend, set `EXPO_PUBLIC_API_BASE_URL` like this:

- Android emulator: `http://10.0.2.2:8787`
- iOS simulator: `http://127.0.0.1:8787`
- Physical device: `http://<YOUR_LAN_IP>:8787`

4. For local Android emulator work, start with:

```bash
npm run android
```

This does the first native build, installs the app on the emulator, and starts Metro. It is the command you want when you come back later and need to get the emulator working again.

5. After the app is already installed on the emulator, your normal loop is:

```bash
npm run dev:client
```

Then reopen the Utter app in the emulator. You do not need another full Android rebuild for ordinary JavaScript, styling, routing, or API changes.

6. If you want to use EAS development builds for a physical device or shared build, log in first:

```bash
npx eas-cli login
```

Then use one of these:

```bash
npm run build:dev:android
npm run build:dev:ios-simulator
npm run build:dev:ios
```

That path is useful for cloud-built dev clients. It is not the normal command loop for local Android emulator work on your laptop.

If you want the mobile app to hit your local backend, you usually need three terminals:

Terminal 1, from the repo root:

```bash
supabase start
```

Terminal 2, from the repo root:

```bash
npm --prefix workers/api install
cp workers/api/.dev.vars.example workers/api/.dev.vars
npm --prefix workers/api run dev
```

Terminal 3, from `mobile/`:

```bash
npm run dev:client
```

That is enough to sign in, clone, generate, design, view history, and use the same API surface as the web app.

For the fuller setup and troubleshooting notes, read [SETUP.md](C:/Users/Duncan/Desktop/utter-mobile/mobile/SETUP.md).
