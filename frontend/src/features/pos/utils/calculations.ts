import type { CartItem, CartTaxBreakdown } from '../types';

export function calculateCartTotals(
  items: CartItem[],
  loyaltyDiscount = 0,
  isInterState = false,
  isTaxInclusive = true
): CartTaxBreakdown {
  let subtotal = 0;
  let totalDiscount = 0;
  let totalTaxable = 0;
  let totalTax = 0;

  for (const item of items) {
    const lineGross = item.unit_price * item.quantity;
    const lineDiscount = item.discount * item.quantity;
    const lineNet = Math.max(0, lineGross - lineDiscount);

    subtotal += lineGross;
    totalDiscount += lineDiscount;

    const rate = Number(item.tax_slab) || 0;

    if (isTaxInclusive) {
      const taxable = lineNet / (1 + rate / 100);
      const tax = lineNet - taxable;
      totalTaxable += taxable;
      totalTax += tax;
    } else {
      const taxable = lineNet;
      const tax = (taxable * rate) / 100;
      totalTaxable += taxable;
      totalTax += tax;
    }
  }

  let cgstAmount = 0;
  let sgstAmount = 0;
  let igstAmount = 0;

  if (isInterState) {
    igstAmount = Number(totalTax.toFixed(2));
  } else {
    cgstAmount = Number((totalTax / 2).toFixed(2));
    sgstAmount = Number((totalTax / 2).toFixed(2));
  }

  const effectiveLoyalty = Math.min(loyaltyDiscount, subtotal - totalDiscount);
  const netPayableBeforeRoundOff = Math.max(
    0,
    (isTaxInclusive ? subtotal - totalDiscount : totalTaxable + totalTax) - effectiveLoyalty
  );

  const roundedGrandTotal = Math.round(netPayableBeforeRoundOff);
  const roundOff = Number((roundedGrandTotal - netPayableBeforeRoundOff).toFixed(2));

  return {
    subtotal: Number(subtotal.toFixed(2)),
    totalDiscount: Number(totalDiscount.toFixed(2)),
    taxableAmount: Number(totalTaxable.toFixed(2)),
    cgstAmount,
    sgstAmount,
    igstAmount,
    totalGst: Number(totalTax.toFixed(2)),
    loyaltyDiscount: Number(effectiveLoyalty.toFixed(2)),
    netPayableBeforeRoundOff: Number(netPayableBeforeRoundOff.toFixed(2)),
    roundOff,
    grandTotal: roundedGrandTotal,
  };
}
