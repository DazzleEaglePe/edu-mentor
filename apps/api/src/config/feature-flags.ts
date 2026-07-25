export const FEATURE_FLAGS = Symbol('FEATURE_FLAGS');

export interface FeatureFlags {
  readonly agenda: boolean;
  readonly deliverables: boolean;
}

const acceptedBooleanValues = new Map<string, boolean>([
  ['0', false],
  ['1', true],
  ['false', false],
  ['true', true],
]);

function parseBooleanFlag(name: string, value: string | undefined): boolean {
  if (value === undefined) {
    return false;
  }

  const parsed = acceptedBooleanValues.get(value.trim().toLowerCase());

  if (parsed === undefined) {
    throw new Error(`${name} must be one of: true, false, 1, 0.`);
  }

  return parsed;
}

export function loadFeatureFlags(environment: NodeJS.ProcessEnv = process.env): FeatureFlags {
  return {
    agenda: parseBooleanFlag('FEATURE_AGENDA', environment.FEATURE_AGENDA),
    deliverables: parseBooleanFlag('FEATURE_DELIVERABLES', environment.FEATURE_DELIVERABLES),
  };
}
