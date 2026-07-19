import type { AxeMatchers } from "vitest-axe/matchers";

declare module "vitest" {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type -- merges axe matchers into expect
  interface Assertion extends AxeMatchers {}
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type -- merges axe matchers into expect
  interface AsymmetricMatchersContaining extends AxeMatchers {}
}
