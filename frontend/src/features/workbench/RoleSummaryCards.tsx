import { Button, Card, Empty, Space, Tag, Typography } from 'antd';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

export type RoleMetric = {
  label: string;
  value: number;
  icon?: ReactNode;
  tone?: 'default' | 'warning' | 'danger' | 'success';
};

export type RoleAction = {
  label: string;
  to?: string;
  onClick?: () => void;
  primary?: boolean;
};

export type RolePriorityItem = {
  key: string;
  eyebrow?: string;
  title: string;
  meta?: ReactNode;
  status?: ReactNode;
  action?: RoleAction;
  secondaryAction?: RoleAction;
};

function renderRoleAction(action: RoleAction) {
  if (action.to) {
    return (
      <Link className={action.primary ? 'mobile-primary-link' : 'mobile-secondary-link'} to={action.to}>
        {action.label}
      </Link>
    );
  }
  return (
    <Button type={action.primary ? 'primary' : 'default'} onClick={action.onClick}>
      {action.label}
    </Button>
  );
}

export function RoleSummaryCard({
  eyebrow,
  title,
  description,
  metrics,
  items,
  emptyText,
  actions
}: {
  eyebrow: string;
  title: string;
  description: string;
  metrics: RoleMetric[];
  items: RolePriorityItem[];
  emptyText: string;
  actions: RoleAction[];
}) {
  return (
    <Card className="business-card workbench-role-card">
      <Space direction="vertical" size={14} className="full-width">
        <div className="workbench-role-card-head">
          <div>
            <Typography.Text type="secondary">{eyebrow}</Typography.Text>
            <Typography.Title level={4}>{title}</Typography.Title>
            <Typography.Text type="secondary">{description}</Typography.Text>
          </div>
          <Tag color="blue">入口</Tag>
        </div>
        <div className="workbench-role-metrics">
          {metrics.map((metric) => (
            <div className={`workbench-role-metric ${metric.tone || 'default'}`} key={metric.label}>
              <span>{metric.icon}</span>
              <Typography.Text type="secondary">{metric.label}</Typography.Text>
              <Typography.Text strong>{metric.value}</Typography.Text>
            </div>
          ))}
        </div>
        {items.length ? (
          <div className="workbench-priority-list">
            {items.map((item) => (
              <div className="workbench-priority-item" key={item.key}>
                <div className="workbench-priority-main">
                  {item.eyebrow ? <Typography.Text className="task-code">{item.eyebrow}</Typography.Text> : null}
                  <Typography.Text strong className="workbench-priority-title">{item.title}</Typography.Text>
                  {item.meta}
                </div>
                {item.status ? <div className="workbench-priority-status">{item.status}</div> : null}
                {(item.action || item.secondaryAction) ? (
                  <Space wrap className="workbench-priority-actions">
                    {item.action ? renderRoleAction(item.action) : null}
                    {item.secondaryAction ? renderRoleAction(item.secondaryAction) : null}
                  </Space>
                ) : null}
              </div>
            ))}
          </div>
        ) : (
          <div className="workbench-role-empty">
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={emptyText} />
          </div>
        )}
        <Space wrap className="workbench-role-actions">
          {actions.map((action) => <span key={action.label}>{renderRoleAction(action)}</span>)}
        </Space>
      </Space>
    </Card>
  );
}
