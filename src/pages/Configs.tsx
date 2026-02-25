import { useState, type ChangeEvent } from 'react'
import type { ContainerType, ItemType } from '../types'
import { useContainerStore } from '../store/containerStore'
import { useItemStore } from '../store/itemStore'
import { SlideOver } from '../components/SlideOver'
import { ConfirmDialog } from '../components/ConfirmDialog'
import {
  PlusIcon,
  PencilIcon,
  TrashIcon,
  ContainerIcon,
  PackageIcon,
} from '../components/icons'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ContainerForm {
  name: string
  lengthM: string
  widthM: string
  heightM: string
  maxWeightKg: string
  costPerUnit: string
  isActive: boolean
}

interface ItemForm {
  name: string
  lengthM: string
  widthM: string
  heightM: string
  weightKg: string
  isStackable: boolean
  maxStackWeightKg: string
  isFragile: boolean
  color: string
  showItemCode: boolean
}

type ContainerFormErrors = Partial<Record<keyof Omit<ContainerForm, 'isActive'>, string>>
type ItemFormErrors = Partial<Record<keyof Omit<ItemForm, 'isStackable' | 'isFragile'>, string>>

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const EMPTY_CONTAINER: ContainerForm = {
  name: '',
  lengthM: '',
  widthM: '',
  heightM: '',
  maxWeightKg: '',
  costPerUnit: '',
  isActive: true,
}

const EMPTY_ITEM: ItemForm = {
  name: '',
  lengthM: '',
  widthM: '',
  heightM: '',
  weightKg: '',
  isStackable: true,
  maxStackWeightKg: '',
  isFragile: false,
  color: '#3498DB',
  showItemCode: false,
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function n(s: string) {
  const v = parseFloat(s)
  return isNaN(v) ? 0 : v
}

function fmtInt(x: number) {
  return x.toLocaleString('en-IN')
}

function fmtDim(x: number) {
  return x.toFixed(2)
}

function containerToForm(c: ContainerType): ContainerForm {
  return {
    name: c.name,
    lengthM: String(c.lengthM),
    widthM: String(c.widthM),
    heightM: String(c.heightM),
    maxWeightKg: String(c.maxWeightKg),
    costPerUnit: String(c.costPerUnit),
    isActive: c.isActive,
  }
}

function itemToForm(it: ItemType): ItemForm {
  return {
    name: it.name,
    lengthM: String(it.lengthM),
    widthM: String(it.widthM),
    heightM: String(it.heightM),
    weightKg: String(it.weightKg),
    isStackable: it.isStackable,
    maxStackWeightKg: String(it.maxStackWeightKg),
    isFragile: it.isFragile,
    color: it.color,
    showItemCode: it.showItemCode ?? false,
  }
}

function toItemCode(name: string): string {
  return name.trim().split(/\s+/).map((w) => w[0]?.toUpperCase() ?? '').join('')
}

function validateContainer(f: ContainerForm): ContainerFormErrors {
  const e: ContainerFormErrors = {}
  if (!f.name.trim()) e.name = 'Name is required'
  if (!(n(f.lengthM) > 0)) e.lengthM = 'Must be > 0'
  if (!(n(f.widthM) > 0)) e.widthM = 'Must be > 0'
  if (!(n(f.heightM) > 0)) e.heightM = 'Must be > 0'
  if (!(n(f.maxWeightKg) > 0)) e.maxWeightKg = 'Must be > 0'
  if (!(n(f.costPerUnit) > 0)) e.costPerUnit = 'Must be > 0'
  return e
}

function validateItem(f: ItemForm): ItemFormErrors {
  const e: ItemFormErrors = {}
  if (!f.name.trim()) e.name = 'Name is required'
  if (!(n(f.lengthM) > 0)) e.lengthM = 'Must be > 0'
  if (!(n(f.widthM) > 0)) e.widthM = 'Must be > 0'
  if (!(n(f.heightM) > 0)) e.heightM = 'Must be > 0'
  if (!(n(f.weightKg) > 0)) e.weightKg = 'Must be > 0'
  if (f.isStackable && !(n(f.maxStackWeightKg) > 0)) e.maxStackWeightKg = 'Must be > 0 when stackable'
  if (!f.color.match(/^#[0-9A-Fa-f]{6}$/)) e.color = 'Enter a valid hex color'
  return e
}

// ---------------------------------------------------------------------------
// Shared UI atoms
// ---------------------------------------------------------------------------

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
        checked ? 'bg-accent' : 'bg-border'
      }`}
    >
      <span
        className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200 ease-in-out ${
          checked ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </button>
  )
}

interface FieldProps {
  label: string
  unit?: string
  prefix?: string
  error?: string
  required?: boolean
  hint?: string
  id: string
  type?: string
  value: string
  onChange: (e: ChangeEvent<HTMLInputElement>) => void
  step?: string
  min?: string
  placeholder?: string
  readOnly?: boolean
}

function Field({
  label,
  unit,
  prefix,
  error,
  required,
  hint,
  id,
  type = 'text',
  value,
  onChange,
  step,
  min,
  placeholder,
  readOnly,
}: FieldProps) {
  return (
    <div>
      <label htmlFor={id} className="block text-xs font-medium text-white/50 mb-1.5">
        {label}
        {required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      <div className="relative flex items-center">
        {prefix && (
          <span className="absolute left-3 text-white/40 text-sm pointer-events-none select-none z-10">
            {prefix}
          </span>
        )}
        <input
          id={id}
          type={type}
          value={value}
          onChange={onChange}
          step={step}
          min={min}
          placeholder={placeholder}
          readOnly={readOnly}
          className={`w-full bg-background border rounded-xl text-sm text-white placeholder-white/20 focus:outline-none focus:ring-1 focus:ring-accent/60 transition-colors ${
            prefix ? 'pl-7' : 'pl-3'
          } ${unit ? 'pr-10' : 'pr-3'} py-2.5 ${
            error ? 'border-red-500/50 focus:border-red-500/50' : 'border-border hover:border-white/20 focus:border-accent/60'
          } ${readOnly ? 'opacity-60 cursor-default' : ''}`}
        />
        {unit && (
          <span className="absolute right-3 text-white/30 text-xs pointer-events-none select-none">
            {unit}
          </span>
        )}
      </div>
      {hint && !error && <p className="mt-1 text-xs text-white/30">{hint}</p>}
      {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
    </div>
  )
}

function SectionDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 py-1">
      <div className="flex-1 h-px bg-border" />
      <span className="text-[10px] font-semibold uppercase tracking-widest text-white/25">{label}</span>
      <div className="flex-1 h-px bg-border" />
    </div>
  )
}

function ActionBtn({
  onClick,
  variant,
  children,
}: {
  onClick: () => void
  variant: 'edit' | 'delete'
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={`p-1.5 rounded-lg transition-colors ${
        variant === 'edit'
          ? 'text-white/30 hover:text-white hover:bg-white/10'
          : 'text-white/30 hover:text-red-400 hover:bg-red-500/10'
      }`}
    >
      {children}
    </button>
  )
}

// ---------------------------------------------------------------------------
// Container Types section
// ---------------------------------------------------------------------------

function ContainersEmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
      <div className="w-16 h-16 rounded-2xl bg-accent/10 border border-accent/20 flex items-center justify-center mb-5">
        <ContainerIcon className="w-8 h-8 text-accent/40" />
      </div>
      <h3 className="text-white/80 font-medium text-base mb-2">No container types yet</h3>
      <p className="text-white/35 text-sm max-w-xs leading-relaxed mb-6">
        Add shipping containers to define the available spaces for your packing simulations.
      </p>
      <button
        onClick={onAdd}
        className="inline-flex items-center gap-2 px-4 py-2.5 bg-accent/20 hover:bg-accent/30 border border-accent/40 text-accent text-sm font-medium rounded-xl transition-colors"
      >
        <PlusIcon className="w-4 h-4" />
        Add Container Type
      </button>
    </div>
  )
}

function ContainerTypesSection() {
  const store = useContainerStore()
  const containers = store.items

  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<ContainerType | null>(null)
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [form, setForm] = useState<ContainerForm>(EMPTY_CONTAINER)
  const [errors, setErrors] = useState<ContainerFormErrors>({})

  function openAdd() {
    setEditing(null)
    setForm(EMPTY_CONTAINER)
    setErrors({})
    setOpen(true)
  }

  function openEdit(c: ContainerType) {
    setEditing(c)
    setForm(containerToForm(c))
    setErrors({})
    setOpen(true)
  }

  function handleClose() {
    setOpen(false)
  }

  async function handleSubmit() {
    const errs = validateContainer(form)
    if (Object.keys(errs).length > 0) {
      setErrors(errs)
      return
    }
    const data: Omit<ContainerType, 'id'> = {
      name: form.name.trim(),
      lengthM: n(form.lengthM),
      widthM: n(form.widthM),
      heightM: n(form.heightM),
      maxWeightKg: n(form.maxWeightKg),
      costPerUnit: n(form.costPerUnit),
      isActive: form.isActive,
    }
    if (editing?.id != null) {
      await store.update(editing.id, data)
    } else {
      await store.add(data)
    }
    if (!store.error) setOpen(false)
  }

  async function handleDelete() {
    if (deleteId != null) {
      await store.remove(deleteId)
    }
    setDeleteId(null)
  }

  function set(patch: Partial<ContainerForm>) {
    setForm((f) => ({ ...f, ...patch }))
  }

  const cbm = n(form.lengthM) * n(form.widthM) * n(form.heightM)

  const slideOverFooter = (
    <div className="flex gap-3">
      <button
        onClick={handleClose}
        className="flex-1 px-4 py-2.5 rounded-xl border border-border text-white/60 hover:text-white hover:border-white/30 transition-colors text-sm font-medium"
      >
        Cancel
      </button>
      <button
        onClick={handleSubmit}
        disabled={store.isLoading}
        className="flex-1 px-4 py-2.5 rounded-xl bg-accent text-white hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
      >
        {store.isLoading ? 'Saving…' : editing ? 'Save Changes' : 'Add Container'}
      </button>
    </div>
  )

  return (
    <>
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 sm:px-6 py-3 border-b border-border">
        <p className="text-sm text-white/40">
          {containers.length} container type{containers.length !== 1 ? 's' : ''}
        </p>
        <button
          onClick={openAdd}
          className="inline-flex items-center gap-2 px-3 py-2 bg-accent text-white text-sm font-medium rounded-xl hover:bg-accent/90 transition-colors"
        >
          <PlusIcon className="w-4 h-4" />
          <span className="hidden sm:inline">Add Container</span>
          <span className="sm:hidden">Add</span>
        </button>
      </div>

      {containers.length === 0 ? (
        <ContainersEmptyState onAdd={openAdd} />
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  {['Name', 'Dimensions', 'CBM', 'Max Weight', 'Cost', 'Active', ''].map((h) => (
                    <th
                      key={h}
                      className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-white/30 first:pl-6 last:pr-6"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {containers.map((c) => {
                  const vol = c.lengthM * c.widthM * c.heightM
                  return (
                    <tr key={c.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="px-4 py-3.5 pl-6 font-medium text-white">{c.name}</td>
                      <td className="px-4 py-3.5 font-mono text-white/60 text-xs">
                        {fmtDim(c.lengthM)} × {fmtDim(c.widthM)} × {fmtDim(c.heightM)} m
                      </td>
                      <td className="px-4 py-3.5 font-mono text-white/70">
                        {vol.toFixed(2)} m³
                      </td>
                      <td className="px-4 py-3.5 text-white/60">
                        {fmtInt(c.maxWeightKg)} kg
                      </td>
                      <td className="px-4 py-3.5 text-white/70">
                        ₹{fmtInt(c.costPerUnit)}
                      </td>
                      <td className="px-4 py-3.5">
                        <Toggle
                          checked={c.isActive}
                          onChange={(v) => store.update(c.id!, { isActive: v })}
                        />
                      </td>
                      <td className="px-4 py-3.5 pr-6">
                        <div className="flex items-center gap-1 justify-end">
                          <ActionBtn variant="edit" onClick={() => openEdit(c)}>
                            <PencilIcon />
                          </ActionBtn>
                          <ActionBtn variant="delete" onClick={() => setDeleteId(c.id!)}>
                            <TrashIcon />
                          </ActionBtn>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="sm:hidden space-y-3 p-4">
            {containers.map((c) => {
              const vol = c.lengthM * c.widthM * c.heightM
              return (
                <div
                  key={c.id}
                  className="bg-surface border border-border rounded-2xl p-4 space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-white truncate">{c.name}</h3>
                      <p className="text-xs text-white/40 font-mono mt-0.5">
                        {fmtDim(c.lengthM)} × {fmtDim(c.widthM)} × {fmtDim(c.heightM)} m
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <ActionBtn variant="edit" onClick={() => openEdit(c)}>
                        <PencilIcon />
                      </ActionBtn>
                      <ActionBtn variant="delete" onClick={() => setDeleteId(c.id!)}>
                        <TrashIcon />
                      </ActionBtn>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <p className="text-[10px] text-white/30 uppercase tracking-wide mb-0.5">CBM</p>
                      <p className="text-sm font-mono text-white/80">{vol.toFixed(2)} m³</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-white/30 uppercase tracking-wide mb-0.5">Max Wt</p>
                      <p className="text-sm text-white/80">{fmtInt(c.maxWeightKg)} kg</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-white/30 uppercase tracking-wide mb-0.5">Cost</p>
                      <p className="text-sm text-white/80">₹{fmtInt(c.costPerUnit)}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between pt-1 border-t border-border/60">
                    <span className="text-xs text-white/40">Active</span>
                    <Toggle
                      checked={c.isActive}
                      onChange={(v) => store.update(c.id!, { isActive: v })}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}

      {/* Slide-over form */}
      <SlideOver
        open={open}
        onClose={handleClose}
        title={editing ? 'Edit Container Type' : 'Add Container Type'}
        subtitle="Internal container dimensions and logistics cost"
        footer={slideOverFooter}
      >
        <Field
          id="c-name"
          label="Name"
          required
          placeholder="e.g. 20ft Standard"
          value={form.name}
          onChange={(e) => set({ name: e.target.value })}
          error={errors.name}
        />

        <SectionDivider label="Internal Dimensions" />

        <div className="grid grid-cols-3 gap-3">
          <Field
            id="c-len"
            label="Length"
            required
            unit="m"
            type="number"
            step="0.001"
            min="0.001"
            placeholder="5.90"
            value={form.lengthM}
            onChange={(e) => set({ lengthM: e.target.value })}
            error={errors.lengthM}
          />
          <Field
            id="c-wid"
            label="Width"
            required
            unit="m"
            type="number"
            step="0.001"
            min="0.001"
            placeholder="2.35"
            value={form.widthM}
            onChange={(e) => set({ widthM: e.target.value })}
            error={errors.widthM}
          />
          <Field
            id="c-hei"
            label="Height"
            required
            unit="m"
            type="number"
            step="0.001"
            min="0.001"
            placeholder="2.39"
            value={form.heightM}
            onChange={(e) => set({ heightM: e.target.value })}
            error={errors.heightM}
          />
        </div>

        {/* CBM auto-calc */}
        <div className="flex items-center justify-between bg-background/60 border border-border/60 rounded-xl px-4 py-3">
          <span className="text-xs text-white/40">Auto-calculated CBM</span>
          <span className={`font-mono text-sm font-semibold ${cbm > 0 ? 'text-accent' : 'text-white/20'}`}>
            {cbm > 0 ? `${cbm.toFixed(3)} m³` : '—'}
          </span>
        </div>

        <SectionDivider label="Capacity & Cost" />

        <Field
          id="c-wt"
          label="Max Payload Weight"
          required
          unit="kg"
          type="number"
          step="1"
          min="1"
          placeholder="21800"
          value={form.maxWeightKg}
          onChange={(e) => set({ maxWeightKg: e.target.value })}
          error={errors.maxWeightKg}
        />
        <Field
          id="c-cost"
          label="Cost per Unit"
          required
          prefix="₹"
          type="number"
          step="1"
          min="1"
          placeholder="45000"
          value={form.costPerUnit}
          onChange={(e) => set({ costPerUnit: e.target.value })}
          error={errors.costPerUnit}
        />

        <SectionDivider label="Status" />

        <div className="flex items-center justify-between py-1">
          <div>
            <p className="text-sm text-white/80">Active</p>
            <p className="text-xs text-white/30 mt-0.5">Available in packing simulations</p>
          </div>
          <Toggle checked={form.isActive} onChange={(v) => set({ isActive: v })} />
        </div>

        {store.error && (
          <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
            {store.error}
          </p>
        )}
      </SlideOver>

      {/* Delete confirmation */}
      <ConfirmDialog
        open={deleteId != null}
        title="Delete Container Type"
        message="This container type will be permanently removed. Any simulations using it may be affected."
        confirmLabel="Delete"
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
      />
    </>
  )
}

// ---------------------------------------------------------------------------
// Item Types section
// ---------------------------------------------------------------------------

function ItemsEmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
      <div className="w-16 h-16 rounded-2xl bg-accent/10 border border-accent/20 flex items-center justify-center mb-5">
        <PackageIcon className="w-8 h-8 text-accent/40" />
      </div>
      <h3 className="text-white/80 font-medium text-base mb-2">No item types yet</h3>
      <p className="text-white/35 text-sm max-w-xs leading-relaxed mb-6">
        Define the items you want to pack — dimensions, weight, stacking rules, and a color for 3D visualisation.
      </p>
      <button
        onClick={onAdd}
        className="inline-flex items-center gap-2 px-4 py-2.5 bg-accent/20 hover:bg-accent/30 border border-accent/40 text-accent text-sm font-medium rounded-xl transition-colors"
      >
        <PlusIcon className="w-4 h-4" />
        Add Item Type
      </button>
    </div>
  )
}

function Badge({ label, color }: { label: string; color: 'green' | 'amber' | 'slate' }) {
  const styles = {
    green: 'bg-green-500/15 border-green-500/25 text-green-400',
    amber: 'bg-amber-500/15 border-amber-500/25 text-amber-400',
    slate: 'bg-white/5 border-white/10 text-white/25',
  }
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border ${styles[color]}`}
    >
      {label}
    </span>
  )
}

function ItemTypesSection() {
  const store = useItemStore()
  const items = store.items

  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<ItemType | null>(null)
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [form, setFormState] = useState<ItemForm>(EMPTY_ITEM)
  const [errors, setErrors] = useState<ItemFormErrors>({})

  function openAdd() {
    setEditing(null)
    setFormState(EMPTY_ITEM)
    setErrors({})
    setOpen(true)
  }

  function openEdit(it: ItemType) {
    setEditing(it)
    setFormState(itemToForm(it))
    setErrors({})
    setOpen(true)
  }

  function handleClose() {
    setOpen(false)
  }

  async function handleSubmit() {
    const errs = validateItem(form)
    if (Object.keys(errs).length > 0) {
      setErrors(errs)
      return
    }
    const data: Omit<ItemType, 'id'> = {
      name: form.name.trim(),
      lengthM: n(form.lengthM),
      widthM: n(form.widthM),
      heightM: n(form.heightM),
      weightKg: n(form.weightKg),
      isStackable: form.isStackable,
      maxStackWeightKg: form.isStackable ? n(form.maxStackWeightKg) : 0,
      isFragile: form.isFragile,
      color: form.color,
      showItemCode: form.showItemCode,
    }
    if (editing?.id != null) {
      await store.update(editing.id, data)
    } else {
      await store.add(data)
    }
    if (!store.error) setOpen(false)
  }

  async function handleDelete() {
    if (deleteId != null) {
      await store.remove(deleteId)
    }
    setDeleteId(null)
  }

  function set(patch: Partial<ItemForm>) {
    setFormState((f) => ({ ...f, ...patch }))
  }

  const slideOverFooter = (
    <div className="flex gap-3">
      <button
        onClick={handleClose}
        className="flex-1 px-4 py-2.5 rounded-xl border border-border text-white/60 hover:text-white hover:border-white/30 transition-colors text-sm font-medium"
      >
        Cancel
      </button>
      <button
        onClick={handleSubmit}
        disabled={store.isLoading}
        className="flex-1 px-4 py-2.5 rounded-xl bg-accent text-white hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
      >
        {store.isLoading ? 'Saving…' : editing ? 'Save Changes' : 'Add Item'}
      </button>
    </div>
  )

  return (
    <>
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 sm:px-6 py-3 border-b border-border">
        <p className="text-sm text-white/40">
          {items.length} item type{items.length !== 1 ? 's' : ''}
        </p>
        <button
          onClick={openAdd}
          className="inline-flex items-center gap-2 px-3 py-2 bg-accent text-white text-sm font-medium rounded-xl hover:bg-accent/90 transition-colors"
        >
          <PlusIcon className="w-4 h-4" />
          <span className="hidden sm:inline">Add Item</span>
          <span className="sm:hidden">Add</span>
        </button>
      </div>

      {items.length === 0 ? (
        <ItemsEmptyState onAdd={openAdd} />
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  {['', 'Name', 'Dimensions', 'Weight', 'Properties', ''].map((h, i) => (
                    <th
                      key={i}
                      className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-white/30 first:pl-6 last:pr-6"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {items.map((it) => (
                  <tr key={it.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="pl-6 pr-2 py-3.5">
                      <div
                        className="w-4 h-4 rounded-full border border-white/10 shrink-0"
                        style={{ background: it.color }}
                      />
                    </td>
                    <td className="px-4 py-3.5 font-medium text-white">{it.name}</td>
                    <td className="px-4 py-3.5 font-mono text-white/60 text-xs">
                      {fmtDim(it.lengthM)} × {fmtDim(it.widthM)} × {fmtDim(it.heightM)} m
                    </td>
                    <td className="px-4 py-3.5 text-white/60 font-mono text-xs">
                      {it.weightKg} kg
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex flex-wrap gap-1.5">
                        {it.isStackable ? (
                          <Badge label="Stackable" color="green" />
                        ) : (
                          <Badge label="No Stack" color="slate" />
                        )}
                        {it.isFragile && <Badge label="Fragile" color="amber" />}
                      </div>
                    </td>
                    <td className="px-4 py-3.5 pr-6">
                      <div className="flex items-center gap-1 justify-end">
                        <ActionBtn variant="edit" onClick={() => openEdit(it)}>
                          <PencilIcon />
                        </ActionBtn>
                        <ActionBtn variant="delete" onClick={() => setDeleteId(it.id!)}>
                          <TrashIcon />
                        </ActionBtn>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="sm:hidden space-y-3 p-4">
            {items.map((it) => (
              <div
                key={it.id}
                className="bg-surface border border-border rounded-2xl p-4 space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className="w-8 h-8 rounded-lg border border-white/10 shrink-0"
                      style={{ background: it.color }}
                    />
                    <div className="min-w-0">
                      <h3 className="font-semibold text-white truncate">{it.name}</h3>
                      <p className="text-xs text-white/40 font-mono mt-0.5">
                        {fmtDim(it.lengthM)} × {fmtDim(it.widthM)} × {fmtDim(it.heightM)} m
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <ActionBtn variant="edit" onClick={() => openEdit(it)}>
                      <PencilIcon />
                    </ActionBtn>
                    <ActionBtn variant="delete" onClick={() => setDeleteId(it.id!)}>
                      <TrashIcon />
                    </ActionBtn>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-[10px] text-white/30 uppercase tracking-wide mb-0.5">Weight</p>
                    <p className="text-sm text-white/80 font-mono">{it.weightKg} kg</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-white/30 uppercase tracking-wide mb-0.5">Max Stack</p>
                    <p className="text-sm text-white/80">
                      {it.isStackable ? `${it.maxStackWeightKg} kg` : '—'}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5 pt-1 border-t border-border/60">
                  {it.isStackable ? (
                    <Badge label="Stackable" color="green" />
                  ) : (
                    <Badge label="No Stack" color="slate" />
                  )}
                  {it.isFragile && <Badge label="Fragile" color="amber" />}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Slide-over form */}
      <SlideOver
        open={open}
        onClose={handleClose}
        title={editing ? 'Edit Item Type' : 'Add Item Type'}
        subtitle="Physical properties and packing constraints"
        footer={slideOverFooter}
      >
        {/* Color + Name */}
        <div className="flex gap-3 items-start">
          <div className="shrink-0">
            <label className="block text-xs font-medium text-white/50 mb-1.5">Color</label>
            <div
              className="relative w-10 h-10 rounded-xl border border-border overflow-hidden cursor-pointer"
              style={{ background: form.color }}
              title="Pick color"
            >
              <input
                type="color"
                value={form.color}
                onChange={(e) => set({ color: e.target.value })}
                className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                aria-label="Pick color"
              />
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <Field
              id="i-name"
              label="Name"
              required
              placeholder="e.g. Smartphone Box"
              value={form.name}
              onChange={(e) => set({ name: e.target.value })}
              error={errors.name}
            />
          </div>
        </div>

        {/* Hex input */}
        <Field
          id="i-color-hex"
          label="Hex Color"
          placeholder="#3498DB"
          value={form.color}
          onChange={(e) => set({ color: e.target.value })}
          error={errors.color}
          hint="Used in 3D packing visualisation"
        />

        <SectionDivider label="Dimensions" />

        <div className="grid grid-cols-3 gap-3">
          <Field
            id="i-len"
            label="Length"
            required
            unit="m"
            type="number"
            step="0.001"
            min="0.001"
            placeholder="0.40"
            value={form.lengthM}
            onChange={(e) => set({ lengthM: e.target.value })}
            error={errors.lengthM}
          />
          <Field
            id="i-wid"
            label="Width"
            required
            unit="m"
            type="number"
            step="0.001"
            min="0.001"
            placeholder="0.30"
            value={form.widthM}
            onChange={(e) => set({ widthM: e.target.value })}
            error={errors.widthM}
          />
          <Field
            id="i-hei"
            label="Height"
            required
            unit="m"
            type="number"
            step="0.001"
            min="0.001"
            placeholder="0.10"
            value={form.heightM}
            onChange={(e) => set({ heightM: e.target.value })}
            error={errors.heightM}
          />
        </div>

        <SectionDivider label="Weight" />

        <Field
          id="i-weight"
          label="Weight"
          required
          unit="kg"
          type="number"
          step="0.01"
          min="0.001"
          placeholder="2.50"
          value={form.weightKg}
          onChange={(e) => set({ weightKg: e.target.value })}
          error={errors.weightKg}
        />

        <SectionDivider label="Packing Rules" />

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-white/80">Stackable</p>
              <p className="text-xs text-white/30 mt-0.5">Other items can be placed on top</p>
            </div>
            <Toggle
              checked={form.isStackable}
              onChange={(v) => set({ isStackable: v, maxStackWeightKg: v ? form.maxStackWeightKg : '0' })}
            />
          </div>

          {form.isStackable && (
            <Field
              id="i-maxstack"
              label="Max Stack Weight"
              required
              unit="kg"
              type="number"
              step="0.1"
              min="0.1"
              placeholder="100"
              value={form.maxStackWeightKg}
              onChange={(e) => set({ maxStackWeightKg: e.target.value })}
              error={errors.maxStackWeightKg}
              hint="Max weight that can rest on top of this item"
            />
          )}

          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-white/80">Fragile</p>
              <p className="text-xs text-white/30 mt-0.5">Nothing can be placed on top</p>
            </div>
            <Toggle checked={form.isFragile} onChange={(v) => set({ isFragile: v })} />
          </div>
        </div>

        <SectionDivider label="Display" />

        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-white/80">Show Item Code</p>
            <p className="text-xs text-white/30 mt-0.5">
              Display initials on placed boxes in 3D view
              {form.name.trim() && (
                <span className="ml-1 font-mono text-accent/70">
                  (e.g. "{toItemCode(form.name)}")
                </span>
              )}
            </p>
          </div>
          <Toggle checked={form.showItemCode} onChange={(v) => set({ showItemCode: v })} />
        </div>

        {store.error && (
          <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
            {store.error}
          </p>
        )}
      </SlideOver>

      {/* Delete confirmation */}
      <ConfirmDialog
        open={deleteId != null}
        title="Delete Item Type"
        message="This item type will be permanently removed and will no longer appear in new simulations."
        confirmLabel="Delete"
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
      />
    </>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

type Tab = 'containers' | 'items'

export function Configs() {
  const [tab, setTab] = useState<Tab>('containers')

  return (
    <div className="max-w-7xl mx-auto">
      {/* Page header */}
      <div className="px-4 sm:px-6 py-6 border-b border-border">
        <h1 className="text-xl font-bold text-white">Configuration</h1>
        <p className="text-sm text-white/40 mt-1">Manage container and item types for packing simulations</p>
      </div>

      {/* Tab switcher */}
      <div className="px-4 sm:px-6 pt-4 pb-0 border-b border-border">
        <div className="flex gap-1">
          {(
            [
              { key: 'containers', label: 'Container Types', Icon: ContainerIcon },
              { key: 'items', label: 'Item Types', Icon: PackageIcon },
            ] as const
          ).map(({ key, label, Icon }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
                tab === key
                  ? 'border-accent text-accent'
                  : 'border-transparent text-white/40 hover:text-white/70'
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="bg-surface/50 min-h-[60vh]">
        {tab === 'containers' ? <ContainerTypesSection /> : <ItemTypesSection />}
      </div>
    </div>
  )
}
