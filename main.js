const path = require('path')
const accounting = require('accounting-js')
const log = require('electron-log')
const {app, Tray, Menu, MenuItem, BrowserWindow, ipcMain} = require('electron')
const api = require('./api')
const {apiKey} = require('./config')
const storage = require('./storage')

const shouldQuit = app.makeSingleInstance((argv, workingDirectory) => {
  // Could focus the app window here
})

let user
let tray
let menu
let win
let isOnline = false
let waiting
let store

try {
  store = storage(apiKey)
} catch (e) {
  log.debug(`Storage error: ${e}`)
}

if (shouldQuit) {
  app.quit()
  return
}

ipcMain.on('online', event => {
  isOnline = true
  log.debug(`Online status is: online`)
  update()
})

ipcMain.on('offline', event => {
  isOnline = false
  log.debug(`Online status is: offline`)
})

const loginSettings = app.getLoginItemSettings()

app.on('ready', async _ => {
  win = new BrowserWindow({ width: 0, height: 0, show: false })
  win.loadURL(`file://${__dirname}/online.html`)

  if (app.dock) app.dock.hide()

  try {
    user = store.get('user')
  } catch (e) {
    log.debug(`Storage error: ${e}`)
  }

  buildTray()
  buildMenu()
  update()

  setInterval(update, 1000 * 60) // Every minute
})

const update = async _ => {
  log.debug(`Starting update`)

  if (waiting) {
    clearTimeout(waiting)
    waiting = null
  }

  if (isOnline) {
    try {
      log.debug(`Fetching user`)
      user = await api.fetch()
    } catch (e) {
      // It's ok
    }
  }

  log.debug(`Refreshing menu`)
  buildMenu()
}

const buildTray = _ => {
  tray = new Tray(path.join(__dirname, 'IconTemplate.png'))
}

const buildMenu = _ => {
  const menuTemplate = []

  if (apiKey && (!user || isOnline === false)) {
    menuTemplate.push({
      label: `Connecting...`,
      enabled: false
    })
  }

  if (!apiKey) {
    menuTemplate.push({
      label: `No API key provided`,
      enabled: false
    })
  }

  if (user) {
    const accounts = user.accounts.filter(account => !account.is_net_worth)

    const activeAccountIds = store.get('activeAccounts') || accounts.reduce((active, account) => {
      active[account.id] = true

      return active
    }, {})

    const sum = accounts.filter(account => activeAccountIds[account.id]).reduce((sum, account) => {
      return sum + account.current_balance
    }, 0)

    const balance = accounting.formatMoney(sum, {
      symbol: user.base_currency_code,
      format: user.using_multiple_currencies ? "%v %s" : "%v"
    })

    menuTemplate.push({
      label: `${user.login}: ${balance}`,
      enabled: false
    }, {
      type: 'separator'
    })

    accounts.forEach(account => {
      menuTemplate.push({
        type: 'checkbox',
        label: account.title,
        checked: activeAccountIds[account.id],
        click: (menuItem, _, event) => {
          activeAccountIds[account.id] = menuItem.checked

          store.set('activeAccounts', activeAccountIds)

          // Can't just update the balance menu item;
          // need to rebuild the whole menu
          buildMenu()
        }
      })
    })
  }

  menuTemplate.push({
    type: 'separator'
  }, {
    type: 'checkbox',
    label: `Start On Login`,
    checked: loginSettings.openAtLogin,
    click: (menuItem, browserWindow, event) => {
      app.setLoginItemSettings({
        openAtLogin: menuItem.checked,
        openAsHidden: menuItem.checked
      })
    }
  }, {
    type: 'separator'
  }, {
    role: 'quit',
    label: `Quit`
  })

  menu = Menu.buildFromTemplate(menuTemplate)

  tray.setContextMenu(menu)
}
