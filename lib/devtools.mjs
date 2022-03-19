import { Builder, until, By } from 'selenium-webdriver'
import chrome from 'selenium-webdriver/chrome.js'
import 'chromedriver'
import log from 'npmlog'

/* -----------------------------------------------------------------------------
 * devtools public
 * -------------------------------------------------------------------------- */

/**
 * @param {{}} options
 */
export default function Devtools (options) {
  this.options = options || {}
  /** @type {import('selenium-webdriver').WebDriver} */
  this.driver
}

Devtools.prototype.create = async function () {
  log.silly('devtools', 'create')
  this.driver = await new Builder()
    .forBrowser('chrome')
    .setChromeOptions(new chrome.Options())
    .build()
}

Devtools.prototype.open = function (debuggerUrl, options) {
  log.silly('devtools', 'open')

  return this._resize()
    .then(() => this._navigateToUrl(debuggerUrl))
    .then(() => this._waitUntilPause())
    .then(() => this.options['debug-exception'] ? this._pauseOnException() : null)
    .then(() => this.options['inspect-brk'] ? null : this._continueExecution())
    .then(() => this.onOpen ? this.onOpen() : null)
    .catch((e) => {
      log.verbose('debtools', e)
      // webdriver throws errors on already resolved promises upon manual browser
      // quit/close. This is a catch all to avoid killing the entire process.
    })
}

// wrapper around driver.quit to ensure error is caught if close gets called
// multiple times.
Devtools.prototype.close = async function () {
  log.silly('devtools', 'close')

  await this.driver.quit()
}

/* -----------------------------------------------------------------------------
 * devtools private
 * -------------------------------------------------------------------------- */

Devtools.prototype._resize = function () {
  log.silly('devtools', 'resize')

  const window = this.driver.manage().window()

  return window.getSize()
    .then((size) => window.setSize(size.width, 450))
}

Devtools.prototype._navigateToUrl = function (debuggerUrl) {
  log.silly('devtools', 'navigate')

  return this.driver.get(debuggerUrl)
}

Devtools.prototype._waitUntilPause = function () {
  log.silly('devtools', 'wait for pause')

  return this.driver.wait(until.elementLocated(By.css('.cm-execution-line')))
}

Devtools.prototype._pauseOnException = function () {
  log.silly('devtools', 'pause on exception')

  return this._executeOnPanel('_togglePauseOnExceptions')
}

Devtools.prototype._continueExecution = function () {
  log.silly('devtools', 'continue execution')

  return this._executeOnPanel('_togglePause')
}

Devtools.prototype._executeOnPanel = function (methodName) {
  let script = `const root = window['WebInspector'] || window['Sources'];`
  script += `return root.SourcesPanel.instance().${methodName}();`

  return this.driver.executeScript(script)
}

