export type RepaymentMethod = 'annuity' | 'equalPrincipal' | 'bullet'

export interface ScheduleRow {
  month: number
  payment: number
  principal: number
  interest: number
  balance: number
}

export interface LoanResult {
  rows: ScheduleRow[]
  totalPayment: number
  totalInterest: number
  firstPayment: number
  lastPayment: number
}

export const METHOD_LABELS: Record<RepaymentMethod, string> = {
  annuity: '원리금균등',
  equalPrincipal: '원금균등',
  bullet: '만기일시',
}

export const METHOD_DESC: Record<RepaymentMethod, string> = {
  annuity: '매월 동일한 금액(원금+이자)을 상환합니다. 초반에는 이자 비중이 높습니다.',
  equalPrincipal: '매월 동일한 원금을 상환하며, 이자가 줄어 납입금이 점점 감소합니다.',
  bullet: '매월 이자만 납부하고, 만기에 원금을 일시 상환합니다.',
}

export function buildSchedule(
  principal: number,
  annualRatePct: number,
  months: number,
  method: RepaymentMethod,
): LoanResult {
  const r = annualRatePct / 100 / 12
  const rows: ScheduleRow[] = []
  let balance = principal

  if (months <= 0 || principal <= 0) {
    return { rows: [], totalPayment: 0, totalInterest: 0, firstPayment: 0, lastPayment: 0 }
  }

  if (method === 'annuity') {
    const payment =
      r === 0 ? principal / months : (principal * r * Math.pow(1 + r, months)) / (Math.pow(1 + r, months) - 1)
    for (let m = 1; m <= months; m++) {
      const interest = balance * r
      let prin = payment - interest
      let pay = payment
      if (m === months) {
        // 마지막 회차 잔액 보정
        prin = balance
        pay = prin + interest
      }
      balance = Math.max(0, balance - prin)
      rows.push({ month: m, payment: pay, principal: prin, interest, balance })
    }
  } else if (method === 'equalPrincipal') {
    const prinPerMonth = principal / months
    for (let m = 1; m <= months; m++) {
      const interest = balance * r
      const prin = m === months ? balance : prinPerMonth
      const pay = prin + interest
      balance = Math.max(0, balance - prin)
      rows.push({ month: m, payment: pay, principal: prin, interest, balance })
    }
  } else {
    for (let m = 1; m <= months; m++) {
      const interest = principal * r
      const prin = m === months ? principal : 0
      const pay = prin + interest
      balance = m === months ? 0 : principal
      rows.push({ month: m, payment: pay, principal: prin, interest, balance })
    }
  }

  const totalInterest = rows.reduce((s, x) => s + x.interest, 0)
  const totalPayment = rows.reduce((s, x) => s + x.payment, 0)
  return {
    rows,
    totalPayment,
    totalInterest,
    firstPayment: rows[0]?.payment ?? 0,
    lastPayment: rows[rows.length - 1]?.payment ?? 0,
  }
}

export function fmt(n: number): string {
  return Math.round(n).toLocaleString('ko-KR')
}

export function fmtKorean(n: number): string {
  const v = Math.round(n)
  if (v === 0) return '0원'
  const eok = Math.floor(v / 100_000_000)
  const man = Math.floor((v % 100_000_000) / 10_000)
  const rest = v % 10_000
  const parts: string[] = []
  if (eok > 0) parts.push(`${eok.toLocaleString('ko-KR')}억`)
  if (man > 0) parts.push(`${man.toLocaleString('ko-KR')}만`)
  if (rest > 0 && eok === 0) parts.push(`${rest.toLocaleString('ko-KR')}`)
  return parts.join(' ') + '원'
}
