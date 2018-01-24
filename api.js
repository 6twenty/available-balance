const got = require('got')
const moment = require('moment')
const money = require('money')
const log = require('electron-log')
const {apiKey} = require('./config')
const storage = require('./storage')(apiKey)

let isFetching = false

const get = endpoint => {
  return got(`https://api.pocketsmith.com/v2/${endpoint}`, {
    json: true, headers: { 'Authorization': `Key ${apiKey}` }
  }).then(response => response.body)
}

exports.fetch = async opts => {
  let user

  try {
    if (isFetching) {
      log.debug(`Suppressing fetch (already fetching)`)
      return
    }

    isFetching = true

    log.debug('Fetching user...')

    user = await get('me')

    log.debug(' > Done')
    log.debug('Fetching accounts...')

    user.accounts = await get(`users/${user.id}/accounts`)

    log.debug(' > Done')

    storage.set('user', user)

    isFetching = false

    return user
  } catch(e) {
    isFetching = false

    log.error('Error fetching from API:', e)

    return user
  }
}
