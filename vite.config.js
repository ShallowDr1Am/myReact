import { defineConfig } from "vite";
import react from '@vitejs/plugin-react';
import path from 'path';
export default defineConfig({
  resolve: {
    alias: {
      react: path.posix.resolve("src/react"),
      "react-dom": path.posix.resolve("src/react-dom"),
      "react-reconciler": path.posix.resolve("src/react-reconciler"),
      scheduler: path.posix.resolve("src/scheduler"),
      shared: path.posix.resolve("src/shared"),
      "react-dom-bindings": path.posix.resolve("src/react-dom-bindings")
    }
  },
  plugins: [
    react()
  ],
  define: {
    __DEV__: true, // 设置为false跳过 if(__dev__)的开发逻辑
    __EXPERIMENTAL__: true,
    __PROFILE__: true,
  },
})
//window和linux路径分割符不一样 window ;   linux :
//利用path.posix都转换成path.posix