import { join } from 'path'
import { pathToFileURL } from 'url'
import { app, BrowserWindow } from 'electron'

type CreateAppOptions = {
  update?: {
    auto_download: boolean
    onUpdateAvailable: (info: any) => Promise<boolean>
    onUpdateDownloaded: (info: any) => Promise<boolean>
    onUpdateError: (error: Error) => void
  }
  protocol?: {
    scheme: string
    path: string
    args: string[]
    handle: (url: string) => void
  }
}

export function createElectronApp({ update, protocol }: CreateAppOptions) {
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

  const gotTheLock = app.requestSingleInstanceLock()
  !gotTheLock && app.quit()

  if (protocol) {
    app.on('second-instance', (_event, argv) => {
      process.platform !== 'darwin' && protocol.handle(argv.slice(3).toString())
    })
    app.on('open-url', (event, url) => {
      event.preventDefault()
      protocol.handle(url)
    })
    app.setAsDefaultProtocolClient(protocol.scheme, protocol.path, protocol.args)
  }

  if (update) {
    app.whenReady().then(() => {
      // @ts-expect-error
      import('electron-updater').then(({ autoUpdater }) => {
        autoUpdater.autoDownload = update.auto_download
        autoUpdater.on('update-available', async (...args: any[]) => {
          const canDownloadUpdate = await update.onUpdateAvailable(args)
          canDownloadUpdate && autoUpdater.downloadUpdate()
        })
        autoUpdater.on('update-downloaded', async (...args: any[]) => {
          const canInstallUpdate = await update.onUpdateDownloaded(args)
          canInstallUpdate && setImmediate(() => autoUpdater.quitAndInstall())
        })
        autoUpdater.on('error', update.onUpdateError)
      })
    })
  }

  return {
    app,
    whenReady: () => app.whenReady(),
  }
}

const application_windows = new Map<number, BrowserWindow>()

export function useApplicationUrl(page: string) {
  return __windowUrls[page]
}

type CreateWindowOptions = {
  url: URL
  contentProtection?: boolean
}

export function createElectronWindow({ url, contentProtection }: CreateWindowOptions) {
  const window = new BrowserWindow({
    height: 600,
    width: 800,
    show: false,
    webPreferences: {
      devTools: !!import.meta.env.DEV,
      contextIsolation: true,
      preload: join(__dirname, '../preload.cjs'),
    },
  })
  contentProtection && window.setContentProtection(contentProtection)

  window.once('ready-to-show', () => window.show())
  window.on('close', () => application_windows.delete(window.id))
  application_windows.set(window.id, window)

  window.loadURL(url.href)

  return window
}
