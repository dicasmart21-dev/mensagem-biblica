import { app, BrowserWindow, clipboard, dialog, ipcMain, shell } from 'electron'
import { join } from 'node:path'
import { TEXT_FIELDS, type Result, type TextField, type Texts } from '../shared/api'
import { approvalBlockers } from '../shared/validate'
import { importBibleFile, removeImportedBible } from './bible'
import { closeDb, getEntry, getStatuses, searchEntries, setStatus, updateTexts } from './db'
import { generateForDay, regenerateText } from './generate'
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

function asTexts(value: unknown): Texts {
  const v = value as Record<string, unknown> | null
  if (!v || TEXT_FIELDS.some((f) => typeof v[f] !== 'string')) throw new Error('Textos inválidos.')
  return { impact: v.impact, xPost: v.xPost, instagram: v.instagram, reflection: v.reflection } as Texts
}

function asField(value: unknown): TextField {
  if (!TEXT_FIELDS.includes(value as TextField)) throw new Error('Texto desconhecido.')
  return value as TextField
}

/** Dias com geração em andamento, para não disparar duas chamadas para o mesmo dia. */
const generating = new Set<number>()

async function exclusive<T>(day: number, action: () => Promise<T>): Promise<T> {
  if (generating.has(day)) throw new Error('Os textos deste dia já estão sendo gerados.')
  generating.add(day)
  try {
    return await action()
  } finally {
    generating.delete(day)
  }
}

void app.whenReady().then(() => {
  ipcMain.handle('settings:get', () => getSettings())
  ipcMain.handle('settings:setStartDate', (_e, v: unknown) => result(() => setStartDate(String(v))))
  ipcMain.handle('settings:setModel', (_e, v: unknown) => result(() => setModel(String(v))))
  ipcMain.handle('settings:setApiKey', (_e, v: unknown) => result(() => setApiKey(String(v))))
  ipcMain.handle('entries:get', (_e, day: unknown) => getEntry(asDay(day)))
  ipcMain.handle('entries:statuses', (_e, from: unknown, to: unknown) => getStatuses(asDay(from), asDay(to)))
  ipcMain.handle('entries:search', (_e, query: unknown, status: unknown) =>
    searchEntries(String(query ?? ''), status === 'draft' || status === 'approved' ? status : 'all')
  )
  ipcMain.handle('bible:import', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)!
    const picked = await dialog.showOpenDialog(win, {
      title: 'Importar Bíblia',
      properties: ['openFile'],
      filters: [{ name: 'Bíblia em JSON', extensions: ['json'] }]
    })
    if (picked.canceled || !picked.filePaths[0]) return null
    return result(() => importBibleFile(picked.filePaths[0]))
  })
  ipcMain.handle('bible:useEmbedded', () => result(removeImportedBible))
  ipcMain.handle('entries:generate', (_e, value: unknown) =>
    result(() => {
      const day = asDay(value)
      if (getEntry(day)?.status === 'approved') throw new Error('Este dia já foi aprovado. Reabra para gerar de novo.')
      return exclusive(day, () => generateForDay(day))
    })
  )
  ipcMain.handle('entries:regenerateText', (_e, value: unknown, field: unknown) =>
    result(() => {
      const day = asDay(value)
      const which = asField(field)
      return exclusive(day, () => regenerateText(day, which))
    })
  )
  ipcMain.handle('entries:saveTexts', (_e, day: unknown, texts: unknown) =>
    result(() => updateTexts(asDay(day), asTexts(texts)))
  )
  ipcMain.handle('entries:approve', (_e, value: unknown) =>
    result(() => {
      const day = asDay(value)
      const entry = getEntry(day)
      if (!entry) throw new Error('Ainda não há textos para este dia.')
      const blockers = approvalBlockers(entry.texts)
      if (blockers.length > 0) throw new Error(`Não dá para aprovar ainda: ${blockers.join(' ')}`)
      return setStatus(day, 'approved')
    })
  )
  ipcMain.handle('entries:reopen', (_e, day: unknown) => result(() => setStatus(asDay(day), 'draft')))
  ipcMain.handle('clipboard:write', (_e, text: unknown) => clipboard.writeText(String(text)))

  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('will-quit', closeDb)
