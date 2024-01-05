import { promises as fsp } from 'node:fs'
import { isAbsolute, join, relative, resolve } from 'node:path'

import defu from 'defu'
import { TSConfig } from 'pkg-types'

import { makeDir } from './fs'
import { electronMainPlugin, servicesElectronPlugin } from './plugins/electron'
import { autoImportClientPlugin, componentsPlugin } from './plugins/client'
import type { Blackboox } from '../types'

export async function generateTSConfig(blackboox: Blackboox) {
  const tsConfig: TSConfig = defu({}, {
    compilerOptions: {
      baseUrl: relative(blackboox.buildDir!, blackboox.rootDir!),
      jsx: 'preserve',
      target: 'ESNext',
      module: 'ESNext',
      moduleResolution: 'Node',
      skipLibCheck: true,
      strict: true,
      allowJs: true,
      noEmit: true,
      resolveJsonModule: true,
      allowSyntheticDefaultImports: true,
      isolatedModules: true,
      esModuleInterop: true,
      preserveSymlinks: true,
      types: ['node'],
      paths: {},
    },
    include: [
      './blackboox.d.ts',
      join(relative(blackboox.buildDir!, blackboox.rootDir!), '**/*'),
      ...(blackboox.srcDir !== blackboox.rootDir
        ? [join(relative(blackboox.buildDir!, blackboox.srcDir!), '**/*')]
        : []),
    ],
  } as TSConfig)

  const aliases: Record<string, string> = {
    '~~': blackboox.srcDir!,
    '@@': blackboox.srcDir!,
    '~': blackboox.srcDir!,
    '@': blackboox.srcDir!,
    '#app': 'app',
    '#build': blackboox.buildDir!,
  }

  for (const alias in aliases) {
    const relativePath: string = isAbsolute(aliases[alias])
      ? relative(blackboox.rootDir!, aliases[alias]) || '.'
      : aliases[alias]

    const stats = await fsp
      .stat(resolve(blackboox.rootDir!, blackboox.srcDir!, relativePath))
      .catch(() => null /* file does not exist */)
    if (stats?.isDirectory()) {
      tsConfig.compilerOptions!.paths[alias] = [relativePath]
      tsConfig.compilerOptions!.paths[`${alias}/*`] = [`${relativePath}/*`]
    } else {
      tsConfig.compilerOptions!.paths[alias] = [relativePath.replace(/(?<=\w)\.\w+$/g, '')] /* remove extension */
    }
  }

  return {
    tsConfigContent: '// Generated by blackboox' + '\n' + JSON.stringify(tsConfig, null, 2),
    tsConfigPath: resolve(blackboox.buildDir!, 'tsconfig.json'),
  }
}

export async function generateDeclaration(blackboox: Blackboox) {
  const references: Record<string, string>[] = [
    { types: 'vite/client' },
    { path: 'auto-imports.d.ts' },
    { path: 'components.d.ts' },
    { path: 'types/services.d.ts' },
    { path: 'types/electron.d.ts' },
  ]
  function renderAttrs(obj: Record<string, string>) {
    return Object.entries(obj)
      .map(e => renderAttr(e[0], e[1]))
      .join(' ')
  }
  function renderAttr(key: string, value: string) {
    return value ? `${key}="${value}"` : ''
  }

  const declaration = [...references.map(ref => `/// <reference ${renderAttrs(ref)} />`), '', 'export {}', ''].join(
    '\n'
  )

  return {
    declarationContent: '// Generated by blackboox' + '\n' + declaration,
    declarationPath: resolve(blackboox.buildDir!, 'blackboox.d.ts'),
  }
}

export async function generatePreload(blackboox: Blackboox) {
  const preloadContent = `// Generated by blackboox
const { contextBridge, ipcRenderer } = require('electron')
const __blackboox__ = {
  ipcRenderer: {
    callService: (service, functionName, ...args) =>
      ipcRenderer.invoke('service:call', service, functionName, ...args),
  },
}
contextBridge.exposeInMainWorld('__electron__blackboox__', __blackboox__)
  `
  return {
    preloadContent,
    preloadPath: resolve(blackboox.buildDir!, 'source/preload.cjs'),
  }
}

export async function generatePackageJSON(blackboox: Blackboox) {
  const packageLocation = resolve(blackboox.rootDir!, 'package.json')

  const original = JSON.parse(String(await fsp.readFile(packageLocation)))
  const result = {
    name: original.name,
    author: original.author,
    version: original.version,
    license: original.license,
    description: original.description,
    main: 'app/index.cjs',
    type: 'module',
    dependencies: Object.entries(original.dependencies ?? {})
      .filter(([name]) => blackboox.electron?.external!.includes(name))
      .reduce((object, entry) => ({ ...object, [entry[0]]: entry[1] }), {}),
  }
  const destination = resolve(blackboox.buildDir!, 'source', 'package.json')
  await fsp.writeFile(destination, JSON.stringify(result, null, '  '), 'utf-8')
}

export const writeTypes = async (blackboox: Blackboox) => {
  makeDir(resolve(blackboox.buildDir!, 'dev'))
  makeDir(resolve(blackboox.buildDir!, 'dev', 'client'))
  makeDir(resolve(blackboox.buildDir!, 'dev', 'electron'))
  makeDir(resolve(blackboox.buildDir!, 'source'))
  makeDir(resolve(blackboox.buildDir!, 'types'))

  const { tsConfigContent: tsConfig, tsConfigPath } = await generateTSConfig(blackboox)
  await fsp.writeFile(tsConfigPath, tsConfig, 'utf-8')

  const { preloadContent, preloadPath } = await generatePreload(blackboox)
  await fsp.writeFile(preloadPath, preloadContent, 'utf-8')

  // @ts-expect-error
  await servicesElectronPlugin.vite(blackboox).buildStart()
  // @ts-expect-error
  await electronMainPlugin.vite(blackboox).buildStart()
  // @ts-expect-error
  await autoImportClientPlugin.vite(blackboox).buildStart()
  // @ts-expect-error
  componentsPlugin(blackboox).configResolved({
    root: blackboox.srcDir!,
    plugins: [],
    build: {},
  })

  const { declarationContent, declarationPath } = await generateDeclaration(blackboox)
  await fsp.writeFile(declarationPath, declarationContent, 'utf-8')
}
