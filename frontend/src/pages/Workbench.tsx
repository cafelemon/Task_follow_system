import {
  Alert,
  Button,
  Card,
  Col,
  Empty,
  Row,
  Space,
  Statistic,
  Tag,
  Typography
} from 'antd';
import { CheckCircleOutlined, RightOutlined, SafetyOutlined } from '@ant-design/icons';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { getJson } from '../api/client';
import type { AnyRecord } from '../api/client';
import { PageShell } from '../components/PageShell';
import { StatusTag } from '../components/StatusTag';
import {
  buildSubTaskUpdatePath,
  daysUntil,
  isDueSoonTask,
  isExecutorTask,
  relationLabels,
  renderPeople
} from '../ui/taskDisplay';

type WorkbenchProps = {
  auth?: AnyRecord | null;
  onCreateRisk: (task: AnyRecord) => void;
};

function WorkbenchTaskCard({ task, onCreateRisk }: { task: AnyRecord; onCreateRisk: (task: AnyRecord) => void }) {
  const relationMeta = relationLabels[String(task.viewer_relation)] || { label: '-', color: 'default' };
  const dueDays = daysUntil(task.due_date);
  return (
    <div className="workbench-task-card">
      <Space direction="vertical" size={10} className="full-width">
        <div className="workbench-task-card-head">
          <div>
            <Typography.Text className="task-code">{task.code || '-'}</Typography.Text>
            <Typography.Title level={5}>{task.title || '-'}</Typography.Title>
          </div>
          <Tag color={relationMeta.color}>{relationMeta.label}</Tag>
        </div>
        <div className="mobile-task-meta compact">
          <span>部门任务</span><Typography.Text>{task.department_task || '-'}</Typography.Text>
          <span>本周状态</span><div><StatusTag value={task.weekly_status} /></div>
          <span>任务状态</span><div><StatusTag value={task.status} /></div>
          <span>截止日期</span><Typography.Text>{task.due_date || '-'}</Typography.Text>
          <span>负责人</span><div>{renderPeople(task.owners || task.owner)}</div>
        </div>
        {dueDays != null && dueDays >= 0 && dueDays <= 7 ? (
          <Alert type={dueDays <= 1 ? 'warning' : 'info'} showIcon message={`距离截止还有 ${dueDays} 天`} />
        ) : null}
        <Space wrap className="workbench-task-actions">
          {task.can_update_weekly ? (
            <Link className="mobile-primary-link" to={buildSubTaskUpdatePath(task)}>填写本周更新</Link>
          ) : task.can_reopen && task.status === 'completed' ? (
            <Link className="mobile-primary-link" to={`/sub-tasks/${task.id}/update`}>处理完成状态</Link>
          ) : (
            <Tag>只读</Tag>
          )}
          {task.can_create_risk && task.status !== 'completed' ? (
            <Button size="small" icon={<SafetyOutlined />} onClick={() => onCreateRisk(task)}>登记风险</Button>
          ) : null}
        </Space>
      </Space>
    </div>
  );
}

function WorkbenchTaskSection({
  title,
  description,
  tasks,
  emptyText,
  onCreateRisk
}: {
  title: string;
  description: string;
  tasks: AnyRecord[];
  emptyText: string;
  onCreateRisk: (task: AnyRecord) => void;
}) {
  return (
    <Card className="business-card workbench-section-card">
      <div className="workbench-section-head">
        <div>
          <Typography.Title level={4}>{title}</Typography.Title>
          <Typography.Text type="secondary">{description}</Typography.Text>
        </div>
        <Tag>{tasks.length}</Tag>
      </div>
      {tasks.length ? (
        <div className="workbench-task-list">
          {tasks.map((task) => <WorkbenchTaskCard key={task.id} task={task} onCreateRisk={onCreateRisk} />)}
        </div>
      ) : (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={emptyText} />
      )}
    </Card>
  );
}

export function Workbench({ auth, onCreateRisk }: WorkbenchProps) {
  const [tasks, setTasks] = useState<AnyRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const reload = async () => {
    setLoading(true);
    setError(false);
    try {
      setTasks(await getJson<AnyRecord[]>('/sub-tasks'));
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    reload();
  }, []);

  const executionTasks = useMemo(() => tasks.filter(isExecutorTask), [tasks]);
  const pendingTasks = executionTasks.filter((task) => task.status !== 'completed' && task.weekly_update_status !== 'submitted');
  const draftTasks = executionTasks.filter((task) => task.weekly_update_status === 'draft');
  const dueSoonTasks = executionTasks.filter(isDueSoonTask);
  const completedTasks = executionTasks.filter((task) => task.status === 'completed');
  const riskReadyTasks = executionTasks.filter((task) => task.status !== 'completed' && task.can_create_risk);
  const weekKey = auth?.week_key || '-';
  const userName = auth?.user?.name || '-';

  return (
    <PageShell
      title="工作台"
      subtitle="执行者本周行动入口：先处理待更新、草稿和临近截止任务"
      extra={<Button onClick={reload} loading={loading}>刷新</Button>}
    >
      <Space direction="vertical" size={16} className="full-width workbench-page">
        <Card className="business-card workbench-hero-card">
          <div className="workbench-hero">
            <div>
              <Typography.Text type="secondary">当前人员</Typography.Text>
              <Typography.Title level={3}>{userName}</Typography.Title>
              <Typography.Text type="secondary">统计周次：{weekKey}</Typography.Text>
            </div>
            <Space wrap className="workbench-hero-actions">
              <Link className="mobile-primary-link" to="/sub-tasks">进入子任务执行</Link>
              <Button icon={<RightOutlined />} disabled>待归类事项即将开放</Button>
            </Space>
          </div>
        </Card>
        {error ? <Alert type="warning" showIcon message="工作台数据加载失败，请刷新重试。" /> : null}
        <Row gutter={[16, 16]}>
          <Col xs={12} md={6}><Card className="workbench-metric-card"><Statistic title="本周待更新" value={pendingTasks.length} /></Card></Col>
          <Col xs={12} md={6}><Card className="workbench-metric-card"><Statistic title="草稿未提交" value={draftTasks.length} /></Card></Col>
          <Col xs={12} md={6}><Card className="workbench-metric-card"><Statistic title="临近截止" value={dueSoonTasks.length} /></Card></Col>
          <Col xs={12} md={6}><Card className="workbench-metric-card"><Statistic title="已完成" value={completedTasks.length} prefix={<CheckCircleOutlined />} /></Card></Col>
        </Row>
        {!executionTasks.length && !loading ? (
          <Alert type="info" showIcon message="当前没有需要你执行的子任务。" description="如果你同时是负责人或管理员，可继续通过部门任务、子任务执行或会议看板查看其他事项。" />
        ) : null}
        <WorkbenchTaskSection
          title="本周待更新"
          description="正式提交后，本周提醒才会停止；保存草稿不算提交。"
          tasks={pendingTasks}
          emptyText="本周没有待提交的执行任务。"
          onCreateRisk={onCreateRisk}
        />
        <WorkbenchTaskSection
          title="草稿未提交"
          description="这里显示已保存草稿但尚未正式提交的任务。"
          tasks={draftTasks}
          emptyText="没有草稿未提交任务。"
          onCreateRisk={onCreateRisk}
        />
        <WorkbenchTaskSection
          title="临近截止"
          description="距离截止 7 天内的未完成执行任务。"
          tasks={dueSoonTasks}
          emptyText="当前没有临近截止的执行任务。"
          onCreateRisk={onCreateRisk}
        />
        <WorkbenchTaskSection
          title="风险与卡点入口"
          description="遗留事项不等于风险；影响和可能性明确时，从这里登记风险。"
          tasks={riskReadyTasks}
          emptyText="当前没有可登记风险的执行任务。"
          onCreateRisk={onCreateRisk}
        />
      </Space>
    </PageShell>
  );
}
