import { builtinModules } from 'node:module'
import { resolve } from 'node:path'

import defu from 'defu'
import { loadConfig } from 'unconfig'
import { defineConfig } from 'vite'

import Vue from '@vitejs/plugin-vue'

import { electronMainPlugin, servicesElectronPlugin, startElectronPlugin } from './plugins/electron'
import { autoImportClientPlugin, componentsPlugin, servicesClientPlugin } from './plugins/client'

import type { Blackboox } from '../types'

export async function loadBlackbooxConfig() {
  const { config } = await loadConfig<Blackboox>({
    sources: [
      {
        files: ['blackboox.config'],
        async rewrite(config) {
          const resolvedConfig = await (typeof config === 'function' ? config({ mode: process.env.NODE_ENV }) : config)
          return resolvedConfig
        },
      },
    ],
  })
  return defu(config, {
    buildDir: '.blackboox',
    rootDir: '.',
    srcDir: '.',
  } as Blackboox)
}

export function loadRendererConfig(blackboox: Blackboox) {
  return defineConfig({
    base: '',
    clearScreen: false,
    resolve: {
      alias: {
        '~/': `${resolve(blackboox.rootDir!, blackboox.srcDir!)}/`,
        '~~/': `${resolve(blackboox.rootDir!, blackboox.srcDir!)}/`,
        '@/': `${resolve(blackboox.rootDir!, blackboox.srcDir!)}/`,
        '@@/': `${resolve(blackboox.rootDir!, blackboox.srcDir!)}/`,
      },
    },
    build: {
      emptyOutDir: true,
      target: 'chrome106',
      outDir: resolve(blackboox.rootDir!, blackboox.buildDir!, 'source/ui'),
    },
    optimizeDeps: { exclude: ['electron'] },
    plugins: [
      Vue(),
      componentsPlugin(blackboox),
      autoImportClientPlugin.vite(blackboox),
      servicesClientPlugin.vite(blackboox),
      ...(blackboox.client?.plugins ?? []),
    ],
    server: {
      port: 4000,
      strictPort: true,
    },
  })
}

export function loadElectronConfig({ mode, blackboox }: { mode: 'development' | 'production'; blackboox: Blackboox }) {
  return defineConfig({
    clearScreen: false,
    resolve: {
      alias: {
        '~/': `${resolve(blackboox.rootDir!, blackboox.srcDir!)}/`,
        '~~/': `${resolve(blackboox.rootDir!, blackboox.srcDir!)}/`,
        '@/': `${resolve(blackboox.rootDir!, blackboox.srcDir!)}/`,
        '@@/': `${resolve(blackboox.rootDir!, blackboox.srcDir!)}/`,
        '#app': `${resolve(blackboox.rootDir!, blackboox.srcDir!, 'app')}/`,
      },
    },
    build: {
      watch:
        mode === 'development'
          ? {
              exclude: '.blackboox/**',
            }
          : null,
      sourcemap: mode === 'development' ? 'inline' : false,
      minify: mode === 'development' ? false : 'esbuild',
      emptyOutDir: true,
      target: 'node16',
      outDir: resolve(blackboox.rootDir!, blackboox.buildDir!, 'source/app'),
      lib: {
        entry: 'index.ts',
        formats: ['cjs'],
      },
      rollupOptions: {
        output: { entryFileNames: '[name].cjs' },
        external: [...builtinModules, ...(blackboox.external ?? []), 'electron', 'electron-updater'],
      },
    },
    plugins: [
      electronMainPlugin.vite(blackboox),
      servicesElectronPlugin.vite(blackboox),
      ...(blackboox.electron?.plugins ?? []),
      ...[mode === 'development' ? startElectronPlugin.vite(blackboox) : null],
    ],
  })
}
