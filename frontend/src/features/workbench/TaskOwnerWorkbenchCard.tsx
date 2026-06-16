import {
  ApartmentOutlined,
  ClockCircleOutlined,
  FlagOutlined,
  FolderOpenOutlined,
} from '@ant-design/icons';
import { Tag, Typography } from 'antd';
import type { AnyRecord } from '../../api/client';
import { StatusTag } from '../../components/StatusTag';
import { RoleSummaryCard } from './RoleSummaryCards';
import type { RolePriorityItem } from './RoleSummaryCards';

function activeSubTaskCount(task: AnyRecord) {
  return (task.sub_tasks || []).filter((item: AnyRecord) => item.status !== 'archived').length;
}

function isSplitCandidate(task: AnyRecord) {
  return Boolean(task.can_split && ((task.pending_split_count || 0) > 0 || activeSubTaskCount(task) === 0));
}

function itemTime(value?: string | null) {
  if (!value) return 0;
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
}

function dueTime(task: AnyRecord) {
  if (!task.due_date) return Number.POSITIVE_INFINITY;
  const parsed = new Date(`${task.due_date}T00:00:00`).getTime();
  return Number.isNaN(parsed) ? Number.POSITIVE_INFINITY : parsed;
}

function workItemLabel(item: AnyRecord) {
  if (item.can_convert_to_sub_task) return <Tag color="purple">可转子任务</Tag>;
  if (item.can_cross_department_approve) return <Tag color="blue">待确认协作</Tag>;
  return <Tag color="orange">待处理</Tag>;
}

function workItemMeta(item: AnyRecord) {
  return (
    <Typography.Text type="secondary">
      {item.related_department_task?.title || item.collaboration_department?.name || item.department?.name || '待处理事项'}
    </Typography.Text>
  );
}

function departmentTaskMeta(task: AnyRecord) {
  return (
    <Typography.Text type="secondary">
      {task.parent_task || task.parent_task_title || '-'} · 待拆 {task.pending_split_count || 0}
    </Typography.Text>
  );
}

function subTaskMeta(task: AnyRecord) {
  return (
    <Typography.Text type="secondary">
      {task.department_task || '-'}{task.due_date ? ` · 截止 ${task.due_date}` : ''}
    </Typography.Text>
  );
}

function buildPriorityItems({
  receivedItems,
  splitDepartmentTasks,
  ownerTasks,
  onOpenWorkItems,
}: {
  receivedItems: AnyRecord[];
  splitDepartmentTasks: AnyRecord[];
  ownerTasks: AnyRecord[];
  onOpenWorkItems: () => void;
}): RolePriorityItem[] {
  const convertible = receivedItems
    .filter((item) => item.can_convert_to_sub_task)
    .sort((left, right) => itemTime(right.created_at) - itemTime(left.created_at))
    .map((item) => ({
      key: `convertible-${item.id}`,
      eyebrow: item.category_label || '待归类事项',
      title: item.content || '-',
      meta: workItemMeta(item),
      status: workItemLabel(item),
      action: { label: '处理', onClick: onOpenWorkItems, primary: true },
    }));

  const otherWorkItems = receivedItems
    .filter((item) => !item.can_convert_to_sub_task)
    .sort((left, right) => itemTime(right.created_at) - itemTime(left.created_at))
    .map((item) => ({
      key: `received-${item.id}`,
      eyebrow: item.category_label || '待归类事项',
      title: item.content || '-',
      meta: workItemMeta(item),
      status: workItemLabel(item),
      action: { label: '处理', onClick: onOpenWorkItems, primary: true },
    }));

  const departmentTasks = splitDepartmentTasks
    .sort((left, right) => dueTime(left) - dueTime(right))
    .map((task) => ({
      key: `department-task-${task.id}`,
      eyebrow: task.code || '部门任务',
      title: task.title || '-',
      meta: departmentTaskMeta(task),
      status: <Tag color="gold">待拆</Tag>,
      action: { label: '部门任务', to: '/department-tasks', primary: true },
    }));

  const followUpTasks = ownerTasks
    .filter((task) => task.status !== 'completed')
    .sort((left, right) => dueTime(left) - dueTime(right))
    .map((task) => ({
      key: `owner-task-${task.id}`,
      eyebrow: task.code || '-',
      title: task.title || '-',
      meta: subTaskMeta(task),
      status: <StatusTag value={task.status} />,
      action: { label: '子任务', to: '/sub-tasks', primary: true },
    }));

  return [...convertible, ...otherWorkItems, ...departmentTasks, ...followUpTasks].slice(0, 2);
}

export function TaskOwnerWorkbenchCard({
  tasks,
  receivedItems,
  departmentTasks,
  hasTaskOwnerRole,
  onOpenWorkItems,
}: {
  tasks: AnyRecord[];
  receivedItems: AnyRecord[];
  departmentTasks: AnyRecord[];
  hasTaskOwnerRole: boolean;
  onOpenWorkItems: () => void;
}) {
  const ownerTasks = tasks.filter((task) => task.viewer_relation === 'owner' || task.viewer_relation === 'both');
  const taskOwnerDepartmentTasks = departmentTasks.filter((task) => task.can_split);
  const splitDepartmentTasks = taskOwnerDepartmentTasks.filter(isSplitCandidate);
  const convertibleItems = receivedItems.filter((item) => item.can_convert_to_sub_task);
  if (!hasTaskOwnerRole && !ownerTasks.length && !receivedItems.length && !taskOwnerDepartmentTasks.length) return null;

  return (
    <RoleSummaryCard
      eyebrow="任务负责人"
      title="拆解入口"
      description="先处理待归类事项和待拆部门任务，完整拆解回到部门任务页。"
      metrics={[
        { label: '待处理事项', value: receivedItems.length, icon: <FlagOutlined />, tone: receivedItems.length ? 'warning' : 'default' },
        { label: '可转子任务', value: convertibleItems.length, icon: <ApartmentOutlined />, tone: convertibleItems.length ? 'warning' : 'default' },
        { label: '负责部门任务', value: taskOwnerDepartmentTasks.length, icon: <FolderOpenOutlined /> },
        { label: '待拆子任务', value: splitDepartmentTasks.reduce((total, task) => total + Math.max(Number(task.pending_split_count || 0), activeSubTaskCount(task) ? 0 : 1), 0), icon: <ClockCircleOutlined />, tone: splitDepartmentTasks.length ? 'warning' : 'default' },
      ]}
      items={buildPriorityItems({ receivedItems, splitDepartmentTasks, ownerTasks, onOpenWorkItems })}
      emptyText="当前没有需要你处理的任务负责人事项。"
      actions={[
        { label: '处理待归类事项', onClick: onOpenWorkItems, primary: true },
        { label: '进入部门任务', to: '/department-tasks' },
        { label: '进入子任务执行', to: '/sub-tasks' },
      ]}
    />
  );
}
