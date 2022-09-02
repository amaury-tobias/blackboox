import { startCli } from './cli-start'

startCli()
  .then(result => {
    if (result === 'error') process.exit(1)
    else if (result === 'wait') process.exit(0)
  })
  .catch(err => {
    console.log(err)
    process.exit(1)
  })
