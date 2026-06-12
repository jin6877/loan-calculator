import { useEffect, useMemo, useState } from 'react'
import {
  buildSchedule,
  buildScheduleWithPrepayment,
  fmt,
  fmtKorean,
  fmtMonths,
  METHOD_DESC,
  METHOD_LABELS,
  PREPAY_MODE_DESC,
  PREPAY_MODE_LABELS,
  type LoanResult,
  type PrepayMode,
  type RepaymentMethod,
} from './lib/loan'

const STORAGE_KEY = 'loan-calculator-v1'

interface Inputs {
  principal: number
  rate: number
  years: number
  method: RepaymentMethod
  compareMode: boolean
  prepayEnabled: boolean
  prepayMonth: number
  prepayAmount: number
  prepayFeePct: number
  prepayMode: PrepayMode
}

const DEFAULTS: Inputs = {
  principal: 300_000_000,
  rate: 4.5,
  years: 30,
  method: 'annuity',
  compareMode: false,
  prepayEnabled: false,
  prepayMonth: 12,
  prepayAmount: 50_000_000,
  prepayFeePct: 1.2,
  prepayMode: 'shortenTerm',
}

function loadInputs(): Inputs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULTS
    const p = JSON.parse(raw)
    return {
      principal: Number(p.principal) || DEFAULTS.principal,
      rate: Number(p.rate) >= 0 ? Number(p.rate) : DEFAULTS.rate,
      years: Number(p.years) || DEFAULTS.years,
      method: ['annuity', 'equalPrincipal', 'bullet'].includes(p.method) ? p.method : DEFAULTS.method,
      compareMode: Boolean(p.compareMode),
      prepayEnabled: Boolean(p.prepayEnabled),
      prepayMonth: Number(p.prepayMonth) || DEFAULTS.prepayMonth,
      prepayAmount: Number(p.prepayAmount) || DEFAULTS.prepayAmount,
      prepayFeePct: Number(p.prepayFeePct) >= 0 ? Number(p.prepayFeePct) : DEFAULTS.prepayFeePct,
      prepayMode: ['shortenTerm', 'reducePayment'].includes(p.prepayMode)
        ? p.prepayMode
        : DEFAULTS.prepayMode,
    }
  } catch {
    return DEFAULTS
  }
}

/* ---------- 입력 컴포넌트 ---------- */

function MoneyInput({
  value,
  onChange,
  min,
  max,
  step,
}: {
  value: number
  onChange: (v: number) => void
  min: number
  max: number
  step: number
}) {
  const [text, setText] = useState(fmt(value))
  useEffect(() => setText(fmt(value)), [value])

  return (
    <div>
      <div className="relative">
        <input
          inputMode="numeric"
          value={text}
          onChange={(e) => {
            const digits = e.target.value.replace(/[^0-9]/g, '')
            const n = digits === '' ? 0 : Math.min(Number(digits), max)
            setText(digits === '' ? '' : fmt(n))
            onChange(n)
          }}
          onBlur={() => setText(fmt(value))}
          className="w-full rounded-xl border border-zinc-700/80 bg-zinc-900/80 px-4 py-3 pr-12 text-right text-lg font-semibold tabular-nums text-zinc-100 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30"
        />
        <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm text-zinc-500">
          원
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={Math.min(Math.max(value, min), max)}
        onChange={(e) => onChange(Number(e.target.value))}
        className="slider mt-3 w-full"
      />
      <p className="mt-1 text-right text-xs text-emerald-400/90">{fmtKorean(value)}</p>
    </div>
  )
}

function NumberInput({
  value,
  onChange,
  min,
  max,
  step,
  unit,
}: {
  value: number
  onChange: (v: number) => void
  min: number
  max: number
  step: number
  unit: string
}) {
  return (
    <div>
      <div className="relative">
        <input
          inputMode="decimal"
          type="number"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => {
            const n = Number(e.target.value)
            if (!Number.isNaN(n)) onChange(Math.min(Math.max(n, 0), max))
          }}
          className="w-full rounded-xl border border-zinc-700/80 bg-zinc-900/80 px-4 py-3 pr-12 text-right text-lg font-semibold tabular-nums text-zinc-100 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        />
        <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm text-zinc-500">
          {unit}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={Math.min(Math.max(value, min), max)}
        onChange={(e) => onChange(Number(e.target.value))}
        className="slider mt-3 w-full"
      />
    </div>
  )
}

/* ---------- 차트 ---------- */

function DonutChart({ principal, interest }: { principal: number; interest: number }) {
  const total = principal + interest
  const interestRatio = total > 0 ? interest / total : 0
  const R = 56
  const C = 2 * Math.PI * R
  return (
    <div className="flex items-center gap-6">
      <svg viewBox="0 0 140 140" className="h-36 w-36 shrink-0 -rotate-90">
        <circle cx="70" cy="70" r={R} fill="none" stroke="#10b981" strokeWidth="18" />
        <circle
          cx="70"
          cy="70"
          r={R}
          fill="none"
          stroke="#f59e0b"
          strokeWidth="18"
          strokeDasharray={`${C * interestRatio} ${C}`}
          className="transition-all duration-500"
        />
      </svg>
      <div className="min-w-0 flex-1 space-y-2 text-sm">
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 shrink-0 rounded-sm bg-emerald-500" />
          <span className="text-zinc-400">원금</span>
          <span className="ml-auto font-semibold tabular-nums text-zinc-100">
            {(100 - interestRatio * 100).toFixed(1)}%
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 shrink-0 rounded-sm bg-amber-500" />
          <span className="text-zinc-400">이자</span>
          <span className="ml-auto font-semibold tabular-nums text-zinc-100">
            {(interestRatio * 100).toFixed(1)}%
          </span>
        </div>
        <p className="pt-1 text-xs leading-relaxed text-zinc-500">
          원금 {fmtKorean(principal)}
          <br />
          이자 {fmtKorean(interest)}
        </p>
      </div>
    </div>
  )
}

function StackedBarChart({
  rows,
}: {
  rows: { month: number; principal: number; interest: number }[]
}) {
  // 최대 60개 막대로 다운샘플링
  const bars = useMemo(() => {
    const N = Math.min(60, rows.length)
    if (N === 0) return []
    const out: { principal: number; interest: number }[] = []
    const chunk = rows.length / N
    for (let i = 0; i < N; i++) {
      const start = Math.floor(i * chunk)
      const end = Math.max(start + 1, Math.floor((i + 1) * chunk))
      const slice = rows.slice(start, end)
      out.push({
        principal: slice.reduce((s, r) => s + r.principal, 0) / slice.length,
        interest: slice.reduce((s, r) => s + r.interest, 0) / slice.length,
      })
    }
    return out
  }, [rows])

  const maxV = Math.max(...bars.map((b) => b.principal + b.interest), 1)
  const W = 600
  const H = 150
  const gap = 1.5
  const bw = bars.length > 0 ? W / bars.length - gap : 0

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-36 w-full" preserveAspectRatio="none">
        {bars.map((b, i) => {
          const x = i * (bw + gap)
          const hP = (b.principal / maxV) * H
          const hI = (b.interest / maxV) * H
          return (
            <g key={i}>
              <rect x={x} y={H - hI} width={bw} height={hI} fill="#f59e0b" />
              <rect x={x} y={H - hI - hP} width={bw} height={hP} fill="#10b981" />
            </g>
          )
        })}
      </svg>
      <div className="mt-2 flex justify-between text-xs text-zinc-500">
        <span>1회차</span>
        <span>월 납입금 구성 (원금 / 이자)</span>
        <span>{rows.length}회차</span>
      </div>
    </div>
  )
}

const METHOD_COLORS: Record<RepaymentMethod, string> = {
  annuity: '#10b981',
  equalPrincipal: '#38bdf8',
  bullet: '#f59e0b',
}

function CompareLineChart({ results }: { results: Record<RepaymentMethod, LoanResult> }) {
  const W = 600
  const H = 180
  const methods = Object.keys(METHOD_LABELS) as RepaymentMethod[]
  const maxV = Math.max(
    ...methods.flatMap((m) => results[m].rows.map((r) => r.payment)),
    1,
  )
  const months = Math.max(...methods.map((m) => results[m].rows.length), 1)

  // 만기일시는 마지막 회차에 원금이 몰려 스케일이 깨지므로, 마지막 회차를 제외한 최대값으로 스케일링
  const maxVBody = Math.max(
    ...methods.flatMap((m) => results[m].rows.slice(0, -1).map((r) => r.payment)),
    1,
  )
  const clip = maxV > maxVBody * 3
  const yMax = clip ? maxVBody * 1.15 : maxV * 1.05

  const pathFor = (m: RepaymentMethod) => {
    const rows = results[m].rows
    if (rows.length === 0) return ''
    const N = Math.min(120, rows.length)
    const pts: string[] = []
    for (let i = 0; i < N; i++) {
      const idx = Math.min(rows.length - 1, Math.round((i / (N - 1 || 1)) * (rows.length - 1)))
      const x = (rows[idx].month / months) * W
      const y = H - Math.min(rows[idx].payment / yMax, 1) * H
      pts.push(`${x.toFixed(1)},${y.toFixed(1)}`)
    }
    return pts.join(' ')
  }

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-44 w-full" preserveAspectRatio="none">
        {[0.25, 0.5, 0.75].map((t) => (
          <line key={t} x1={0} x2={W} y1={H * t} y2={H * t} stroke="#3f3f46" strokeWidth="0.5" strokeDasharray="4 4" />
        ))}
        {methods.map((m) => (
          <polyline
            key={m}
            points={pathFor(m)}
            fill="none"
            stroke={METHOD_COLORS[m]}
            strokeWidth="2.5"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ))}
      </svg>
      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-xs">
        {methods.map((m) => (
          <span key={m} className="flex items-center gap-1.5 text-zinc-400">
            <span className="h-0.5 w-5 rounded-full" style={{ backgroundColor: METHOD_COLORS[m] }} />
            {METHOD_LABELS[m]}
          </span>
        ))}
        <span className="ml-auto text-zinc-600">1회차 → {months}회차</span>
      </div>
      {clip && (
        <p className="mt-2 text-xs text-zinc-500">
          만기일시 상환의 마지막 회차(원금 일시 상환)는 스케일을 위해 차트에서 잘려 표시됩니다.
        </p>
      )}
    </div>
  )
}

/* ---------- 메인 ---------- */

export default function App() {
  const [inputs, setInputs] = useState<Inputs>(loadInputs)
  const [showAll, setShowAll] = useState(false)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(inputs))
  }, [inputs])

  const months = Math.round(inputs.years * 12)
  const baseResult = useMemo(
    () => buildSchedule(inputs.principal, inputs.rate, months, inputs.method),
    [inputs.principal, inputs.rate, months, inputs.method],
  )

  const prepayMonth = Math.min(Math.max(Math.round(inputs.prepayMonth), 1), Math.max(months - 1, 1))
  const prepayResult = useMemo(
    () =>
      inputs.prepayEnabled
        ? buildScheduleWithPrepayment(inputs.principal, inputs.rate, months, inputs.method, {
            month: prepayMonth,
            amount: inputs.prepayAmount,
            feePct: inputs.prepayFeePct,
            mode: inputs.prepayMode,
          })
        : null,
    [
      inputs.prepayEnabled,
      inputs.principal,
      inputs.rate,
      months,
      inputs.method,
      prepayMonth,
      inputs.prepayAmount,
      inputs.prepayFeePct,
      inputs.prepayMode,
    ],
  )

  const result = prepayResult ?? baseResult
  const visibleRows = showAll ? result.rows : result.rows.slice(0, 12)
  const set = (patch: Partial<Inputs>) => setInputs((p) => ({ ...p, ...patch }))

  // 3종 비교 모드 (중도상환 미적용, 기본 조건 비교)
  const compareResults = useMemo(() => {
    const out = {} as Record<RepaymentMethod, LoanResult>
    for (const m of Object.keys(METHOD_LABELS) as RepaymentMethod[]) {
      out[m] = buildSchedule(inputs.principal, inputs.rate, months, m)
    }
    return out
  }, [inputs.principal, inputs.rate, months])
  const bestMethod = useMemo(() => {
    const ms = Object.keys(METHOD_LABELS) as RepaymentMethod[]
    return ms.reduce((best, m) =>
      compareResults[m].totalInterest < compareResults[best].totalInterest ? m : best,
    )
  }, [compareResults])

  // 중도상환 전/후 비교
  const savedInterest = prepayResult ? baseResult.totalInterest - prepayResult.totalInterest : 0
  const savedMonths = prepayResult ? months - prepayResult.rows.length : 0
  const paymentBefore = baseResult.rows[prepayMonth]?.payment ?? 0
  const paymentAfter = prepayResult?.rows[prepayMonth]?.payment ?? 0

  const monthlyLabel =
    inputs.method === 'annuity'
      ? '월 납입금'
      : inputs.method === 'equalPrincipal'
        ? '첫 달 납입금'
        : '월 이자'

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="pointer-events-none fixed inset-x-0 top-0 h-72 bg-gradient-to-b from-emerald-500/10 to-transparent" />
      <main className="relative mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <header className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">
            대출 계산기<span className="text-emerald-400">.</span>
          </h1>
          <p className="mt-2 text-sm text-zinc-400">
            원리금균등 · 원금균등 · 만기일시 상환 방식별 월 상환액과 총 이자를 한눈에 비교하세요.
          </p>
        </header>

        <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
          {/* 입력 패널 */}
          <section className="h-fit space-y-6 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 backdrop-blur lg:sticky lg:top-6">
            <div>
              <label className="mb-2 block text-sm font-medium text-zinc-300">대출 원금</label>
              <MoneyInput
                value={inputs.principal}
                onChange={(v) => set({ principal: v })}
                min={1_000_000}
                max={2_000_000_000}
                step={1_000_000}
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-zinc-300">연이자율</label>
              <NumberInput
                value={inputs.rate}
                onChange={(v) => set({ rate: v })}
                min={0}
                max={20}
                step={0.1}
                unit="%"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-zinc-300">
                대출 기간 <span className="text-xs text-zinc-500">({months}개월)</span>
              </label>
              <NumberInput
                value={inputs.years}
                onChange={(v) => set({ years: v })}
                min={1}
                max={40}
                step={1}
                unit="년"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-zinc-300">상환 방식</label>
              <div className="grid grid-cols-3 gap-1 rounded-xl bg-zinc-800/80 p-1">
                {(Object.keys(METHOD_LABELS) as RepaymentMethod[]).map((m) => (
                  <button
                    key={m}
                    onClick={() => set({ method: m })}
                    className={`rounded-lg px-2 py-2 text-sm font-medium transition ${
                      inputs.method === m
                        ? 'bg-emerald-600 text-white shadow'
                        : 'text-zinc-400 hover:bg-zinc-700/60 hover:text-zinc-200'
                    }`}
                  >
                    {METHOD_LABELS[m]}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-xs leading-relaxed text-zinc-500">{METHOD_DESC[inputs.method]}</p>
            </div>

            {/* 중도상환 시뮬레이션 */}
            <div className="border-t border-zinc-800 pt-5">
              <label className="flex cursor-pointer items-center justify-between">
                <span className="text-sm font-medium text-zinc-300">중도상환 시뮬레이션</span>
                <button
                  role="switch"
                  aria-checked={inputs.prepayEnabled}
                  onClick={() => set({ prepayEnabled: !inputs.prepayEnabled })}
                  className={`relative h-6 w-11 rounded-full transition ${
                    inputs.prepayEnabled ? 'bg-emerald-600' : 'bg-zinc-700'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${
                      inputs.prepayEnabled ? 'left-[22px]' : 'left-0.5'
                    }`}
                  />
                </button>
              </label>

              {inputs.prepayEnabled && (
                <div className="mt-4 space-y-5">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-zinc-300">
                      중도상환 시점{' '}
                      <span className="text-xs text-zinc-500">
                        ({prepayMonth}회차 납입 직후 · 약 {fmtMonths(prepayMonth)} 후)
                      </span>
                    </label>
                    <NumberInput
                      value={prepayMonth}
                      onChange={(v) => set({ prepayMonth: v })}
                      min={1}
                      max={Math.max(months - 1, 1)}
                      step={1}
                      unit="회차"
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-zinc-300">중도상환 금액</label>
                    <MoneyInput
                      value={inputs.prepayAmount}
                      onChange={(v) => set({ prepayAmount: v })}
                      min={1_000_000}
                      max={inputs.principal}
                      step={1_000_000}
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-zinc-300">
                      중도상환 수수료율
                    </label>
                    <NumberInput
                      value={inputs.prepayFeePct}
                      onChange={(v) => set({ prepayFeePct: v })}
                      min={0}
                      max={3}
                      step={0.1}
                      unit="%"
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-zinc-300">상환 후 방식</label>
                    <div className="grid grid-cols-2 gap-1 rounded-xl bg-zinc-800/80 p-1">
                      {(Object.keys(PREPAY_MODE_LABELS) as PrepayMode[]).map((m) => (
                        <button
                          key={m}
                          onClick={() => set({ prepayMode: m })}
                          className={`rounded-lg px-2 py-2 text-sm font-medium transition ${
                            inputs.prepayMode === m
                              ? 'bg-emerald-600 text-white shadow'
                              : 'text-zinc-400 hover:bg-zinc-700/60 hover:text-zinc-200'
                          }`}
                        >
                          {PREPAY_MODE_LABELS[m]}
                        </button>
                      ))}
                    </div>
                    <p className="mt-2 text-xs leading-relaxed text-zinc-500">
                      {inputs.method === 'bullet'
                        ? '만기일시 상환은 중도상환 후 잔액에 대한 월 이자와 만기 상환액이 줄어듭니다.'
                        : PREPAY_MODE_DESC[inputs.prepayMode]}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* 결과 패널 */}
          <section className="space-y-6">
            {/* 보기 모드 전환 */}
            <div className="grid max-w-xs grid-cols-2 gap-1 rounded-xl bg-zinc-800/80 p-1">
              {([false, true] as const).map((mode) => (
                <button
                  key={String(mode)}
                  onClick={() => set({ compareMode: mode })}
                  className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                    inputs.compareMode === mode
                      ? 'bg-emerald-600 text-white shadow'
                      : 'text-zinc-400 hover:bg-zinc-700/60 hover:text-zinc-200'
                  }`}
                >
                  {mode ? '3종 비교' : '단일 방식'}
                </button>
              ))}
            </div>

            {inputs.compareMode ? (
              <>
                {inputs.prepayEnabled && (
                  <p className="rounded-xl border border-zinc-800 bg-zinc-900/60 px-4 py-3 text-xs text-zinc-500">
                    비교 모드에서는 중도상환 시뮬레이션이 적용되지 않으며, 기본 대출 조건으로 세 방식을
                    비교합니다.
                  </p>
                )}

                <div className="grid gap-3 sm:grid-cols-3">
                  {(Object.keys(METHOD_LABELS) as RepaymentMethod[]).map((m) => {
                    const res = compareResults[m]
                    const isBest = m === bestMethod
                    return (
                      <div
                        key={m}
                        className={`rounded-2xl border p-5 ${
                          isBest
                            ? 'border-emerald-600/60 bg-emerald-500/10'
                            : 'border-zinc-800 bg-zinc-900/60'
                        }`}
                      >
                        <div className="mb-4 flex items-center gap-2">
                          <span
                            className="h-2.5 w-2.5 shrink-0 rounded-full"
                            style={{ backgroundColor: METHOD_COLORS[m] }}
                          />
                          <h3 className="text-sm font-semibold text-zinc-100">{METHOD_LABELS[m]}</h3>
                          {isBest && (
                            <span className="ml-auto rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-semibold text-white">
                              총 이자 최소
                            </span>
                          )}
                        </div>
                        <dl className="space-y-3 text-sm">
                          <CompareRow label={m === 'bullet' ? '월 이자' : '첫 달 납입금'} value={`${fmt(res.firstPayment)}원`} />
                          <CompareRow label="마지막 회차 납입금" value={`${fmt(res.lastPayment)}원`} />
                          <CompareRow
                            label="총 이자"
                            value={`${fmt(res.totalInterest)}원`}
                            highlight={isBest}
                          />
                          <CompareRow label="총 상환액" value={`${fmt(res.totalPayment)}원`} />
                        </dl>
                      </div>
                    )
                  })}
                </div>

                <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
                  <h2 className="mb-4 text-sm font-semibold text-zinc-300">월 납입금 추이 비교</h2>
                  <CompareLineChart results={compareResults} />
                </div>

                <p className="text-xs leading-relaxed text-zinc-500">
                  {METHOD_LABELS[bestMethod]} 방식이 총 이자{' '}
                  <span className="font-semibold text-emerald-400">
                    {fmtKorean(compareResults[bestMethod].totalInterest)}
                  </span>
                  으로 가장 적습니다. 다만 방식에 따라 초기 납입 부담이 다르므로 월 상환 여력을 함께
                  고려하세요.
                </p>
              </>
            ) : (
              <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <SummaryCard label={monthlyLabel} value={`${fmt(result.firstPayment)}원`} accent />
              <SummaryCard
                label={inputs.method === 'equalPrincipal' ? '마지막 달 납입금' : '마지막 회차 납입금'}
                value={`${fmt(result.lastPayment)}원`}
              />
              <SummaryCard label="총 이자" value={`${fmt(result.totalInterest)}원`} warn />
              <SummaryCard label="총 상환액" value={`${fmt(result.totalPayment)}원`} />
            </div>

            {prepayResult && (
              <div className="rounded-2xl border border-emerald-800/50 bg-emerald-500/5 p-5">
                <h2 className="mb-1 text-sm font-semibold text-emerald-300">중도상환 효과</h2>
                <p className="mb-4 text-xs text-zinc-500">
                  {prepayMonth}회차 납입 직후 {fmtKorean(prepayResult.prepayApplied)} 중도상환 ·{' '}
                  {PREPAY_MODE_LABELS[inputs.prepayMode]}
                  {prepayResult.fee > 0 && ` · 수수료 ${fmt(prepayResult.fee)}원`}
                </p>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <SummaryCard label="절감되는 총 이자" value={`${fmt(savedInterest)}원`} accent />
                  {inputs.prepayMode === 'shortenTerm' && inputs.method !== 'bullet' ? (
                    <SummaryCard
                      label="단축되는 기간"
                      value={savedMonths > 0 ? fmtMonths(savedMonths) : '없음'}
                      accent
                    />
                  ) : (
                    <SummaryCard
                      label="이후 월 납입금"
                      value={`${fmt(paymentBefore)} → ${fmt(paymentAfter)}원`}
                      accent
                    />
                  )}
                  <SummaryCard label="중도상환 수수료" value={`${fmt(prepayResult.fee)}원`} warn />
                  <SummaryCard
                    label="순 절감액 (이자−수수료)"
                    value={`${fmt(savedInterest - prepayResult.fee)}원`}
                  />
                </div>
              </div>
            )}

            <div className="grid gap-6 sm:grid-cols-2">
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
                <h2 className="mb-4 text-sm font-semibold text-zinc-300">원금 vs 이자 비중</h2>
                <DonutChart principal={inputs.principal} interest={result.totalInterest} />
              </div>
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
                <h2 className="mb-4 text-sm font-semibold text-zinc-300">월별 납입금 구성</h2>
                <StackedBarChart rows={result.rows} />
              </div>
            </div>

            <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/60">
              <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-4">
                <h2 className="text-sm font-semibold text-zinc-300">월별 상환 스케줄</h2>
                <button
                  onClick={() => setShowAll((s) => !s)}
                  className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-300 transition hover:border-emerald-500 hover:text-emerald-400"
                >
                  {showAll ? '12회차만 보기' : `전체 ${result.rows.length}회차 보기`}
                </button>
              </div>
              <div className="max-h-[480px] overflow-auto">
                <table className="w-full text-sm tabular-nums">
                  <thead className="sticky top-0 z-10 bg-zinc-900 text-xs text-zinc-500">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium">회차</th>
                      <th className="px-4 py-3 text-right font-medium">납입금</th>
                      <th className="px-4 py-3 text-right font-medium">원금</th>
                      <th className="px-4 py-3 text-right font-medium">이자</th>
                      <th className="px-4 py-3 text-right font-medium">잔액</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/70">
                    {visibleRows.map((r) => (
                      <tr
                        key={r.month}
                        className={`transition hover:bg-zinc-800/40 ${
                          prepayResult && r.month === prepayMonth ? 'bg-emerald-500/10' : ''
                        }`}
                      >
                        <td className="px-4 py-2.5 text-zinc-500">{r.month}</td>
                        <td className="px-4 py-2.5 text-right font-medium text-zinc-100">
                          {fmt(r.payment)}
                        </td>
                        <td className="px-4 py-2.5 text-right text-emerald-400/90">{fmt(r.principal)}</td>
                        <td className="px-4 py-2.5 text-right text-amber-400/90">{fmt(r.interest)}</td>
                        <td className="px-4 py-2.5 text-right text-zinc-400">{fmt(r.balance)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
              </>
            )}
          </section>
        </div>

        <footer className="mt-10 text-center text-xs text-zinc-600">
          본 계산기는 참고용이며 실제 대출 조건은 금융기관에 따라 다를 수 있습니다.
        </footer>
      </main>
    </div>
  )
}

function CompareRow({
  label,
  value,
  highlight,
}: {
  label: string
  value: string
  highlight?: boolean
}) {
  return (
    <div>
      <dt className="text-xs text-zinc-400">{label}</dt>
      <dd
        className={`mt-0.5 break-words font-semibold tabular-nums ${
          highlight ? 'text-emerald-300' : 'text-zinc-100'
        }`}
      >
        {value}
      </dd>
    </div>
  )
}

function SummaryCard({
  label,
  value,
  accent,
  warn,
}: {
  label: string
  value: string
  accent?: boolean
  warn?: boolean
}) {
  return (
    <div
      className={`rounded-2xl border p-4 ${
        accent
          ? 'border-emerald-700/50 bg-emerald-500/10'
          : warn
            ? 'border-amber-700/50 bg-amber-500/10'
            : 'border-zinc-800 bg-zinc-900/60'
      }`}
    >
      <p className="text-xs text-zinc-400">{label}</p>
      <p
        className={`mt-1.5 break-words text-base font-bold tabular-nums sm:text-lg ${
          accent ? 'text-emerald-300' : warn ? 'text-amber-300' : 'text-zinc-100'
        }`}
      >
        {value}
      </p>
    </div>
  )
}
