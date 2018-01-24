const path = require('path')
const accounting = require('accounting-js')
const {app, Tray, Menu, MenuItem} = require('electron')
const api = require('./api')
const {apiKey} = require('./config')
const storage = require('./storage')(apiKey)

const shouldQuit = app.makeSingleInstance((argv, workingDirectory) => {
  // Could focus the app window here
})

let user
let tray
let menu

if (shouldQuit) {
  app.quit()
  return
}

const loginSettings = app.getLoginItemSettings()

app.on('ready', async _ => {
  if (app.dock) app.dock.hide()

  user = storage.get('user')

  buildTray()
  buildMenu()
  update()

  setInterval(update, 1000 * 60) // Every minute
})

const update = async _ => {
  user = await api.fetch()

  buildMenu()
}

const buildTray = _ => {
  tray = new Tray(path.join(__dirname, 'IconTemplate.png'))
}

const buildMenu = _ => {
  const menuTemplate = []

  if (user) {
    const accounts = user.accounts.filter(account => !account.is_net_worth)

    const activeAccountIds = storage.get('activeAccounts') || accounts.reduce((active, account) => {
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

          storage.set('activeAccounts', activeAccountIds)

          // Can't just update the balance menu item;
          // need to rebuild the whole menu
          buildMenu()
        }
      })
    })
  } else {
    menuTemplate.push({
      label: `Connecting...`,
      enabled: false
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
