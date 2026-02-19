import type {
  PackingInput,
  PackingProgress,
  PackingWorkerResult,
  SimulationResult,
} from '../../types'

export interface RunPackingOptions {
  input: PackingInput
  configId: number
  onProgress?: (progress: PackingProgress) => void
}

/**
 * Run the packing algorithm in a Web Worker.
 * Returns a full SimulationResult (minus `id` — caller persists to DB).
 */
export function runPacking(opts: RunPackingOptions): Promise<Omit<SimulationResult, 'id'>> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./packing.worker.ts', import.meta.url), {
      type: 'module',
    })

    worker.onmessage = (e: MessageEvent<PackingWorkerResult>) => {
      const msg = e.data

      switch (msg.type) {
        case 'progress':
          opts.onProgress?.(msg.data)
          break

        case 'done':
          worker.terminate()
          resolve({
            ...msg.data,
            configId: opts.configId,
            computedAt: new Date(),
          })
          break

        case 'error':
          worker.terminate()
          reject(new Error(msg.message))
          break
      }
    }

    worker.onerror = (err) => {
      worker.terminate()
      reject(new Error(err.message || 'Worker error'))
    }

    // Post input to worker (structured clone — no transferables needed for plain objects)
    worker.postMessage(opts.input)
  })
}
