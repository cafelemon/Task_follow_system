import { buildDepartmentOwnerSteps } from './departmentOwner';
import { buildExecutorSteps } from './executor';
import { buildExecutiveSteps } from './executive';
import { buildLegacySteps } from './legacy';
import { buildObserverSteps } from './observer';
import { buildTaskOwnerSteps } from './taskOwner';
import type { GuideBuildContext, GuideSteps } from './types';

export function buildGuideStepsByKey(context: GuideBuildContext): Record<string, GuideSteps> {
  return {
    legacy: buildLegacySteps(context),
    ...buildExecutiveSteps(context),
    ...buildDepartmentOwnerSteps(context),
    ...buildTaskOwnerSteps(context),
    ...buildExecutorSteps(context),
    ...buildObserverSteps(context)
  };
}
