import ModalBackdrop from '../../components/common/ModalBackdrop'
import React, { useState, type FormEvent } from 'react'
import { Check, Edit2, FileText, Plus, Power, Trash2, X } from 'lucide-react'
import { api, money, type PlanDto } from '../../api'

interface PlansTabProps {
  plans: PlanDto[]
  onReload: () => Promise<void>
  onToast: (msg: string) => void
}

export const PlansTab: React.FC<PlansTabProps> = ({
  plans,
  onReload,
  onToast,
}) => {
  const [modalOpen, setModalOpen] = useState(false)
  const [editingPlan, setEditingPlan] = useState<PlanDto | null>(null)
  const [busy, setBusy] = useState(false)

  const handleOpenCreate = () => {
    setEditingPlan(null)
    setModalOpen(true)
  }

  const handleOpenEdit = (plan: PlanDto) => {
    setEditingPlan(plan)
    setModalOpen(true)
  }

  const handleSavePlan = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setBusy(true)
    const values = Object.fromEntries(new FormData(e.currentTarget).entries())
    try {
      const payload = JSON.stringify({
        name: values.name,
        durationDays: Number(values.durationDays),
        price: Number(values.price),
        description: values.description,
      })

      if (editingPlan) {
        await api(`/plans/${editingPlan.id}`, { method: 'PATCH', body: payload })
        onToast('Membership plan updated!')
      } else {
        await api('/plans', { method: 'POST', body: payload })
        onToast('New membership plan created!')
      }
      setModalOpen(false)
      setEditingPlan(null)
      await onReload()
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Could not save plan')
    } finally {
      setBusy(false)
    }
  }

  const handleTogglePlan = async (plan: PlanDto) => {
    try {
      await api(`/plans/${plan.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: !plan.isActive }),
      })
      onToast(plan.isActive ? 'Plan deactivated' : 'Plan activated')
      await onReload()
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Could not toggle plan')
    }
  }

  const handleDeletePlan = async (plan: PlanDto) => {
    if (!window.confirm(`Delete plan "${plan.name}"? Only plans with zero members can be deleted.`)) return
    try {
      await api(`/plans/${plan.id}`, { method: 'DELETE' })
      onToast(`Plan "${plan.name}" deleted`)
      await onReload()
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Could not delete plan. Try deactivating it instead.')
    }
  }

  return (
    <div className="plans-page">
      <div className="page-heading">
        <div>
          <h2>Membership Plans</h2>
          <p>Configure pricing tiers and subscription durations for your members.</p>
        </div>
        <div className="heading-actions">
          <button
            type="button"
            className="button button-primary"
            onClick={handleOpenCreate}
          >
            <Plus size={16} />
            <span>Create Plan</span>
          </button>
        </div>
      </div>

      <div className="plans-grid">
        {plans.map(plan => {
          const memberCount = plan._count?.memberships ?? 0
          return (
            <div key={plan.id} className={`plan-card ${!plan.isActive ? 'plan-inactive' : ''}`}>
              <div className="plan-card-header">
                <div>
                  <h3>{plan.name}</h3>
                  <span className="plan-duration-tag">
                    {plan.durationDays} Days ({Math.round(plan.durationDays / 30)} Month{plan.durationDays > 30 ? 's' : ''})
                  </span>
                </div>
                <span className={`plan-status-pill ${plan.isActive ? 'active' : 'inactive'}`}>
                  {plan.isActive ? 'Active' : 'Inactive'}
                </span>
              </div>

              <div className="plan-price-row">
                <span className="plan-price-amount">{money(plan.pricePaise)}</span>
                <span className="plan-price-period">/ {plan.durationDays} days</span>
              </div>

              {plan.description && (
                <p className="plan-description">{plan.description}</p>
              )}

              <div className="plan-footer">
                <span className="plan-members-count">
                  {memberCount} active member{memberCount === 1 ? '' : 's'}
                </span>

                <div className="plan-card-actions">
                  <button
                    type="button"
                    className="button-icon-secondary"
                    title={plan.isActive ? 'Deactivate plan' : 'Activate plan'}
                    onClick={() => handleTogglePlan(plan)}
                  >
                    <Power size={15} />
                  </button>

                  <button
                    type="button"
                    className="button-icon-secondary"
                    title="Edit plan"
                    onClick={() => handleOpenEdit(plan)}
                  >
                    <Edit2 size={15} />
                  </button>

                  {memberCount === 0 && (
                    <button
                      type="button"
                      className="button-icon-secondary danger-hover"
                      title="Delete unused plan"
                      onClick={() => handleDeletePlan(plan)}
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Plan Add/Edit Modal */}
      {modalOpen && (
        <ModalBackdrop label="Membership plan" onClose={() => setModalOpen(false)}>
          <div className="modal-card">
            <div className="modal-header">
              <div>
                <h3>{editingPlan ? 'Edit Membership Plan' : 'Create Membership Plan'}</h3>
                <p>Define duration and pricing for this membership tier</p>
              </div>
              <button
                className="icon-button"
                onClick={() => setModalOpen(false)}
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSavePlan}>
              <div className="modal-body form-grid">
                <label className="form-group">
                  <span>Plan Name *</span>
                  <input
                    name="name"
                    required
                    defaultValue={editingPlan?.name ?? ''}
                    placeholder="e.g. 1 Month Standard, 3 Months Transformation"
                  />
                </label>

                <div className="form-row-2">
                  <label className="form-group">
                    <span>Duration in Days *</span>
                    <input
                      name="durationDays"
                      type="number"
                      min="1"
                      max="3650"
                      required
                      defaultValue={editingPlan?.durationDays ?? 30}
                      placeholder="30"
                    />
                  </label>

                  <label className="form-group">
                    <span>Price in Rupees (₹) *</span>
                    <input
                      name="price"
                      type="number"
                      min="0"
                      step="1"
                      required
                      defaultValue={editingPlan ? editingPlan.pricePaise / 100 : 1500}
                      placeholder="1500"
                    />
                  </label>
                </div>

                <label className="form-group">
                  <span>Description (Optional)</span>
                  <textarea
                    name="description"
                    rows={3}
                    defaultValue={editingPlan?.description ?? ''}
                    placeholder="Access to gym equipment, cardio deck, locker facilities..."
                  />
                </label>
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="button button-secondary"
                  onClick={() => setModalOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="button button-primary" disabled={busy}>
                  {busy ? 'Saving...' : editingPlan ? 'Save Changes' : 'Create Plan'}
                </button>
              </div>
            </form>
          </div>
        </ModalBackdrop>
      )}
    </div>
  )
}

export default PlansTab
