import { Alert, Button, Card, Empty, Modal, Space, Tabs, Tag, Typography, message } from 'antd';
import { useEffect, useState } from 'react';
import { getJson, postJson } from '../../api/client';
import type { AnyRecord } from '../../api/client';

const statusColors: Record<string, string> = {
  pending: 'blue',
  withdrawn: 'default',
  approved: 'green',
  rejected: 'red',
  closed: 'default'
};

function formatDateTime(value?: string | null) {
  if (!value) return '-';
  return value.replace('T', ' ').slice(0, 16);
}

function relatedText(item: AnyRecord) {
  if (item.related_department_task) {
    const task = item.related_department_task;
    return `${task.code || '-'} ${task.title || '-'}`;
  }
  if (item.collaboration_department) {
    return `协作部门：${item.collaboration_department.name}`;
  }
  if (item.department) {
    return `提交部门：${item.department.name}`;
  }
  return '未关联对象';
}

function WorkItemCard({
  item,
  readonly,
  onWithdraw
}: {
  item: AnyRecord;
  readonly?: boolean;
  onWithdraw?: (item: AnyRecord) => void;
}) {
  return (
    <div className="work-item-card">
      <Space direction="vertical" size={10} className="full-width">
        <div className="work-item-card-head">
          <div>
            <Typography.Text type="secondary">{item.category_label || '-'}</Typography.Text>
            <Typography.Title level={5}>{item.content || '-'}</Typography.Title>
          </div>
          <Tag color={statusColors[item.status] || 'default'}>{item.status_label || item.status || '-'}</Tag>
        </div>
        <div className="mobile-task-meta compact">
          <span>关联对象</span><Typography.Text>{relatedText(item)}</Typography.Text>
          <span>提交人</span><Typography.Text>{item.submitter?.name || '-'}</Typography.Text>
          <span>提交时间</span><Typography.Text>{formatDateTime(item.created_at)}</Typography.Text>
          <span>撤回时间</span><Typography.Text>{formatDateTime(item.withdrawn_at)}</Typography.Text>
        </div>
        {readonly ? (
          <Alert type="info" showIcon message="本版仅展示待确认事项，处理能力将在 4.4.x 开放。" />
        ) : item.can_withdraw ? (
          <Button danger onClick={() => onWithdraw?.(item)}>撤回</Button>
        ) : null}
      </Space>
    </div>
  );
}

export function WorkItemPanel({ refreshKey = 0 }: { refreshKey?: number }) {
  const [submitted, setSubmitted] = useState<AnyRecord[]>([]);
  const [received, setReceived] = useState<AnyRecord[]>([]);
  const [loading, setLoading] = useState(false);

  const reload = async () => {
    setLoading(true);
    try {
      const [submittedItems, receivedItems] = await Promise.all([
        getJson<AnyRecord[]>('/work-items?scope=submitted'),
        getJson<AnyRecord[]>('/work-items?scope=received')
      ]);
      setSubmitted(submittedItems);
      setReceived(receivedItems);
    } catch {
      message.error('待归类事项加载失败，请刷新重试');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    reload();
  }, [refreshKey]);

  const withdraw = (item: AnyRecord) => {
    Modal.confirm({
      title: '撤回待归类事项？',
      content: '撤回后该事项不会进入后续确认流程，但历史记录会保留。',
      okText: '确认撤回',
      cancelText: '取消',
      okButtonProps: { danger: true },
      onOk: async () => {
        await postJson(`/work-items/${item.id}/withdraw`, {});
        message.success('已撤回');
        await reload();
      }
    });
  };

  return (
    <Card className="business-card workbench-section-card">
      <div className="workbench-section-head">
        <div>
          <Typography.Title level={4}>待归类事项</Typography.Title>
          <Typography.Text type="secondary">提交的临时和补充事项先进入待确认，不进入正式任务统计。</Typography.Text>
        </div>
        <Button onClick={reload} loading={loading}>刷新</Button>
      </div>
      <Tabs
        items={[
          {
            key: 'submitted',
            label: `我的提交 ${submitted.length}`,
            children: submitted.length ? (
              <div className="work-item-list">
                {submitted.map((item) => <WorkItemCard key={item.id} item={item} onWithdraw={withdraw} />)}
              </div>
            ) : (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无已提交待归类事项" />
            )
          },
          {
            key: 'received',
            label: `待我确认 ${received.length}`,
            children: received.length ? (
              <div className="work-item-list">
                {received.map((item) => <WorkItemCard key={item.id} item={item} readonly />)}
              </div>
            ) : (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无待你确认的事项" />
            )
          }
        ]}
      />
    </Card>
  );
}
