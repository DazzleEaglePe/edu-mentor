import type { components, operations, paths } from './generated/openapi.js';

export type ApiComponents = components;
export type ApiOperations = operations;
export type ApiPaths = paths;

export type ApiError = components['schemas']['ErrorEnvelope'];
export type AuthMe = components['schemas']['AuthMe'];
export type Deliverable = components['schemas']['Deliverable'];
export type Enrollment = components['schemas']['Enrollment'];
export type MentorAssignment = components['schemas']['MentorAssignment'];
export type Oleada = components['schemas']['Oleada'];
export type Session = components['schemas']['Session'];
