import type { PackingInput, PackingWorkerResult } from '../../types'
import { packItems } from './engine'

self.onmessage = (e: MessageEvent<PackingInput>) => {
  try {
    const result = packItems(e.data, (progress) => {
      const msg: PackingWorkerResult = { type: 'progress', data: progress }
      self.postMessage(msg)
    })

    const msg: PackingWorkerResult = { type: 'done', data: result }
    self.postMessage(msg)
  } catch (err) {
    const msg: PackingWorkerResult = {
      type: 'error',
      message: err instanceof Error ? err.message : 'Unknown packing error',
    }
    self.postMessage(msg)
  }
}
