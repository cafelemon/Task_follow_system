import {
  AlertOutlined,
  ClockCircleOutlined,
  FileTextOutlined,
  SafetyOutlined,
} from '@ant-design/icons';
import { Tag, Typography } from 'antd';
import type { AnyRecord } from '../../api/client';
import { StatusTag } from '../../components/StatusTag';
import {
  buildSubTaskUpdatePath,
  daysUntil,
} from '../../ui/taskDisplay';
import { RoleSummaryCard } from './RoleSummaryCards';
import type { RolePriorityItem } from './RoleSummaryCards';

function dueTime(task: AnyRecord) {
  if (!task.due_date) return Number.POSITIVE_INFINITY;
  const value = new Date(`${task.due_date}T00:00:00`).getTime();
  return Number.isNaN(value) ? Number.POSITIVE_INFINITY : value;
}

function executorPriority(task: AnyRecord) {
  if (task.weekly_update_status === 'draft') return 0;
  if (task.is_due_soon) return 1;
  if (task.status !== 'completed' && task.weekly_update_status !== 'submitted') return 2;
  if (task.can_create_risk && task.status !== 'completed') return 3;
  return 4;
}

function priorityTag(task: AnyRecord) {
  if (task.weekly_update_status === 'draft') return <Tag color="gold">草稿未提交</Tag>;
  if (task.is_due_soon) return <Tag color="red">临近截止</Tag>;
  if (task.status !== 'completed' && task.weekly_update_status !== 'submitted') return <Tag color="orange">待更新</Tag>;
  if (task.can_create_risk && task.status !== 'completed') return <Tag color="purple">可登记风险</Tag>;
  return <StatusTag value={task.weekly_status || task.status} />;
}

function priorityTasks(tasks: AnyRecord[]) {
  return [...tasks]
    .filter((task) => executorPriority(task) < 4)
    .sort((left, right) => {
      const byPriority = executorPriority(left) - executorPriority(right);
      if (byPriority !== 0) return byPriority;
      const byDue = dueTime(left) - dueTime(right);
      if (byDue !== 0) return byDue;
      return Number(left.id || 0) - Number(right.id || 0);
    })
    .slice(0, 2);
}

function taskMeta(task: AnyRecord) {
  const dueDays = daysUntil(task.due_date);
  const dueText = task.due_date ? `截止 ${task.due_date}` : '无截止日期';
  const dueHint = dueDays != null && dueDays >= 0 ? ` · 距截止 ${dueDays} 天` : '';
  return (
    <Typography.Text type="secondary">
      {task.department_task || '-'} · {dueText}{dueHint}
    </Typography.Text>
  );
}

export function ExecutorWorkbenchCard({
  executionTasks,
  pendingTasks,
  draftTasks,
  dueSoonTasks,
  riskReadyTasks,
  hasExecutorRole,
  onCreateRisk,
}: {
  executionTasks: AnyRecord[];
  pendingTasks: AnyRecord[];
  draftTasks: AnyRecord[];
  dueSoonTasks: AnyRecord[];
  riskReadyTasks: AnyRecord[];
  hasExecutorRole: boolean;
  onCreateRisk: (task: AnyRecord) => void;
}) {
  if (!hasExecutorRole && !executionTasks.length) return null;

  const decoratedTasks = executionTasks.map((task) => ({
    ...task,
    is_due_soon: dueSoonTasks.some((item) => item.id === task.id),
  }));

  const items: RolePriorityItem[] = priorityTasks(decoratedTasks).map((task) => ({
    key: `executor-${task.id}`,
    eyebrow: task.code || '-',
    title: task.title || '-',
    meta: taskMeta(task),
    status: priorityTag(task),
    action: {
      label: task.can_update_weekly ? '更新' : '查看',
      to: task.can_update_weekly ? buildSubTaskUpdatePath(task) : `/sub-tasks/${task.id}/update`,
      primary: true,
    },
    secondaryAction: task.can_create_risk && task.status !== 'completed'
      ? { label: '风险', onClick: () => onCreateRisk(task) }
      : undefined,
  }));

  return (
    <RoleSummaryCard
      eyebrow="执行者"
      title="子任务执行周更新"
      description="先处理草稿、临近截止和待更新任务；完整列表进入子任务执行页。"
      metrics={[
        { label: '待更新', value: pendingTasks.length, icon: <ClockCircleOutlined />, tone: pendingTasks.length ? 'warning' : 'default' },
        { label: '草稿未提交', value: draftTasks.length, icon: <FileTextOutlined />, tone: draftTasks.length ? 'warning' : 'default' },
        { label: '临近截止', value: dueSoonTasks.length, icon: <AlertOutlined />, tone: dueSoonTasks.length ? 'danger' : 'default' },
        { label: '可登记风险', value: riskReadyTasks.length, icon: <SafetyOutlined />, tone: riskReadyTasks.length ? 'warning' : 'default' },
      ]}
      items={items}
      emptyText="当前没有需要你执行的子任务；如有临时或补充工作，可提交待归类事项。"
      actions={[
        { label: '进入子任务执行', to: '/sub-tasks', primary: true },
        { label: '查看周报中心', to: '/weekly-report' },
      ]}
    />
  );
}
