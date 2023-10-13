import { Command, commands } from './commands'

export async function startCli() {
  const command = process.argv.slice(2).shift() ?? 'usage'
  if (!(command in commands)) {
    console.log('\n' + ('Invalid command ' + command))
    process.exit(1)
  }

  const cmd = await commands[command as Command]()
  const result = await cmd.invoke(process.argv.slice(2))
  return result
}
