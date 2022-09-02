import { resolve } from 'node:path'
import { createRequire } from 'node:module'

import { build } from 'vite'

import { defineBlackbooxCommand } from './defineCommand'
import { loadBlackbooxConfig, loadElectronConfig, loadRendererConfig } from '../utils/config'
import { writeTypes, generatePackageJSON } from '../utils/prepare'

export default defineBlackbooxCommand({
  meta: {
    name: 'build',
    usage: 'npx blackboox build',
    description: 'Build blackboox for production deployment',
  },
  async invoke(args) {
    process.env.NODE_ENV = 'production'
    const blackboox = await loadBlackbooxConfig()
    generatePackageJSON(blackboox)

    await writeTypes(blackboox)

    const viteRendererConfig = loadRendererConfig(blackboox)
    await build({
      mode: 'production',
      root: resolve(blackboox.rootDir!, blackboox.srcDir!),
      ...viteRendererConfig,
    })

    const viteElectronConfig = loadElectronConfig({
      mode: 'production',
      blackboox,
    })
    await build({
      root: resolve(blackboox.rootDir!, blackboox.srcDir!, 'app'),
      envDir: resolve(blackboox.rootDir!, blackboox.srcDir!),
      mode: 'production',
      ...viteElectronConfig,
    })

    if (args.pkg) {
      const require = createRequire(import.meta.url)
      const electronBuilder = require('electron-builder')
      electronBuilder.build(blackboox.electron)
    }
  },
})
