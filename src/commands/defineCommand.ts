export interface BlackbooxCommandMeta {
  name: string
  usage: string
  description: string
  [key: string]: any
}

export type CLIInvokeResult = void | 'error' | 'wait'

export interface BlackbooxCommand {
  invoke(args: string[]): Promise<CLIInvokeResult> | CLIInvokeResult
  meta: BlackbooxCommandMeta
}

export function defineBlackbooxCommand(command: BlackbooxCommand): BlackbooxCommand {
  return command
}
