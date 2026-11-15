import { contextBridge, ipcRenderer } from 'electron'
import type { AppApi } from '../shared/api'

const api: AppApi = {
  getSettings: () => ipcRenderer.invoke('settings:get'),
  setStartDate: (startDate) => ipcRenderer.invoke('settings:setStartDate', startDate),
  setModel: (model) => ipcRenderer.invoke('settings:setModel', model),
  setApiKey: (apiKey) => ipcRenderer.invoke('settings:setApiKey', apiKey),
  getEntry: (day) => ipcRenderer.invoke('entries:get', day),
  generate: (day) => ipcRenderer.invoke('entries:generate', day)
}

contextBridge.exposeInMainWorld('api', api)
