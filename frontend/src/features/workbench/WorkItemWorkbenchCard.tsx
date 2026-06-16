import {
  ApartmentOutlined,
  CheckCircleOutlined,
  FileAddOutlined,
  InboxOutlined,
} from '@ant-design/icons';
import { Tag, Typography } from 'antd';
import type { AnyRecord } from '../../api/client';
import { RoleSummaryCard } from './RoleSummaryCards';
import type { RolePriorityItem } from './RoleSummaryCards';

function itemTime(value?: string | null) {
  if (!value) return 0;
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
}

function statusTag(item: AnyRecord) {
  const status = item.status;
  if (status === 'pending') return <Tag color="blue">待确认</Tag>;
  if (status === 'approved') return <Tag color="green">已确认</Tag>;
  if (status === 'converted_to_sub_task') return <Tag color="purple">已转子任务</Tag>;
  if (status === 'rejected') return <Tag color="red">已退回</Tag>;
  if (status === 'closed') return <Tag>已关闭</Tag>;
  if (status === 'withdrawn') return <Tag>已撤回</Tag>;
  return <Tag>{item.status_label || status || '-'}</Tag>;
}

function relatedText(item: AnyRecord) {
  if (item.related_department_task) {
    return item.related_department_task.title || item.related_department_task.code || '关联部门任务';
  }
  if (item.collaboration_department) {
    return `协作：${item.collaboration_department.name || '-'}`;
  }
  if (item.department) {
    return item.department.name || '本部门';
  }
  return item.category_label || '待归类事项';
}

function priorityItems({
  submittedItems,
  receivedItems,
  onOpenWorkItems,
}: {
  submittedItems: AnyRecord[];
  receivedItems: AnyRecord[];
  onOpenWorkItems: () => void;
}): RolePriorityItem[] {
  const received = [...receivedItems]
    .sort((left, right) => itemTime(right.created_at) - itemTime(left.created_at))
    .map((item) => ({
      key: `received-work-item-${item.id}`,
      eyebrow: item.category_label || '待处理',
      title: item.content || '-',
      meta: <Typography.Text type="secondary">{relatedText(item)}</Typography.Text>,
      status: item.can_convert_to_sub_task ? <Tag color="purple">可转子任务</Tag> : statusTag(item),
      action: { label: '处理', onClick: onOpenWorkItems, primary: true },
    }));

  const submitted = [...submittedItems]
    .filter((item) => item.status === 'pending' || item.status === 'approved' || item.status === 'converted_to_sub_task')
    .sort((left, right) => itemTime(right.created_at) - itemTime(left.created_at))
    .map((item) => ({
      key: `submitted-work-item-${item.id}`,
      eyebrow: item.category_label || '我的提交',
      title: item.content || '-',
      meta: <Typography.Text type="secondary">{relatedText(item)}</Typography.Text>,
      status: statusTag(item),
      action: { label: '查看', onClick: onOpenWorkItems },
    }));

  return [...received, ...submitted].slice(0, 3);
}

export function WorkItemWorkbenchCard({
  submittedItems,
  receivedItems,
  onSubmitWorkItem,
  onOpenWorkItems,
  onOpenAutomationSettings,
}: {
  submittedItems: AnyRecord[];
  receivedItems: AnyRecord[];
  onSubmitWorkItem: () => void;
  onOpenWorkItems: () => void;
  onOpenAutomationSettings?: () => void;
}) {
  const pendingSubmitted = submittedItems.filter((item) => item.status === 'pending');
  const convertibleItems = receivedItems.filter((item) => item.can_convert_to_sub_task);

  return (
    <RoleSummaryCard
      eyebrow="待归类事项"
      title="补充事项入口"
      description="提交临时、补充或周报材料事项；需要处理的事项回到完整面板。"
      metrics={[
        { label: '我的提交', value: submittedItems.length, icon: <FileAddOutlined /> },
        { label: '待我处理', value: receivedItems.length, icon: <InboxOutlined />, tone: receivedItems.length ? 'warning' : 'default' },
        { label: '可转子任务', value: convertibleItems.length, icon: <ApartmentOutlined />, tone: convertibleItems.length ? 'warning' : 'default' },
        { label: '待确认', value: pendingSubmitted.length, icon: <CheckCircleOutlined />, tone: pendingSubmitted.length ? 'warning' : 'default' },
      ]}
      items={priorityItems({ submittedItems, receivedItems, onOpenWorkItems })}
      emptyText="当前没有待处理事项；如有临时、补充或周报材料，可从这里提交。"
      actions={[
        { label: '提交待归类事项', onClick: onSubmitWorkItem, primary: true },
        { label: '处理待归类事项', onClick: onOpenWorkItems },
        ...(onOpenAutomationSettings ? [{ label: '审批与通知设置', onClick: onOpenAutomationSettings }] : []),
        { label: '查看周报中心', to: '/weekly-report' },
      ]}
    />
  );
}
