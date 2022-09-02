import { resolve } from 'node:path'

import { build, createServer } from 'vite'

import { defineBlackbooxCommand } from './defineCommand'
import { writeTypes } from '../utils/prepare'
import { loadBlackbooxConfig, loadElectronConfig, loadRendererConfig } from '../utils/config'

export default defineBlackbooxCommand({
  meta: {
    name: 'dev',
    usage: 'npx blackboox dev',
    description: 'Run blackboox development server',
  },
  async invoke(args) {
    process.env.NODE_ENV = 'development'

    const blackboox = await loadBlackbooxConfig()
    await writeTypes(blackboox)

    const viteRendererConfig = loadRendererConfig(blackboox)
    const viteDevServer = await createServer({
      mode: 'development',
      root: resolve(blackboox.rootDir!, blackboox.srcDir!),
      ...viteRendererConfig,
    })
    await viteDevServer.listen()

    const viteElectronConfig = loadElectronConfig({
      mode: 'development',
      blackboox,
    })
    await build({
      root: resolve(blackboox.rootDir!, blackboox.srcDir!, 'app'),
      envDir: resolve(blackboox.rootDir!, blackboox.srcDir!),
      mode: 'development',
      ...viteElectronConfig,
    })
  },
})
