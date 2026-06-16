import type { GuideAuthPayload, GuideState } from './types';

export function guideKeyForCurrentPage({
  guideProfile,
  pathname,
  guides
}: {
  guideProfile?: string | null;
  pathname: string;
  guides?: GuideAuthPayload['guides'];
}) {
  if (guideProfile === 'executive_office') {
    return pathname.startsWith('/meeting-board')
      ? guides?.modules?.meeting_board?.guide_key
      : guides?.system?.guide_key;
  }
  if (guideProfile === 'department_owner') {
    if (pathname.startsWith('/parent-tasks')) return guides?.modules?.parent_tasks?.guide_key;
    if (pathname.startsWith('/department-tasks')) return guides?.modules?.department_tasks?.guide_key;
    if (pathname.startsWith('/sub-tasks')) return guides?.modules?.sub_tasks?.guide_key;
    return guides?.system?.guide_key;
  }
  if (guideProfile === 'task_owner') {
    if (pathname.startsWith('/department-tasks')) return guides?.modules?.department_tasks?.guide_key;
    if (pathname.startsWith('/sub-tasks')) return guides?.modules?.sub_tasks?.guide_key;
    return guides?.system?.guide_key;
  }
  if (guideProfile === 'executor') {
    if (pathname.startsWith('/sub-tasks')) return guides?.modules?.sub_tasks?.guide_key;
    return guides?.system?.guide_key;
  }
  if (guideProfile === 'observer') {
    if (pathname.startsWith('/meeting-board')) return guides?.modules?.meeting_board?.guide_key;
    if (pathname.startsWith('/parent-tasks')) return guides?.modules?.parent_tasks?.guide_key;
    if (pathname.startsWith('/department-tasks')) return guides?.modules?.department_tasks?.guide_key;
    if (pathname.startsWith('/timeline')) return guides?.modules?.timeline?.guide_key;
    if (pathname.startsWith('/sub-tasks')) return guides?.modules?.sub_tasks?.guide_key;
    return guides?.system?.guide_key;
  }
  return guideProfile ? 'legacy' : null;
}

export function guideForMenuPath(guides: GuideAuthPayload['guides'] | undefined, key: string): GuideState | null | undefined {
  if (key === '/meeting-board') return guides?.modules?.meeting_board;
  if (key === '/parent-tasks') return guides?.modules?.parent_tasks;
  if (key === '/department-tasks') return guides?.modules?.department_tasks;
  if (key === '/sub-tasks') return guides?.modules?.sub_tasks;
  if (key === '/timeline') return guides?.modules?.timeline;
  return null;
}
