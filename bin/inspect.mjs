#!/usr/bin/env node

import _ from 'lodash'
import yargs from 'yargs'
import nodeflags from 'nodeflags'
import inspect from '../lib/index.mjs'

/* -----------------------------------------------------------------------------
 * usage
 * -------------------------------------------------------------------------- */

/** @type {{ [key: string]: import('yargs').Options }} */
const inspectCliOptions = {
  'debug-exception': {
    type: 'boolean',
    description: 'Pause debugger on exceptions.'
  },
  'log-level': {
    type: 'string',
    description: 'The level to display logs at.',
    choices: ['silly', 'verbose', 'info'],
    default: 'info'
  },
  'profile-dir': {
    type: 'string',
    description: 'Uses specified profile path for every execution instead of creating a clean one.',
    default: null,
  }
}

// early parse in order to show inspect specific help options
// eslint-disable-next-line no-unused-expressions
yargs(process.argv.slice(2))
  .options(inspectCliOptions)
  .usage('\nUsage:\ninspect [inspect options] [node options] [v8 options] [script] [arguments]')
  .version()
  .help()
  .argv

/* -----------------------------------------------------------------------------
 * inspect
 * -------------------------------------------------------------------------- */

nodeflags((err, flags) => {
  if (err) {
    throw new Error(err)
  }

  const parsed = yargs(process.argv).options(flags).argv
  const args = process.argv.slice(2)
  const cmd = parsed._[0]
  // TODO: Should support picking node args from cmd
  const processArgs = []
  const childArgs = args

  // inspectOptions are just picked from our parsed args. We pass "options"
  // rather than args because we are not proxying the args to the future
  // child_process
  const inspectKeys = _.keys(inspectCliOptions)
  const inspectFlags = _.map(inspectKeys, (key) => '--' + key)
  const inspectOptions = _.pick(parsed, inspectKeys)

  _.remove(processArgs, (arg) => inspectFlags.includes(arg.split('=')[0]))
  _.remove(childArgs, (arg) => inspectFlags.includes(arg.split('=')[0]))

  inspect(cmd, { nodeArgs: processArgs, childArgs, inspectOptions })
    .then(() => process.exit())
    .catch(() => process.exit(1))
})
