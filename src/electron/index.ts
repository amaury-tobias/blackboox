import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { app, ipcMain, BrowserWindow, type BrowserWindowConstructorOptions, type WebPreferences } from 'electron'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)


// function called on runtime
function initializeServices(services: Record<any, any>) {
  ipcMain.handle('service:call', (_event, name, method, ...args) => {
    const service = services[name]
    if (!service) throw new Error('Cannot find service named' + name.toString())
    if (!(method in service)) throw new Error('Cannot find method named ' + method + ' in service' + name.toString())
    return service[method](...args)
  })
  return () => ipcMain.removeHandler('service:call')
}

const urlProxy = new Proxy<Record<string, URL>>(
  {},
  {
    get(_, page) {
      return import.meta.env.DEV
        ? new URL(`http://localhost:4000/#/${page.toString()}`)
        : new URL(
          join(
            new URL(import.meta.url).toString(),
            `../../ui/index.html#/${page.toString()}`
          )
        )
    },
  }
)

export function createElectronApp() {
  const gotTheLock = app.requestSingleInstanceLock()
  if (!gotTheLock) app.quit()

  //{{ initializeServices }}

  return {
    app,
    whenReady: () => app.whenReady(),
  }
}

const application_windows = new Map<number, BrowserWindow>()

export function useApplicationUrl(page: string) {
  return urlProxy[page]
}

type BBWebPreferences = Omit<WebPreferences, 'preload' | 'contextIsolation'>
type BBBrowserWindowConstructorOptions = {
  webPreferences?: BBWebPreferences
} & Omit<BrowserWindowConstructorOptions, 'show' | 'webPreferences'>

export function createElectronWindow(url: URL, options?: BBBrowserWindowConstructorOptions): BrowserWindow {
  const window = new BrowserWindow({
    height: 600,
    width: 800,
    ...options,
    webPreferences: {
      devTools: !!import.meta.env.DEV,
      contextIsolation: true,
      preload: join(__dirname, '../preload.cjs'),
      ...options?.webPreferences,
    },
  })

  window.on('close', () => application_windows.delete(window.id))
  application_windows.set(window.id, window)
  window.loadURL(url.href)
  return window
}

type ServiceObject<T> = Record<string, (...params: any) => Promise<T>>
type ServiceFunction<T> = () => ServiceObject<T>
type ServiceDeclaration<T> = ServiceObject<T> | ServiceFunction<T>
type ExtractServiceObject<T> = T extends ServiceFunction<unknown> ? ReturnType<T> : T

export function defineService<T extends ServiceDeclaration<unknown>, K extends ExtractServiceObject<T>>(
  service: T
): () => K {
  let instance: K | undefined

  return (function (): () => K {
    if (!instance) {
      if (typeof service === 'function') instance = service() as K
      else instance = service as unknown as K

      return () => instance as K
    } else {
      return () => instance as K
    }
  })()
}
