import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { ArrowLeft, ArrowRight, Check } from 'lucide-react'
import api from '../../lib/api'
import { Button, Input, Select } from '../../components/ui/index'
import useToast from '../../hooks/useToast'
import { ToastContainer } from '../../components/ui/Toast'

const FRAMEWORK_OPTIONS = [
  { value: 'IPSAS', label: 'IPSAS' },
  { value: 'IFRS', label: 'IFRS' },
  { value: 'ISA', label: 'ISA' },
  { value: 'Other', label: 'Other' },
]

const CURRENCY_OPTIONS = [
  { value: 'TZS', label: 'TZS — Tanzanian Shilling' },
  { value: 'USD', label: 'USD — US Dollar' },
  { value: 'EUR', label: 'EUR — Euro' },
]

function StepIndicator({ step }) {
  return (
    <div className="flex items-center gap-3 mb-8">
      {[1, 2].map((s) => (
        <div key={s} className="flex items-center gap-2">
          <div className={[
            'w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors',
            step === s
              ? 'bg-[#1e3a5f] text-white'
              : step > s
              ? 'bg-green-500 text-white'
              : 'bg-gray-200 text-gray-400',
          ].join(' ')}>
            {step > s ? <Check className="w-4 h-4" /> : s}
          </div>
          <span className={['text-sm font-medium', step >= s ? 'text-[#1e3a5f]' : 'text-gray-400'].join(' ')}>
            {s === 1 ? 'Engagement Details' : 'Assign Team Leader'}
          </span>
          {s < 2 && <div className={['flex-1 h-0.5 w-12', step > s ? 'bg-green-400' : 'bg-gray-200'].join(' ')} />}
        </div>
      ))}
    </div>
  )
}

function NewEngagementPage() {
  const navigate = useNavigate()
  const { toasts, toast, removeToast } = useToast()
  const [step, setStep] = useState(1)
  const [step1Data, setStep1Data] = useState(null)

  // Step 1 form
  const {
    register: reg1,
    handleSubmit: handleStep1,
    formState: { errors: err1 },
    watch: watch1,
  } = useForm({
    defaultValues: {
      reporting_framework: 'IPSAS',
      reporting_currency: 'TZS',
    },
  })

  // Step 2 form
  const {
    register: reg2,
    handleSubmit: handleStep2,
    formState: { errors: err2 },
    watch: watch2,
  } = useForm()

  // Entity search
  const [entitySearch, setEntitySearch] = useState('')
  const { data: entities } = useQuery({
    queryKey: ['entities', entitySearch],
    queryFn: async () => {
      const res = await api.get(`entities/?search=${entitySearch}&page_size=30`)
      return res.data
    },
    enabled: entitySearch.length >= 1,
  })
  const entityOptions = (() => {
    const list = Array.isArray(entities?.results) ? entities.results
      : Array.isArray(entities) ? entities : []
    return list.map((e) => ({ value: e.id, label: e.name || e.entity_name }))
  })()

  // TL search (role 2 = Team Leader)
  const { data: tlUsers } = useQuery({
    queryKey: ['users-tl'],
    queryFn: async () => {
      const res = await api.get('users/by-role/?role=2&page_size=100')
      return res.data
    },
  })
  const tlOptions = (() => {
    const list = Array.isArray(tlUsers?.results) ? tlUsers.results
      : Array.isArray(tlUsers) ? tlUsers : []
    return list.map((u) => ({ value: u.id, label: u.full_name || u.username }))
  })()

  const createEngagement = useMutation({
    mutationFn: (data) => api.post('engagements/', data),
    onSuccess: (res) => {
      toast.success('Engagement created successfully.')
      const newId = res.data?.id
      setTimeout(() => navigate(newId ? `/engagements/${newId}` : '/engagements'), 800)
    },
    onError: (err) => {
      const msg = err.response?.data?.detail || 'Failed to create engagement.'
      toast.error(msg)
    },
  })

  const onStep1 = (data) => {
    setStep1Data(data)
    setStep(2)
  }

  const onStep2 = (data) => {
    createEngagement.mutate({
      ...step1Data,
      entity: parseInt(step1Data.entity),
      audit_year: parseInt(step1Data.audit_year),
      team_leader: parseInt(data.team_leader),
    })
  }

  const selectedEntityName = entityOptions.find((e) => String(e.value) === String(watch1('entity')))?.label
  const selectedTLName = tlOptions.find((t) => String(t.value) === String(watch2('team_leader')))?.label

  return (
    <div className="max-w-2xl mx-auto">
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => step === 2 ? setStep(1) : navigate('/engagements')}
          className="p-1.5 rounded-lg text-gray-400 hover:text-[#1e3a5f] hover:bg-gray-100 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-xl font-bold text-[#1e3a5f]">New Engagement</h1>
      </div>

      <StepIndicator step={step} />

      {/* Step 1 */}
      {step === 1 && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <h2 className="text-base font-semibold text-[#1e3a5f] mb-5">Step 1: Engagement Details</h2>
          <form onSubmit={handleStep1(onStep1)} className="space-y-4">
            {/* Entity */}
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">Entity</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Search entity..."
                  value={entitySearch}
                  onChange={(e) => setEntitySearch(e.target.value)}
                  className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg outline-none focus:border-[#1e3a5f] focus:ring-2 focus:ring-[#1e3a5f]/10"
                />
              </div>
              {entityOptions.length > 0 && (
                <select
                  {...reg1('entity', { required: 'Entity is required' })}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg outline-none focus:border-[#1e3a5f] bg-white mt-1"
                  size={Math.min(entityOptions.length, 5)}
                >
                  <option value="">-- Select an entity --</option>
                  {entityOptions.map((e) => (
                    <option key={e.value} value={e.value}>{e.label}</option>
                  ))}
                </select>
              )}
              {err1.entity && <p className="text-xs text-red-500">{err1.entity.message}</p>}
              {selectedEntityName && (
                <p className="text-xs text-green-600 font-medium">Selected: {selectedEntityName}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Audit Year"
                type="number"
                placeholder={String(new Date().getFullYear())}
                error={err1.audit_year?.message}
                {...reg1('audit_year', { required: 'Audit year is required', min: { value: 2000, message: 'Invalid year' } })}
              />
              <Input
                label="Overall Deadline"
                type="date"
                error={err1.overall_deadline?.message}
                {...reg1('overall_deadline', { required: 'Deadline is required' })}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Period Start"
                type="date"
                error={err1.period_start?.message}
                {...reg1('period_start', { required: 'Required' })}
              />
              <Input
                label="Period End"
                type="date"
                error={err1.period_end?.message}
                {...reg1('period_end', { required: 'Required' })}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Select
                label="Reporting Framework"
                options={FRAMEWORK_OPTIONS}
                error={err1.reporting_framework?.message}
                {...reg1('reporting_framework', { required: 'Required' })}
              />
              <Select
                label="Reporting Currency"
                options={CURRENCY_OPTIONS}
                error={err1.reporting_currency?.message}
                {...reg1('reporting_currency', { required: 'Required' })}
              />
            </div>

            <div className="flex justify-between pt-3 border-t border-gray-100">
              <Button variant="secondary" type="button" onClick={() => navigate('/engagements')}>
                Cancel
              </Button>
              <Button type="submit">
                Next Step
                <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* Step 2 */}
      {step === 2 && (
        <div className="space-y-5">
          {/* Preview */}
          <div className="bg-[#e8edf4] rounded-xl border border-[#1e3a5f]/10 p-5">
            <h3 className="text-sm font-semibold text-[#1e3a5f] mb-3">Engagement Summary</h3>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
              {[
                ['Entity', selectedEntityName || step1Data?.entity],
                ['Audit Year', step1Data?.audit_year],
                ['Deadline', step1Data?.overall_deadline],
                ['Period', `${step1Data?.period_start} – ${step1Data?.period_end}`],
                ['Framework', step1Data?.reporting_framework],
                ['Currency', step1Data?.reporting_currency],
              ].map(([label, value]) => (
                <div key={label} className="flex flex-col gap-0.5">
                  <dt className="text-xs text-[#1e3a5f]/60 uppercase tracking-wide">{label}</dt>
                  <dd className="font-medium text-[#1e3a5f]">{value || '—'}</dd>
                </div>
              ))}
            </dl>
          </div>

          {/* TL assignment form */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <h2 className="text-base font-semibold text-[#1e3a5f] mb-5">Step 2: Assign Team Leader</h2>
            <form onSubmit={handleStep2(onStep2)} className="space-y-4">
              <Select
                label="Team Leader"
                options={tlOptions}
                placeholder="Select team leader..."
                error={err2.team_leader?.message}
                {...reg2('team_leader', { required: 'Team leader is required' })}
              />
              {selectedTLName && (
                <p className="text-xs text-green-600 font-medium">Selected: {selectedTLName}</p>
              )}

              <div className="flex justify-between pt-3 border-t border-gray-100">
                <Button variant="secondary" type="button" onClick={() => setStep(1)}>
                  <ArrowLeft className="w-4 h-4" />
                  Back
                </Button>
                <Button type="submit" loading={createEngagement.isPending}>
                  <Check className="w-4 h-4" />
                  Create Engagement
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default NewEngagementPage
