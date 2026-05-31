// ---------------------------------------------------------------------------
// Panama ACH File Generator — Standard Commercial Format
// Generates CSV-delimited flat file for mass bank transfers
// ---------------------------------------------------------------------------

export interface ACHAgentRecord {
  cedula: string | null;
  agentName: string;
  bankCode: string | null;
  bankAccountNumber: string | null;
  bankAccountType: 'ahorros' | 'corriente' | null;
  netSalary: number;
}

export interface ACHGenerationResult {
  success: boolean;
  content: string;
  filename: string;
  agentCount: number;
  totalAmount: number;
  missingBankData: { agentName: string; missingFields: string[] }[];
}

function sanitizeText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[ñÑ]/g, (c) => (c === 'ñ' ? 'n' : 'N'))
    .replace(/[,;"'\\]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

function sanitizeCedula(cedula: string): string {
  return cedula.replace(/[^0-9A-Za-z]/g, '').toUpperCase();
}

function formatAmount(amount: number): string {
  return Math.max(0, amount).toFixed(2);
}

function formatAccountType(type: 'ahorros' | 'corriente'): string {
  return type === 'ahorros' ? 'AHO' : 'CTE';
}

export function generatePanamaACH(
  agents: ACHAgentRecord[],
  companyAccountNumber: string,
  periodLabel: string,
): ACHGenerationResult {
  const missingBankData: ACHGenerationResult['missingBankData'] = [];
  const validRecords: string[] = [];
  let totalAmount = 0;

  for (const agent of agents) {
    if (agent.netSalary <= 0) continue;

    const missing: string[] = [];
    if (!agent.cedula) missing.push('cedula');
    if (!agent.bankCode) missing.push('codigo de banco');
    if (!agent.bankAccountNumber) missing.push('numero de cuenta');
    if (!agent.bankAccountType) missing.push('tipo de cuenta');

    if (missing.length > 0) {
      missingBankData.push({
        agentName: agent.agentName,
        missingFields: missing,
      });
      continue;
    }

    const line = [
      sanitizeCedula(agent.cedula!),
      sanitizeText(agent.agentName),
      agent.bankCode!,
      agent.bankAccountNumber!,
      formatAccountType(agent.bankAccountType!),
      formatAmount(agent.netSalary),
      sanitizeText(periodLabel),
    ].join(',');

    validRecords.push(line);
    totalAmount += agent.netSalary;
  }

  const header = [
    'HDR',
    sanitizeText('NEXGUARD360'),
    companyAccountNumber,
    new Date().toISOString().split('T')[0],
    String(validRecords.length),
    formatAmount(totalAmount),
    sanitizeText(periodLabel),
  ].join(',');

  const content = [header, ...validRecords].join('\n');

  const dateSlug = periodLabel
    .replace(/\s+/g, '_')
    .replace(/[^A-Za-z0-9_]/g, '')
    .toUpperCase();

  return {
    success: missingBankData.length === 0,
    content,
    filename: `ACH_PLANILLA_${dateSlug}.txt`,
    agentCount: validRecords.length,
    totalAmount: Math.round(totalAmount * 100) / 100,
    missingBankData,
  };
}
