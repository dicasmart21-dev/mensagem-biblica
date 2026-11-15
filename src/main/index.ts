import { app, BrowserWindow, ipcMain, shell } from 'electron'
import { join } from 'node:path'
import type { Result } from '../shared/api'
import { closeDb, getEntry } from './db'
import { generateForDay } from './generate'
import { getSettings, setApiKey, setModel, setStartDate } from './settings'

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1100,
    height: 760,
    minWidth: 720,
    minHeight: 520,
    title: 'Palavra Diária',
    autoHideMenuBar: true,
    backgroundColor: '#f6f2ea',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })

  // Links externos abrem no navegador do sistema, nunca dentro do app.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) void shell.openExternal(url)
    return { action: 'deny' }
  })
  win.webContents.on('will-navigate', (event) => event.preventDefault())

  if (process.env.ELECTRON_RENDERER_URL) {
    void win.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    void win.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

/** Roda uma ação e devolve o erro como dado, para a tela mostrar a mensagem limpa. */
async function result<T>(action: () => T | Promise<T>): Promise<Result<T>> {
  try {
    return { ok: true, value: await action() }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) }
  }
}

function asDay(value: unknown): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1) {
    throw new Error('Dia inválido.')
  }
  return value
}

/** Dias com geração em andamento, para não disparar duas chamadas para o mesmo dia. */
const generating = new Set<number>()

void app.whenReady().then(() => {
  ipcMain.handle('settings:get', () => getSettings())
  ipcMain.handle('settings:setStartDate', (_e, v: unknown) => result(() => setStartDate(String(v))))
  ipcMain.handle('settings:setModel', (_e, v: unknown) => result(() => setModel(String(v))))
  ipcMain.handle('settings:setApiKey', (_e, v: unknown) => result(() => setApiKey(String(v))))
  ipcMain.handle('entries:get', (_e, day: unknown) => getEntry(asDay(day)))
  ipcMain.handle('entries:generate', (_e, value: unknown) =>
    result(async () => {
      const day = asDay(value)
      if (generating.has(day)) throw new Error('Os textos deste dia já estão sendo gerados.')
      generating.add(day)
      try {
        return await generateForDay(day)
      } finally {
        generating.delete(day)
      }
    })
  )

  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('will-quit', closeDb)
