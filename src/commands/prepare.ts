import { relative } from 'node:path'

import { clearDir } from '../utils/fs'
import { loadBlackbooxConfig } from '../utils/config'
import { writeTypes } from '../utils/prepare'
import { defineBlackbooxCommand } from './defineCommand'

export default defineBlackbooxCommand({
  meta: {
    name: 'prepare',
    usage: 'npx blackboox prepare',
    description: 'Prepare blackboox for development/build',
  },
  async invoke() {
    process.env.NODE_ENV = process.env.NODE_ENV || 'production'
    const config = await loadBlackbooxConfig()

    await clearDir(config.buildDir!)
    await writeTypes(config)

    console.log('Types generated in', relative(process.cwd(), config.buildDir!))
  },
})
