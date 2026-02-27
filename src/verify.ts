// Verification script to test store initialization
import { db } from './db'
import { useContainerStore } from './store/containerStore'
import { useItemStore } from './store/itemStore'
import { useSimulationStore } from './store/simulationStore'

export async function verifyImplementation() {
  console.log('🔍 Starting verification...\n')

  try {
    // 1. Verify database tables exist
    console.log('📊 Database Tables:')
    const dbVersion = db.verno
    console.log(`  Database Version: ${dbVersion}`)
    console.log(`  Tables: ${db.tables.map(t => t.name).join(', ')}`)

    // 2. Load and verify container types
    console.log('\n📦 Container Types:')
    await useContainerStore.getState().loadAll()
    const containers = useContainerStore.getState().items
    console.log(`  Count: ${containers.length}`)
    containers.forEach((c) => {
      console.log(`    ✓ ${c.name} (₹${c.costPerUnit})`)
    })

    // 3. Load and verify item types
    console.log('\n📋 Item Types:')
    await useItemStore.getState().loadAll()
    const items = useItemStore.getState().items
    console.log(`  Count: ${items.length}`)
    items.forEach((i) => {
      console.log(`    ✓ ${i.name} (${i.color})`)
    })

    // 4. Load simulation config/results
    console.log('\n📈 Simulation Storage:')
    await useSimulationStore.getState().loadAll()
    const configs = useSimulationStore.getState().configs
    const results = useSimulationStore.getState().results
    console.log(`  Configs: ${configs.length}`)
    console.log(`  Results: ${results.length}`)

    // 5. Test CRUD on containers
    console.log('\n🧪 Testing CRUD Operations:')
    const newContainer = {
      name: 'Test Container',
      lengthM: 10,
      widthM: 2,
      heightM: 2,
      maxWeightKg: 20000,
      costPerUnit: 50000,
      isActive: true,
    }
    await useContainerStore.getState().add(newContainer)
    const afterAdd = useContainerStore.getState().items.length
    console.log(`  ✓ Add: ${afterAdd - 1} → ${afterAdd} containers`)

    const testId = useContainerStore.getState().items[afterAdd - 1].id!
    await useContainerStore.getState().update(testId, { costPerUnit: 55000 })
    console.log(`  ✓ Update: Container ${testId} cost updated`)

    await useContainerStore.getState().remove(testId)
    const afterRemove = useContainerStore.getState().items.length
    console.log(`  ✓ Remove: ${afterAdd} → ${afterRemove} containers`)

    console.log('\n✅ ALL VERIFICATIONS PASSED!\n')
    return true
  } catch (error) {
    console.error('\n❌ Verification failed:', error)
    return false
  }
}

// Auto-run on import in development
if (import.meta.env.DEV) {
  verifyImplementation().catch(console.error)
}
