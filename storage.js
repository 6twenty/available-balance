const {app} = require('electron')
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const dataFilePath = path.join(app.getPath('userData'), 'data.json')

let data = null

const load = hashedKey => {
  if (data !== null) {
    return
  }

  if (!fs.existsSync(dataFilePath)) {
    data = {}
    data[hashedKey] = {}
    return
  }

  data = JSON.parse(fs.readFileSync(dataFilePath, 'utf-8'))

  if (!(hashedKey in data)) {
    data[hashedKey] = {}
  }
}

const save = _ => {
  fs.writeFileSync(dataFilePath, JSON.stringify(data))
}

module.exports = storeKey => {
  if (!storeKey) {
    throw new Error(`Storage: no key provided`)
  }

  const hashedKey = crypto.createHash('sha256').update(storeKey).digest('hex')
  const store = {}

  store.set = (key, value) => {
    load(hashedKey)

    data[hashedKey][key] = value

    save()
  }

  store.get = key => {
    load(hashedKey)

    if (key in data[hashedKey]) {
      return data[hashedKey][key]
    } else {
      return null
    }
  }

  store.del = key => {
    load(hashedKey)

    if (key in data[hashedKey]) {
      delete data[hashedKey][key]

      save()
    }
  }

  store.has = key => {
    load(hashedKey)

    return key in data[hashedKey]
  }

  store.all = _ => {
    load(hashedKey)

    return data[hashedKey]
  }

  store.drop = _ => {
    load(hashedKey)

    delete data[hashedKey]

    save()
  }

  return store
}
