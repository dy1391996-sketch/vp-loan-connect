export interface EmiResult {
  monthlyEmi: number;
  totalRepayment: number;
  totalInterest: number;
}

export function calculateEmi(principal: number, annualRate: number, tenureMonths: number): EmiResult {
  if (!Number.isFinite(principal) || principal <= 0) throw new Error("Principal must be greater than zero.");
  if (!Number.isFinite(annualRate) || annualRate < 0 || annualRate > 100) throw new Error("Interest rate must be between 0 and 100.");
  if (!Number.isInteger(tenureMonths) || tenureMonths < 1 || tenureMonths > 360) throw new Error("Tenure must be between 1 and 360 months.");

  const monthlyRate = annualRate / 12 / 100;
  const monthlyEmi =
    monthlyRate === 0
      ? principal / tenureMonths
      : (principal * monthlyRate * (1 + monthlyRate) ** tenureMonths) /
        ((1 + monthlyRate) ** tenureMonths - 1);
  const totalRepayment = monthlyEmi * tenureMonths;

  return {
    monthlyEmi: roundMoney(monthlyEmi),
    totalRepayment: roundMoney(totalRepayment),
    totalInterest: roundMoney(totalRepayment - principal),
  };
}

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
