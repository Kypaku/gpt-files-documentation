'use strict'

import { app, protocol, BrowserWindow } from 'electron'
import { createProtocol } from 'vue-cli-plugin-electron-builder/lib'
import installExtension, { VUEJS3_DEVTOOLS } from 'electron-devtools-installer'
import * as path from 'path'
const isDevelopment = process.env.NODE_ENV !== 'production'
const lockApp = app.requestSingleInstanceLock()
const { dialog } = require('electron')
let mainWindow // Keep a global reference to avoid being garbage collected

// Scheme must be registered before the app is ready
protocol.registerSchemesAsPrivileged([
    { scheme: 'gptpi', privileges: { secure: true, standard: true } }
])

function createWindowOne () {
    const iconPath = path.join(__dirname, '..', 'public', 'icon.png')

    return new BrowserWindow({
        width: 600,
        height: 800,
        icon: iconPath,
        webPreferences: {
            enableRemoteModule: true,
            contextIsolation: false,
            nodeIntegration: true,
        }
    })
}

async function createWindow () {
    // Create the browser window.
    const win = createWindowOne()
    mainWindow = win
    win.setMenuBarVisibility(false)
    if (!lockApp) {
        app.quit()
    } else {
        app.on('second-instance', async (ev, argv, workDir) => {
            const win = createWindowOne()
            win.setMenuBarVisibility(false)
            await win.loadURL(process.env.WEBPACK_DEV_SERVER_URL as string)
            win.webContents.send('data', { externalRoute: argv[argv.length - 1] })
            if (win) {
                if (win.isMinimized()) win.restore()
                win.focus()
            }
        })
    }
    if (process.env.WEBPACK_DEV_SERVER_URL) {
    // Load the url of the dev server if in development mode
        await win.loadURL(process.env.WEBPACK_DEV_SERVER_URL as string)
        // if (!process.env.IS_TEST) win.webContents.openDevTools()
    } else {
        createProtocol('gptpi')
        // Load the index.html when not in development
        win.loadURL('gptpi://./index.html')
    }
}

if (process.defaultApp) {
    if (process.argv.length >= 2) {
        app.setAsDefaultProtocolClient('gptpi', process.execPath, [path.resolve(process.argv[1])])
    }
} else {
    app.setAsDefaultProtocolClient('gptpi')
}

// Quit when all windows are closed.
app.on('window-all-closed', (event) => {
    // On macOS it is common for applications and their menu bar
    // to stay active until the user quits explicitly with Cmd + Q
    if (process.platform !== 'darwin') {
        app.quit()
    }
    // event.preventDefault() // Prevents the default behaviour
})

// app.on('before-quit', async (event) => {
//     event.preventDefault() // Prevents the default quit
//     const option = {
//         type: 'question',
//         buttons: ['Yes', 'No'],
//         title: 'Confirm',
//         message: 'Unsaved data will be lost. Are you sure you want to quit?'
//     }

//     const response = await dialog.showMessageBox(mainWindow, option)
//     console.log("before-quit event triggered", { response })
//     if (response.response == 0) { // If 'Yes' is clicked
//         mainWindow = null // Dereference the window object
//         app.quit() // Quit the app
//     }
// })

app.on('activate', () => {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
})

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', async () => {
    if (isDevelopment && !process.env.IS_TEST) {
    // Install Vue Devtools
        try {
            await installExtension(VUEJS3_DEVTOOLS)
        } catch (e) {
            console.error('Vue Devtools failed to install:', e.toString())
        }
    }
    createWindow()
})

// Exit cleanly on request from parent process in development mode.
if (isDevelopment) {
    if (process.platform === 'win32') {
        process.on('message', (data) => {
            if (data === 'graceful-exit') {
                app.quit()
            }
        })
    } else {
        process.on('SIGTERM', () => {
            app.quit()
        })
    }
}
