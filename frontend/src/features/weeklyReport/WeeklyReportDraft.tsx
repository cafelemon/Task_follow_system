import { Alert, Card, Col, Empty, Row, Space, Tag, Typography } from 'antd';
import type { ReactNode } from 'react';
import type { AnyRecord } from '../../api/client';
import { StatusTag } from '../../components/StatusTag';

function textValue(value?: unknown) {
  return value == null || value === '' ? '-' : String(value);
}

function renderLongText(value?: unknown) {
  const text = textValue(value);
  return <Typography.Paragraph className="weekly-report-long-text">{text}</Typography.Paragraph>;
}

function TaskTrail({ item }: { item: AnyRecord }) {
  const parent = item.parent_task;
  const department = item.department_task;
  const subTask = item.sub_task;
  return (
    <Space wrap size={[6, 6]}>
      {parent?.code ? <Tag>{parent.code}</Tag> : null}
      {parent?.title ? <Typography.Text type="secondary">{parent.title}</Typography.Text> : null}
      {department?.code ? <Tag color="blue">{department.code}</Tag> : null}
      {department?.title ? <Typography.Text type="secondary">{department.title}</Typography.Text> : null}
      {subTask?.code ? <Tag color="geekblue">{subTask.code}</Tag> : null}
    </Space>
  );
}

function AttachmentLinks({ attachments }: { attachments?: AnyRecord[] }) {
  if (!attachments?.length) {
    return <Typography.Text type="secondary">暂无附件</Typography.Text>;
  }
  return (
    <Space direction="vertical" size={4} className="full-width">
      {attachments.map((item) => (
        <a key={item.id} href={item.download_url} target="_blank" rel="noreferrer">{item.filename}</a>
      ))}
    </Space>
  );
}

function TaskUpdateCard({ item }: { item: AnyRecord }) {
  const subTask = item.sub_task || {};
  return (
    <div className="weekly-report-item-card">
      <Space direction="vertical" size={10} className="full-width">
        <div className="weekly-report-card-head">
          <div>
            <TaskTrail item={item} />
            <Typography.Title level={5}>{subTask.title || '-'}</Typography.Title>
          </div>
          <StatusTag value={item.status} />
        </div>
        <div className="mobile-task-meta compact">
          <span>进度</span><Typography.Text>{item.progress ?? 0}%</Typography.Text>
          <span>截止日期</span><Typography.Text>{subTask.due_date || '-'}</Typography.Text>
          <span>附件</span><div><AttachmentLinks attachments={item.attachments} /></div>
        </div>
        <div>
          <Typography.Text strong>本周完成</Typography.Text>
          {renderLongText(item.this_week)}
        </div>
        <div>
          <Typography.Text strong>下周计划</Typography.Text>
          {renderLongText(item.next_week)}
        </div>
        {(item.risk || item.needs_coordination) ? (
          <Alert
            type="warning"
            showIcon
            message={item.needs_coordination ? '存在卡点或需协调' : '遗留事项 / 风险文本'}
            description={item.risk || '已标记需要协调，未填写具体说明。'}
          />
        ) : null}
      </Space>
    </div>
  );
}

function WorkItemCard({ item }: { item: AnyRecord }) {
  return (
    <div className="weekly-report-item-card">
      <Space direction="vertical" size={8} className="full-width">
        <div className="weekly-report-card-head">
          <Typography.Title level={5}>{item.content || '-'}</Typography.Title>
          <StatusTag value={item.status_label || item.status} />
        </div>
        <div className="mobile-task-meta compact">
          <span>关联对象</span>
          <Typography.Text>
            {item.related_department_task
              ? `${item.related_department_task.code || ''} ${item.related_department_task.title || ''}`.trim()
              : item.collaboration_department?.name || item.department?.name || '-'}
          </Typography.Text>
          <span>提交时间</span><Typography.Text>{item.created_at ? String(item.created_at).slice(0, 16).replace('T', ' ') : '-'}</Typography.Text>
        </div>
      </Space>
    </div>
  );
}

function RiskTextCard({ item }: { item: AnyRecord }) {
  const task = item.sub_task || {};
  return (
    <div className="weekly-report-item-card">
      <Space direction="vertical" size={8} className="full-width">
        <Space wrap><Tag>{task.code || '-'}</Tag><Typography.Text strong>{task.title || '-'}</Typography.Text></Space>
        <Typography.Paragraph className="weekly-report-long-text">{item.risk || '已标记需要协调，未填写具体说明。'}</Typography.Paragraph>
      </Space>
    </div>
  );
}

function RiskItemCard({ item }: { item: AnyRecord }) {
  return (
    <div className="weekly-report-item-card">
      <Space direction="vertical" size={8} className="full-width">
        <div className="weekly-report-card-head">
          <Typography.Title level={5}>{item.title || '-'}</Typography.Title>
          <Tag color={item.level === 'high' ? 'red' : item.level === 'medium' ? 'orange' : 'green'}>{item.level || '-'}</Tag>
        </div>
        <div className="mobile-task-meta compact">
          <span>分值</span><Typography.Text>{item.score ?? '-'}</Typography.Text>
          <span>状态</span><div><StatusTag value={item.status} /></div>
          <span>责任人</span><Typography.Text>{item.owner || '-'}</Typography.Text>
          <span>来源任务</span><Typography.Text>{item.sub_task || '-'}</Typography.Text>
        </div>
      </Space>
    </div>
  );
}

function PlanCard({ item }: { item: AnyRecord }) {
  const task = item.sub_task || {};
  return (
    <div className="weekly-report-item-card">
      <Space direction="vertical" size={8} className="full-width">
        <Space wrap><Tag>{task.code || '-'}</Tag><Typography.Text strong>{task.title || '-'}</Typography.Text></Space>
        {renderLongText(item.next_week)}
      </Space>
    </div>
  );
}

function Section({
  title,
  description,
  count,
  emptyText,
  children
}: {
  title: string;
  description: string;
  count: number;
  emptyText: string;
  children: ReactNode;
}) {
  return (
    <Card className="business-card weekly-report-section-card">
      <div className="weekly-report-section-head">
        <div>
          <Typography.Title level={4}>{title}</Typography.Title>
          <Typography.Text type="secondary">{description}</Typography.Text>
        </div>
        <Tag>{count}</Tag>
      </div>
      {count ? <div className="weekly-report-list">{children}</div> : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={emptyText} />}
    </Card>
  );
}

export function WeeklyReportDraft({ draft }: { draft: AnyRecord }) {
  const summary = draft.summary || {};
  const workItemGroups = draft.work_items_by_category || [];
  const workItemCount = Number(summary.work_item_count || 0);
  const riskCount = Number(summary.risk_text_count || 0) + Number(summary.risk_item_count || 0);
  return (
    <Space direction="vertical" size={16} className="full-width weekly-report-page">
      <Card className="business-card weekly-report-summary-card">
        <Row gutter={[16, 16]}>
          <Col xs={12} md={6}><div className="weekly-report-summary-item"><strong>{summary.task_update_count || 0}</strong><span>正式任务更新</span></div></Col>
          <Col xs={12} md={6}><div className="weekly-report-summary-item"><strong>{summary.work_item_count || 0}</strong><span>待归类事项</span></div></Col>
          <Col xs={12} md={6}><div className="weekly-report-summary-item"><strong>{riskCount}</strong><span>风险与卡点</span></div></Col>
          <Col xs={12} md={6}><div className="weekly-report-summary-item"><strong>{summary.next_plan_count || 0}</strong><span>下周计划</span></div></Col>
        </Row>
      </Card>

      <Section
        title="正式任务进展"
        description="仅聚合你作为执行人的本周周更新，待归类事项不会混入正式任务统计。"
        count={draft.task_updates?.length || 0}
        emptyText="本周暂无正式任务更新。"
      >
        {(draft.task_updates || []).map((item: AnyRecord) => <TaskUpdateCard key={item.id} item={item} />)}
      </Section>

      <Section
        title="待归类事项"
        description="展示本周由你提交且未撤回的事项，按归类方式分组。"
        count={workItemCount}
        emptyText="本周暂无待归类事项。"
      >
        {workItemGroups.map((group: AnyRecord) => (
          <div className="weekly-report-group" key={group.category}>
            <Space wrap><Tag color="blue">{group.category_label}</Tag><Typography.Text type="secondary">{group.items?.length || 0} 项</Typography.Text></Space>
            {group.items?.length ? (
              <div className="weekly-report-list nested">
                {group.items.map((item: AnyRecord) => <WorkItemCard key={item.id} item={item} />)}
              </div>
            ) : null}
          </div>
        ))}
      </Section>

      <Section
        title="风险与卡点"
        description="包括周更新中的风险/卡点文本，以及当前执行任务下仍开放或处理中的风险项。"
        count={riskCount}
        emptyText="本周暂无风险或卡点。"
      >
        {(draft.risk_texts || []).map((item: AnyRecord) => <RiskTextCard key={`text-${item.weekly_update_id}`} item={item} />)}
        {(draft.risk_items || []).map((item: AnyRecord) => <RiskItemCard key={`risk-${item.id}`} item={item} />)}
      </Section>

      <Section
        title="下周计划"
        description="从本周周更新里的下周计划自动聚合。"
        count={draft.next_plans?.length || 0}
        emptyText="本周暂无下周计划。"
      >
        {(draft.next_plans || []).map((item: AnyRecord) => <PlanCard key={item.weekly_update_id} item={item} />)}
      </Section>
    </Space>
  );
}
