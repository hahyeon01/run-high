/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** 비우면 데모(기기 내 데이터) 모드, 값이 있으면 해당 API 서버 사용 ("/"는 같은 출처) */
  readonly VITE_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module '*.wasm?url' {
  const url: string;
  export default url;
}

declare module 'react-iconly/dist/Icons/*.mjs' {
  import type { ComponentType } from 'react';
  const Icon: ComponentType<{
    set?: 'bold' | 'bulk' | 'light' | 'broken' | 'two-tone' | 'curved';
    size?: number | string;
    primaryColor?: string;
    secondaryColor?: string;
    stroke?: 'light' | 'regular' | 'bold';
  }>;
  export default Icon;
}
