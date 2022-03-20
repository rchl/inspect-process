import path from 'path'
import { spawn } from 'child_process'
import _ from 'lodash'
import which from 'which'
import exitHook from 'exit-hook'
import portfinderSync from 'portfinder-sync'
import log from 'npmlog'
import { Devtools } from './devtools.mjs'

export default async function (cmd, options) {
  options = _.defaults(options || {}, {
    inspectOptions: {},
    nodeArgs: [],
    childArgs: []
  })

  log.level = options['inspectOptions']['log-level'] || 'info'

  const devtoolsOptions = _.pick(options['inspectOptions'], ['debug-exception'])
  devtoolsOptions['inspect-brk'] = options['nodeArgs'].includes('--inspect-brk')

  const devtools = new Devtools(devtoolsOptions)
  await devtools.create()
  return _.extend(inspectProcess(cmd, options, devtools), { devtools })
}

function inspectProcess (cmd, options, devtools) {
  const getPathToCmd = function (cmd) {
    try { return which.sync(cmd) } catch (e) { return path.resolve(cmd) }
  }

  return new Promise(function (resolve, reject) {
    process.env['FORCE_COLOR'] = '1'

    const port = portfinderSync.getPort(9229)
    const debugArgs = ['--inspect=' + port, '--inspect-brk']
    const nodeArgs = options['nodeArgs']
    const childArgs = options['childArgs']
    const args = nodeArgs.concat(debugArgs, childArgs)
    const proc = spawn(getPathToCmd(cmd), args)

    // we want esnure devtools creation/cleanup executes fully
    let devtoolsOpen
    let devtoolsClose

    const openDevtools = async function (url) {
      return (devtoolsOpen = await devtools.open(url))
    }

    const closeDevtools = function () {
      return devtoolsOpen.then(() => (devtoolsClose = devtools.close()))
    }

    const onInspectComplete = function () {
      if (!devtoolsOpen) {
        return resolveWithResult()
      }

      return devtoolsClose
        ? devtoolsClose.then(resolveWithResult)
        : closeDevtools().then(resolveWithResult)
    }

    const resolveWithResult = function () {
      return proc.exitCode
        ? reject(new Error('Process exited with a non 0 exitCode.'))
        : resolve(null)
    }

    proc.stdout.on('data', (data) => {
      process.stdout.write(data)
    })

    proc.stderr.on('data', async (data) => {
      const dataStr = data.toString()
      const isListening = dataStr.startsWith('Debugger listening on port')
      const isListeningWs = dataStr.startsWith('Debugger listening on ws://')
      const isAttached = dataStr.startsWith('Debugger attached')
      const isCompleted = dataStr.startsWith('Waiting for the debugger to disconnect')
      const isInspectOutput = isListening || isListeningWs || isCompleted || isAttached

      if (isListening) {
        log.silly('process', 'listening')
        await openDevtools(dataStr.substring(dataStr.indexOf('devtools')))
      } else if (isListeningWs) {
        log.silly('process', 'listening')
        const wsUrl = dataStr.match(/ws:\/\/(.*?)\s/)[1]
        await openDevtools(`devtools://devtools/bundled/inspector.html?v8only=true&ws=${encodeURIComponent(wsUrl)}`)
      } else if (isCompleted && devtoolsOpen) {
        log.silly('process', 'completed')
        await closeDevtools()
      } else if (isAttached) {
        log.silly('process', 'attached')
      }

      if (isInspectOutput) {
        log.verbose('debugger', _.trim(data))
      } else {
        process.stderr.write(data)
      }
    })

    proc.once('exit', onInspectComplete)
    proc.once('SIGINT', onInspectComplete)
    proc.once('SIGTERM', onInspectComplete)

    // safegaurd to ensure processes are cleaned up on exit
    exitHook(() => {
      proc.kill()
      devtools.close()
    })
  })
}
