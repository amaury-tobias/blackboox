import type { CliOptions } from 'electron-builder'

export type Blackboox = {
  srcDir?: string
  rootDir?: string
  buildDir?: string

  external?: string[]
  electron?: CliOptions
}

interface ConfigEnv {
  mode: 'development' | 'production'
}
type UserConfigFn = (env: ConfigEnv) => Blackboox | Promise<Blackboox>
export type UserConfigExport = Blackboox | Promise<Blackboox> | UserConfigFn
