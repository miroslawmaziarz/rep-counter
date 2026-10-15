import patientList from "./patients.json";

/**
 * A person doing the exercise, and the only kind of caller. The `token` is
 * demo-only: the web bundle carries every Patient's token.
 */
export type Patient = {
  id: string;
  name: string;
  token: string;
};

/** Every Patient the app knows. Plain data, so core stays pure. */
export const patients: readonly Patient[] = patientList;
