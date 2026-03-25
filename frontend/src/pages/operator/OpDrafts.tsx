import { useState, useEffect } from 'react'
import { DRAFTS, getLocation, formatCurrency, IMPREST } from '../../mock/data'
import { listSubmissions, deleteDraft } from '../../api/submissions'
import { getToken } from '../../api/client'

interface Props {
  onNavigate: (panel: string, ctx?: Record<string, string>) => void
}

export default function OpDrafts({ onNavigate }: Props) {
  const [deletedIds, setDeletedIds] = useState<string[]>([])
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [apiDrafts, setApiDrafts] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(!!getToken())

  useEffect(() => {
    if (!getToken()) {
      Promise.resolve().then(() => {
        setApiDrafts([])
        setIsLoading(false)
      })
      return
    }
    
    // Secure Isolation: The backend listSubmissions endpoint automatically filters
    // by the current operator's ID, ensuring they only see their own drafts.
    listSubmissions({ status: 'draft', page_size: 100 })
      .then(res => setApiDrafts(res.items))
      .catch(() => { /* fallback to mock */ })
      .finally(() => setIsLoading(false))
  }, [])

  const activeDrafts = !getToken()
    ? DRAFTS.filter(d => !deletedIds.includes(d.id))
    : apiDrafts.filter(d => !deletedIds.includes(d.id)).map(d => ({
        id: d.id, locationId: d.location_id, date: d.submission_date,
        savedAt: d.updated_at || d.created_at, sections: d.sections || {},
        totalSoFar: d.total_cash
      }))

  async function handleDelete(id: string) {
    if (!window.confirm("Are you sure you want to delete this draft? This cannot be undone.")) return;
    if (getToken()) {
      try { await deleteDraft(id) } catch (err) { console.error('Failed to delete draft', err) }
    }
    setDeletedIds(prev => [...prev, id])
  }

  function handleResume(draftId: string, locationId: string, date: string) {
    onNavigate('op-form', { locationId, date, draftId, method: 'form', from: 'op-drafts' })
  }

  return (
    <div className="fade-up">
      <div className="ph">
        <div>
          <h2>My Drafts</h2>
          <p>Resume or discard in-progress submissions</p>
        </div>
        <div className="ph-right" style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-outline" onClick={() => onNavigate('op-start')}>← Dashboard</button>
          <button className="btn btn-primary" onClick={() => onNavigate('op-start')}>+ New Submission</button>
        </div>
      </div>

      {isLoading ? (
        <div className="card">
          <div className="card-body" style={{ textAlign: 'center', padding: '64px 24px' }}>
            <div style={{ display: 'inline-block', width: 28, height: 28, border: '3px solid var(--ow2)', borderTopColor: 'var(--g4)', borderRadius: '50%', animation: 'spin 1s linear infinite', marginBottom: 16 }}></div>
            <div style={{ fontWeight: 600, color: 'var(--ts)', fontSize: 14 }}>Loading drafts...</div>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        </div>
      ) : activeDrafts.length === 0 ? (
        <div className="card">
          <div className="card-body" style={{ textAlign: 'center', padding: '48px 24px' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>📝</div>
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>No drafts</div>
            <div style={{ fontSize: 13, color: 'var(--ts)', marginBottom: 20 }}>
              Drafts are saved automatically when you close a form in progress.
            </div>
            <button className="btn btn-primary" onClick={() => onNavigate('op-start')}>Start New Submission</button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {activeDrafts.map(d => {
            const loc = getLocation(d.locationId)
            const savedLabel = new Date(d.savedAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
            const dateLabel = new Date(d.date + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
            const pct = IMPREST > 0 ? (d.totalSoFar / IMPREST) * 100 : 0
            return (
              <div key={d.id} className="card" style={{ marginBottom: 0 }}>
                <div className="card-header">
                  <div>
                    <span className="card-title">{loc?.name}</span>
                    <div style={{ fontSize: 12, color: 'var(--ts)', marginTop: 2 }}>
                      Date: {dateLabel} · Saved: {savedLabel}
                    </div>
                  </div>
                  <span className="badge badge-amber"><span className="bdot"></span>Draft</span>
                </div>
                <div className="card-body">
                  <div style={{ display: 'flex', gap: 24, alignItems: 'center', flexWrap: 'wrap' }}>
                    <div>
                      <div style={{ fontSize: 11, color: 'var(--ts)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Total so far</div>
                      <div style={{ fontFamily: 'DM Serif Display,serif', fontSize: 22, color: 'var(--td)' }}>{formatCurrency(d.totalSoFar)}</div>
                    </div>
                    <div style={{ flex: 1, minWidth: 160 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--ts)', marginBottom: 4 }}>
                        <span>Progress vs Imprest</span>
                        <span>{Math.min(100, pct).toFixed(0)}%</span>
                      </div>
                      <div style={{ height: 6, background: 'var(--ow2)', borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{
                          height: '100%', borderRadius: 3,
                          width: `${Math.min(100, pct)}%`,
                          background: pct > 105 ? 'var(--red)' : pct > 95 ? 'var(--g5)' : 'var(--amb)',
                        }} />
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
                      <button className="btn btn-primary" onClick={() => handleResume(d.id, d.locationId, d.date)}>
                        ▶ Resume
                      </button>
                      <button
                        className="btn btn-reject"
                        onClick={() => handleDelete(d.id)}
                      >
                        🗑 Discard
                      </button>
                    </div>
                  </div>

                  {/* Sections completed */}
                  {d.sections && Object.keys(d.sections).length > 0 && (
                    <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {['A','B','C','D','E','F','G','H','I'].map(s => {
                        const val = (d.sections as Record<string, number | undefined>)[s]
                        return (
                          <div key={s} style={{
                            display: 'flex', alignItems: 'center', gap: 6,
                            background: val !== undefined ? 'var(--g0)' : 'var(--ow2)',
                            borderRadius: 6, padding: '4px 10px', fontSize: 12,
                          }}>
                            <span style={{ fontWeight: 700, color: val !== undefined ? 'var(--g7)' : 'var(--ts)' }}>§{s}</span>
                            {val !== undefined && <span style={{ color: 'var(--ts)' }}>{formatCurrency(val)}</span>}
                            {val === undefined && <span style={{ color: 'var(--wg)' }}>—</span>}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <div style={{ marginTop: 24 }}>
        <div className="card">
          <div className="card-header">
            <span className="card-title">About Drafts</span>
          </div>
          <div className="card-body" style={{ fontSize: 13, color: 'var(--ts)', lineHeight: 1.8 }}>
            <p>• Drafts are saved when you click <strong>Save Draft</strong> during form entry.</p>
            <p>• Only one draft is kept per location per date.</p>
            <p>• Drafts are not visible to controllers until submitted.</p>
            <p>• Discarding a draft is permanent and cannot be undone.</p>
          </div>
        </div>
      </div>
    </div>
  )
}
