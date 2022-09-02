import { EOL } from 'node:os'
import { dirname, resolve } from 'node:path'
import { promises as fsp } from 'node:fs'
import { ChildProcessWithoutNullStreams, spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

import { createUnplugin } from 'unplugin'
import { createUnimport, getMagicString, scanDirExports } from 'unimport'
import { createFilter } from 'vite'
import { red, green, bgGreen, yellow, gray, white } from 'colorette'

import { Blackboox } from '../../types'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// autoimport `createElectronApp` `useApplicationUrl` `createElectronWindow`
export const electronMainPlugin = createUnplugin<Blackboox>((options = {}) => {
  const ctx = createUnimport({})
  const dirs = [resolve(options.rootDir!, options.buildDir!, 'dev', 'electron')]
  const filter = createFilter(
    [/\.[jt]sx?$/, /\.vue$/, /\.vue\?vue/, /\.svelte$/],
    [/[\\/]node_modules[\\/]/, /[\\/]\.git[\\/]/]
  )

  return {
    name: 'blackboox:electron:main',
    enforce: 'post',
    transformInclude(id) {
      return filter(id)
    },
    async transform(code, id) {
      const s = getMagicString(code)
      await ctx.injectImports(s, id)
      if (!s.hasChanged()) return

      return {
        code: s.toString(),
        map: s.generateMap(),
      }
    },
    async buildStart() {
      await ctx.modifyDynamicImports(async imports => {
        imports.push(...(await scanDirExports(dirs)))
      })

      return fsp.writeFile(
        resolve(options.buildDir!, 'types/electron.d.ts'),
        '// Generated by blackboox' + '\n' + ctx.generateTypeDeclarations(),
        'utf-8'
      )
    },
  }
})

export const startElectronPlugin = createUnplugin<Blackboox>((options = {}) => {
  let electronProcess: ChildProcessWithoutNullStreams | null = null
  const electronLogger = (message: string) => {
    const colorize = (line: string) => {
      if (line.startsWith('[INFO]')) return green('[INFO]') + line.substring(6)
      else if (line.startsWith('[WARN]')) return yellow('[WARN]') + line.substring(6)
      else if (line.startsWith('[ERROR]')) return red('[ERROR]') + line.substring(7)
      return gray(line)
    }
    console.log(
      message
        .toString()
        .split(EOL)
        .filter(s => s.trim() !== '')
        .map(colorize)
        .join(EOL)
    )
  }

  return {
    name: 'blackboox:electron',
    enforce: 'post',
    buildEnd() {
      console.log(bgGreen(white('[ELECTRON] ')), 'build')
      if (electronProcess) {
        console.log(bgGreen(white('[ELECTRON] ')), 'restart')
        electronProcess.kill()
        electronProcess = null
      }
      electronProcess = spawn('electron', [
        '--inspect=5858',
        '--remote-debugging-port=9222',
        '--dev',
        resolve(options.rootDir!, '.'),
      ])

      electronProcess.stdout.on('data', electronLogger)
      electronProcess.stderr.on('data', electronLogger)
    },
  }
})

// autoimport application services + generate clietn proxy services
export const servicesElectronPlugin = createUnplugin<Blackboox>((options = {}) => {
  const ctx = createUnimport({})
  const dirs = ['app/services']
  const filter = createFilter(
    [/\.[jt]sx?$/, /\.vue$/, /\.vue\?vue/, /\.svelte$/],
    [/[\\/]node_modules[\\/]/, /[\\/]\.git[\\/]/]
  )

  return {
    name: 'unimport:services:electron',
    enforce: 'post',
    transformInclude(id) {
      return filter(id)
    },
    async transform(code, id) {
      const s = getMagicString(code)
      await ctx.injectImports(s, id)
      if (!s.hasChanged()) return

      return {
        code: s.toString(),
        map: s.generateMap(),
      }
    },
    async buildStart() {
      await ctx.modifyDynamicImports(async imports => {
        imports.push(...(await scanDirExports(dirs)))
      })
      const imports = ctx.getImports()

      const useServiceContent = `// Generated by blackboox
const { ipcRenderer } = window.__electron__blackboox__
const ipcRendererProxy = new Proxy(
  {},
  {
    get(_, method) {
      return (...args) => ipcRenderer[method](...args)
    },
  }
)
function createProxy(service) {
  return new Proxy(
    {},
    {
      get(_, functionName) {
        return (...args) =>
          ipcRendererProxy.callService(
            service,
            functionName.toString(),
            ...args
          )
      },
    }
  )
}
const servicesProxy = new Proxy(
  {},
  {
    get(_, serviceName) {
      return createProxy(serviceName.toString())
    },
  }
)
function useService(name) {
  return servicesProxy[name]
}
`
      const useServices = imports.map(i => `export const ${i.name} = () => useService("${i.name}");`).join('\n')
      await fsp.writeFile(
        resolve(options.buildDir!, 'dev', 'client', 'useService.mjs'),
        useServiceContent + '\n' + useServices,
        'utf-8'
      )

      const electronContent = await fsp.readFile(resolve(__dirname, '..', '..', 'src', 'electron', 'index.ts'), 'utf-8')
      const initServicesContent = `import { ipcMain } from 'electron'
function initializeServices(services) {
  ipcMain.handle('service:call', (_event, name, method, ...args) => {
    const service = services[name]
    if (!service) throw new Error('Cannot find service named' + name.toString())
    if (!(method in service)) throw new Error('Cannot find method named ' + method + ' in service' + name.toString())
    return service[method](...args)
  })
  return () => ipcMain.removeHandler('service:call')
}
`

      const initServicesObject = imports.map(i => `${i.name}: ${i.name}()`).join(',')
      const setupServices = `export const setupServices = () => initializeServices({${initServicesObject}})`

      await fsp.writeFile(
        resolve(options.buildDir!, 'dev', 'electron', 'index.ts'),
        `// Generated by blackboox\n${electronContent}\n${initServicesContent}\n${setupServices}`,
        'utf-8'
      )

      return fsp.writeFile(
        resolve(options.buildDir!, 'types/services.d.ts'),
        '// Generated by blackboox' + '\n' + ctx.generateTypeDeclarations(),
        'utf-8'
      )
    },
  }
})
