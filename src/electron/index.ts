import { join } from 'path'
import { pathToFileURL, fileURLToPath } from 'url'
import { app, ipcMain, BrowserWindow, type BrowserWindowConstructorOptions, type WebPreferences } from 'electron'

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

global.__windowUrls = new Proxy(
  {},
  {
    get(_, page) {
      return import.meta.env.DEV
        ? new URL(`http://localhost:${4000}/${page.toString()}`)
        : pathToFileURL(join(__dirname, `../ui/${page.toString()}.html`))
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

export function useApplicationUrl(page: string): URL {
  return __windowUrls[page]
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
      preload: new URL('../preload.cjs', import.meta.url).pathname,
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
