import { contextBridge, ipcRenderer } from 'electron'
import type { AppApi } from '../shared/api'

const api: AppApi = {
  getSettings: () => ipcRenderer.invoke('settings:get'),
  setStartDate: (startDate) => ipcRenderer.invoke('settings:setStartDate', startDate)
}

contextBridge.exposeInMainWorld('api', api)
