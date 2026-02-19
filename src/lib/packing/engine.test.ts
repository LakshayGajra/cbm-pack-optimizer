import { describe, it, expect } from 'vitest'
import { packItems } from './engine'
import type { ContainerType, ItemType, PackingInput } from '../../types'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeContainer(overrides: Partial<ContainerType> = {}): ContainerType {
  return {
    id: 1,
    name: '20ft Standard',
    lengthM: 5.9,
    widthM: 2.35,
    heightM: 2.39,
    maxWeightKg: 21800,
    costPerUnit: 45000,
    isActive: true,
    ...overrides,
  }
}

function makeItem(overrides: Partial<ItemType> = {}): ItemType {
  return {
    id: 100,
    name: 'Test Item',
    lengthM: 0.5,
    widthM: 0.4,
    heightM: 0.3,
    weightKg: 5,
    isStackable: true,
    maxStackWeightKg: 100,
    isFragile: false,
    color: '#AABBCC',
    ...overrides,
  }
}

function makeInput(
  containers: ContainerType[],
  items: Array<{ itemType: ItemType; quantity: number }>,
): PackingInput {
  return { containerTypes: containers, items }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('packItems', () => {
  describe('single item placement', () => {
    it('places a single small item into a container', () => {
      const container = makeContainer()
      const item = makeItem({ id: 1 })
      const result = packItems(makeInput([container], [{ itemType: item, quantity: 1 }]))

      expect(result.packedContainers).toHaveLength(1)
      expect(result.packedContainers[0].placedItems).toHaveLength(1)
      expect(result.unpackedItems).toHaveLength(0)

      const placed = result.packedContainers[0].placedItems[0]
      expect(placed.itemTypeId).toBe(1)
      expect(placed.px).toBe(0)
      expect(placed.py).toBe(0)
      expect(placed.pz).toBe(0)
    })

    it('computes utilization correctly for a single item', () => {
      const container = makeContainer({
        id: 1,
        lengthM: 1,
        widthM: 1,
        heightM: 1,
      })
      const item = makeItem({
        id: 1,
        lengthM: 0.5,
        widthM: 0.5,
        heightM: 0.5,
      })
      const result = packItems(makeInput([container], [{ itemType: item, quantity: 1 }]))

      // Volume = 0.125 / 1.0 = 12.5%
      expect(result.packedContainers[0].utilizationPct).toBeCloseTo(12.5, 1)
    })

    it('returns totalCost equal to cost of used container', () => {
      const container = makeContainer({ costPerUnit: 45000 })
      const item = makeItem({ id: 1 })
      const result = packItems(makeInput([container], [{ itemType: item, quantity: 1 }]))

      expect(result.totalCost).toBe(45000)
    })
  })

  describe('rotation selection', () => {
    it('rotates an item to fit a narrow space', () => {
      // Container: 1m × 0.3m × 2m (very narrow along y)
      const container = makeContainer({
        id: 1,
        lengthM: 1,
        widthM: 0.3,
        heightM: 2,
      })
      // Item: 0.8m × 0.8m × 0.2m — doesn't fit without rotating
      // Needs rotation so that 0.2m goes along the narrow 0.3m axis
      const item = makeItem({
        id: 1,
        lengthM: 0.8,
        widthM: 0.8,
        heightM: 0.2,
      })
      const result = packItems(makeInput([container], [{ itemType: item, quantity: 1 }]))

      expect(result.packedContainers).toHaveLength(1)
      expect(result.packedContainers[0].placedItems).toHaveLength(1)
      expect(result.unpackedItems).toHaveLength(0)

      const placed = result.packedContainers[0].placedItems[0]
      // The 0.3m-wide container can only accept ≤0.3m along y-axis
      expect(placed.placedWidthM).toBeLessThanOrEqual(0.3 + 1e-9)
    })

    it('cannot place an item that does not fit in any rotation', () => {
      // Container: 0.5m cube
      const container = makeContainer({
        id: 1,
        lengthM: 0.5,
        widthM: 0.5,
        heightM: 0.5,
      })
      // Item: 1m × 1m × 1m — too big
      const item = makeItem({
        id: 1,
        lengthM: 1,
        widthM: 1,
        heightM: 1,
      })
      const result = packItems(makeInput([container], [{ itemType: item, quantity: 1 }]))

      expect(result.packedContainers).toHaveLength(0)
      expect(result.unpackedItems).toHaveLength(1)
      expect(result.unpackedItems[0]).toEqual({ itemTypeId: 1, quantity: 1 })
    })
  })

  describe('weight overflow triggers new container', () => {
    it('spills items into a second container when weight is exceeded', () => {
      const container = makeContainer({
        id: 1,
        maxWeightKg: 10,
        costPerUnit: 45000,
      })
      // Each item weighs 6 kg — only 1 fits per container by weight
      const item = makeItem({
        id: 1,
        lengthM: 0.1,
        widthM: 0.1,
        heightM: 0.1,
        weightKg: 6,
      })
      const result = packItems(makeInput([container], [{ itemType: item, quantity: 3 }]))

      expect(result.packedContainers.length).toBeGreaterThanOrEqual(2)

      // Each container should have only 1 item (6kg < 10kg, but 12kg > 10kg)
      for (const pc of result.packedContainers) {
        expect(pc.usedWeightKg).toBeLessThanOrEqual(10 + 1e-9)
      }

      const totalPlaced = result.packedContainers.reduce(
        (sum, pc) => sum + pc.placedItems.length,
        0,
      )
      expect(totalPlaced).toBe(3)
      expect(result.totalCost).toBe(45000 * result.packedContainers.length)
    })

    it('tracks usedWeightKg accurately', () => {
      const container = makeContainer({ id: 1, maxWeightKg: 50 })
      const item = makeItem({ id: 1, weightKg: 10, lengthM: 0.1, widthM: 0.1, heightM: 0.1 })
      const result = packItems(makeInput([container], [{ itemType: item, quantity: 3 }]))

      expect(result.packedContainers[0].usedWeightKg).toBeCloseTo(30, 1)
    })
  })

  describe('cost optimization chooses cheaper container', () => {
    it('prefers the container with lower cost-per-CBM', () => {
      const expensive = makeContainer({
        id: 1,
        name: 'Expensive',
        lengthM: 2,
        widthM: 2,
        heightM: 2,
        costPerUnit: 100000, // 100k / 8 CBM = 12,500 per CBM
      })
      const cheap = makeContainer({
        id: 2,
        name: 'Cheap',
        lengthM: 2,
        widthM: 2,
        heightM: 2,
        costPerUnit: 20000, // 20k / 8 CBM = 2,500 per CBM
      })
      const item = makeItem({
        id: 1,
        lengthM: 0.5,
        widthM: 0.5,
        heightM: 0.5,
      })

      const result = packItems(
        makeInput([expensive, cheap], [{ itemType: item, quantity: 1 }]),
      )

      expect(result.packedContainers).toHaveLength(1)
      // Should pick the cheap container
      expect(result.packedContainers[0].containerTypeId).toBe(2)
      expect(result.totalCost).toBe(20000)
    })

    it('uses expensive container only when cheap one cannot fit the items', () => {
      const small = makeContainer({
        id: 1,
        name: 'Small Cheap',
        lengthM: 0.3,
        widthM: 0.3,
        heightM: 0.3,
        costPerUnit: 5000,
      })
      const large = makeContainer({
        id: 2,
        name: 'Large Expensive',
        lengthM: 2,
        widthM: 2,
        heightM: 2,
        costPerUnit: 50000,
      })
      const item = makeItem({
        id: 1,
        lengthM: 1,
        widthM: 1,
        heightM: 1,
      })

      const result = packItems(
        makeInput([small, large], [{ itemType: item, quantity: 1 }]),
      )

      expect(result.packedContainers).toHaveLength(1)
      expect(result.packedContainers[0].containerTypeId).toBe(2)
      expect(result.totalCost).toBe(50000)
    })
  })

  describe('stacking constraints', () => {
    it('does not place items on top of fragile items', () => {
      // Tall, narrow container to force vertical stacking
      const container = makeContainer({
        id: 1,
        lengthM: 0.5,
        widthM: 0.5,
        heightM: 3,
      })
      const fragileItem = makeItem({
        id: 1,
        name: 'Fragile',
        lengthM: 0.5,
        widthM: 0.5,
        heightM: 0.5,
        isFragile: true,
        isStackable: false,
        maxStackWeightKg: 0,
      })
      const heavyItem = makeItem({
        id: 2,
        name: 'Heavy',
        lengthM: 0.5,
        widthM: 0.5,
        heightM: 0.5,
        weightKg: 50,
      })

      const result = packItems(
        makeInput(
          [container],
          [
            { itemType: heavyItem, quantity: 1 },
            { itemType: fragileItem, quantity: 1 },
          ],
        ),
      )

      // Both should be placed (heavy first by volume sort — same size so stable),
      // but fragile must not have anything on top. The algorithm places heavy first
      // at z=0. Fragile goes at z=0.5 IF there's space, but nothing should be
      // ON TOP of the fragile item.
      const totalPlaced = result.packedContainers.reduce(
        (sum, pc) => sum + pc.placedItems.length,
        0,
      )
      expect(totalPlaced).toBe(2)

      // Verify no item sits directly on top of the fragile item
      for (const pc of result.packedContainers) {
        const fragiles = pc.placedItems.filter((p) => p.itemTypeId === 1)
        for (const f of fragiles) {
          const fragileTop = f.pz + f.placedHeightM
          const onTop = pc.placedItems.filter(
            (p) =>
              p.itemTypeId !== 1 &&
              Math.abs(p.pz - fragileTop) < 0.001,
          )
          expect(onTop).toHaveLength(0)
        }
      }
    })
  })

  describe('FFD ordering', () => {
    it('places larger items first', () => {
      const container = makeContainer({ id: 1 })
      const small = makeItem({
        id: 1,
        name: 'Small',
        lengthM: 0.1,
        widthM: 0.1,
        heightM: 0.1,
      })
      const large = makeItem({
        id: 2,
        name: 'Large',
        lengthM: 1,
        widthM: 1,
        heightM: 1,
      })

      const result = packItems(
        makeInput(
          [container],
          [
            { itemType: small, quantity: 1 },
            { itemType: large, quantity: 1 },
          ],
        ),
      )

      // Large item should be placed first (at origin)
      const pc = result.packedContainers[0]
      const largeIdx = pc.placedItems.findIndex((p) => p.itemTypeId === 2)
      const smallIdx = pc.placedItems.findIndex((p) => p.itemTypeId === 1)
      expect(largeIdx).toBeLessThan(smallIdx)
    })
  })

  describe('progress callback', () => {
    it('fires progress events as items are placed', () => {
      const container = makeContainer({ id: 1 })
      const item = makeItem({ id: 1, lengthM: 0.1, widthM: 0.1, heightM: 0.1 })

      const progressEvents: Array<{ placedCount: number; totalCount: number; percent: number }> = []
      packItems(
        makeInput([container], [{ itemType: item, quantity: 5 }]),
        (p) => progressEvents.push(p),
      )

      // At least one progress event should fire (one per container fill)
      expect(progressEvents.length).toBeGreaterThan(0)
      // Final event should show all items placed
      const last = progressEvents[progressEvents.length - 1]
      expect(last.placedCount).toBe(5)
      expect(last.totalCount).toBe(5)
      expect(last.percent).toBe(100)
    })
  })

  describe('empty / edge cases', () => {
    it('returns empty result when no items provided', () => {
      const container = makeContainer({ id: 1 })
      const result = packItems(makeInput([container], []))

      expect(result.packedContainers).toHaveLength(0)
      expect(result.unpackedItems).toHaveLength(0)
      expect(result.totalCost).toBe(0)
      expect(result.avgUtilization).toBe(0)
    })

    it('returns all items unpacked when no containers provided', () => {
      const item = makeItem({ id: 1 })
      const result = packItems(makeInput([], [{ itemType: item, quantity: 3 }]))

      expect(result.packedContainers).toHaveLength(0)
      expect(result.unpackedItems).toHaveLength(1)
      expect(result.unpackedItems[0]).toEqual({ itemTypeId: 1, quantity: 3 })
    })

    it('skips inactive container types', () => {
      const container = makeContainer({ id: 1, isActive: false })
      const item = makeItem({ id: 1, lengthM: 0.1, widthM: 0.1, heightM: 0.1 })
      const result = packItems(makeInput([container], [{ itemType: item, quantity: 1 }]))

      expect(result.packedContainers).toHaveLength(0)
      expect(result.unpackedItems).toHaveLength(1)
    })
  })
})
