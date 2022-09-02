import { promises as fsp } from 'node:fs'

export async function clearDir(path: string) {
  await fsp.rm(path, { recursive: true, force: true })
  await fsp.mkdir(path, { recursive: true })
}

export async function makeDir(path: string) {
  await fsp.mkdir(path, { recursive: true })
}
