import { Alert, Button, Collapse, Space, Typography } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import { getJson } from '../api/client';
import type { AnyRecord } from '../api/client';
import { PageShell } from '../components/PageShell';
import { DepartmentOwnerWorkbench } from '../features/workbench/DepartmentOwnerWorkbench';
import { ExecutorWorkbenchCard } from '../features/workbench/ExecutorWorkbenchCard';
import { ObserverWeeklyExportCard } from '../features/workbench/ObserverWeeklyExportCard';
import { TaskOwnerWorkbenchCard } from '../features/workbench/TaskOwnerWorkbenchCard';
import { WorkItemWorkbenchCard } from '../features/workbench/WorkItemWorkbenchCard';
import { WorkItemAutomationSettingsModal } from '../features/workItems/WorkItemAutomationSettingsModal';
import { WorkItemPanel } from '../features/workItems/WorkItemPanel';
import { WorkItemSubmitModal } from '../features/workItems/WorkItemSubmitModal';
import { isDueSoonTask, isExecutorTask } from '../ui/taskDisplay';

type WorkbenchProps = {
  auth?: AnyRecord | null;
  onCreateRisk: (task: AnyRecord) => void;
};

function userRoleCodes(auth?: AnyRecord | null) {
  return new Set<string>((auth?.user?.roles || []).map((role: AnyRecord) => String(role.code)));
}

function userPermissionCodes(auth?: AnyRecord | null) {
  return new Set<string>((auth?.user?.permissions || []).map((permission: AnyRecord | string) => (
    typeof permission === 'string' ? permission : String(permission.code)
  )));
}

export function Workbench({ auth, onCreateRisk }: WorkbenchProps) {
  const [tasks, setTasks] = useState<AnyRecord[]>([]);
  const [submittedItems, setSubmittedItems] = useState<AnyRecord[]>([]);
  const [receivedItems, setReceivedItems] = useState<AnyRecord[]>([]);
  const [departmentTasks, setDepartmentTasks] = useState<AnyRecord[]>([]);
  const [departmentOwnerData, setDepartmentOwnerData] = useState<AnyRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [workItemOpen, setWorkItemOpen] = useState(false);
  const [automationSettingsOpen, setAutomationSettingsOpen] = useState(false);
  const [workItemRefreshKey, setWorkItemRefreshKey] = useState(0);
  const [openDetailKeys, setOpenDetailKeys] = useState<string[]>([]);

  const reload = async () => {
    setLoading(true);
    setError(false);
    try {
      const [taskData, submittedData, receivedData, departmentTaskPayload, departmentOwnerPayload] = await Promise.all([
        getJson<AnyRecord[]>('/sub-tasks'),
        getJson<AnyRecord[]>('/work-items?scope=submitted').catch(() => []),
        getJson<AnyRecord[]>('/work-items?scope=received').catch(() => []),
        getJson<AnyRecord>('/department-tasks/overview').catch(() => null),
        getJson<AnyRecord>('/workbench/department-owner').catch(() => null),
      ]);
      setTasks(taskData);
      setSubmittedItems(submittedData);
      setReceivedItems(receivedData);
      setDepartmentTasks(departmentTaskPayload?.department_tasks || []);
      setDepartmentOwnerData(departmentOwnerPayload);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    reload();
  }, []);

  const roles = useMemo(() => userRoleCodes(auth), [auth]);
  const permissions = useMemo(() => userPermissionCodes(auth), [auth]);
  const executionTasks = useMemo(() => tasks.filter(isExecutorTask), [tasks]);
  const pendingTasks = executionTasks.filter((task) => task.status !== 'completed' && task.weekly_update_status !== 'submitted');
  const draftTasks = executionTasks.filter((task) => task.weekly_update_status === 'draft');
  const dueSoonTasks = executionTasks.filter(isDueSoonTask);
  const riskReadyTasks = executionTasks.filter((task) => task.status !== 'completed' && task.can_create_risk);
  const hasExecutorRole = roles.has('executor');
  const hasTaskOwnerRole = roles.has('task_owner');
  const hasObserverRole = roles.has('observer');
  const canConfigureWorkItemAutomation = Boolean(
    auth?.user?.is_admin
    || roles.has('department_owner')
    || roles.has('task_owner')
    || permissions.has('permission.manage')
  );
  const weekKey = auth?.week_key || '-';
  const userName = auth?.user?.name || '-';

  const openWorkItemDetails = () => {
    setOpenDetailKeys((current) => Array.from(new Set([...current, 'work-items'])));
    requestAnimationFrame(() => document.getElementById('work-items')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  };

  return (
    <PageShell
      title="工作台"
      extra={<Button onClick={reload} loading={loading}>刷新</Button>}
    >
      <Space direction="vertical" size={16} className="full-width workbench-page">
        <div className="workbench-compact-meta">
          <Typography.Text type="secondary">当前人员：<Typography.Text strong>{userName}</Typography.Text></Typography.Text>
          <Typography.Text type="secondary">统计周次：<Typography.Text strong>{weekKey}</Typography.Text></Typography.Text>
        </div>
        {error ? <Alert type="warning" showIcon message="工作台数据加载失败，请刷新重试。" /> : null}
        <div className="workbench-entry-grid">
          <WorkItemWorkbenchCard
            submittedItems={submittedItems}
            receivedItems={receivedItems}
            onSubmitWorkItem={() => setWorkItemOpen(true)}
            onOpenWorkItems={openWorkItemDetails}
            onOpenAutomationSettings={canConfigureWorkItemAutomation ? () => setAutomationSettingsOpen(true) : undefined}
          />
          {hasObserverRole ? <ObserverWeeklyExportCard /> : null}
          <ExecutorWorkbenchCard
            executionTasks={executionTasks}
            pendingTasks={pendingTasks}
            draftTasks={draftTasks}
            dueSoonTasks={dueSoonTasks}
            riskReadyTasks={riskReadyTasks}
            hasExecutorRole={hasExecutorRole}
            onCreateRisk={onCreateRisk}
          />
          <TaskOwnerWorkbenchCard
            tasks={tasks}
            receivedItems={receivedItems}
            departmentTasks={departmentTasks}
            hasTaskOwnerRole={hasTaskOwnerRole}
            onOpenWorkItems={openWorkItemDetails}
          />
        </div>
        <Collapse
          className="workbench-detail-collapse"
          activeKey={openDetailKeys}
          onChange={(keys) => setOpenDetailKeys(Array.isArray(keys) ? keys.map(String) : [String(keys)])}
          items={[
            {
              key: 'work-items',
              label: '完整处理面板：待归类事项',
              children: (
                <div id="work-items">
                  <WorkItemPanel refreshKey={workItemRefreshKey} />
                </div>
              )
            },
            ...(departmentOwnerData?.can_view ? [
              {
                key: 'department-owner',
                label: '部门负责人详细面板：完整部门材料',
                children: (
                  <div id="department-owner-details">
                    <DepartmentOwnerWorkbench data={departmentOwnerData} />
                  </div>
                )
              }
            ] : [])
          ]}
        />
        <WorkItemSubmitModal
          open={workItemOpen}
          onCancel={() => setWorkItemOpen(false)}
          onSubmitted={async () => {
            setWorkItemOpen(false);
            setWorkItemRefreshKey((current) => current + 1);
            await reload();
          }}
        />
        <WorkItemAutomationSettingsModal
          open={automationSettingsOpen}
          onClose={() => setAutomationSettingsOpen(false)}
        />
      </Space>
    </PageShell>
  );
}
