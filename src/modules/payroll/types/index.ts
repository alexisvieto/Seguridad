export type {
  PayrollConfig,
  PayrollPeriod,
  PayrollAgentConsolidated,
  PayrollPeriodStatus,
} from '@/shared/types/database';

export interface CreatePeriodInput {
  tenant_id: string;
  start_date: string;
  end_date: string;
}

export interface CalculatePayrollInput {
  tenant_id: string;
  payroll_period_id: string;
}

export interface AdjustAgentPayrollInput {
  consolidated_id: string;
  adjustments_addition?: number;
  adjustments_deduction?: number;
}

export interface PayrollSummary {
  totalAgents: number;
  totalGross: number;
  totalNet: number;
  totalSS: number;
  totalEI: number;
  totalRegularHours: number;
  totalOvertimeHours: number;
}
