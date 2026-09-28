import Decimal from "decimal.js";
import { z } from "zod";
const amount = z.number().finite().min(0).max(1e12);
export const calculationSchema = z.object({
  quantity: amount.nullable(),
  purchase_price: amount.nullable(),
  sales_price: amount.nullable(),
  delivery: amount,
  customs_duty: amount,
  certification: amount,
  vat: amount.max(100),
  markup: amount.max(1000),
  additional_costs: amount,
  currency: z.string().regex(/^[A-Z]{3}$/),
});
export function calculate(input: z.infer<typeof calculationSchema>) {
  const p = calculationSchema.parse(input);
  if (p.quantity === null || p.purchase_price === null)
    return { ...p, margin: null, total: null };
  const cost = new Decimal(p.purchase_price)
    .mul(p.quantity)
    .plus(p.delivery)
    .plus(p.customs_duty)
    .plus(p.certification)
    .plus(p.additional_costs);
  const revenue =
    p.sales_price === null
      ? cost.mul(new Decimal(1).plus(new Decimal(p.markup).div(100)))
      : new Decimal(p.sales_price).mul(p.quantity);
  const total = revenue
    .mul(new Decimal(1).plus(new Decimal(p.vat).div(100)))
    .toDecimalPlaces(2);
  if (total.mul(100).gt(Number.MAX_SAFE_INTEGER))
    throw Error("Calculation exceeds supported precision");
  return {
    ...p,
    margin: revenue.isZero()
      ? null
      : revenue.minus(cost).div(revenue).mul(100).toDecimalPlaces(4).toNumber(),
    total: total.toNumber(),
  };
}
