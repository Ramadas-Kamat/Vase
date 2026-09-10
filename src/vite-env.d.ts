/// <reference types="vite/client" />

// Declared so the branding variables are typed as strings rather than `any`.
// Both are optional: a build with no `.env` and no overrides still compiles,
// and `appConfig.ts` falls back to the built-in defaults.
interface ImportMetaEnv {
  readonly VITE_APP_NAME?: string;
  readonly VITE_APP_DESCRIPTION?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
