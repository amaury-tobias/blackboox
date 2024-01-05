import type { CliOptions } from 'electron-builder'
import { BuiltinPresetName, Preset } from 'unimport'
import type { PluginOption } from 'vite'

export type Blackboox = {
  srcDir?: string
  rootDir?: string
  buildDir?: string

  electron?: {
    builder?: CliOptions
    plugins?: PluginOption[]
    external?: string[]
  }

  client?: {
    autoImportPresets?: (Preset | Exclude<BuiltinPresetName, 'vue'>)[]
    plugins?: PluginOption[]
    external?: string[]
    optimizeDeps?: {
      exclude?: string[]
    }
  }
}

interface ConfigEnv {
  mode: 'development' | 'production'
}
type UserConfigFn = (env: ConfigEnv) => Blackboox | Promise<Blackboox>
export type UserConfigExport = Blackboox | Promise<Blackboox> | UserConfigFn
