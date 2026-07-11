// Central place for all pricing numbers. Amounts in ₹, coins are platform currency.

export const COINS_PER_MIN = 6; // what a customer spends per minute of video
export const MODEL_EARN_PER_MIN = 3; // ₹ credited to the model per minute
export const TRIAL_COINS = 30; // free coins on signup (~5 minutes)
export const MIN_PAYOUT = 500; // ₹ minimum withdrawal

export const COIN_PACKAGES = [
  { id: "small", coins: 300, price: 499, tag: "Starter" },
  { id: "medium", coins: 900, price: 1199, tag: "Popular" },
  { id: "large", coins: 2000, price: 1999, tag: "Best value" },
] as const;

export const GIFTS = [
  { id: "rose", emoji: "🌹", label: "Rose", coins: 10 },
  { id: "kiss", emoji: "💋", label: "Kiss", coins: 25 },
  { id: "ring", emoji: "💍", label: "Ring", coins: 60 },
  { id: "crown", emoji: "👑", label: "Crown", coins: 150 },
] as const;

export const GIFT_MODEL_SHARE = 0.6; // model keeps 60% of a gift's value (as ₹)
