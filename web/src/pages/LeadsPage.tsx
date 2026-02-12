// If react-window is not installed, run: npm install react-window @types/react-window
import { useEffect, useState, useRef, useMemo } from 'react'
import type { CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { List, type RowComponentProps } from 'react-window'
import { useQueryClient } from '@tanstack/react-query'
import { get, post, patch, del } from '../api'
import { useToast } from '../useToast'
import { safeFocus } from '../utils/safeFocus'
import BackToDashboard from '../components/BackToDashboard'
import EditLeadModal from '../features/leads/EditLeadModal'
import DeleteConfirmModal from '../features/leads/DeleteConfirmModal'
import LeadSourceModal from '../features/leads/LeadSourceModal'

type Lead = {
  id: string
  type: string
  address: string
  city: string
  state: string
  zip: string
  homeownerName?: string | null
  phoneNumber?: string | null
  createdBy?: string | null
  createdAt?: string
  updatedAt?: string
  temperature?: 'cold' | 'warm' | 'hot'
  // Deal Milestones (Silver tier)
  underContractAt?: string | null
  assignedAt?: string | null
  escrowOpenedAt?: string | null
  closedAt?: string | null
  cancelledAt?: string | null
  buyerName?: string | null
  assignmentFee?: string | null  // Decimal from DB comes as string; keep as string for round-trip safety
}

interface LeadImportRow {
  address?: string
  city?: string
  state?: string
  zip?: string
  county?: string
  ownerName?: string
  phone?: string
  parcelId?: string
  legalDescription?: string
  assessedValue?: number | string
  squareFeet?: number | string
  bedrooms?: number | string
  bathrooms?: number | string
  yearBuilt?: number | string
  lotSize?: number | string
  type?: string
  source?: string
  sellerPhone?: string
  sellerName?: string
  sellerEmail?: string
  _rowIndex?: number
  _errors?: string[]
  _warnings?: string[]
}

// Import Mapping Preset Types
interface ImportMapping {
  addressKey?: string
  cityKey?: string
  stateKey?: string
  zipKey?: string
  ownerKey?: string
  phoneKey?: string
  notesKey?: string
  defaultCity?: string
  defaultState?: string
  splitRule?: 'address_dash_notes'
}

interface ImportPreset {
  mapping: ImportMapping
  createdAt: number
  updatedAt: number
}

interface ImportPresetsStorage {
  version: 1
  presets: Record<string, ImportPreset>
}

const IMPORT_PRESETS_KEY = 'dfos.import.presets.v1'

function getPresetsFromStorage(): ImportPresetsStorage {
  try {
    const raw = localStorage.getItem(IMPORT_PRESETS_KEY)
    if (!raw) return { version: 1, presets: {} }
    const parsed = JSON.parse(raw)
    if (parsed.version !== 1) return { version: 1, presets: {} }
    return parsed
  } catch {
    return { version: 1, presets: {} }
  }
}

function savePresetToStorage(fingerprint: string, mapping: ImportMapping): void {
  try {
    const storage = getPresetsFromStorage()
    const existing = storage.presets[fingerprint]
    storage.presets[fingerprint] = {
      mapping,
      createdAt: existing?.createdAt ?? Date.now(),
      updatedAt: Date.now(),
    }
    localStorage.setItem(IMPORT_PRESETS_KEY, JSON.stringify(storage))
  } catch (err) {
    console.warn('[ImportPresets] Failed to save preset:', err)
  }
}

function deletePresetFromStorage(fingerprint: string): void {
  try {
    const storage = getPresetsFromStorage()
    delete storage.presets[fingerprint]
    localStorage.setItem(IMPORT_PRESETS_KEY, JSON.stringify(storage))
  } catch (err) {
    console.warn('[ImportPresets] Failed to delete preset:', err)
  }
}

function getPresetForFingerprint(fingerprint: string): ImportPreset | null {
  const storage = getPresetsFromStorage()
  return storage.presets[fingerprint] ?? null
}

const defaultLead: Omit<Lead, 'id'> = {
  type: 'single_family',
  address: '123 Main St',
  city: 'Austin',
  state: 'TX',
  zip: '78701',
}

const inputClass =
  'neon-glass w-full px-3 py-2 text-sm text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-[#ff0a45]/60'

const buttonClass =
  'neon-glass px-4 py-2 text-sm font-semibold text-white cursor-pointer hover:bg-[#ff0a45]/20'

function sanitizeLeadInput(form: any) {
  const clean = {
    type: String(form.type ?? "").trim(),
    address: String(form.address ?? "").trim(),
    city: String(form.city ?? "").trim(),
    state: String(form.state ?? "").trim().toUpperCase(),
    zip: String(form.zip ?? "").trim(),
  };

  // Basic ZIP cleanup
  clean.zip = clean.zip.replace(/[^\d]/g, ""); // remove non-numbers

  return clean;
}

function validateLead(form: any): string | null {
  if (!form.address) return "Address is required";
  if (!form.city) return "City is required";
  if (!form.state || form.state.length !== 2)
    return "State must be a 2-letter abbreviation";
  if (!/^\d{5}$/.test(form.zip))
    return "ZIP code must be 5 digits";

  return null; // no errors
}

// Helper: Strip non-digits from phone for matching
function normalizePhone(str: string | null | undefined): string {
  if (!str) return ''
  return str.replace(/\D/g, '')
}

export default function LeadsPage() {
  const [items, setItems] = useState<Lead[]>([])
  const [form, setForm] = useState(defaultLead)
  const [error, setError] = useState<string | null>(null)
  const [editingLead, setEditingLead] = useState<Lead | null>(null)
  const [deletingLead, setDeletingLead] = useState<Lead | null>(null)
  const [isSourceModalOpen, setSourceModalOpen] = useState(false)
  const [pendingLeadData, setPendingLeadData] = useState<any>(null)
  // Bulk delete modal state
  const [isBulkConfirmOpen, setIsBulkConfirmOpen] = useState(false)
  const [bulkCountSnapshot, setBulkCountSnapshot] = useState(0)
  const [isBulkDeleting, setIsBulkDeleting] = useState(false)
  // Selection state: tracks IDs of currently visible rows only
  // "Select all" selects all items in the current items array (not global)
  // Selection is pruned on refresh() to remove IDs that no longer exist
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [searchQuery, setSearchQuery] = useState<string>('')
  const headerCheckboxRef = useRef<HTMLInputElement | null>(null)
  const { notify } = useToast()
  const queryClient = useQueryClient()

  // Derive filtered leads from search query
  const visibleLeads = useMemo(() => {
    if (!searchQuery.trim()) return items
    
    const query = searchQuery.toLowerCase().trim()
    const queryDigits = normalizePhone(query)
    
    return items.filter(lead => {
      // Match address (case-insensitive contains)
      if (lead.address?.toLowerCase().includes(query)) return true
      
      // Match homeowner name (case-insensitive contains)
      if (lead.homeownerName?.toLowerCase().includes(query)) return true
      
      // Match phone (digits-only contains)
      if (queryDigits && normalizePhone(lead.phoneNumber).includes(queryDigits)) return true
      
      return false
    })
  }, [items, searchQuery])

  // Derive visible lead IDs
  const visibleLeadIds = useMemo(() => {
    return new Set(visibleLeads.map(l => l.id))
  }, [visibleLeads])

  // Computed selection state
  const selectedCount = selectedIds.size
  const maxBulk = 100
  const allVisibleSelected = visibleLeads.length > 0 && visibleLeads.every(l => selectedIds.has(l.id))
  const someVisibleSelected = visibleLeads.some(l => selectedIds.has(l.id)) && !allVisibleSelected
  const overLimit = selectedCount > maxBulk
  const headerSelectDisabled = visibleLeads.length === 0 || visibleLeads.length > maxBulk

  // Header checkbox indeterminate state (hardened)
  useEffect(() => {
    if (!headerCheckboxRef.current) return
    headerCheckboxRef.current.indeterminate = someVisibleSelected && !allVisibleSelected
  }, [someVisibleSelected, allVisibleSelected])

  // Quick View state
  const [quickViewOpen, setQuickViewOpen] = useState(false)
  const [quickViewLeadId, setQuickViewLeadId] = useState<string | null>(null)
  const lastQuickViewTriggerRef = useRef<HTMLElement | null>(null)
  const closeBtnRef = useRef<HTMLButtonElement | null>(null)
  const prevBodyOverflowRef = useRef<string>("")
  const prevBodyPaddingRightRef = useRef<string>("")

  // Temperature menu state
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null)
  const menuRef = useRef<HTMLDivElement | null>(null)
  const buttonRef = useRef<HTMLButtonElement | null>(null)
  
  const MENU_WIDTH = 140

  // Import preview detail modal state
  const [previewDetailOpen, setPreviewDetailOpen] = useState(false)
  const [previewDetailRow, setPreviewDetailRow] = useState<LeadImportRow | null>(null)
  const previewDetailAnchorRef = useRef<HTMLElement | null>(null)

  // Import state
  const [importOpen, setImportOpen] = useState(false)
  const [importMode, setImportMode] = useState<'idle' | 'uploading' | 'preview' | 'committing'>('idle')
  const [previewRows, setPreviewRows] = useState<LeadImportRow[]>([])
  const [dragActive, setDragActive] = useState(false)
  const [importMetadata, setImportMetadata] = useState<any>(null)
  const [importWarningMessage, setImportWarningMessage] = useState<string | null>(null)
  const [abandonmentMessageShown, setAbandonmentMessageShown] = useState(false)
  const hasCommittedRef = useRef(false)

  // Import preset state
  const [presetApplied, setPresetApplied] = useState(false)
  const [mappingEditorOpen, setMappingEditorOpen] = useState(false)
  const [editingMapping, setEditingMapping] = useState<ImportMapping>({})
  const [currentFile, setCurrentFile] = useState<File | null>(null)
  const [sessionDisabledPresets, setSessionDisabledPresets] = useState<Set<string>>(new Set())
  const [mappingChanged, setMappingChanged] = useState(false)
  const restoredFromSession = useRef(false)

  // Import preview persistence (sessionStorage)
  const IMPORT_PREVIEW_KEY = 'leadImportPreview_v1'
  const IMPORT_PREVIEW_MAX_SIZE = 4_000_000 // ~4MB
  const IMPORT_PREVIEW_TTL = 4 * 60 * 60 * 1000 // 4 hours

  // Persist import preview to sessionStorage
  function safePersistImportPreview() {
    // Only persist when in preview mode with rows
    if (importMode !== 'preview' || previewRows.length === 0) {
      sessionStorage.removeItem(IMPORT_PREVIEW_KEY)
      return
    }

    try {
      const payload = {
        v: 1,
        t: Date.now(),
        importMode,
        previewRows,
        importMetadata,
        presetApplied,
      }

      const serialized = JSON.stringify(payload)

      // Guard against storage quota
      if (serialized.length > IMPORT_PREVIEW_MAX_SIZE) {
        console.warn('[Import] Preview too large to persist (~' + Math.round(serialized.length / 1024 / 1024) + 'MB), skipping')
        return
      }

      sessionStorage.setItem(IMPORT_PREVIEW_KEY, serialized)
    } catch (err) {
      console.warn('[Import] Failed to persist preview:', err)
    }
  }

  // Restore import preview from sessionStorage
  function safeRestoreImportPreview() {
    try {
      const raw = sessionStorage.getItem(IMPORT_PREVIEW_KEY)
      if (!raw) return

      const payload = JSON.parse(raw)

      // Version check
      if (payload.v !== 1) {
        sessionStorage.removeItem(IMPORT_PREVIEW_KEY)
        return
      }

      // TTL check
      const age = Date.now() - payload.t
      if (age > IMPORT_PREVIEW_TTL) {
        sessionStorage.removeItem(IMPORT_PREVIEW_KEY)
        return
      }

      // Restore state
      if (payload.previewRows && Array.isArray(payload.previewRows) && payload.previewRows.length > 0) {
        restoredFromSession.current = true // Mark as restored to prevent auto-apply
        setPreviewRows(payload.previewRows)
        setImportMetadata(payload.importMetadata || null)
        setImportMode(payload.importMode || 'preview')
        setImportOpen(true) // Auto-open import UI
        // Restore preset applied state if it was saved
        setPresetApplied(payload.presetApplied ?? false)
      } else {
        sessionStorage.removeItem(IMPORT_PREVIEW_KEY)
      }
    } catch (err) {
      console.warn('[Import] Failed to restore preview:', err)
      sessionStorage.removeItem(IMPORT_PREVIEW_KEY)
    }
  }

  // Minimal observability hook (placeholder for future)
  function trackImportEvent(event: string, payload: {
    rowsTotal?: number
    inserted?: number
    skipped?: number
    failed?: number
  }) {
    if (process.env.NODE_ENV !== 'production') return
    // placeholder for future observability (no-op for now)
  }

  // Deterministic import session reset
  function resetImportSession() {
    setPreviewRows([])
    setImportMetadata(null)
    setImportWarningMessage(null)
    setDragActive(false)
    setImportMode('idle')
    hasCommittedRef.current = false
    setAbandonmentMessageShown(false)

    // Reset preset state
    setPresetApplied(false)
    setMappingEditorOpen(false)
    setEditingMapping({})
    setCurrentFile(null)
    setMappingChanged(false)
    restoredFromSession.current = false

    // Clear persisted preview
    sessionStorage.removeItem(IMPORT_PREVIEW_KEY)
  }

  async function refresh() {
    setError(null)
    try {
      const res = await get<{ items: any[] }>('/leads')
      // Normalize milestone fields: ensure assignmentFee is string | null (Decimal from DB may be string)
      const normalizedItems: Lead[] = res.items.map((item: any) => ({
        ...item,
        assignmentFee: item.assignmentFee == null ? null : String(item.assignmentFee),
        // Milestone timestamps: ensure null stays null, strings stay strings (already ISO format)
        underContractAt: item.underContractAt ?? null,
        assignedAt: item.assignedAt ?? null,
        escrowOpenedAt: item.escrowOpenedAt ?? null,
        closedAt: item.closedAt ?? null,
        cancelledAt: item.cancelledAt ?? null,
        buyerName: item.buyerName ?? null,
      }))
      setItems(normalizedItems)
      // Prune selection to only IDs that still exist
      setSelectedIds(prev => {
        const validIds = new Set(res.items.map(l => l.id))
        return new Set(Array.from(prev).filter(id => validIds.has(id)))
      })
    } catch (e: any) {
      const msg = e?.error?.message || e?.message || 'Unable to load leads'
      setError(msg)
      notify('error', msg)
    }
  }

  useEffect(() => {
    refresh()
    safeRestoreImportPreview()
  }, [])

  // Quick View: Open panel
  function openQuickView(leadId: string, triggerEl: HTMLElement) {
    setQuickViewLeadId(leadId)
    setQuickViewOpen(true)
    lastQuickViewTriggerRef.current = triggerEl

    // Lock scroll and prevent layout shift
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth
    prevBodyOverflowRef.current = document.body.style.overflow
    prevBodyPaddingRightRef.current = document.body.style.paddingRight
    document.body.style.overflow = 'hidden'
    document.body.style.paddingRight = `${scrollbarWidth}px`

    // Focus close button after render (prevent auto-scroll)
    setTimeout(() => {
      safeFocus(closeBtnRef.current)
    }, 0)
  }

  // Quick View: Close panel
  function closeQuickView() {
    setQuickViewOpen(false)
    setQuickViewLeadId(null)

    // Restore scroll
    document.body.style.overflow = prevBodyOverflowRef.current
    document.body.style.paddingRight = prevBodyPaddingRightRef.current

    // Restore focus to trigger (prevent auto-scroll to avoid rubber-band effect)
    if (lastQuickViewTriggerRef.current) {
      safeFocus(lastQuickViewTriggerRef.current)
      lastQuickViewTriggerRef.current = null
    }
  }

  // Preview Detail: Open modal for import preview row
  function openPreviewDetail(row: LeadImportRow, anchorEl: HTMLElement) {
    setPreviewDetailRow(row)
    setPreviewDetailOpen(true)
    previewDetailAnchorRef.current = anchorEl
  }

  // Preview Detail: Close modal
  function closePreviewDetail() {
    setPreviewDetailOpen(false)
    setPreviewDetailRow(null)

    // Restore focus to trigger
    if (previewDetailAnchorRef.current) {
      safeFocus(previewDetailAnchorRef.current)
      previewDetailAnchorRef.current = null
    }
  }

  // Quick View: ESC handler (only close if no Edit/Delete modal is open)
  useEffect(() => {
    function handleEsc(e: KeyboardEvent) {
      if (e.key === 'Escape' && quickViewOpen && !editingLead && !deletingLead) {
        closeQuickView()
      }
    }
    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [quickViewOpen, editingLead, deletingLead])

  // Preview Detail: ESC handler
  useEffect(() => {
    function handleEsc(e: KeyboardEvent) {
      if (e.key === 'Escape' && previewDetailOpen) {
        closePreviewDetail()
      }
    }
    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [previewDetailOpen])

  // Quick View: Auto-close if selected lead is deleted/refreshed away
  useEffect(() => {
    if (quickViewOpen && quickViewLeadId) {
      const exists = items.find((l) => l.id === quickViewLeadId)
      if (!exists) {
        closeQuickView()
      }
    }
  }, [items, quickViewOpen, quickViewLeadId])

  // Temperature menu: Close on outside click, Escape, or scroll
  useEffect(() => {
    if (openMenuId === null) return

    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node
      if (
        menuRef.current &&
        !menuRef.current.contains(target) &&
        buttonRef.current &&
        !buttonRef.current.contains(target)
      ) {
        setOpenMenuId(null)
        setMenuPosition(null)
      }
    }

    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setOpenMenuId(null)
        setMenuPosition(null)
      }
    }

    function handleScroll() {
      setOpenMenuId(null)
      setMenuPosition(null)
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)
    window.addEventListener('scroll', handleScroll, true)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
      window.removeEventListener('scroll', handleScroll, true)
    }
  }, [openMenuId])

  // Import preview: Auto-save to sessionStorage
  useEffect(() => {
    safePersistImportPreview()
  }, [importMode, previewRows, importMetadata, presetApplied])

  // Derive selected lead from items (never stale)
  const quickViewLead = quickViewLeadId ? items.find((l) => l.id === quickViewLeadId) : null

  async function handleCreateLeadClick(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const clean = sanitizeLeadInput(form);
    const validationError = validateLead(clean);

    if (validationError) {
      notify("error", validationError);
      setError(validationError);
      return;
    }

    // Store pending lead data and open source modal
    setPendingLeadData(clean);
    setSourceModalOpen(true);
  }

  async function handleSourceSubmit(source: string) {
    setSourceModalOpen(false);

    const finalPayload = {
      ...pendingLeadData,
      source,
    };

    try {
      await post("/leads", finalPayload);
      notify("success", "Lead created");

      await refresh();
      queryClient.invalidateQueries({ queryKey: ["lead-sources"] });

      queryClient.invalidateQueries({ queryKey: ["kpis-summary"], refetchType: "none" });
      try {
        await queryClient.cancelQueries({ queryKey: ["kpis-summary"] });
        await queryClient.fetchQuery({
          queryKey: ["kpis-summary"],
          queryFn: () => get("/api/kpis"),
        });
      } catch (e) {
        if (import.meta.env.DEV) console.warn("[KPI] fetchQuery failed", e);
        // swallow: KPI will refetch on next mount/focus anyway
      }

      setForm(defaultLead);
      setPendingLeadData(null);
    } catch (e: any) {
      const msg = e?.error?.message || e?.message || "Unable to create lead";
      setError(msg);
      notify("error", msg);
    }
  }

  function setField<K extends keyof typeof form>(key: K, value: string) {
    let cleaned = value;

    // Real-time sanitization rules
    if (key === "state") cleaned = value.toUpperCase().slice(0, 2);
    if (key === "zip") cleaned = value.replace(/[^\d]/g, "").slice(0, 5);

    setForm({ ...form, [key]: cleaned });
  }

  async function handleSaveLead(updated: Lead) {
    try {
      // Whitelist payload: only send fields that can be updated
      // Core lead fields
      const payload: any = {
        type: updated.type,
        address: updated.address,
        city: updated.city,
        state: updated.state,
        zip: updated.zip,
      };

      // Temperature (if present)
      if (updated.temperature !== undefined) {
        payload.temperature = updated.temperature;
      }

      // Milestone fields (if present)
      // All timestamps are ISO strings | null (consistent with DB storage)
      if (updated.underContractAt !== undefined) {
        payload.underContractAt = updated.underContractAt;
      }
      if (updated.assignedAt !== undefined) {
        payload.assignedAt = updated.assignedAt;
      }
      if (updated.escrowOpenedAt !== undefined) {
        payload.escrowOpenedAt = updated.escrowOpenedAt;
      }
      if (updated.closedAt !== undefined) {
        payload.closedAt = updated.closedAt;
      }
      if (updated.cancelledAt !== undefined) {
        payload.cancelledAt = updated.cancelledAt;
      }
      if (updated.buyerName !== undefined) {
        payload.buyerName = updated.buyerName;
      }
      if (updated.assignmentFee !== undefined) {
        // assignmentFee: send as string | null (matches DB Decimal type)
        // Server accepts both number and string; we send string for consistency
        payload.assignmentFee = updated.assignmentFee === null ? null : String(updated.assignmentFee);
      }

      await patch(`/leads/${updated.id}`, payload);
      setEditingLead(null);
      notify("success", "Lead updated");
      await refresh();
      // Only invalidate lead-sources if source field was actually edited
      if (updated.source !== undefined) {
        queryClient.invalidateQueries({ queryKey: ["lead-sources"] });
      }
      // Always invalidate KPIs since milestones affect assignmentsMTD and inEscrow
      queryClient.invalidateQueries({ queryKey: ["kpis-summary"] });
    } catch (e: any) {
      const msg = e?.error?.message || e?.message || "Unable to update lead";
      if (msg.includes("buyerName is required")) {
        notify("error", "Buyer name is required when lead is assigned");
      } else {
        notify("error", msg);
      }
    }
  }

  async function handleDeleteLead(lead: Lead) {
    try {
      await del(`/leads/${lead.id}`);
      setDeletingLead(null);
      notify("success", "Lead deleted");
      await refresh();
      // Invalidate caches to keep dashboard in sync
      await queryClient.invalidateQueries({ queryKey: ["kpis-summary"] });
      await queryClient.invalidateQueries({ queryKey: ["lead-sources"] });
    } catch (e: any) {
      const msg = e?.error?.message || e?.message || "Unable to delete lead";
      notify("error", msg);
    }
  }

  async function handleBulkDeleteConfirm() {
    const idsArray = Array.from(selectedIds);
    
    // Defensive guards
    if (idsArray.length === 0) {
      return;
    }
    
    if (idsArray.length > 100) {
      notify("error", "Bulk delete limited to 100 leads");
      return;
    }

    setIsBulkDeleting(true);
    try {
      const res = await post<{ success: boolean; deletedCount: number; items: Lead[] }>(
        "/leads/bulk-delete",
        { ids: idsArray }
      );

      if (res.success) {
        // Success: update UI, clear selection, close modal, refresh, invalidate caches
        setItems(res.items);  // Fast UI update
        setSelectedIds(new Set());
        setBulkCountSnapshot(0);
        setIsBulkConfirmOpen(false);
        
        // Authoritative refresh
        await refresh();
        
        // Invalidate caches to keep dashboard in sync
        await queryClient.invalidateQueries({ queryKey: ["kpis-summary"] });
        await queryClient.invalidateQueries({ queryKey: ["lead-sources"] });
        
        notify("success", `Deleted ${res.deletedCount} lead(s)`);
      } else {
        throw new Error("Bulk delete failed");
      }
    } catch (e: any) {
      // Error: keep selection, keep modal open, show error toast
      const msg = e?.error?.message || e?.message || "Unable to delete leads";
      notify("error", msg);
    } finally {
      setIsBulkDeleting(false);
    }
  }

  async function handleTemperatureChange(leadId: string, temperature: 'cold' | 'warm' | 'hot') {
    const prevItems = [...items]
    
    // Optimistic update
    setItems(items.map(l => 
      l.id === leadId ? { ...l, temperature } : l
    ))
    setOpenMenuId(null)

    try {
      await patch(`/leads/${leadId}`, { temperature })
      notify("success", "Temperature updated")
    } catch (e: any) {
      // Revert on error
      setItems(prevItems)
      const msg = e?.error?.message || e?.message || "Unable to update temperature"
      notify("error", msg)
    }
  }

  // Selection handlers
  const toggleRowSelected = (id: string, checked: boolean) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (checked) {
        next.add(id)
      } else {
        next.delete(id)
      }
      return next
    })
  }

  const toggleSelectAllVisible = (checked: boolean) => {
    if (!checked) {
      // Unselect all visible leads (keep non-visible selections intact)
      setSelectedIds(prev => {
        const next = new Set(prev)
        visibleLeadIds.forEach(id => next.delete(id))
        return next
      })
      return
    }
    
    // Select all visible leads (up to maxBulk limit)
    if (visibleLeads.length > maxBulk) return // Safety: header should be disabled anyway
    
    setSelectedIds(prev => {
      const next = new Set(prev)
      visibleLeads.forEach(l => next.add(l.id))
      return next
    })
  }

  // Import handlers
  function validateFile(file: File): string | null {
    const validTypes = ['.xlsx', '.xls', '.csv'];
    const extension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
    
    if (!validTypes.includes(extension)) {
      return 'Invalid file type. Please upload .xlsx, .xls, or .csv';
    }
    
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      return 'File too large. Maximum size is 10MB';
    }
    
    return null;
  }

  // Helper to upload file with optional mapping
  async function uploadFileWithMapping(file: File, mapping?: ImportMapping): Promise<{
    data: any
    rows: LeadImportRow[]
  } | null> {
    const formData = new FormData();
    formData.append('file', file);
    if (mapping) {
      formData.append('mapping', JSON.stringify(mapping));
    }

    const response = await fetch('/api/leads-import', {
      method: 'POST',
      body: formData,
      headers: {
        'x-dev-user-id': 'user_dev',
        'x-dev-user-email': 'dev@example.com',
        'x-dev-org-id': 'org_dev',
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Upload failed' }));
      throw new Error(error.error || 'Upload failed');
    }

    const data = await response.json();
    const rows: LeadImportRow[] = (data.preview || []).map((r: any, idx: number) => ({
      ...r,
      _rowIndex: idx,
      _errors: r._errors || [],
      _warnings: r._warnings || [],
    }));

    return { data, rows };
  }

  async function handleFileUpload(file: File) {
    const validationError = validateFile(file);
    if (validationError) {
      notify('error', validationError);
      return;
    }

    setImportMode('uploading');
    setCurrentFile(file);
    setPresetApplied(false);
    setMappingChanged(false);

    try {
      // Initial upload without mapping
      const result = await uploadFileWithMapping(file);
      if (!result) {
        throw new Error('Upload failed');
      }

      const { data, rows } = result;
      const fingerprint = data.sourceFingerprint as string | undefined;

      // Check for preset auto-apply (only on fresh uploads, not restored sessions)
      if (fingerprint && !restoredFromSession.current && !sessionDisabledPresets.has(fingerprint)) {
        const preset = getPresetForFingerprint(fingerprint);
        if (preset) {
          // Re-upload with preset mapping
          try {
            const presetResult = await uploadFileWithMapping(file, preset.mapping);
            if (presetResult) {
              const validRows = presetResult.rows.filter(r => !r._errors || r._errors.length === 0).length;

              if (validRows === 0) {
                // Preset resulted in 0 valid rows - disable and use original
                setSessionDisabledPresets(prev => new Set([...prev, fingerprint]));
                setImportWarningMessage('Saved mapping resulted in 0 valid rows. Using default mapping instead.');
                setImportMetadata(data);
                setPreviewRows(rows);
                setPresetApplied(false);
              } else {
                // Preset worked - use preset result
                setImportMetadata(presetResult.data);
                setImportWarningMessage(presetResult.data.warningMessage || null);
                setPreviewRows(presetResult.rows);
                setPresetApplied(true);
                setEditingMapping(preset.mapping);
              }
            } else {
              // Preset upload failed - use original
              setImportMetadata(data);
              setImportWarningMessage(data.warningMessage || null);
              setPreviewRows(rows);
            }
          } catch {
            // Preset upload failed - use original
            setImportMetadata(data);
            setImportWarningMessage(data.warningMessage || null);
            setPreviewRows(rows);
          }
        } else {
          // No preset - use original
          setImportMetadata(data);
          setImportWarningMessage(data.warningMessage || null);
          setPreviewRows(rows);
        }
      } else {
        // No fingerprint or restored session - use original
        setImportMetadata(data);
        setImportWarningMessage(data.warningMessage || null);
        setPreviewRows(rows);
      }

      setImportMode('preview');
      trackImportEvent('import_preview_loaded', {
        rowsTotal: rows.length,
        validRows: data.validRows || 0,
        invalidRows: data.invalidRows || 0,
      });
    } catch (e: any) {
      notify('error', 'We couldn\'t read your file. Please check the format and try again.');
      resetImportSession();
    }
  }

  // Apply custom mapping to current file
  async function handleApplyMapping(mapping: ImportMapping) {
    if (!currentFile) return;

    setImportMode('uploading');

    try {
      const result = await uploadFileWithMapping(currentFile, mapping);
      if (!result) {
        throw new Error('Upload failed');
      }

      const { data, rows } = result;
      setImportMetadata(data);
      setImportWarningMessage(data.warningMessage || null);
      setPreviewRows(rows);
      setEditingMapping(mapping);
      setMappingChanged(true);
      setPresetApplied(false); // No longer using saved preset
      setImportMode('preview');
      setMappingEditorOpen(false);
    } catch (e: any) {
      notify('error', 'Failed to apply mapping. Please try again.');
      setImportMode('preview');
    }
  }

  // Reset to server default mapping
  async function handleResetMapping() {
    if (!currentFile) return;

    setImportMode('uploading');

    try {
      const result = await uploadFileWithMapping(currentFile);
      if (!result) {
        throw new Error('Upload failed');
      }

      const { data, rows } = result;
      setImportMetadata(data);
      setImportWarningMessage(data.warningMessage || null);
      setPreviewRows(rows);
      setEditingMapping({});
      setMappingChanged(false);
      setPresetApplied(false);
      setImportMode('preview');
    } catch (e: any) {
      notify('error', 'Failed to reset mapping. Please try again.');
      setImportMode('preview');
    }
  }

  // Save current mapping as preset
  function handleSavePreset() {
    const fingerprint = importMetadata?.sourceFingerprint as string | undefined;
    if (!fingerprint) {
      notify('error', 'Cannot save preset: no file fingerprint');
      return;
    }

    const validHeaders = getValidHeaders();
    const isSingleColumn = validHeaders.length === 1 && ((importMetadata?.validRows ?? 0) === 0 || !!importMetadata?.warningMessage);

    let mapping: ImportMapping = { ...editingMapping };

    if (isSingleColumn) {
      mapping = {
        addressKey: editingMapping.addressKey,
        notesKey: editingMapping.notesKey,
        defaultCity: editingMapping.defaultCity,
        defaultState: editingMapping.defaultState,
        splitRule: editingMapping.splitRule,
      };
    } else if (Object.keys(mapping).length === 0 && importMetadata?.columnMapping) {
      const cm = importMetadata.columnMapping as Record<string, string>;
      Object.entries(cm).forEach(([field, header]) => {
        if (field === 'address') mapping.addressKey = header;
        if (field === 'city') mapping.cityKey = header;
        if (field === 'state') mapping.stateKey = header;
        if (field === 'zip') mapping.zipKey = header;
        if (field === 'ownerName') mapping.ownerKey = header;
        if (field === 'phone') mapping.phoneKey = header;
        if (field === 'notes') mapping.notesKey = header;
      });
    }

    savePresetToStorage(fingerprint, mapping);
    setPresetApplied(true);
    setMappingChanged(false);
    notify('success', 'Mapping preset saved');
  }

  // Delete preset for current file
  function handleDeletePreset() {
    const fingerprint = importMetadata?.sourceFingerprint as string | undefined;
    if (!fingerprint) return;

    deletePresetFromStorage(fingerprint);
    setPresetApplied(false);
    notify('success', 'Mapping preset deleted');
  }

  // --- Mapping editor helpers (no exports) ---
  function getValidHeaders(): string[] {
    const headers = (importMetadata?.headers as string[] | undefined) ?? [];
    return headers.filter(h => h && !h.startsWith('__EMPTY') && !/^_\d+$/.test(h));
  }

  function getSingleHeader(): string | null {
    const valid = getValidHeaders();
    return valid.length === 1 ? valid[0] : null;
  }

  function looksLikeDataHeader(h: string): boolean {
    return /\d/.test(h) && /\s/.test(h);
  }

  function getHeaderDisplayLabel(header: string, isSingleColumnMode: boolean): string {
    if (isSingleColumnMode && looksLikeDataHeader(header)) return 'Column 1';
    return header.length > 28 ? header.slice(0, 28) + '…' : header;
  }

  function getSample(header: string): string {
    const samples = importMetadata?.headerSamples as Record<string, string> | undefined;
    return samples?.[header] ?? '';
  }

  function getMappingDuplicates(mapping: ImportMapping): string[] {
    const keys = ['addressKey', 'cityKey', 'stateKey', 'zipKey', 'ownerKey', 'phoneKey', 'notesKey'] as const;
    const values: string[] = [];
    keys.forEach(k => {
      const v = (mapping as Record<string, string | undefined>)[k];
      if (v && v.trim()) values.push(v);
    });
    const seen = new Set<string>();
    const duplicates = new Set<string>();
    values.forEach(v => {
      if (seen.has(v)) duplicates.add(v);
      else seen.add(v);
    });
    return Array.from(duplicates);
  }

  function useColumnOnlyForAddress() {
    setEditingMapping(prev => ({
      addressKey: prev.addressKey,
      defaultCity: prev.defaultCity,
      defaultState: prev.defaultState,
      cityKey: undefined,
      stateKey: undefined,
      zipKey: undefined,
      ownerKey: undefined,
      phoneKey: undefined,
      notesKey: undefined,
    }));
  }

  // Open mapping editor with current mapping
  function openMappingEditor() {
    const validHeaders = getValidHeaders();
    const singleHeader = getSingleHeader();
    const isSingleColumn = validHeaders.length === 1 && ((importMetadata?.validRows ?? 0) === 0 || !!importMetadata?.warningMessage);

    if (isSingleColumn && singleHeader) {
      // Single-column mode: initialize to address-only, preserve defaults
      setEditingMapping({
        addressKey: singleHeader,
        defaultCity: editingMapping.defaultCity,
        defaultState: editingMapping.defaultState,
        cityKey: undefined,
        stateKey: undefined,
        zipKey: undefined,
        ownerKey: undefined,
        phoneKey: undefined,
        notesKey: undefined,
        splitRule: editingMapping.splitRule,
      });
    } else if (Object.keys(editingMapping).length === 0 && importMetadata?.columnMapping) {
      const cm = importMetadata.columnMapping as Record<string, string>;
      const initial: ImportMapping = {};
      Object.entries(cm).forEach(([field, header]) => {
        if (field === 'address') initial.addressKey = header;
        if (field === 'city') initial.cityKey = header;
        if (field === 'state') initial.stateKey = header;
        if (field === 'zip') initial.zipKey = header;
        if (field === 'ownerName') initial.ownerKey = header;
        if (field === 'phone') initial.phoneKey = header;
        if (field === 'notes') initial.notesKey = header;
      });
      setEditingMapping(initial);
    }
    setMappingEditorOpen(true);
  }

  function applySingleColumnMapping(singleHeader: string, useAddressAndNotes: boolean) {
    const newMapping: ImportMapping = {
      addressKey: singleHeader,
      defaultCity: editingMapping.defaultCity,
      defaultState: editingMapping.defaultState,
      cityKey: undefined,
      stateKey: undefined,
      zipKey: undefined,
      ownerKey: undefined,
      phoneKey: undefined,
    };
    if (useAddressAndNotes) {
      newMapping.notesKey = singleHeader;
      newMapping.splitRule = 'address_dash_notes';
    } else {
      newMapping.notesKey = undefined;
      newMapping.splitRule = undefined;
    }
    handleApplyMapping(newMapping);
  }

  function handleDragOver(e: React.DragEvent) {
    if (importMode === 'uploading') return;
    e.preventDefault();
    e.stopPropagation();
    setDragActive(true);
  }

  function handleDragLeave(e: React.DragEvent) {
    if (importMode === 'uploading') return;
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  }

  function handleDrop(e: React.DragEvent) {
    if (importMode === 'uploading') return;
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFileUpload(file);
    }
  }

  function handleFileInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      handleFileUpload(file);
    }
  }

  async function handleConfirmImport() {
    if (previewRows.length === 0) return;

    // Hard prevent double-submit
    if (hasCommittedRef.current === true) return;
    hasCommittedRef.current = true;

    setImportMode('committing');

    try {
      const response = await post<{
        inserted: number
        failed: number
        skipped: number
        errors: Array<{ rowIndex: number; errors: string[] }>
        skippedRows: Array<{ rowIndex: number; reason: string; address?: string }>
      }>('/leads-import/commit', { leads: previewRows });

      const { inserted, failed, skipped } = response;

      if (inserted === 0 && failed === 0 && skipped > 0) {
        notify('success', 'Nothing new imported — all rows were duplicates (already in your CRM).');
        trackImportEvent('import_committed_success', { rowsTotal: previewRows.length, inserted: 0 });
      } else if (inserted === 0) {
        notify('error', 'No leads were imported. Please check your file and try again.');
        trackImportEvent('import_failed', { rowsTotal: previewRows.length });
        setImportMode('preview');
        hasCommittedRef.current = false;
        return;
      } else {
        let message = `Import complete. Your leads are now in the table below.`;
        if (skipped > 0 || failed > 0) {
          message = `Import complete. ${inserted} lead${inserted !== 1 ? 's' : ''} ${inserted === 1 ? 'is' : 'are'} now in the table below.`;
        }
        notify('success', message);
      }
      
      if (inserted > 0 && failed === 0 && skipped === 0) {
        trackImportEvent('import_committed_success', { rowsTotal: previewRows.length, inserted });
      } else {
        trackImportEvent('import_committed_partial', { rowsTotal: previewRows.length, inserted, skipped, failed });
      }
      
      await refresh();
      queryClient.invalidateQueries({ queryKey: ["lead-sources"] });
      
      queryClient.invalidateQueries({ queryKey: ["kpis-summary"], refetchType: "none" });
      try {
        await queryClient.cancelQueries({ queryKey: ["kpis-summary"] });
        await queryClient.fetchQuery({
          queryKey: ["kpis-summary"],
          queryFn: () => get("/api/kpis"),
        });
      } catch (e) {
        if (import.meta.env.DEV) console.warn("[KPI] fetchQuery failed", e);
        // swallow: KPI will refetch on next mount/focus anyway
      }

      resetImportSession();
      setImportOpen(false);
    } catch (e: any) {
      // Detect row-limit errors
      const errorMessage = e?.error?.message || e?.message || '';
      if (errorMessage.includes('1000') || errorMessage.includes('Too many leads')) {
        notify('error', 'This file has more than 1,000 rows. Please split it into smaller files.');
      } else {
        notify('error', 'We couldn\'t finish the import. Your file wasn\'t changed. You can try again.');
      }
      trackImportEvent('import_failed', { rowsTotal: previewRows.length });
      resetImportSession();
    }
  }

  function handleCancelImport() {
    // Check if preview rows exist before resetting (abandonment safety)
    if (previewRows.length > 0) {
      setAbandonmentMessageShown(true);
    }
    resetImportSession();
    setImportOpen(false);
  }

  function getRowStatus(row: LeadImportRow): 'valid' | 'warning' | 'error' {
    if (row._errors && row._errors.length > 0) return 'error';
    if (row._warnings && row._warnings.length > 0) return 'warning';
    return 'valid';
  }

  function getImportSummary() {
    const valid = previewRows.filter(r => getRowStatus(r) === 'valid').length;
    const warnings = previewRows.filter(r => getRowStatus(r) === 'warning').length;
    const invalid = previewRows.filter(r => getRowStatus(r) === 'error').length;
    return { valid, warnings, invalid };
  }

  function hasValidRows(): boolean {
    if (previewRows.length === 0) return false;
    return previewRows.some(r => getRowStatus(r) !== 'error');
  }

  // Helper: Normalize display data for Quick View (works for both Lead and LeadImportRow)
  function getQuickViewDisplayData(): {
    address: string
    city: string
    state: string
    zip: string
    type: string
    updatedAt?: string
    isPreview: boolean
    validationStatus?: 'valid' | 'warning' | 'error'
    validationErrors?: string[]
    validationWarnings?: string[]
  } | null {
    // Preview mode: use previewDetailRow
    if (previewDetailOpen && previewDetailRow) {
      return {
        address: previewDetailRow.address || 'No address',
        city: previewDetailRow.city || '—',
        state: previewDetailRow.state || '—',
        zip: previewDetailRow.zip || '—',
        type: previewDetailRow.type || 'sfr',
        isPreview: true,
        validationStatus: getRowStatus(previewDetailRow),
        validationErrors: previewDetailRow._errors,
        validationWarnings: previewDetailRow._warnings,
      }
    }
    // Real lead mode: use quickViewLeadId
    if (quickViewOpen && quickViewLeadId) {
      const lead = items.find((l) => l.id === quickViewLeadId)
      if (!lead) return null
      return {
        address: lead.address,
        city: lead.city,
        state: lead.state,
        zip: lead.zip,
        type: lead.type,
        updatedAt: lead.updatedAt,
        isPreview: false,
      }
    }
    return null
  }

  // Virtualization constants
  const PREVIEW_HEIGHT = 400;
  const ROW_HEIGHT = 40;

  const PreviewRow = (props: RowComponentProps<{ rows: LeadImportRow[] }>) => {
    const { index, style, rows } = props;
    const row = rows?.[index];
    if (!row) return null;
    
    const status = getRowStatus(row);
    
    return (
      <div
        style={style}
        onClick={(e) => openPreviewDetail(row, e.currentTarget)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            openPreviewDetail(row, e.currentTarget)
          }
        }}
        tabIndex={0}
        role="button"
        aria-label={`View details for ${row.address || 'row'}`}
        className={`grid grid-cols-[60px_1fr_1fr_80px_100px_1fr] gap-3 px-3 py-2 border-t border-white/5 text-xs cursor-pointer hover:bg-white/5 transition-colors ${
          status === 'error'
            ? 'bg-red-500/10'
            : status === 'warning'
            ? 'bg-yellow-500/10'
            : ''
        }`}
      >
        <div className="flex items-center">
          {status === 'valid' && <span className="text-green-400">✅</span>}
          {status === 'warning' && <span className="text-yellow-400">⚠️</span>}
          {status === 'error' && <span className="text-red-400">❌</span>}
        </div>
        <div className="text-white truncate">{row.address || '—'}</div>
        <div className="text-white truncate">{row.city || '—'}</div>
        <div className="text-white">{row.state || '—'}</div>
        <div className="text-white">{row.zip || '—'}</div>
        <div className="text-white/60 text-xs">
          {row._errors && row._errors.length > 0 && (
            <div className="text-red-400 truncate">
              {row._errors.join(', ')}
            </div>
          )}
          {row._warnings && row._warnings.length > 0 && (
            <div className="text-yellow-400 truncate">
              {row._warnings.join(', ')}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <BackToDashboard />
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
          Pipeline
        </p>
        <h1 className="text-3xl font-semibold text-white">Leads</h1>
        <p className="text-sm text-slate-400">
          Create deals, import lists, and watch the board light up.
        </p>
      </header>

      <form
        onSubmit={handleCreateLeadClick}
        className="neon-glass p-6 md:p-8 grid gap-3 md:grid-cols-6 text-sm"
      >
        <input
          className={inputClass}
          placeholder="Type"
          value={form.type}
          onChange={(e) => setField('type', e.target.value)}
        />
        <input
          className={`${inputClass} md:col-span-2`}
          placeholder="Address"
          value={form.address}
          onChange={(e) => setField('address', e.target.value)}
        />
        <input
          className={inputClass}
          placeholder="City"
          value={form.city}
          onChange={(e) => setField('city', e.target.value)}
        />
        <input
          className={inputClass}
          placeholder="State"
          value={form.state}
          onChange={(e) => setField('state', e.target.value)}
        />
        <input
          className={inputClass}
          placeholder="Zip"
          value={form.zip}
          onChange={(e) => setField('zip', e.target.value)}
        />
        <button
          className={`${buttonClass} md:col-span-6 glass-tile neon-border`}
          type="submit"
        >
          Create lead
        </button>
      </form>

      {error && <p className="text-sm text-rose-400">{error}</p>}

      {/* Import Section */}
      <div className="neon-glass p-6 md:p-8">
        {!importOpen ? (
          <div>
            <button
              onClick={() => {
                setAbandonmentMessageShown(false);
                setImportOpen(true);
              }}
              className="neon-glass px-4 py-2 text-sm font-semibold text-white cursor-pointer hover:bg-[#ff0a45]/20 transition-colors"
            >
              Import leads from file
            </button>
            {abandonmentMessageShown && (
              <p className="text-xs text-white/50 mt-2">
                No leads were imported.
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">Import Leads</h2>
              <button
                onClick={handleCancelImport}
                className="text-sm text-white/60 hover:text-white transition-colors"
                disabled={importMode === 'committing'}
              >
                Cancel
              </button>
            </div>

            {importMode === 'idle' || importMode === 'uploading' ? (
              <div>
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                    importMode === 'uploading'
                      ? 'border-white/10 bg-white/5 opacity-60'
                      : dragActive
                      ? 'border-[#ff0a45] bg-[#ff0a45]/10'
                      : 'border-white/20 hover:border-white/40'
                  }`}
                >
                  <input
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    onChange={handleFileInputChange}
                    className="hidden"
                    id="file-upload"
                    disabled={importMode === 'uploading'}
                  />
                  <label
                    htmlFor="file-upload"
                    className={`block ${importMode === 'uploading' ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                  >
                    {importMode === 'uploading' ? (
                      <p className="text-white/60">Reading file…</p>
                    ) : (
                      <div>
                        <p className="text-white mb-2">
                          Drop or click to upload leads (.xlsx / .xls / .csv)
                        </p>
                        <p className="text-xs text-white/40">
                          Maximum file size: 10MB
                        </p>
                      </div>
                    )}
                  </label>
                </div>
                {importMode === 'idle' && (
                  <p className="text-xs text-white/50 mt-3 text-center">
                    You can upload a county or municipal spreadsheet here. Nothing is imported until you confirm.
                  </p>
                )}
              </div>
            ) : importMode === 'preview' ? (
              <div className="flex flex-col min-h-0 space-y-4">
                {previewRows.length > 0 && (
                  <div className="flex flex-col gap-4">
                    {/* Preset Controls */}
                    <div className="flex items-center justify-between flex-wrap gap-2 border-b border-white/10 pb-3">
                      <div className="flex items-center gap-2">
                        {presetApplied && (
                          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-green-500/20 text-green-400 border border-green-500/30 rounded-full">
                            <span>✓</span> Preset applied
                          </span>
                        )}
                        {mappingChanged && !presetApplied && (
                          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 rounded-full">
                            Mapping modified
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <button
                          onClick={openMappingEditor}
                          className="px-3 py-1 text-xs text-white/70 hover:text-white hover:bg-white/10 rounded transition"
                        >
                          Edit mapping
                        </button>
                        {(mappingChanged || !presetApplied) && importMetadata?.sourceFingerprint && (
                          <button
                            onClick={handleSavePreset}
                            className="px-3 py-1 text-xs text-white/70 hover:text-white hover:bg-white/10 rounded transition"
                          >
                            Save preset
                          </button>
                        )}
                        {presetApplied && (
                          <button
                            onClick={handleDeletePreset}
                            className="px-3 py-1 text-xs text-red-400/70 hover:text-red-400 hover:bg-red-500/10 rounded transition"
                          >
                            Delete preset
                          </button>
                        )}
                        {(presetApplied || mappingChanged) && (
                          <button
                            onClick={handleResetMapping}
                            className="px-3 py-1 text-xs text-white/70 hover:text-white hover:bg-white/10 rounded transition"
                          >
                            Reset mapping
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Column Mapping Summary */}
                    <div className="text-xs text-white/60 border-b border-white/10 pb-2">
                      {importMetadata?.columnMapping ? (
                        <div>
                          We mapped columns from your file like this:
                          <div className="mt-1 space-y-0.5">
                            {Object.entries(importMetadata.columnMapping).map(([fileCol, mappedCol]) => (
                              <div key={fileCol}>
                                {fileCol} → {mappedCol as string}
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div>Columns were auto-detected.</div>
                      )}
                    </div>

                    {/* Preview Summary */}
                    {(() => {
                      const summary = getImportSummary();
                      return (
                        <div className="text-sm text-white/80 space-y-1">
                          {summary.valid > 0 && (
                            <div>
                              <strong>{summary.valid}</strong> lead{summary.valid !== 1 ? 's' : ''} ready to import
                            </div>
                          )}
                          {summary.warnings > 0 && (
                            <div className="text-white/70">
                              <strong>{summary.warnings}</strong> lead{summary.warnings !== 1 ? 's' : ''} have minor issues (they'll still import)
                            </div>
                          )}
                          {summary.invalid > 0 && (
                            <div className="text-white/70">
                              <strong>{summary.invalid}</strong> lead{summary.invalid !== 1 ? 's' : ''} will be skipped
                            </div>
                          )}
                        </div>
                      );
                    })()}

                    {/* Warning message when no valid rows (e.g., single-column file) */}
                    {importWarningMessage && (
                      <div className="mt-3 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg text-yellow-400 text-sm">
                        <div className="flex items-start gap-2">
                          <span className="text-lg">⚠️</span>
                          <div>
                            <div className="font-medium">File format issue detected</div>
                            <div className="text-yellow-400/80 mt-1">{importWarningMessage}</div>
                          </div>
                        </div>
                      </div>
                    )}

                    {(() => {
                      try {
                        return (
                          <div className="border border-white/10 rounded overflow-hidden">
                            {/* Table Header */}
                            <div className="grid grid-cols-[60px_1fr_1fr_80px_100px_1fr] gap-3 px-3 py-2 bg-white dark:bg-[#0a0a0c]/95 backdrop-blur-sm text-black dark:text-white/60 text-xs sticky top-0 z-10 border-b border-gray-200 dark:border-white/10">
                              <div>Validation</div>
                              <div>Address</div>
                              <div>City</div>
                              <div>State</div>
                              <div>Zip</div>
                              <div>Issues</div>
                            </div>
                            <List
                              className="neon-scrollbar"
                              rowComponent={PreviewRow}
                              rowCount={previewRows.length}
                              rowHeight={ROW_HEIGHT}
                              rowProps={{ rows: previewRows }}
                              overscanCount={10}
                              style={{ height: PREVIEW_HEIGHT, width: '100%' }}
                            />
                          </div>
                        );
                      } catch (e) {
                        console.warn('[react-window] Virtualization failed, using fallback:', e);
                      }
                      // Fallback: Non-virtualized table for compatibility
                      return (
                        <div className="overflow-y-auto min-h-0 max-h-[400px] border border-white/10 rounded">
                          <table className="w-full text-left text-xs">
                            <thead className="bg-white dark:bg-[#0a0a0c]/95 backdrop-blur-sm sticky top-0 z-10 border-b border-gray-200 dark:border-white/10">
                              <tr>
                                <th className="px-3 py-2 text-black dark:text-white/60 font-semibold">Validation</th>
                                <th className="px-3 py-2 text-black dark:text-white/60 font-semibold">Address</th>
                                <th className="px-3 py-2 text-black dark:text-white/60 font-semibold">City</th>
                                <th className="px-3 py-2 text-black dark:text-white/60 font-semibold">State</th>
                                <th className="px-3 py-2 text-black dark:text-white/60 font-semibold">Zip</th>
                                <th className="px-3 py-2 text-black dark:text-white/60 font-semibold">Issues</th>
                              </tr>
                            </thead>
                            <tbody>
                              {previewRows.slice(0, 50).map((row, idx) => {
                                const status = getRowStatus(row);
                                return (
                                  <tr
                                    key={idx}
                                    onClick={(e) => openPreviewDetail(row, e.currentTarget)}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter' || e.key === ' ') {
                                        e.preventDefault()
                                        openPreviewDetail(row, e.currentTarget)
                                      }
                                    }}
                                    tabIndex={0}
                                    role="button"
                                    aria-label={`View details for ${row.address || 'row'}`}
                                    className={`border-t border-white/5 cursor-pointer hover:bg-white/5 transition-colors ${
                                      status === 'error'
                                        ? 'bg-red-500/10'
                                        : status === 'warning'
                                        ? 'bg-yellow-500/10'
                                        : ''
                                    }`}
                                  >
                                    <td className="px-3 py-2">
                                      {status === 'valid' && <span className="text-green-400">✅</span>}
                                      {status === 'warning' && <span className="text-yellow-400">⚠️</span>}
                                      {status === 'error' && <span className="text-red-400">❌</span>}
                                    </td>
                                    <td className="px-3 py-2 text-white">{row.address || '—'}</td>
                                    <td className="px-3 py-2 text-white">{row.city || '—'}</td>
                                    <td className="px-3 py-2 text-white">{row.state || '—'}</td>
                                    <td className="px-3 py-2 text-white">{row.zip || '—'}</td>
                                    <td className="px-3 py-2 text-white/60 text-xs">
                                      {row._errors && row._errors.length > 0 && (
                                        <div className="text-red-400">
                                          {row._errors.join(', ')}
                                        </div>
                                      )}
                                      {row._warnings && row._warnings.length > 0 && (
                                        <div className="text-yellow-400">
                                          {row._warnings.join(', ')}
                                        </div>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      );
                    })()}

                    {/* Preview-only field disclosure */}
                    <div className="text-xs text-white/50 border-t border-white/10 pt-2">
                      Some fields are shown for review only and are not stored yet (e.g. assessed value).
                    </div>

                    {/* Reassurance before confirm */}
                    <div className="text-xs text-white/60 pt-1">
                      You'll be able to review and edit leads after import.
                    </div>

                    <div className="flex gap-3">
                      <button
                        onClick={handleConfirmImport}
                        disabled={importMode === 'committing' || !hasValidRows()}
                        className="neon-glass px-4 py-2 text-sm font-semibold text-white cursor-pointer hover:bg-[#ff0a45]/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        title={!hasValidRows() ? 'No valid rows to import.' : undefined}
                      >
                        {importMode === 'committing' ? 'Importing...' : 'Confirm import'}
                      </button>
                      <button
                        onClick={handleCancelImport}
                        disabled={importMode === 'committing'}
                        className="px-4 py-2 text-sm text-white/60 hover:text-white transition-colors disabled:opacity-50"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : null}
          </div>
        )}
      </div>

      {/* Search Bar */}
      <div className="neon-glass p-4">
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by address, homeowner, or phone..."
            className="w-full px-4 py-2 pl-10 text-sm text-white bg-transparent border border-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#ff0a45]/60 placeholder:text-white/40"
          />
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40">
            🔍
          </span>
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-white/60 hover:text-white transition"
              aria-label="Clear search"
            >
              ✕
            </button>
          )}
        </div>
        {searchQuery && (
          <div className="mt-2 text-xs text-white/60">
            Showing {visibleLeads.length} of {items.length} lead{items.length !== 1 ? 's' : ''}
          </div>
        )}
      </div>

      {/* Bulk Actions Toolbar - Always mounted with fixed height to prevent layout shift */}
      <div
        className={`mb-4 min-h-[56px] flex items-center justify-between px-4 py-2 neon-glass rounded-lg border border-white/10 transition-opacity duration-200 ${
          (selectedCount > 0 || visibleLeads.length > maxBulk) ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        aria-hidden={!(selectedCount > 0 || visibleLeads.length > maxBulk)}
      >
        <div className="flex items-center gap-4">
          {selectedCount > 0 && (
            <span className="text-sm text-white/80">
              {selectedCount} selected
            </span>
          )}
          {selectedCount > maxBulk && (
            <span className="text-xs text-yellow-400/80">
              Selection exceeds 100. Deselect some leads.
            </span>
          )}
          {visibleLeads.length > maxBulk && selectedCount <= maxBulk && (
            <span className="text-xs text-yellow-400/80">
              Bulk actions limited to 100 visible leads. Use filters to narrow.
            </span>
          )}
          {selectedCount > 0 && (
            <button
              onClick={() => setSelectedIds(new Set())}
              className="text-sm text-white/60 hover:text-white/80 transition underline"
              aria-label="Clear selection"
            >
              Clear selection
            </button>
          )}
        </div>
        {selectedCount > 0 && (
          <button
            onClick={() => {
              setBulkCountSnapshot(selectedCount)
              setIsBulkConfirmOpen(true)
            }}
            disabled={selectedCount === 0 || overLimit}
            aria-disabled={selectedCount === 0 || overLimit}
            aria-label={`Delete ${selectedCount} selected lead(s)`}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600/20 border border-red-500/40 text-red-400 hover:bg-red-600/30 hover:border-red-500/60 transition-all text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span>🗑️</span>
            Delete selected ({selectedCount})
          </button>
        )}
      </div>

      <div className="neon-glass overflow-hidden text-sm">
        <table className="w-full text-left">
          <thead className="bg-white/5 text-xs uppercase tracking-[0.25em] text-white/60">
            <tr>
              <th className={`px-4 py-3 w-12 ${headerSelectDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}>
                <input
                  type="checkbox"
                  checked={allVisibleSelected}
                  ref={headerCheckboxRef}
                  onChange={(e) => toggleSelectAllVisible(e.target.checked)}
                  disabled={headerSelectDisabled}
                  aria-label="Select all visible leads"
                  className="tron-checkbox"
                  title={headerSelectDisabled ? 'Select all disabled when >100 leads visible' : 'Select all visible leads'}
                />
              </th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Address</th>
              <th className="px-4 py-3">Homeowner</th>
              <th className="px-4 py-3">City</th>
              <th className="px-4 py-3">State</th>
              <th className="px-4 py-3">Zip</th>
              <th className="px-4 py-3">Phone</th>
              <th className="px-4 py-3 text-right pr-4">Actions</th>
            </tr>
          </thead>
          <tbody>
            {visibleLeads.map((lead) => (
              <tr
                key={lead.id}
                className="border-t border-white/5 hover:bg-white/5 transition-colors"
              >
                <td className="px-4 py-3">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(lead.id)}
                    onChange={(e) => toggleRowSelected(lead.id, e.target.checked)}
                    onClick={(e) => e.stopPropagation()}
                    aria-label={`Select lead at ${lead.address || 'unknown address'}`}
                    className="tron-checkbox"
                  />
                </td>
                <td className="px-4 py-3 capitalize text-white">
                  {lead.type}
                </td>
                <td className="px-4 py-3 text-white">
                  <button
                    onClick={(e) => openQuickView(lead.id, e.currentTarget)}
                    className="text-left w-full hover:underline hover:drop-shadow-[0_0_4px_rgba(255,10,69,0.6)] transition cursor-pointer"
                  >
                    {lead.address}
                  </button>
                </td>
                <td className="px-4 py-3 text-white text-sm">{lead.homeownerName ?? '—'}</td>
                <td className="px-4 py-3 text-white">{lead.city}</td>
                <td className="px-4 py-3 text-white">{lead.state}</td>
                <td className="px-4 py-3 text-white">{lead.zip}</td>
                <td className="px-4 py-3 text-xs text-white/60">
                  <span className="tabular-nums">{lead.phoneNumber ?? '—'}</span>
                </td>
                <td className="px-4 py-3 text-right pr-4 overflow-visible">
                  <div className="flex items-center justify-end gap-2">
                    {lead.temperature && (
                      <span className={`px-2 py-0.5 rounded-full text-xs border ${
                        lead.temperature === 'hot'
                          ? 'bg-red-500/20 text-red-400 border-red-500/30'
                          : lead.temperature === 'warm'
                          ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
                          : 'bg-blue-500/20 text-blue-400 border-blue-500/30'
                      }`}>
                        {lead.temperature.charAt(0).toUpperCase() + lead.temperature.slice(1)}
                      </span>
                    )}
                    <div className="relative overflow-visible">
                      <button
                        ref={openMenuId === lead.id ? buttonRef : null}
                        onClick={(e) => {
                          e.stopPropagation()
                          if (openMenuId === lead.id) {
                            setOpenMenuId(null)
                            setMenuPosition(null)
                          } else {
                            const rect = e.currentTarget.getBoundingClientRect()
                            setOpenMenuId(lead.id)
                            setMenuPosition({
                              top: rect.bottom + 8,
                              left: rect.right - MENU_WIDTH
                            })
                          }
                        }}
                        className="text-white/60 hover:text-white transition p-1"
                        aria-label="Temperature options"
                        aria-expanded={openMenuId === lead.id}
                      >
                        ⋯
                      </button>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setEditingLead(lead)
                      }}
                      className="text-white/70 hover:text-white transition drop-shadow-[0_0_4px_rgba(255,0,80,0.5)]"
                    >
                      ✏️
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setDeletingLead(lead)
                      }}
                      className="text-red-400 hover:text-red-500 transition drop-shadow-[0_0_6px_rgba(255,0,80,0.8)]"
                    >
                      🗑️
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {!visibleLeads.length && !searchQuery && (
              <tr>
                <td
                  colSpan={9}
                  className="px-4 py-8 text-center text-white/60"
                >
                  No leads yet. Use the form above to create one or import a
                  list.
                </td>
              </tr>
            )}
            {!visibleLeads.length && searchQuery && (
              <tr>
                <td
                  colSpan={9}
                  className="px-4 py-8 text-center text-white/60"
                >
                  No leads match your search.{' '}
                  <button
                    onClick={() => setSearchQuery('')}
                    className="underline hover:text-white transition"
                  >
                    Clear filter
                  </button>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Temperature menu portal */}
      {openMenuId && menuPosition && items.find(l => l.id === openMenuId) && createPortal(
        <div
          ref={menuRef}
          className="fixed neon-glass rounded-lg shadow-lg border border-white/10 z-[9999] min-w-[140px]"
          style={{
            top: `${menuPosition.top}px`,
            left: `${menuPosition.left}px`
          }}
          role="menu"
          aria-hidden={false}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={(e) => {
              e.stopPropagation()
              handleTemperatureChange(openMenuId, 'cold')
              setOpenMenuId(null)
              setMenuPosition(null)
            }}
            className="w-full text-left px-3 py-2 text-sm text-white hover:bg-[#ff0a45]/20 transition"
            role="menuitem"
          >
            Cold
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation()
              handleTemperatureChange(openMenuId, 'warm')
              setOpenMenuId(null)
              setMenuPosition(null)
            }}
            className="w-full text-left px-3 py-2 text-sm text-white hover:bg-[#ff0a45]/20 transition"
            role="menuitem"
          >
            Warm
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation()
              handleTemperatureChange(openMenuId, 'hot')
              setOpenMenuId(null)
              setMenuPosition(null)
            }}
            className="w-full text-left px-3 py-2 text-sm text-white hover:bg-[#ff0a45]/20 transition"
            role="menuitem"
          >
            Hot
          </button>
        </div>,
        document.body
      )}

      <EditLeadModal
        lead={editingLead}
        onClose={() => setEditingLead(null)}
        onSave={handleSaveLead}
      />

      <DeleteConfirmModal
        lead={deletingLead}
        onClose={() => setDeletingLead(null)}
        onConfirm={() => deletingLead && handleDeleteLead(deletingLead)}
        isDeleting={false}
      />

      <DeleteConfirmModal
        count={isBulkConfirmOpen ? bulkCountSnapshot : 0}
        onClose={() => setIsBulkConfirmOpen(false)}
        onConfirm={handleBulkDeleteConfirm}
        isDeleting={isBulkDeleting}
      />

      <LeadSourceModal
        isOpen={isSourceModalOpen}
        onClose={() => {
          setSourceModalOpen(false);
          setPendingLeadData(null);
        }}
        onSubmit={handleSourceSubmit}
      />

      {/* Mapping Editor Modal */}
      <div
        className={`fixed inset-0 z-50 transition-opacity duration-200 ${
          mappingEditorOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
      >
        <div
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          onClick={() => setMappingEditorOpen(false)}
        />
        <div className="absolute inset-0 flex items-center justify-center p-4 overflow-hidden">
          <div
            className={`w-full max-w-lg neon-glass rounded-lg shadow-2xl border border-white/10 transform transition-transform duration-200 overflow-hidden ${
              mappingEditorOpen ? 'scale-100' : 'scale-95'
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            {(() => {
              const validHeaders = getValidHeaders();
              const isSingleColumnMode = validHeaders.length === 1 && ((importMetadata?.validRows ?? 0) === 0 || !!importMetadata?.warningMessage);
              const singleHeader = getSingleHeader();
              const duplicates = getMappingDuplicates(editingMapping);

              return (
                <div className="p-6 overflow-hidden max-w-full flex flex-col max-h-[85vh]">
                  <div className="flex items-center justify-between mb-4 shrink-0">
                    <h3 className="text-lg font-semibold text-white">
                      {isSingleColumnMode ? 'Single Column Setup' : 'Edit Column Mapping'}
                    </h3>
                    <button
                      onClick={() => setMappingEditorOpen(false)}
                      className="text-white/60 hover:text-white text-xl leading-none p-1"
                    >
                      ×
                    </button>
                  </div>

                  <div className="max-h-[50vh] overflow-y-auto overflow-x-hidden dfos-modal-scrollbar pr-1 min-h-0">
                    {isSingleColumnMode && singleHeader ? (
                      <div className="space-y-4">
                        <p className="text-sm text-white/70">
                          1 column detected. We&apos;ll use it as Address (and optionally Notes).
                        </p>
                        <div className="flex items-center gap-3">
                          <label className="w-20 text-sm text-white/80 shrink-0">Column</label>
                          <select
                            value={singleHeader}
                            disabled
                            aria-readonly="true"
                            className="flex-1 min-w-0 neon-glass px-3 py-2 text-sm text-white bg-transparent border border-white/20 rounded focus:outline-none truncate opacity-90"
                          >
                            <option value={singleHeader} className="bg-[#0a0a0c]">
                              {getHeaderDisplayLabel(singleHeader, true)} (e.g. &quot;{getSample(singleHeader).slice(0, 16)}{getSample(singleHeader).length > 16 ? '…' : ''}&quot;)
                            </option>
                          </select>
                        </div>
                        <div className="space-y-2">
                          <p className="text-xs font-medium text-white/70">Use this column as:</p>
                          <div className="flex flex-col gap-2">
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="radio"
                                name="singleColumnMode"
                                checked={editingMapping.splitRule !== 'address_dash_notes'}
                                onChange={() => setEditingMapping(prev => ({ ...prev, splitRule: undefined, notesKey: undefined }))}
                                className="rounded-full border-white/30"
                              />
                              <span className="text-sm text-white/90">Address only</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="radio"
                                name="singleColumnMode"
                                checked={editingMapping.splitRule === 'address_dash_notes'}
                                onChange={() => setEditingMapping(prev => ({ ...prev, splitRule: 'address_dash_notes', notesKey: singleHeader ?? prev.notesKey }))}
                                className="rounded-full border-white/30"
                              />
                              <span className="text-sm text-white/90">Address + Notes (split on dash)</span>
                            </label>
                          </div>
                        </div>
                        <div className="pt-3 border-t border-white/10 space-y-3">
                          <h4 className="text-xs font-medium text-white/60 uppercase tracking-wider">Default Values</h4>
                          <div className="flex items-center gap-3">
                            <label className="w-24 text-sm text-white/80 shrink-0">City</label>
                            <input
                              type="text"
                              value={editingMapping.defaultCity || ''}
                              onChange={(e) => setEditingMapping(prev => ({ ...prev, defaultCity: e.target.value || undefined }))}
                              placeholder="e.g., Indianapolis"
                              className="flex-1 min-w-0 neon-glass px-3 py-2 text-sm text-white placeholder:text-white/40 border border-white/20 rounded focus:outline-none focus:border-[#ff0a45]/60"
                            />
                          </div>
                          <div className="flex items-center gap-3">
                            <label className="w-24 text-sm text-white/80 shrink-0">State</label>
                            <input
                              type="text"
                              value={editingMapping.defaultState || ''}
                              onChange={(e) => setEditingMapping(prev => ({ ...prev, defaultState: e.target.value.toUpperCase().slice(0, 2) || undefined }))}
                              placeholder="e.g., IN"
                              maxLength={2}
                              className="flex-1 min-w-0 neon-glass px-3 py-2 text-sm text-white placeholder:text-white/40 border border-white/20 rounded focus:outline-none focus:border-[#ff0a45]/60"
                            />
                          </div>
                        </div>
                        <p className="text-xs text-white/50">
                          City/State/Zip/Owner/Phone will be left blank.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {validHeaders.length > 0 && (
                          <div className="text-xs text-white/50 pb-3 border-b border-white/10">
                            <span className="text-white/70">{validHeaders.length}</span> columns detected
                            {validHeaders.length <= 3 && (
                              <span className="ml-2">
                                ({validHeaders.map(h => (h.length > 20 ? h.slice(0, 20) + '…' : h)).join(', ')})
                              </span>
                            )}
                            {validHeaders.length > 3 && (
                              <span className="ml-2">
                                ({validHeaders.slice(0, 3).map(h => (h.length > 20 ? h.slice(0, 20) + '…' : h)).join(', ')}, …)
                              </span>
                            )}
                          </div>
                        )}
                        {validHeaders.length < 3 && validHeaders.length > 1 && (
                          <p className="text-xs text-white/60">
                            Only map the fields you have. Everything else can stay None.
                          </p>
                        )}
                        {duplicates.length > 0 && (
                          <div className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded text-sm text-yellow-400/90">
                            <p>Same column mapped to multiple fields — usually wrong for county lists. Consider setting extras to None.</p>
                            <button
                              type="button"
                              onClick={useColumnOnlyForAddress}
                              className="mt-2 px-3 py-1 text-xs font-medium text-yellow-400 border border-yellow-500/40 rounded hover:bg-yellow-500/20 transition"
                            >
                              Use column only for Address
                            </button>
                          </div>
                        )}
                        <div className="mb-4">
                          <h4 className="text-xs font-medium text-white/60 uppercase tracking-wider mb-3">Field Mappings</h4>
                          <div className="space-y-3">
                            {[
                              { key: 'addressKey', label: 'Address' },
                              { key: 'cityKey', label: 'City' },
                              { key: 'stateKey', label: 'State' },
                              { key: 'zipKey', label: 'ZIP' },
                              { key: 'ownerKey', label: 'Owner Name' },
                              { key: 'phoneKey', label: 'Phone' },
                              { key: 'notesKey', label: 'Notes' },
                            ].map(({ key, label }) => (
                              <div key={key} className="flex items-center gap-3">
                                <label className="w-24 text-sm text-white/80 shrink-0">{label}</label>
                                <select
                                  value={(editingMapping as Record<string, string>)[key] || ''}
                                  onChange={(e) => setEditingMapping(prev => ({ ...prev, [key]: e.target.value || undefined }))}
                                  className="flex-1 min-w-0 neon-glass px-3 py-2 text-sm text-white bg-transparent border border-white/20 rounded focus:outline-none focus:border-[#ff0a45]/60"
                                >
                                  <option value="" className="bg-[#0a0a0c]">— None —</option>
                                  {validHeaders.map(header => {
                                    const labelText = getHeaderDisplayLabel(header, false);
                                    const sampleLabel = getSample(header).slice(0, 16);
                                    const optionText = sampleLabel ? `${labelText} (e.g. "${sampleLabel}")` : labelText;
                                    return (
                                      <option key={header} value={header} className="bg-[#0a0a0c]">
                                        {optionText.length > 48 ? optionText.slice(0, 48) + '…' : optionText}
                                      </option>
                                    );
                                  })}
                                </select>
                              </div>
                            ))}
                          </div>
                        </div>
                        <div className="mb-4 pt-3 border-t border-white/10">
                          <h4 className="text-xs font-medium text-white/60 uppercase tracking-wider mb-3">Default Values</h4>
                          <div className="space-y-3">
                            <div className="flex items-center gap-3">
                              <label className="w-24 text-sm text-white/80 shrink-0">City</label>
                              <input
                                type="text"
                                value={editingMapping.defaultCity || ''}
                                onChange={(e) => setEditingMapping(prev => ({ ...prev, defaultCity: e.target.value || undefined }))}
                                placeholder="e.g., Indianapolis"
                                className="flex-1 min-w-0 neon-glass px-3 py-2 text-sm text-white placeholder:text-white/40 border border-white/20 rounded focus:outline-none focus:border-[#ff0a45]/60"
                              />
                            </div>
                            <div className="flex items-center gap-3">
                              <label className="w-24 text-sm text-white/80 shrink-0">State</label>
                              <input
                                type="text"
                                value={editingMapping.defaultState || ''}
                                onChange={(e) => setEditingMapping(prev => ({ ...prev, defaultState: e.target.value.toUpperCase().slice(0, 2) || undefined }))}
                                placeholder="e.g., IN"
                                maxLength={2}
                                className="flex-1 min-w-0 neon-glass px-3 py-2 text-sm text-white placeholder:text-white/40 border border-white/20 rounded focus:outline-none focus:border-[#ff0a45]/60"
                              />
                            </div>
                          </div>
                        </div>
                        <div className="pt-3 border-t border-white/10">
                          <h4 className="text-xs font-medium text-white/60 uppercase tracking-wider mb-3">Advanced</h4>
                          <div className="flex items-center gap-3">
                            <label className="w-24 text-sm text-white/80 shrink-0">Split Rule</label>
                            <select
                              value={editingMapping.splitRule || ''}
                              onChange={(e) => setEditingMapping(prev => ({ ...prev, splitRule: (e.target.value as 'address_dash_notes') || undefined }))}
                              className="flex-1 min-w-0 neon-glass px-3 py-2 text-sm text-white bg-transparent border border-white/20 rounded focus:outline-none focus:border-[#ff0a45]/60"
                            >
                              <option value="" className="bg-[#0a0a0c]">— None —</option>
                              <option value="address_dash_notes" className="bg-[#0a0a0c]">
                                Address - Notes (split on dash)
                              </option>
                            </select>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex justify-end gap-3 mt-5 pt-4 border-t border-white/10 shrink-0">
                    <button
                      onClick={() => setMappingEditorOpen(false)}
                      className="px-4 py-2 text-sm text-white/60 hover:text-white transition"
                    >
                      Cancel
                    </button>
                    {isSingleColumnMode && singleHeader ? (
                      <button
                        onClick={() => applySingleColumnMapping(singleHeader, editingMapping.splitRule === 'address_dash_notes')}
                        className="neon-glass px-4 py-2 text-sm font-semibold text-white hover:bg-[#ff0a45]/20 transition border border-[#ff0a45]/30"
                      >
                        Apply Mapping
                      </button>
                    ) : (
                      <button
                        onClick={() => handleApplyMapping(editingMapping)}
                        className="neon-glass px-4 py-2 text-sm font-semibold text-white hover:bg-[#ff0a45]/20 transition border border-[#ff0a45]/30"
                      >
                        Apply Mapping
                      </button>
                    )}
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      </div>

      {/* Unified Quick View (for both persisted leads and import preview) */}
      <div
        className={`fixed inset-0 z-40 transition-opacity duration-300 ${
          (quickViewOpen || previewDetailOpen) ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
      >
        <div
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          onClick={() => {
            if (quickViewOpen) closeQuickView()
            if (previewDetailOpen) closePreviewDetail()
          }}
        />
        <div
          className={`absolute top-0 right-0 h-full w-full max-w-[520px] neon-glass border-l border-white/10 shadow-[0_0_40px_rgba(255,10,69,0.3)] transform transition-transform duration-300 ${
            (quickViewOpen || previewDetailOpen) ? 'translate-x-0' : 'translate-x-full'
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          {(() => {
            const displayData = getQuickViewDisplayData()
            if (!displayData) return null

            return (
              <div className="h-full flex flex-col p-6 overflow-y-auto neon-scrollbar">
                <div className="flex items-center justify-between mb-6 pb-4 border-b border-white/10">
                  <h2 className="text-xl font-semibold text-white tracking-wide">
                    {displayData.isPreview ? 'Import Preview' : 'Lead Quick View'}
                  </h2>
                  <button
                    ref={closeBtnRef}
                    onClick={() => {
                      if (quickViewOpen) closeQuickView()
                      if (previewDetailOpen) closePreviewDetail()
                    }}
                    className="text-white/60 hover:text-white transition text-2xl leading-none"
                    aria-label="Close"
                  >
                    ×
                  </button>
                </div>

                {/* Address Identity (same layout for both) */}
                <div className="mb-6">
                  <div className="text-2xl font-bold text-white mb-1 drop-shadow-[0_0_8px_rgba(255,10,69,0.4)]">
                    {displayData.address}
                  </div>
                  <div className="text-sm text-white/70">
                    {displayData.city}, {displayData.state} {displayData.zip}
                  </div>
                  <div className="mt-2">
                    <span className="inline-block px-3 py-1 text-xs font-semibold text-white bg-white/10 rounded-full border border-white/20 capitalize">
                      {displayData.type}
                    </span>
                  </div>
                </div>

                {/* Preview Mode: Validation Status */}
                {displayData.isPreview && displayData.validationStatus && (
                  <div className="mb-6">
                    <h3 className="text-sm font-semibold text-white/80 uppercase tracking-wider mb-3">
                      Validation Status
                    </h3>
                    {displayData.validationErrors && displayData.validationErrors.length > 0 && (
                      <div className="mb-3 p-3 bg-red-500/10 border border-red-500/20 rounded">
                        <div className="text-xs text-red-400 font-semibold mb-2 flex items-center gap-2">
                          <span>❌</span>
                          <span>Errors ({displayData.validationErrors.length})</span>
                        </div>
                        <ul className="text-xs text-red-400/90 space-y-1">
                          {displayData.validationErrors.map((err, i) => (
                            <li key={i} className="pl-4">• {err}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {displayData.validationWarnings && displayData.validationWarnings.length > 0 && (
                      <div className="mb-3 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded">
                        <div className="text-xs text-yellow-400 font-semibold mb-2 flex items-center gap-2">
                          <span>⚠️</span>
                          <span>Warnings ({displayData.validationWarnings.length})</span>
                        </div>
                        <ul className="text-xs text-yellow-400/90 space-y-1">
                          {displayData.validationWarnings.map((warn, i) => (
                            <li key={i} className="pl-4">• {warn}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {(!displayData.validationErrors || displayData.validationErrors.length === 0) &&
                     (!displayData.validationWarnings || displayData.validationWarnings.length === 0) && (
                      <div className="text-xs text-green-400 flex items-center gap-2 p-3 bg-green-500/10 border border-green-500/20 rounded">
                        <span>✅</span>
                        <span>No validation issues</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Real Lead Mode: Actions */}
                {!displayData.isPreview && quickViewLead && (
                  <div className="mb-6">
                    <h3 className="text-sm font-semibold text-white/80 uppercase tracking-wider mb-3">
                      Actions
                    </h3>
                    <div className="flex gap-3">
                      <button
                        onClick={() => {
                          closeQuickView()
                          setTimeout(() => setEditingLead(quickViewLead), 100)
                        }}
                        className="neon-glass px-4 py-2 text-sm font-semibold text-white hover:bg-[#ff0a45]/20 transition"
                      >
                        ✏️ Edit
                      </button>
                      <button
                        onClick={() => {
                          closeQuickView()
                          setTimeout(() => setDeletingLead(quickViewLead), 100)
                        }}
                        className="neon-glass px-4 py-2 text-sm font-semibold text-red-400 hover:bg-red-500/20 transition"
                      >
                        🗑️ Delete
                      </button>
                    </div>
                  </div>
                )}

                {/* Details Section (same for both) */}
                <div className="mb-6">
                  <h3 className="text-sm font-semibold text-white/80 uppercase tracking-wider mb-3">
                    Details
                  </h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <div className="text-white/50 text-xs mb-1">Type</div>
                      <div className="text-white capitalize">{displayData.type}</div>
                    </div>
                    <div>
                      <div className="text-white/50 text-xs mb-1">State</div>
                      <div className="text-white">{displayData.state}</div>
                    </div>
                    <div>
                      <div className="text-white/50 text-xs mb-1">Zip</div>
                      <div className="text-white">{displayData.zip}</div>
                    </div>
                    {!displayData.isPreview && displayData.updatedAt && (
                      <div>
                        <div className="text-white/50 text-xs mb-1">Updated</div>
                        <div className="text-white/70 text-xs">{displayData.updatedAt}</div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Preview Mode: Footer Note */}
                {displayData.isPreview && (
                  <div className="mt-auto pt-4 border-t border-white/10">
                    <p className="text-xs text-white/50">
                      💡 This is preview data. Click <span className="font-semibold text-white/70">"Confirm import"</span> to add this lead to your pipeline.
                    </p>
                  </div>
                )}
              </div>
            )
          })()}
        </div>
      </div>
    </div>
  )
}
