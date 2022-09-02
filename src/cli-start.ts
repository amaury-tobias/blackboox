import mri from 'mri'
import { Command, commands } from './commands'

export async function startCli() {
  const _argv = process.argv.slice(2)
  const args = mri(_argv, {
    boolean: ['no-clear'],
  })

  const command = args._.shift() || 'usage'
  if (!(command in commands)) {
    console.log('\n' + ('Invalid command ' + command))
    process.exit(1)
  }

  const cmd = await commands[command as Command]()
  const result = await cmd.invoke(args)
  return result
}
