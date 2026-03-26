// ── Mock data for CashRoom Compliance System ──────────────────────────────

export interface Location {
  id: string
  name: string
  cost_center?: string | null
  city: string
  expectedCash: number
  tolerancePct: number
  effectiveTolerancePct?: number  // from location_config_overrides; falls back to tolerancePct
  slaHours?: number               // default 48
  active: boolean
  createdAt?: string
  updatedAt?: string
}

export interface Submission {
  id: string
  locationId: string
  operatorName: string
  date: string           // YYYY-MM-DD
  status: 'draft' | 'pending_approval' | 'approved' | 'rejected'
  source?: 'FORM' | 'CHAT' | 'EXCEL'
  totalCash: number
  expectedCash?: number  // snapshotted at submission time
  variance: number
  variancePct: number
  submittedAt: string
  approvedBy?: string
  approvedByName?: string
  rejectionReason?: string
  sections: SectionTotals
  // Variance exception: set when |variancePct| > location tolerancePct at submission time
  varianceException?: boolean
  varianceNote?: string
}

export interface SectionTotals {
  A: number; B: number; C: number; D: number; E: number
  F: number; G: number; H: number; I: number
}

export interface Draft {
  id: string
  locationId: string
  date: string
  savedAt: string
  sections: Partial<SectionTotals>
  totalSoFar: number
}

export interface VerificationRecord {
  id: string
  locationId: string
  verifierName: string
  type: 'controller' | 'dgm'
  date: string           // YYYY-MM-DD — scheduled or actual visit date
  monthYear?: string
  observedTotal?: number // undefined for scheduled / missed records
  notes: string
  dayOfWeek: number
  warningFlag: boolean
  status: 'scheduled' | 'completed' | 'missed' | 'cancelled'
  missedReason?: string
  scheduledTime?: string  // e.g. "09:00" — set at booking time, undefined for older records
  signatureData?: string  // base64 data URL of the controller's signature
}

export interface AuditEvent {
  id: string
  eventType: string
  actor: string         // display name (mock only — API uses actor_id + actor_name)
  actorId?: string      // UUID in real API
  actorRole?: string
  locationId?: string
  entityId?: string     // maps to API entity_id
  entityType?: string   // maps to API entity_type
  submissionId?: string // legacy alias for entityId when entityType='submission'
  detail: string
  timestamp: string
  oldValue?: string
  newValue?: string
  ipAddress?: string
}

export interface User {
  id: string
  name: string
  email: string
  role: 'operator' | 'controller' | 'dgm' | 'admin' | 'regional-controller'
  locationIds: string[]
  active: boolean
  createdAt?: string
}

export interface SecReview {
  decision: 'accept' | 'reject'
  note: string
}

export interface SubmissionReview {
  submissionId: string
  outcome: 'approved' | 'rejected'
  reviewedAt: string
  reviewedBy: string
  sections: Record<string, SecReview>
}

// ── Persistence helpers ────────────────────────────────────────────────────
function loadStored<T>(key: string, fallback: T[]): T[] {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T[]) : fallback
  } catch { return fallback }
}
function loadStoredMap<V>(key: string, fallback: Record<string, V>): Record<string, V> {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as Record<string, V>) : fallback
  } catch { return fallback }
}
export function saveStored(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)) } catch { /* quota exceeded */ }
}

// ── Submission Reviews (section-level controller review results) ───────────
export const SUBMISSION_REVIEWS: Record<string, SubmissionReview> =
  loadStoredMap<SubmissionReview>('compass_submission_reviews', {})

export function saveSubmissionReview(review: SubmissionReview) {
  SUBMISSION_REVIEWS[review.submissionId] = review
  saveStored('compass_submission_reviews', SUBMISSION_REVIEWS)
}

// ── Verification Reviews (section-level review recorded during visit completion) ─
export interface VerificationReview {
  verificationId: string
  outcome: 'approved' | 'rejected'
  reviewedAt: string
  reviewedBy: string
  sections: Record<string, SecReview>
}

export const VERIFICATION_REVIEWS: Record<string, VerificationReview> =
  loadStoredMap<VerificationReview>('compass_verification_reviews', {})

export function saveVerificationReview(review: VerificationReview) {
  VERIFICATION_REVIEWS[review.verificationId] = review
  saveStored('compass_verification_reviews', VERIFICATION_REVIEWS)
}

// ── Locations ─────────────────────────────────────────────────────────────
// Populated via Admin → Import Roster (persisted in localStorage)
const DEFAULT_LOCATIONS: Location[] = [
  { id: 'loc-1', name: 'NYC - Times Square', cost_center: '1001', city: 'New York', expectedCash: 9575.00, tolerancePct: 5, active: true },
  { id: 'loc-2', name: 'CHI - Millenium Park', cost_center: '2005', city: 'Chicago', expectedCash: 12000.00, tolerancePct: 5, active: true },
  { id: 'loc-3', name: 'LAX - Santa Monica', cost_center: '3099', city: 'Los Angeles', expectedCash: 8500.00, tolerancePct: 5, active: true },
  { id: 'loc-4', name: 'Tech Park Vending Route', cost_center: '4002', city: 'Austin', expectedCash: 15000.00, tolerancePct: 5, active: true },
  { id: 'loc-5', name: 'Downtown Arena Concessions', cost_center: '5508', city: 'Denver', expectedCash: 7200.00, tolerancePct: 5, active: true },
]
export const LOCATIONS: Location[] = loadStored<Location>('compass_locations_v3', DEFAULT_LOCATIONS)

// Helper to generate dates relative to today
const dMinus = (days: number) => {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toISOString().split('T')[0]
}
const isoMinus = (days: number, hours = 0) => {
  const d = new Date()
  d.setDate(d.getDate() - days)
  d.setHours(d.getHours() - hours)
  return d.toISOString()
}

export const IMPREST = 9575.00

// ── Submissions ─────────────────────────────────────────────────────────────
export const SUBMISSIONS: Submission[] = [
  // Pending / Submissions that need action
  { id: 'SUB-101', locationId: 'loc-1', operatorName: 'Demo Operator', date: dMinus(0), status: 'pending_approval', source: 'FORM', totalCash: 9575.00, expectedCash: 9575.00, variance: 0, variancePct: 0.0, submittedAt: isoMinus(0, 2), sections: { A: 5000, B: 2000, C: 1500, D: 500, E: 575, F: 0, G: 0, H: 0, I: 0 }, varianceException: false },
  { id: 'SUB-102', locationId: 'loc-2', operatorName: 'Alice Smith', date: dMinus(0), status: 'pending_approval', source: 'FORM', totalCash: 12000.00, expectedCash: 12000.00, variance: 0, variancePct: 0.0, submittedAt: isoMinus(3, 4), sections: { A: 6000, B: 3000, C: 2000, D: 500, E: 500, F: 0, G: 0, H: 0, I: 0 }, varianceException: false },
  
  // Historical Approved
  { id: 'SUB-103', locationId: 'loc-3', operatorName: 'Charlie Davis', date: dMinus(1), status: 'approved', source: 'EXCEL', totalCash: 8500.00, expectedCash: 8500.00, variance: 0, variancePct: 0, submittedAt: isoMinus(1, 6), approvedBy: 'U2', approvedByName: 'Demo Controller', sections: { A: 4000, B: 2000, C: 1500, D: 500, E: 500, F: 0, G: 0, H: 0, I: 0 }, varianceException: false },
  { id: 'SUB-105', locationId: 'loc-4', operatorName: 'Demo Operator', date: dMinus(2), status: 'approved', source: 'FORM', totalCash: 15200.00, expectedCash: 15000.00, variance: 200, variancePct: 1.33, submittedAt: isoMinus(2, 3), approvedBy: 'U2', approvedByName: 'Demo Controller', sections: { A: 8000, B: 4000, C: 2000, D: 1000, E: 200, F: 0, G: 0, H: 0, I: 0 }, varianceException: true, varianceNote: "Found an extra $200 bill bundle under the register tray." },
  
  // Historical Rejected
  { id: 'SUB-104', locationId: 'loc-1', operatorName: 'Demo Operator', date: dMinus(3), status: 'rejected', source: 'FORM', totalCash: 9375.00, expectedCash: 9575.00, variance: -200, variancePct: -2.08, submittedAt: isoMinus(3, 2), approvedBy: 'U2', approvedByName: 'Demo Controller', rejectionReason: "Shortage in Section A. Please recount.", sections: { A: 4800, B: 2000, C: 1500, D: 500, E: 575, F: 0, G: 0, H: 0, I: 0 }, varianceException: false },
]

// ── Drafts ────────────────────────────────────────────────────────────────
export const DRAFTS: Draft[] = [
  { id: 'DFT-101', locationId: 'loc-1', date: dMinus(0), savedAt: isoMinus(0, 1), sections: { A: 2500, B: 500 }, totalSoFar: 3000.00 }
]

// ── Verifications ─────────────────────────────────────────────────────────
export const VERIFICATIONS: VerificationRecord[] = [
  // Controller Visits
  { id: 'VER-C1', locationId: 'loc-1', verifierName: 'Demo Controller', type: 'controller', date: dMinus(2), status: 'completed', observedTotal: 9575.00, dayOfWeek: new Date(dMinus(2)).getDay(), warningFlag: false, notes: 'All cash accounted for.' },
  { id: 'VER-C2', locationId: 'loc-2', verifierName: 'Demo Controller', type: 'controller', date: dMinus(15), status: 'completed', observedTotal: 12000.00, dayOfWeek: new Date(dMinus(15)).getDay(), warningFlag: true, notes: 'DOW warning overridden.' },
  { id: 'VER-C3', locationId: 'loc-3', verifierName: 'Demo Controller', type: 'controller', date: dMinus(1), status: 'missed', dayOfWeek: new Date(dMinus(1)).getDay(), warningFlag: false, missedReason: 'Operational conflict — staff not available', notes: '' },
  { id: 'VER-C4', locationId: 'loc-2', verifierName: 'Demo Controller', type: 'controller', date: dMinus(-2), status: 'scheduled', dayOfWeek: new Date(dMinus(-2)).getDay(), warningFlag: false, scheduledTime: '14:00', notes: '' },
  
  // DGM Visits
  { id: 'VER-D1', locationId: 'loc-1', verifierName: 'Demo DGM', type: 'dgm', date: dMinus(10), status: 'completed', observedTotal: 9575.00, dayOfWeek: new Date(dMinus(10)).getDay(), warningFlag: false, notes: 'Routine monthly check.' },
  { id: 'VER-D2', locationId: 'loc-2', verifierName: 'Demo DGM', type: 'dgm', date: dMinus(-5), status: 'scheduled', dayOfWeek: new Date(dMinus(-5)).getDay(), warningFlag: false, scheduledTime: '09:00', notes: '' },
]

// ── Audit Events ──────────────────────────────────────────────────────────
export const AUDIT_EVENTS: AuditEvent[] = [
  { id: 'AUD-1', eventType: 'USER_LOGIN', actor: 'Demo Admin', detail: 'User logged in to the system via Demo Mode.', timestamp: isoMinus(0, 1) },
  { id: 'AUD-2', eventType: 'SUBMISSION_SUBMITTED', actor: 'Demo Operator', locationId: 'loc-1', detail: 'Submitted daily cash form for $9,575.00.', timestamp: isoMinus(0, 2) },
  { id: 'AUD-3', eventType: 'SUBMISSION_REJECTED', actor: 'Demo Controller', locationId: 'loc-1', detail: 'Rejected submission SUB-104 due to variance.', timestamp: isoMinus(1, 5) },
  { id: 'AUD-4', eventType: 'CONTROLLER_VERIFIED', actor: 'Demo Controller', locationId: 'loc-1', detail: 'Completed physical verification. Matched expected $9,575.00.', timestamp: isoMinus(2, 4) },
  { id: 'AUD-5', eventType: 'CONFIG_UPDATED', actor: 'Demo Admin', detail: 'Updated global SLA threshold to 48 hours.', timestamp: isoMinus(5, 0) },
  { id: 'AUD-6', eventType: 'USER_CREATED', actor: 'Demo Admin', detail: 'Imported new user roster from Excel.', timestamp: isoMinus(10, 0) },
  { id: 'AUD-7', eventType: 'LOCATION_ADDED', actor: 'Demo Admin', detail: 'Added new location: Downtown Arena Concessions.', timestamp: isoMinus(12, 0) },
]

// Tracks dates where the operator submitted an absence explanation (key: `${locationId}|${date}`)
export const EXPLAINED_MISSED = new Set<string>()

// Stores the submitted explanation data for view-only display
export interface ExplanationData { reason: string; detail: string; supervisorName: string }
export const MISSED_EXPLANATIONS = new Map<string, ExplanationData>()

// ── Users ─────────────────────────────────────────────────────────────────
// All other users are populated via Admin → Import Roster (persisted in localStorage).
const DEFAULT_USERS: User[] = [
  { id: 'U5', name: 'Demo Admin', email: 'admin@compassusa.com', role: 'admin', locationIds: [], active: true },
  { id: 'U1', name: 'Demo Operator', email: 'operator@compassusa.com', role: 'operator', locationIds: ['loc-1', 'loc-4'], active: true },
  { id: 'U2', name: 'Demo Controller', email: 'controller@compassusa.com', role: 'controller', locationIds: ['loc-1', 'loc-2', 'loc-4'], active: true },
  { id: 'U3', name: 'Demo DGM', email: 'dgm@compassusa.com', role: 'dgm', locationIds: ['loc-1', 'loc-2', 'loc-3', 'loc-4', 'loc-5'], active: true },
  { id: 'U4', name: 'Demo RC', email: 'rc@compassusa.com', role: 'regional-controller', locationIds: [], active: true },
]
// Changed storage key to 'compass_users_v3' to force a cache bust and ensure demo users are loaded
export const USERS: User[] = loadStored<User>('compass_users_v3', DEFAULT_USERS)
// ── Helpers ───────────────────────────────────────────────────────────────
export function getSubmission(locationId: string, date: string) {
  // STRICT DEMO GUARD: Real users must never process or view mock submissions
  if (!localStorage.getItem('compass_demo_email')) return null;
  return SUBMISSIONS.find(s => s.locationId === locationId && s.date === date) ?? null
}
export function getLocation(id: string) {
  const hasToken = !!localStorage.getItem('ccs_token') || !!sessionStorage.getItem('ccs_token'); // Strict check against real auth token
  if (hasToken && !localStorage.getItem('compass_demo_email')) {
    try {
      const realLocs = JSON.parse(sessionStorage.getItem('compass_real_locations') || '[]') as Location[];
      const found = realLocs.find(l => l.id === id);
      if (found) return found;
      return null; // CRITICAL: Never fall back to mock data for real users
    } catch { return null; }
  }
  return LOCATIONS.find(l => l.id === id) ?? null;
}
export function formatCurrency(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n)
}
export function todayStr() {
  const d = new Date()
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}
export function isPastDate(date: string) {
  return date < todayStr()
}
export function isFutureDate(date: string) {
  return date > todayStr()
}
