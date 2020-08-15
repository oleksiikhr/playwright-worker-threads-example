'use strict'

const { Worker } = require('worker_threads')
const { resolve } = require('path')
const debug = require('debug')

// Settings
const threadsCount = 3
const pagesCount = 3

// Storage
const set = new Set()
const workers = []
const queue = Array.from(Array(threadsCount * pagesCount), (_, i) => {
  return `https://news.ycombinator.com/news?p=${i}`
})

// Logs
debug.enable('app')
const log = debug('app')

log(`Run ${threadsCount} threads with ${pagesCount} with 3 pages each`)

// Run Threads
for (let i = 0; i < threadsCount; i++) {
  const worker = new Worker(resolve(__dirname, 'parser.js'), {
    workerData: {
      workerId: i + 1,
      runtimePages: pagesCount,
      taskTimeout: 500,
      headless: true,
      slowMo: 500
    }
  })

  workers.push(worker)

  worker.on('message', (msg) => {
    switch (msg.type) {
      case 'get':
        const link = getLink()
        if (link) {
          set.add(link)
          worker.postMessage(link)
        }
        break
      case 'new':
        if (msg.link && !set.has(msg.link)) {
          queue.push(msg.link)
        }
        break
      case 'complete':
        log(`[worker: ${msg.workerId}, queue: ${queue.length}] ${msg.link}`)
        break
      default:
        throw new Error(`${msg.type} type is unknown`)
    }
  })
}

function getLink() {
  const link = queue.pop()

  if (set.has(link)) {
    return getLink()
  }

  return link
}
