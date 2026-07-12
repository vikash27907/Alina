// Single source of truth for all pricing. READ THIS BEFORE CHANGING MONEY LOGIC.
//
// Two currencies, never mixed:
//   • Customers hold COINS (integer). 1 coin = ₹1 mental model. Coins never
//     convert back to cash (bought coins are non-refundable once spent).
//   • Models hold PAISE (integer, 100 paise = ₹1). All model money — earnings,
//     balance, payouts — is stored and computed in paise to avoid rounding bugs.

export const COIN_PRICE_INR = 1; // 1 coin = ₹1 at checkout
export const CALL_RATE = 10; // coins per minute a customer spends in a 1-to-1 call
export const MODEL_RATE_PAISE = 300; // ₹3.00/min credited to the model
export const LOYALTY_MIN = 10; // from the Nth minute of the SAME call...
export const LOYALTY_BONUS_PAISE = 100; // ...the model earns +₹1.00/min
export const GIFT_PAYOUT_PCT = 30; // model keeps 30% of a gift's ₹ value
export const TRIAL_MINUTES = 1; // free trial minutes granted after phone verification
export const CONVERSION_BONUS_PAISE = 1000; // ₹10 to the model when a trial caller later buys
export const CONVERSION_WINDOW_H = 24; // trial→purchase attribution window
export const MIN_PAYOUT_PAISE = 50000; // ₹500 minimum withdrawal

// Couple rooms (private 2-person rooms). Only the creator pays; joining is free.
export const FREE_ROOMS_PER_DAY = 1; // first room each day is free
export const ROOM_CREATE_COST = 5; // coins to create beyond the free one
export const ROOM_EXTEND_COST = 10; // coins to add another 30 minutes
export const ROOM_MINUTES = 30; // free room duration before the extend prompt

export const COIN_PACKAGES = [
  { id: "small", coins: 300, price: 499, tag: "Starter" },
  { id: "medium", coins: 900, price: 1199, tag: "Popular" },
  { id: "large", coins: 2000, price: 1999, tag: "Best value" },
] as const;

// Gift coin costs. Model credit (paise) = coins * GIFT_PAYOUT_PCT (one formula,
// no per-gift special cases): e.g. rose 10 coins → 10*30 = 300 paise = ₹3.
export const GIFTS = [
  { id: "rose", emoji: "🌹", label: "Rose", coins: 10 },
  { id: "kiss", emoji: "💋", label: "Kiss", coins: 25 },
  { id: "ring", emoji: "💍", label: "Ring", coins: 100 },
  { id: "crown", emoji: "👑", label: "Crown", coins: 500 },
] as const;

/** Format paise as a ₹ string, e.g. 12345 → "₹123.45". */
export function rupees(paise: number): string {
  return `₹${(paise / 100).toFixed(2)}`;
}
