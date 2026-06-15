import { Space, Tag, Tooltip, Typography } from 'antd';
import type { AnyRecord } from '../api/client';

export const relationLabels: Record<string, { label: string; color: string }> = {
  executor: { label: '我执行', color: 'blue' },
  owner: { label: '我负责', color: 'gold' },
  both: { label: '负责+执行', color: 'purple' },
  management: { label: '管理查看', color: 'default' }
};

export function renderPeople(value?: AnyRecord[] | string | null) {
  if (Array.isArray(value)) {
    const names = value.map((item) => item.name).join('、');
    return (
      <Tooltip title={names || undefined}>
        <Space wrap size={[4, 4]} className="people-cell">
          {value.length ? value.map((item) => <Tag className="person-tag" title={item.name} key={item.id}>{item.name}</Tag>) : <Typography.Text type="secondary">-</Typography.Text>}
        </Space>
      </Tooltip>
    );
  }
  if (value) {
    return (
      <Tooltip title={value}>
        <Tag className="person-tag person-tag-single" title={value}>{value}</Tag>
      </Tooltip>
    );
  }
  return <Typography.Text type="secondary">-</Typography.Text>;
}

export function isExecutorTask(task: AnyRecord) {
  return task.viewer_relation === 'executor' || task.viewer_relation === 'both';
}

export function buildSubTaskUpdatePath(task: AnyRecord) {
  const assigneeId = task.current_assignee_id;
  return `/sub-tasks/${task.id}/update${assigneeId ? `?assigneeId=${assigneeId}` : ''}`;
}

export function daysUntil(dateText?: string | null) {
  if (!dateText) return null;
  const due = new Date(`${dateText}T00:00:00`);
  if (Number.isNaN(due.getTime())) return null;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.ceil((due.getTime() - today.getTime()) / 86400000);
}

export function isDueSoonTask(task: AnyRecord) {
  if (task.status === 'completed') return false;
  const days = daysUntil(task.due_date);
  return days != null && days >= 0 && days <= 7;
}
