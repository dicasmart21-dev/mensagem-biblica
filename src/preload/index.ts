import { contextBridge, ipcRenderer } from 'electron'
import type { AppApi } from '../shared/api'

const api: AppApi = {
  getSettings: () => ipcRenderer.invoke('settings:get'),
  setStartDate: (startDate) => ipcRenderer.invoke('settings:setStartDate', startDate),
  setModel: (model) => ipcRenderer.invoke('settings:setModel', model),
  setApiKey: (apiKey) => ipcRenderer.invoke('settings:setApiKey', apiKey),
  getEntry: (day) => ipcRenderer.invoke('entries:get', day),
  importBible: () => ipcRenderer.invoke('bible:import'),
  useEmbeddedBible: () => ipcRenderer.invoke('bible:useEmbedded'),
  generate: (day) => ipcRenderer.invoke('entries:generate', day),
  regenerateText: (day, field) => ipcRenderer.invoke('entries:regenerateText', day, field),
  saveTexts: (day, texts) => ipcRenderer.invoke('entries:saveTexts', day, texts),
  approve: (day) => ipcRenderer.invoke('entries:approve', day),
  reopen: (day) => ipcRenderer.invoke('entries:reopen', day),
  copyText: (text) => ipcRenderer.invoke('clipboard:write', text)
}

contextBridge.exposeInMainWorld('api', api)
