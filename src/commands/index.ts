const _rDefault = (r: any) => r.default || r

export const commands = {
  dev: () => import('./dev').then(_rDefault),
  build: () => import('./build').then(_rDefault),
  prepare: () => import('./prepare').then(_rDefault),
}

export type Command = keyof typeof commands
