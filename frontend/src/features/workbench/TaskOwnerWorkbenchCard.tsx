import {
  ClockCircleOutlined,
  FolderOpenOutlined,
} from '@ant-design/icons';
import { Tag, Typography } from 'antd';
import type { AnyRecord } from '../../api/client';
import { RoleSummaryCard } from './RoleSummaryCards';
import type { RolePriorityItem } from './RoleSummaryCards';

function activeSubTaskCount(task: AnyRecord) {
  return (task.sub_tasks || []).filter((item: AnyRecord) => item.status !== 'archived').length;
}

function isSplitCandidate(task: AnyRecord) {
  return Boolean(task.can_split && ((task.pending_split_count || 0) > 0 || activeSubTaskCount(task) === 0));
}

function dueTime(task: AnyRecord) {
  if (!task.due_date) return Number.POSITIVE_INFINITY;
  const parsed = new Date(`${task.due_date}T00:00:00`).getTime();
  return Number.isNaN(parsed) ? Number.POSITIVE_INFINITY : parsed;
}

function departmentTaskMeta(task: AnyRecord) {
  return (
    <Typography.Text type="secondary">
      {task.parent_task || task.parent_task_title || '-'} · 待拆 {task.pending_split_count || 0}
    </Typography.Text>
  );
}

function buildPriorityItems({
  splitDepartmentTasks,
  departmentTasks,
}: {
  splitDepartmentTasks: AnyRecord[];
  departmentTasks: AnyRecord[];
}): RolePriorityItem[] {
  const splitItems = splitDepartmentTasks
    .sort((left, right) => dueTime(left) - dueTime(right))
    .map((task) => ({
      key: `department-task-${task.id}`,
      eyebrow: task.code || '部门任务',
      title: task.title || '-',
      meta: departmentTaskMeta(task),
      status: <Tag color="gold">待拆</Tag>,
      action: { label: '部门任务', to: '/department-tasks', primary: true },
    }));
  const regularItems = departmentTasks
    .filter((task) => !splitDepartmentTasks.some((item) => item.id === task.id))
    .sort((left, right) => dueTime(left) - dueTime(right))
    .map((task) => ({
      key: `department-task-regular-${task.id}`,
      eyebrow: task.code || '部门任务',
      title: task.title || '-',
      meta: departmentTaskMeta(task),
      status: <Tag color="blue">负责</Tag>,
      action: { label: '部门任务', to: '/department-tasks', primary: true },
    }));

  return [...splitItems, ...regularItems].slice(0, 2);
}

export function TaskOwnerWorkbenchCard({
  tasks,
  receivedItems,
  departmentTasks,
  currentUserId,
  hasTaskOwnerRole,
  onOpenWorkItems,
}: {
  tasks: AnyRecord[];
  receivedItems: AnyRecord[];
  departmentTasks: AnyRecord[];
  currentUserId?: number | string | null;
  hasTaskOwnerRole: boolean;
  onOpenWorkItems: () => void;
}) {
  const currentUserIdText = currentUserId == null ? null : String(currentUserId);
  const isCurrentUserOwner = (task: AnyRecord) => {
    const ownerIds = (task.owner_ids || []).map((id: number | string) => String(id));
    if (currentUserIdText && ownerIds.includes(currentUserIdText)) return true;
    return Boolean(task.viewer_is_direct_owner && ownerIds.length === 0);
  };
  const taskOwnerDepartmentTasks = departmentTasks.filter(isCurrentUserOwner);
  const splitDepartmentTasks = taskOwnerDepartmentTasks.filter(isSplitCandidate);
  if (!hasTaskOwnerRole && !taskOwnerDepartmentTasks.length) return null;

  return (
    <RoleSummaryCard
      eyebrow="任务负责人"
      title="拆解入口"
      description="拆解工作统一回到部门任务页处理。"
      metrics={[
        { label: '负责部门任务', value: taskOwnerDepartmentTasks.length, icon: <FolderOpenOutlined /> },
        { label: '待拆子任务', value: splitDepartmentTasks.reduce((total, task) => total + Math.max(Number(task.pending_split_count || 0), activeSubTaskCount(task) ? 0 : 1), 0), icon: <ClockCircleOutlined />, tone: splitDepartmentTasks.length ? 'warning' : 'default' },
      ]}
      items={buildPriorityItems({ splitDepartmentTasks, departmentTasks: taskOwnerDepartmentTasks })}
      emptyText="当前没有需要拆解的部门任务。"
      actions={[
        { label: '进入部门任务', to: '/department-tasks', primary: true },
      ]}
    />
  );
}
