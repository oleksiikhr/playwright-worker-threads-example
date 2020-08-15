'use strict'

const { workerData, parentPort } = require('worker_threads')
const { chromium } = require('playwright')
const { log } = require('console')

// Storage
let necessaryTasks = workerData.runtimePages
const timeoutCloseBrowser = 500
let timeoutCloseBrowserFn
let browser

log(`Launch Thread: ${workerData.workerId}`)

// Setting up communication with the Main Thread
parentPort.on('message', (link) => {
  if (necessaryTasks < 1) {
    return
  }

  run(link)
})

function run(link) {
  clearTimeout(timeoutCloseBrowserFn)

  necessaryTasks--

  return getContext()
    .then((ctx) => {
      return ctx.newPage()
        .then((page) => {
          return page.goto(link)
            .then(() => {
              return page.$$eval('a', (elements) => elements.map((el) => el.href))
            })
            .then((links) => links.forEach((l) => storeNewLink(l)))
            .finally(() => {
              if (!page.isClosed()) {
                return page.close()
              }
            })
        })
    })
    .finally(() => {
      necessaryTasks++

      if (necessaryTasks === workerData.runtimePages) {
        timeoutCloseBrowserFn = setTimeout(() => {
          browser.close()
        }, timeoutCloseBrowser)
      }
    })
    .then(() => completeLink(link))
    .catch(() => {/* just skip, no matter now */})
}

async function getContext() {
  if (!browser || !browser.isConnected()) {
    browser = await chromium.launch({
      headless: workerData.headless,
      slowMo: workerData.slowMo
    })
  }

  if (browser.contexts().length) {
    return new Promise((resolve) => resolve(browser.contexts()[0]))
  }

  return browser.newContext()
}

function getNewLink() {
  return parentPort.postMessage({ type: 'get' })
}

function storeNewLink(link) {
  return parentPort.postMessage({ type: 'new', link })
}

function completeLink(link) {
  return parentPort.postMessage({ type: 'complete', workerId: workerData.workerId, link })
}

// Constantly checking if new tasks are needed
setInterval(() => {
  if (necessaryTasks > 0) {
    getNewLink()
  }
}, workerData.taskTimeout)
