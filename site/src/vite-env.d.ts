/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly A_API_KEY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
