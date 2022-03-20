import { Builder, until, By } from 'selenium-webdriver'
import chrome from 'selenium-webdriver/chrome.js'
import 'chromedriver'
import log from 'npmlog'

export class Devtools {
  /**
   * @param {Record<string, string>} options
   * @param {Record<string, string>} driverOptions
   */
  constructor(options, driverOptions) {
    this.options = options || {}
    this.driverOptions = driverOptions || {}
    /** @type {import('selenium-webdriver').WebDriver} */
    this.driver
  }

  async create () {
    log.silly('devtools', 'create', this.options)
    const options = new chrome.Options();
    if (this.driverOptions['profile-dir']) {
      options.addArguments(`--user-data-dir=${this.driverOptions['profile-dir']}`)
    }
    this.driver = await new Builder()
      .forBrowser('chrome')
      .setChromeOptions(options)
      .build()
  }

  async open (debuggerUrl, options) {
    log.silly('devtools', 'open')

    try {
      // await this._resize()
      await this._navigateToUrl(debuggerUrl)
      await this._waitUntilPause()
      if (this.options['debug-exception']) {
        await this._pauseOnException()
      }
      if (!this.options['inspect-brk']) {
        await this._continueExecution()
      }
      if (this.onOpen) {
        await this.onOpen()
      }
    } catch (error) {
        log.error('debtools', error)
        // webdriver throws errors on already resolved promises upon manual browser
        // quit/close. This is a catch all to avoid killing the entire process.
    }
  }

  // wrapper around driver.quit to ensure error is caught if close gets called multiple times.
  async close () {
    log.silly('devtools', 'close')

    await this.driver.quit()
  }

  async _resize () {
    log.silly('devtools', 'resize')

    const window = this.driver.manage().window()

    // const { width } = await window.getRect()
    // await window.setRect({ width, height: 700 })
    await window.maximize()
  }

  async _navigateToUrl (debuggerUrl) {
    log.silly('devtools', 'navigate')

    await this.driver.get(debuggerUrl)
  }

  async _waitUntilPause () {
    log.silly('devtools', 'wait for pause')

    await this.driver.wait(until.elementLocated(By.css('.cm-execution-line')))
  }

  async _pauseOnException () {
    log.silly('devtools', 'pause on exception')

    await this._executeOnPanel('_togglePauseOnExceptions')
  }

  async _continueExecution () {
    log.silly('devtools', 'continue execution')

    await this._executeOnPanel('_togglePause')
  }

  async _executeOnPanel (methodName) {
    let script = `const root = window['WebInspector'] || window['Sources'];`
    script += `return root.SourcesPanel.instance().${methodName}();`

    return await this.driver.executeScript(script)
  }
}

