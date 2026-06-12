import { useEffect, useMemo, useState } from 'react'
import {
  buildSchedule,
  fmt,
  fmtKorean,
  METHOD_DESC,
  METHOD_LABELS,
  type RepaymentMethod,
} from './lib/loan'

const STORAGE_KEY = 'loan-calculator-v1'

interface Inputs {
  principal: number
  rate: number
  years: number
  method: RepaymentMethod
}

const DEFAULTS: Inputs = { principal: 300_000_000, rate: 4.5, years: 30, method: 'annuity' }

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

/* ---------- 메인 ---------- */

export default function App() {
  const [inputs, setInputs] = useState<Inputs>(loadInputs)
  const [showAll, setShowAll] = useState(false)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(inputs))
  }, [inputs])

  const months = Math.round(inputs.years * 12)
  const result = useMemo(
    () => buildSchedule(inputs.principal, inputs.rate, months, inputs.method),
    [inputs.principal, inputs.rate, months, inputs.method],
  )

  const visibleRows = showAll ? result.rows : result.rows.slice(0, 12)
  const set = (patch: Partial<Inputs>) => setInputs((p) => ({ ...p, ...patch }))

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
          </section>

          {/* 결과 패널 */}
          <section className="space-y-6">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <SummaryCard label={monthlyLabel} value={`${fmt(result.firstPayment)}원`} accent />
              <SummaryCard
                label={inputs.method === 'equalPrincipal' ? '마지막 달 납입금' : '마지막 회차 납입금'}
                value={`${fmt(result.lastPayment)}원`}
              />
              <SummaryCard label="총 이자" value={`${fmt(result.totalInterest)}원`} warn />
              <SummaryCard label="총 상환액" value={`${fmt(result.totalPayment)}원`} />
            </div>

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
                      <tr key={r.month} className="transition hover:bg-zinc-800/40">
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
          </section>
        </div>

        <footer className="mt-10 text-center text-xs text-zinc-600">
          본 계산기는 참고용이며 실제 대출 조건은 금융기관에 따라 다를 수 있습니다.
        </footer>
      </main>
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
        className={`mt-1.5 truncate text-base font-bold tabular-nums sm:text-lg ${
          accent ? 'text-emerald-300' : warn ? 'text-amber-300' : 'text-zinc-100'
        }`}
        title={value}
      >
        {value}
      </p>
    </div>
  )
}
