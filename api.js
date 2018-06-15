const got = require('got')
const moment = require('moment')
const money = require('money')
const log = require('electron-log')
const {apiKey} = require('./config')
const storage = require('./storage')

let isFetching = false
let store

try {
  store = storage(apiKey)
} catch (e) {
  log.debug(`Storage error: ${e}`)
}

const get = endpoint => {
  return got(`https://api.pocketsmith.com/v2/${endpoint}`, {
    json: true, headers: { 'Authorization': `Key ${apiKey}` }
  }).then(response => response.body)
}

exports.fetch = async opts => {
  let user

  if (!apiKey) {
    throw new Error(`API: no API key provided`)
  }

  try {
    if (isFetching) {
      log.debug(`Suppressing fetch (already fetching)`)
      return
    }

    isFetching = true

    log.debug('Fetching user...')

    user = store.get('user') || await get('me')

    log.debug(' > Done')
    log.debug('Fetching accounts...')

    user.accounts = await get(`users/${user.id}/accounts`)

    log.debug(' > Done')

    store.set('user', user)

    isFetching = false

    return user
  } catch(e) {
    isFetching = false

    log.error('Error fetching from API:', e)

    throw e
  }
}
