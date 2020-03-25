const HALF_PI = Math.PI / 2

export default function sinMinus (amount) {
  return Math.sin(HALF_PI + (HALF_PI * amount))
}
