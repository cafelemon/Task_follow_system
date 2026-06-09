import {
  Alert,
  Button,
  Card,
  Checkbox,
  Col,
  DatePicker,
  Descriptions,
  Divider,
  Form,
  Input,
  Layout,
  Menu,
  Modal,
  Row,
  Select,
  Space,
  Statistic,
  Table,
  Tag,
  Tooltip,
  Typography,
  Upload,
  message
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  ApartmentOutlined,
  ArrowLeftOutlined,
  BellOutlined,
  CheckCircleOutlined,
  DatabaseOutlined,
  FolderOutlined,
  HistoryOutlined,
  LockOutlined,
  NodeIndexOutlined,
  SafetyOutlined,
  ScheduleOutlined,
  TeamOutlined,
  UploadOutlined,
  UserOutlined
} from '@ant-design/icons';
import { useEffect, useRef, useState } from 'react';
import {
  Link,
  Navigate,
  Route,
  BrowserRouter as Router,
  Routes,
  useBeforeUnload,
  useLocation,
  useNavigate,
  useParams
} from 'react-router-dom';
import * as echarts from 'echarts';
import dayjs from 'dayjs';
import { deleteJson, getJson, postJson, putJson } from './api/client';
import type { AnyRecord } from './api/client';
import { PageShell } from './components/PageShell';
import { StatusTag } from './components/StatusTag';
import companyLogoCompact from './assets/brand/company-logo-compact-light.png';
import companyLogoFullname from './assets/brand/company-logo-fullname-light.png';
import taskFollowIcon from './assets/brand/task-follow-icon.png';
import taskFollowHero from './assets/brand/task-follow-hero.png';

const { Header, Sider, Content } = Layout;

function useIsCompactLayout() {
  const [compact, setCompact] = useState(() => window.innerWidth < 1440);
  useEffect(() => {
    const onResize = () => setCompact(window.innerWidth < 1440);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return compact;
}

function currentIsoWeekKey() {
  const today = new Date();
  const target = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));
  const day = target.getUTCDay() || 7;
  target.setUTCDate(target.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((target.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${target.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

function useApi<T = any>(url: string, deps: any[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const reload = async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await getJson<T>(url));
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    reload();
  }, deps);
  return { data, error, loading, reload };
}

function ChartCard({ title, option, height = 300, className }: { title: string; option: any; height?: number; className?: string }) {
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!ref.current) return;
    const chart = echarts.init(ref.current);
    chart.setOption(option);
    const resize = () => chart.resize();
    window.addEventListener('resize', resize);
    return () => {
      window.removeEventListener('resize', resize);
      chart.dispose();
    };
  }, [option]);
  return (
    <Card title={title} className={className}>
      <div ref={ref} style={{ height }} />
    </Card>
  );
}

function personOptions(people?: AnyRecord[] | null) {
  return (people || []).map((item) => ({
    value: item.id,
    label: item.department ? `${item.name}（${item.department}）` : item.name
  }));
}

function PeopleSelect({ options }: { options: { value: number; label: string }[] }) {
  return (
    <Select
      mode="multiple"
      allowClear
      showSearch
      optionFilterProp="label"
      filterOption={(input, option) => String(option?.label || '').toLowerCase().includes(input.toLowerCase())}
      options={options}
    />
  );
}

function renderEllipsis(value?: unknown) {
  const text = value == null || value === '' ? '-' : String(value);
  return (
    <Tooltip title={text === '-' ? undefined : text}>
      <span className="table-ellipsis-cell">{text}</span>
    </Tooltip>
  );
}

function renderPeople(value?: AnyRecord[] | string | null) {
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

function renderDepartments(value?: AnyRecord[] | string | null) {
  if (Array.isArray(value)) {
    const names = value.map((item) => item.name).join('、');
    return (
      <Tooltip title={names || undefined}>
        <Space wrap size={[4, 4]} className="people-cell">
          {value.length ? value.map((item) => <Tag className="department-tag" title={item.name} key={item.id}>{item.name}</Tag>) : <Typography.Text type="secondary">-</Typography.Text>}
        </Space>
      </Tooltip>
    );
  }
  return value ? <Tag className="department-tag" title={value}>{value}</Tag> : <Typography.Text type="secondary">-</Typography.Text>;
}

function TaskTitle({ code, title }: { code?: string; title?: string }) {
  return (
    <Space direction="vertical" size={4} className="task-title-stack">
      {code ? <Typography.Text className="task-code">{code}</Typography.Text> : null}
      <Tooltip title={title}>
        <Typography.Text strong className="task-title-text">{title || '-'}</Typography.Text>
      </Tooltip>
    </Space>
  );
}

function TaskMetricTags({ task }: { task: AnyRecord }) {
  return (
    <Space wrap size={[6, 6]} className="task-metric-tags">
      <Tag color="blue">{task.department_task_count || 0} 部门任务</Tag>
      <Tag color="green">{task.sub_task_count || 0} 子任务</Tag>
      {task.pending_split_count ? <Tag color="orange">{task.pending_split_count} 待拆解</Tag> : null}
    </Space>
  );
}

function renderTableHeader(title: string, count: number, description?: string) {
  return (
    <Space className="table-section-title" wrap>
      <Typography.Text strong>{title}</Typography.Text>
      <Tag>{count}</Tag>
      {description ? <Typography.Text type="secondary">{description}</Typography.Text> : null}
    </Space>
  );
}

function renderTimelineText(value?: unknown, emptyText = '-') {
  const text = value == null || value === '' ? emptyText : String(value);
  return (
    <Tooltip title={text === emptyText ? undefined : text}>
      <span className={text === emptyText ? 'muted-cell timeline-cell-text' : 'timeline-cell-text'}>{text}</span>
    </Tooltip>
  );
}

function renderBindingStatus(value?: string | null, labels = { bound: '已绑定', empty: '未绑定' }) {
  return value ? <Tag color="green">{labels.bound}</Tag> : <Tag>{labels.empty}</Tag>;
}

function renderEmail(value?: string | null) {
  return value ? (
    <Tooltip title={value}>
      <Tag color="blue" className="email-tag">{value}</Tag>
    </Tooltip>
  ) : <Tag>未录入</Tag>;
}

const baseMenuItems = [
  { key: '/meeting-board', title: '会议看板', icon: <ScheduleOutlined />, label: <Link to="/meeting-board/overview">会议看板</Link> },
  { key: '/goals', title: '战略目标', icon: <NodeIndexOutlined />, label: <Link to="/goals">战略目标</Link> },
  { key: '/parent-tasks', title: '母任务管理', icon: <FolderOutlined />, label: <Link to="/parent-tasks">母任务管理</Link> },
  { key: '/department-tasks', title: '部门任务', icon: <ApartmentOutlined />, label: <Link to="/department-tasks">部门任务</Link> },
  { key: '/sub-tasks', title: '子任务执行', icon: <CheckCircleOutlined />, label: <Link to="/sub-tasks">子任务执行</Link> },
  { key: '/timeline', title: '历史时间线', icon: <HistoryOutlined />, label: <Link to="/timeline">历史时间线</Link> },
  { key: '/notifications', title: '通知记录', icon: <BellOutlined />, label: <Link to="/notifications">通知记录</Link> }
];

const adminMenuItems = [
  { key: '/people', title: '人员', icon: <TeamOutlined />, label: <Link to="/people">人员</Link> },
  { key: '/permissions', title: '角色权限', icon: <SafetyOutlined />, label: <Link to="/permissions">角色权限</Link> },
  { key: '/base-sync', title: 'Base同步', icon: <DatabaseOutlined />, label: <Link to="/base-sync">Base同步</Link> }
];

function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(false);
  const larkError = new URLSearchParams(location.search).get('lark_error');
  const submit = async (values: AnyRecord) => {
    setLoading(true);
    try {
      await postJson('/auth/login', values);
      message.success('登录成功');
      navigate('/meeting-board/overview');
    } catch {
      message.error('用户名或密码错误');
    } finally {
      setLoading(false);
    }
  };
  const larkLogin = () => {
    window.location.href = `/api/auth/lark-oauth/start?next_path=${encodeURIComponent('/meeting-board/overview')}`;
  };
  return (
    <div className="login-page">
      <div className="login-shell">
        <section className="login-visual">
          <img className="login-company-logo" src={companyLogoFullname} alt="Fortune Microbot Technology" />
          <img className="login-product-visual" src={taskFollowHero} alt="任务跟踪系统" />
        </section>
        <Card className="login-panel">
          <Space direction="vertical" size={18} className="full-width">
            <div className="login-title">
              <Typography.Title level={3}>任务跟踪系统</Typography.Title>
              <Typography.Text type="secondary">系统管理员登录或飞书免登</Typography.Text>
            </div>
            {larkError && <Alert type="warning" showIcon message={larkError} />}
            <Form layout="vertical" onFinish={submit} autoComplete="off">
              <Form.Item name="username" label="账号" rules={[{ required: true, message: '请输入账号' }]}>
                <Input prefix={<UserOutlined />} autoFocus />
              </Form.Item>
              <Form.Item name="password" label="密码" rules={[{ required: true, message: '请输入密码' }]}>
                <Input.Password prefix={<LockOutlined />} />
              </Form.Item>
              <Button type="primary" htmlType="submit" block loading={loading}>
                登录
              </Button>
            </Form>
            <Button block onClick={larkLogin}>飞书免登</Button>
          </Space>
        </Card>
      </div>
    </div>
  );
}

function AppLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { data: auth, error, loading } = useApi<AnyRecord>('/auth/me', []);
  const compactLayout = useIsCompactLayout();
  const selectedKey = `/${location.pathname.split('/')[1] || 'meeting-board'}`;
  const isAdmin = Boolean(auth?.user?.is_admin || (auth?.permission_codes || []).includes('permission.manage'));
  const canViewParentTasks = Boolean(auth?.features?.can_view_parent_tasks || isAdmin);
  const visibleBaseMenuItems = baseMenuItems.filter((item) => item.key !== '/parent-tasks' || canViewParentTasks);
  const menuItems = isAdmin ? [...visibleBaseMenuItems, ...adminMenuItems] : visibleBaseMenuItems;
  const headerDate = `${dayjs().format('YYYY年MM月DD日')}--${auth?.week_key || '-'}`;
  const logout = async () => {
    await postJson('/auth/logout', {});
    navigate('/login');
  };

  if ((error as any)?.response?.status === 401) {
    return <Navigate to="/login" replace />;
  }

  return (
    <Layout className="app-layout">
      <Sider width={256} collapsedWidth={76} collapsed={compactLayout} className="app-sider">
        <div className="brand">
          <img className="brand-icon" src={taskFollowIcon} alt="任务跟踪系统" />
          <div className="brand-text">
            <strong>任务跟踪系统</strong>
            <span>闭环管理</span>
          </div>
        </div>
        <Menu mode="inline" selectedKeys={[selectedKey]} items={menuItems} />
        <div className="sider-footer">
          <img src={companyLogoCompact} alt="Fortune Microbot" />
          <div className="sider-user">
            <TeamOutlined />
            <span>{loading ? '加载中' : auth?.user?.name || '-'}</span>
          </div>
        </div>
      </Sider>
      <Layout>
        <Header className="app-header">
          <Space size={20}>
            <Typography.Title level={4}>公司任务推进与周更新跟踪系统</Typography.Title>
          </Space>
          <Space className="header-meta" split={<Divider type="vertical" />}>
            <img className="header-company-logo" src={companyLogoCompact} alt="Fortune Microbot" />
            <span>{auth?.user?.name}</span>
            <span>{auth?.user?.department}</span>
            <Tag color="blue">{headerDate}</Tag>
          </Space>
          <Space>
            <Button onClick={logout}>退出</Button>
          </Space>
        </Header>
        <Content className="app-content">
          <Routes>
            <Route path="/" element={<Navigate to="/meeting-board/overview" />} />
            <Route path="/dashboard" element={<Navigate to="/meeting-board/overview" replace />} />
            <Route path="/goals" element={<Goals />} />
            <Route path="/goals/:goalId" element={<GoalDetail />} />
            <Route path="/parent-tasks" element={<ParentTasks />} />
            <Route path="/parent-tasks/:parentTaskId" element={<ParentTaskDetail />} />
            <Route path="/department-tasks" element={<DepartmentTasks />} />
            <Route path="/sub-tasks" element={<SubTasks />} />
            <Route path="/sub-tasks/:subTaskId/update" element={<SubTaskUpdate />} />
            <Route path="/weekly-updates" element={<Navigate to="/sub-tasks" replace />} />
            <Route path="/meeting-board" element={<Navigate to="/meeting-board/overview" replace />} />
            <Route path="/meeting-board/overview" element={<MeetingBoardOverview />} />
            <Route path="/meeting-board/parent" element={<MeetingBoardParent />} />
            <Route path="/meeting-board/department" element={<MeetingBoardDepartment />} />
            <Route path="/risks" element={<Navigate to="/meeting-board/overview#risk-overdue" replace />} />
            <Route path="/timeline" element={<TimelinePage />} />
            <Route path="/notifications" element={<Notifications />} />
            <Route path="/permissions" element={<Permissions />} />
            <Route path="/people" element={<People />} />
            <Route path="/base-sync" element={<BaseSync />} />
            <Route path="/task-detail" element={<TaskDetail />} />
          </Routes>
        </Content>
      </Layout>
    </Layout>
  );
}

function Goals() {
  const { data, loading } = useApi<AnyRecord[]>('/goals', []);
  return (
    <PageShell title="战略目标" subtitle="对齐公司战略，展示顶层目标与任务关联度">
      <Row gutter={[16, 16]}>
        {(data || []).map((goal) => (
          <Col xs={24} sm={12} xl={6} key={goal.id}>
            <Link to={`/goals/${goal.id}`} className="card-link">
              <Card loading={loading} hoverable className="goal-card">
                <Space direction="vertical" size={12} className="full-width">
                  <Tag color="blue">{goal.code}</Tag>
                  <Typography.Title level={4}>{goal.name}</Typography.Title>
                  <Typography.Text type="secondary">{goal.description}</Typography.Text>
                </Space>
              </Card>
            </Link>
          </Col>
        ))}
      </Row>
    </PageShell>
  );
}

function GoalDetail() {
  const navigate = useNavigate();
  const { goalId } = useParams();
  const { data: goals } = useApi<AnyRecord[]>('/goals', []);
  const { data: tasks, loading } = useApi<AnyRecord[]>(`/goals/${goalId}/parent-tasks`, [goalId]);
  const goal = (goals || []).find((item) => String(item.id) === String(goalId));
  return (
    <PageShell
      title={goal ? `${goal.code} ${goal.name}` : '战略目标详情'}
      subtitle="查看该战略目标下关联的母任务项"
      back={<Button size="small" icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)}>返回</Button>}
    >
      <Row gutter={[16, 16]}>
          {(tasks || []).map((task) => (
            <Col xs={24} md={12} xl={8} key={task.id}>
              <Link to={`/parent-tasks/${task.id}`} className="card-link">
              <Card loading={loading} hoverable className="task-card refined-task-card" extra={<StatusTag value={task.status} />}>
                <Space direction="vertical" className="full-width">
                  <TaskTitle code={task.code} title={task.title} />
                  <div className="task-meta-grid">
                    <Typography.Text type="secondary">负责人</Typography.Text>
                    <div>{renderPeople(task.owners || task.owner)}</div>
                    <Typography.Text type="secondary">牵头部门</Typography.Text>
                    <div>{renderDepartments(task.department)}</div>
                  </div>
                  <TaskMetricTags task={task} />
                </Space>
              </Card>
              </Link>
            </Col>
          ))}
      </Row>
    </PageShell>
  );
}

function ParentTasks() {
  const navigate = useNavigate();
  const { data: auth } = useApi<AnyRecord>('/auth/me', []);
  const { data, loading, reload } = useApi<AnyRecord[]>('/parent-tasks', []);
  const { data: goals } = useApi<AnyRecord[]>('/goals', []);
  const { data: departments } = useApi<AnyRecord[]>('/departments', []);
  const { data: people } = useApi<AnyRecord[]>('/user-options', []);
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editing, setEditing] = useState<AnyRecord | null>(null);
  const [createForm] = Form.useForm();
  const [editForm] = Form.useForm();
  const [deleteForm] = Form.useForm();
  const canManageParentTasks = Boolean(auth?.features?.can_manage_parent_tasks);
  const goalOptions = (goals || []).map((item) => ({ value: item.id, label: `${item.code} ${item.name}` }));
  const departmentOptions = (departments || []).map((item) => ({ value: item.id, label: item.name }));
  const peopleOptions = personOptions(people);

  const normalizeParentTaskValues = (values: AnyRecord) => ({
    ...values,
    due_date: values.due_date ? values.due_date.format('YYYY-MM-DD') : null
  });
  const createParentTask = async () => {
    const values = await createForm.validateFields();
    await postJson('/parent-tasks', normalizeParentTaskValues(values));
    message.success('母任务已新增');
    setCreateOpen(false);
    createForm.resetFields();
    await reload();
  };
  const openEdit = (task: AnyRecord) => {
    setEditing(task);
    editForm.setFieldsValue({
      title: task.title,
      description: task.description,
      goal_id: task.goal_id,
      department_id: task.department_id,
      owner_ids: task.owner_ids?.length ? task.owner_ids : (task.owner_id ? [task.owner_id] : []),
      due_date: task.due_date ? dayjs(task.due_date) : null
    });
  };
  const saveEdit = async () => {
    const values = await editForm.validateFields();
    if (!editing) return;
    await putJson(`/parent-tasks/${editing.id}`, normalizeParentTaskValues(values));
    message.success('母任务已更新');
    setEditing(null);
    await reload();
  };
  const archiveParentTask = async () => {
    const values = await deleteForm.validateFields();
    await deleteJson(`/parent-tasks/${values.parent_task_id}`);
    message.success('母任务已归档');
    setDeleteOpen(false);
    deleteForm.resetFields();
    await reload();
  };

  return (
    <PageShell
      title="母任务管理"
      subtitle="集中管理公司级核心任务和责任归属"
      extra={canManageParentTasks ? (
        <Space>
          <Button type="primary" onClick={() => setCreateOpen(true)}>新增母任务</Button>
          <Button danger onClick={() => setDeleteOpen(true)}>删除母任务</Button>
        </Space>
      ) : null}
    >
      <div className="parent-task-layout">
        <aside className="page-directory">
          <Typography.Text type="secondary">母任务目录</Typography.Text>
          <Menu
            mode="inline"
            items={(data || []).map((task) => ({ key: String(task.id), label: `${task.code} ${task.title}` }))}
            onClick={({ key }) => navigate(`/parent-tasks/${key}`)}
          />
        </aside>
        <Row gutter={[16, 16]} className="full-width">
          {(data || []).map((task) => (
            <Col xs={24} lg={12} xl={8} key={task.id}>
              <Card
                loading={loading}
                className="task-card refined-task-card"
                extra={<StatusTag value={task.status} />}
                actions={[
                  <Link to={`/parent-tasks/${task.id}`} key="detail">查看任务详情</Link>,
                  task.can_edit ? <Button type="link" key="edit" onClick={() => openEdit(task)}>编辑</Button> : null
                ].filter(Boolean)}
              >
                <Space direction="vertical" className="full-width">
                  <TaskTitle code={task.code} title={task.title} />
                  <div className="task-meta-grid">
                    <Typography.Text type="secondary">负责人</Typography.Text>
                    <div>{renderPeople(task.owners || task.owner)}</div>
                    <Typography.Text type="secondary">牵头部门</Typography.Text>
                    <div>{renderDepartments(task.department)}</div>
                    <Typography.Text type="secondary">截止日期</Typography.Text>
                    <Typography.Text>{task.due_date || '-'}</Typography.Text>
                  </div>
                  <TaskMetricTags task={task} />
                </Space>
              </Card>
            </Col>
          ))}
        </Row>
      </div>
      <Modal title="新增母任务" open={createOpen} onOk={createParentTask} onCancel={() => setCreateOpen(false)} destroyOnClose>
        <ParentTaskForm form={createForm} goalOptions={goalOptions} departmentOptions={departmentOptions} peopleOptions={peopleOptions} />
      </Modal>
      <Modal title="编辑母任务" open={Boolean(editing)} onOk={saveEdit} onCancel={() => setEditing(null)} destroyOnClose>
        <ParentTaskForm form={editForm} goalOptions={goalOptions} departmentOptions={departmentOptions} peopleOptions={peopleOptions} />
      </Modal>
      <Modal title="删除母任务" open={deleteOpen} onOk={archiveParentTask} onCancel={() => setDeleteOpen(false)} okText="归档隐藏" okButtonProps={{ danger: true }} destroyOnClose>
        <Alert type="warning" showIcon className="mb16" message="删除会按归档处理，隐藏该母任务默认入口，不会物理删除部门任务、子任务和历史记录。" />
        <Form form={deleteForm} layout="vertical">
          <Form.Item name="parent_task_id" label="选择母任务" rules={[{ required: true, message: '请选择要归档的母任务' }]}>
            <Select options={(data || []).map((task) => ({ value: task.id, label: `${task.code} ${task.title}` }))} />
          </Form.Item>
        </Form>
      </Modal>
    </PageShell>
  );
}

function ParentTaskForm({ form, goalOptions, departmentOptions, peopleOptions }: {
  form: any;
  goalOptions: { value: number; label: string }[];
  departmentOptions: { value: number; label: string }[];
  peopleOptions: { value: number; label: string }[];
}) {
  return (
    <Form form={form} layout="vertical">
      <Form.Item name="title" label="母任务名称" rules={[{ required: true, message: '请输入母任务名称' }]}>
        <Input />
      </Form.Item>
      <Form.Item name="description" label="说明">
        <Input.TextArea rows={3} />
      </Form.Item>
      <Row gutter={16}>
        <Col xs={24} md={12}>
          <Form.Item name="goal_id" label="战略目标" rules={[{ required: true, message: '请选择战略目标' }]}>
            <Select options={goalOptions} />
          </Form.Item>
        </Col>
        <Col xs={24} md={12}>
          <Form.Item name="department_id" label="牵头部门" rules={[{ required: true, message: '请选择牵头部门' }]}>
            <Select options={departmentOptions} />
          </Form.Item>
        </Col>
      </Row>
      <Row gutter={16}>
        <Col xs={24} md={12}>
          <Form.Item name="owner_ids" label="母任务负责人" rules={[{ required: true, message: '请选择负责人' }]}>
            <PeopleSelect options={peopleOptions} />
          </Form.Item>
        </Col>
        <Col xs={24} md={12}>
          <Form.Item name="due_date" label="截止时间">
            <DatePicker className="full-width" />
          </Form.Item>
        </Col>
      </Row>
    </Form>
  );
}

function DepartmentTaskForm({ form, parentTask, departmentOptions, peopleOptions }: {
  form: any;
  parentTask?: AnyRecord | null;
  departmentOptions: { value: number; label: string }[];
  peopleOptions: { value: number; label: string }[];
}) {
  return (
    <Form form={form} layout="vertical">
      {parentTask && (
        <Alert
          type="info"
          showIcon
          className="mb16"
          message={`上级母任务：${parentTask.code || ''} ${parentTask.title || ''}`}
        />
      )}
      <Form.Item name="title" label="部门任务内容" rules={[{ required: true, message: '请输入部门任务内容' }]}>
        <Input.TextArea rows={4} />
      </Form.Item>
      <Row gutter={16}>
        <Col xs={24} md={12}>
          <Form.Item name="department_ids" label="负责部门" rules={[{ required: true, message: '请选择负责部门' }]}>
            <Select mode="multiple" options={departmentOptions} />
          </Form.Item>
        </Col>
        <Col xs={24} md={12}>
          <Form.Item name="owner_ids" label="负责人" rules={[{ required: true, message: '请选择负责人' }]}>
            <PeopleSelect options={peopleOptions} />
          </Form.Item>
        </Col>
      </Row>
      <Form.Item name="due_date" label="截止日期">
        <DatePicker className="full-width" />
      </Form.Item>
    </Form>
  );
}

function SplitSubTaskForm({ form, task, peopleOptions }: {
  form: any;
  task?: AnyRecord | null;
  peopleOptions: { value: number; label: string }[];
}) {
  return (
    <Form form={form} layout="vertical">
      {task && (
        <Descriptions column={1} size="small" className="mb16" bordered>
          <Descriptions.Item label="所属母任务">{task.parent_task || '-'}</Descriptions.Item>
          <Descriptions.Item label="部门级任务">{task.code} {task.title}</Descriptions.Item>
          <Descriptions.Item label="负责部门">{renderDepartments(task.departments)}</Descriptions.Item>
        </Descriptions>
      )}
      <Form.Item name="title" label="具体任务" rules={[{ required: true, message: '请输入具体任务' }]}>
        <Input.TextArea rows={4} />
      </Form.Item>
      <Row gutter={16}>
        <Col xs={24} md={12}>
          <Form.Item name="owner_ids" label="负责人" rules={[{ required: true, message: '请选择负责人' }]}>
            <PeopleSelect options={peopleOptions} />
          </Form.Item>
        </Col>
        <Col xs={24} md={12}>
          <Form.Item name="executor_ids" label="执行人" rules={[{ required: true, message: '请选择执行人' }]}>
            <PeopleSelect options={peopleOptions} />
          </Form.Item>
        </Col>
      </Row>
      <Row gutter={16}>
        <Col xs={24} md={12}>
          <Form.Item name="due_date" label="截止日期">
            <DatePicker className="full-width" />
          </Form.Item>
        </Col>
      </Row>
    </Form>
  );
}

function ParentTaskDetail() {
  const navigate = useNavigate();
  const { parentTaskId } = useParams();
  const { data: task, reload: reloadParentTask } = useApi<AnyRecord>(`/parent-tasks/${parentTaskId}`, [parentTaskId]);
  const { data: departmentTasks, reload } = useApi<AnyRecord[]>(`/parent-tasks/${parentTaskId}/department-tasks`, [parentTaskId]);
  const { data: departments } = useApi<AnyRecord[]>('/departments', []);
  const { data: people } = useApi<AnyRecord[]>('/user-options', []);
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editing, setEditing] = useState<AnyRecord | null>(null);
  const [createForm] = Form.useForm();
  const [editForm] = Form.useForm();
  const [deleteForm] = Form.useForm();
  const departmentOptions = (departments || []).map((item) => ({ value: item.id, label: item.name }));
  const peopleOptions = personOptions(people);
  const canManageDepartmentTasks = Boolean(task?.can_edit);
  const normalizeDepartmentTaskValues = (values: AnyRecord) => {
    const departmentIds = values.department_ids || [];
    return {
      ...values,
      department_id: departmentIds[0],
      department_ids: departmentIds,
      due_date: values.due_date ? values.due_date.format('YYYY-MM-DD') : null
    };
  };
  const createDepartmentTask = async () => {
    const values = await createForm.validateFields();
    await postJson('/department-tasks', {
      ...normalizeDepartmentTaskValues(values),
      parent_task_id: Number(parentTaskId)
    });
    message.success('部门级任务已新增');
    setCreateOpen(false);
    createForm.resetFields();
    await reload();
    await reloadParentTask();
  };
  const openDepartmentTaskEdit = (row: AnyRecord) => {
    setEditing(row);
    editForm.setFieldsValue({
      title: row.title,
      department_ids: row.department_ids?.length ? row.department_ids : (row.department_id ? [row.department_id] : []),
      owner_ids: row.owner_ids?.length ? row.owner_ids : (row.owner_id ? [row.owner_id] : []),
      due_date: row.due_date ? dayjs(row.due_date) : null
    });
  };
  const saveDepartmentTaskEdit = async () => {
    const values = await editForm.validateFields();
    if (!editing) return;
    await putJson(`/department-tasks/${editing.id}`, normalizeDepartmentTaskValues(values));
    message.success('部门级任务已更新');
    setEditing(null);
    await reload();
    await reloadParentTask();
  };
  const archiveDepartmentTask = async () => {
    const values = await deleteForm.validateFields();
    await deleteJson(`/department-tasks/${values.department_task_id}`);
    message.success('部门级任务已归档');
    setDeleteOpen(false);
    deleteForm.resetFields();
    await reload();
    await reloadParentTask();
  };
  const columns: ColumnsType<AnyRecord> = [
    { title: '任务编号', dataIndex: 'code', width: 110 },
    { title: '部门级任务', dataIndex: 'title', width: 230, ellipsis: true, render: renderEllipsis },
    { title: '负责部门', dataIndex: 'departments', width: 160, responsive: ['lg'], render: renderDepartments },
    { title: '负责人', dataIndex: 'owners', width: 140, render: renderPeople },
    { title: '状态', dataIndex: 'status', width: 96, render: (value) => <StatusTag value={value} /> },
    {
      title: '编辑',
      width: 96,
      render: (_, row) => (
        <Button size="small" disabled={!row.can_edit} onClick={() => openDepartmentTaskEdit(row)}>
          编辑
        </Button>
      )
    }
  ];
  return (
    <PageShell
      title={task ? `${task.code} ${task.title}` : '母任务详情'}
      subtitle="查看该母任务下的部门级任务与有效子任务"
      back={<Button size="small" icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)}>返回</Button>}
    >
      <Card className="mb16 summary-card">
        <Descriptions column={{ xs: 1, md: 2, xl: 3 }} size="small">
          <Descriptions.Item label="战略目标">{task?.goal || '-'}</Descriptions.Item>
          <Descriptions.Item label="负责人">{renderPeople(task?.owners || task?.owner)}</Descriptions.Item>
          <Descriptions.Item label="牵头部门">{task?.department || '-'}</Descriptions.Item>
          <Descriptions.Item label="状态"><StatusTag value={task?.status} /></Descriptions.Item>
          <Descriptions.Item label="截止日期">{task?.due_date || '-'}</Descriptions.Item>
        </Descriptions>
      </Card>
      <Card
        className="business-card"
        title="部门级任务"
        extra={canManageDepartmentTasks ? (
          <Space>
            <Button type="primary" onClick={() => setCreateOpen(true)}>新增</Button>
            <Button danger onClick={() => setDeleteOpen(true)}>删除</Button>
          </Space>
        ) : null}
      >
        <Table
          rowKey="id"
          dataSource={departmentTasks || []}
          columns={columns}
          className="business-table"
          tableLayout="fixed"
          scroll={{ x: 900 }}
          expandable={{
            expandedRowRender: (row) => (
              <Table
                rowKey="id"
                size="small"
                pagination={false}
                dataSource={row.sub_tasks || []}
                className="business-table nested-table"
                columns={[
                  { title: '子任务编号', dataIndex: 'code', width: 150 },
                  { title: '具体任务', dataIndex: 'title', width: 240, ellipsis: true, render: renderEllipsis },
                  { title: '执行人', dataIndex: 'executors', width: 140, render: renderPeople },
                  { title: '风险', dataIndex: 'risk_level', width: 92, render: (value) => <StatusTag value={value} /> },
                  { title: '截止日期', dataIndex: 'due_date', width: 108, responsive: ['lg'] }
                ]}
                tableLayout="fixed"
                scroll={{ x: 704 }}
              />
            ),
            rowExpandable: (row) => Boolean((row.sub_tasks || []).length)
          }}
        />
      </Card>
      <Modal title="新增部门级任务" open={createOpen} onOk={createDepartmentTask} onCancel={() => setCreateOpen(false)} destroyOnClose>
        <DepartmentTaskForm form={createForm} parentTask={task} departmentOptions={departmentOptions} peopleOptions={peopleOptions} />
      </Modal>
      <Modal title="编辑部门级任务" open={Boolean(editing)} onOk={saveDepartmentTaskEdit} onCancel={() => setEditing(null)} destroyOnClose>
        <DepartmentTaskForm form={editForm} parentTask={task} departmentOptions={departmentOptions} peopleOptions={peopleOptions} />
      </Modal>
      <Modal title="删除部门级任务" open={deleteOpen} onOk={archiveDepartmentTask} onCancel={() => setDeleteOpen(false)} okText="归档隐藏" okButtonProps={{ danger: true }} destroyOnClose>
        <Alert type="warning" showIcon className="mb16" message="删除会按归档处理，隐藏该部门级任务默认入口，不会物理删除子任务和历史记录。" />
        <Form form={deleteForm} layout="vertical">
          <Form.Item name="department_task_id" label="选择部门级任务" rules={[{ required: true, message: '请选择要归档的部门级任务' }]}>
            <Select options={(departmentTasks || []).filter((item) => item.can_delete).map((item) => ({ value: item.id, label: `${item.code} ${item.title}` }))} />
          </Form.Item>
        </Form>
      </Modal>
    </PageShell>
  );
}

function DepartmentTasks() {
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<number | null>(null);
  const query = selectedDepartmentId ? `/department-tasks/overview?department_id=${selectedDepartmentId}` : '/department-tasks/overview';
  const { data, reload } = useApi<AnyRecord>(query, [selectedDepartmentId]);
  const { data: people } = useApi<AnyRecord[]>('/user-options', []);
  const [splitting, setSplitting] = useState<AnyRecord | null>(null);
  const [splitForm] = Form.useForm();
  const departmentTasks: AnyRecord[] = data?.department_tasks || [];
  const peopleOptions = personOptions(people);
  const openSplit = (row: AnyRecord) => {
    setSplitting(row);
    splitForm.setFieldsValue({
      title: undefined,
      owner_ids: row.owner_ids?.length ? row.owner_ids : (row.owner_id ? [row.owner_id] : []),
      executor_ids: undefined,
      due_date: row.due_date ? dayjs(row.due_date) : null
    });
  };
  const createSubTask = async () => {
    const values = await splitForm.validateFields();
    if (!splitting) return;
    await postJson('/sub-tasks', {
      department_task_id: splitting.id,
      title: values.title,
      owner_ids: values.owner_ids,
      executor_ids: values.executor_ids,
      due_date: values.due_date ? values.due_date.format('YYYY-MM-DD') : null
    });
    message.success('子任务已拆解');
    setSplitting(null);
    splitForm.resetFields();
    await reload();
  };
  const departmentTaskColumns: ColumnsType<AnyRecord> = [
    { title: '任务编号', dataIndex: 'code', width: 106 },
    { title: '部门任务', dataIndex: 'title', width: 220, ellipsis: true, render: renderEllipsis },
    { title: '所属母任务', dataIndex: 'parent_task', width: 190, ellipsis: true, render: renderEllipsis },
    { title: '负责部门', dataIndex: 'departments', width: 160, responsive: ['lg'], render: renderDepartments },
    { title: '负责人', dataIndex: 'owners', width: 138, render: renderPeople },
    { title: '状态', dataIndex: 'status', width: 96, render: (value) => <StatusTag value={value} /> },
    {
      title: '拆解',
      width: 116,
      render: (_, row) => (
        <Space>
          {row.pending_split_count ? <Tag color="orange">{row.pending_split_count} 个</Tag> : <Tag>无</Tag>}
          <Button size="small" disabled={!row.can_split} onClick={() => openSplit(row)}>拆解</Button>
        </Space>
      )
    }
  ];
  return (
    <PageShell title="部门任务总览" subtitle="按部门直接查看部门级任务，展开后查看有效子任务">
      <div className={data?.can_switch_department ? 'department-task-layout' : 'department-task-layout no-sidebar'}>
        {data?.can_switch_department && (
          <aside className="department-directory">
            <Typography.Text type="secondary">部门目录</Typography.Text>
            <Menu
              mode="inline"
              selectedKeys={[String(data?.selected_department_id || selectedDepartmentId || 'all')]}
              items={[
                { key: 'all', label: '全部部门' },
                ...((data?.departments || []).map((item: AnyRecord) => ({ key: String(item.id), label: item.name })))
              ]}
              onClick={({ key }) => setSelectedDepartmentId(key === 'all' ? null : Number(key))}
            />
          </aside>
        )}
        <Space direction="vertical" size={16} className="full-width">
          <Card className="business-card">
            <Table
              rowKey="id"
              dataSource={departmentTasks}
              columns={departmentTaskColumns}
              className="business-table"
              tableLayout="fixed"
              scroll={{ x: 866 }}
              title={() => renderTableHeader('部门级任务', departmentTasks.length, '按负责部门和母任务快速扫描')}
              expandable={{
                expandedRowRender: (row) => (
                  <Table
                    rowKey="id"
                    size="small"
                    pagination={false}
                    dataSource={row.sub_tasks || []}
                    className="business-table nested-table"
                    columns={[
                      { title: '子任务编号', dataIndex: 'code', width: 124 },
                      { title: '具体任务', dataIndex: 'title', width: 240, ellipsis: true, render: renderEllipsis },
                      { title: '执行人', dataIndex: 'executors', width: 140, render: renderPeople },
                      { title: '风险', dataIndex: 'risk_level', width: 92, render: (value) => <StatusTag value={value} /> },
                      { title: '截止日期', dataIndex: 'due_date', width: 108, responsive: ['lg'] }
                    ]}
                    tableLayout="fixed"
                    scroll={{ x: 704 }}
                  />
                ),
                rowExpandable: (row) => Boolean((row.sub_tasks || []).length)
              }}
            />
          </Card>
        </Space>
      </div>
      <Modal title="拆解子任务" open={Boolean(splitting)} onOk={createSubTask} onCancel={() => setSplitting(null)} destroyOnClose>
        <SplitSubTaskForm form={splitForm} task={splitting} peopleOptions={peopleOptions} />
      </Modal>
    </PageShell>
  );
}

function SubTasks() {
  const { data } = useApi<AnyRecord[]>('/sub-tasks', []);
  const tasks = data || [];
  const executionTasks = tasks.filter((task) => task.viewer_relation === 'executor' || task.viewer_relation === 'both');
  const ownerTasks = tasks.filter((task) => task.viewer_relation === 'owner');
  const managementTasks = tasks.filter((task) => task.viewer_relation === 'management');
  const relationLabels: Record<string, { label: string; color: string }> = {
    executor: { label: '我执行', color: 'blue' },
    owner: { label: '我负责', color: 'gold' },
    both: { label: '负责+执行', color: 'purple' },
    management: { label: '管理查看', color: 'default' }
  };
  const columns: ColumnsType<AnyRecord> = [
    { title: '编号', dataIndex: 'code', width: 124 },
    { title: '子任务', dataIndex: 'title', width: 240, ellipsis: true, render: renderEllipsis },
    { title: '部门级任务', dataIndex: 'department_task', width: 190, ellipsis: true, render: renderEllipsis },
    { title: '执行人', dataIndex: 'executors', width: 132, render: renderPeople },
    { title: '负责人', dataIndex: 'owners', width: 132, render: renderPeople },
    {
      title: '我的身份',
      dataIndex: 'viewer_relation',
      width: 96,
      render: (value) => {
        const meta = relationLabels[String(value)] || { label: '-', color: 'default' };
        return <Tag color={meta.color}>{meta.label}</Tag>;
      }
    },
    { title: '状态', dataIndex: 'status', width: 96, render: (value) => <StatusTag value={value} /> },
    { title: '本周状态', dataIndex: 'weekly_status', width: 96, render: (value) => <StatusTag value={value} /> },
    { title: '风险', dataIndex: 'risk_level', width: 92, render: (value) => <StatusTag value={value} /> },
    { title: '截止日期', dataIndex: 'due_date', width: 108, responsive: ['lg'] },
    {
      title: '操作',
      width: 100,
      render: (_, row) => (
        row.can_update_weekly
          ? <Link className="table-action-link" to={`/sub-tasks/${row.id}/update${row.current_assignee_id ? `?assigneeId=${row.current_assignee_id}` : ''}`}>更新</Link>
          : <Typography.Text type="secondary">只读</Typography.Text>
      )
    }
  ];
  const renderGroup = (title: string, items: AnyRecord[], description: string) => (
    items.length ? (
      <Table
        key={title}
        rowKey="id"
        dataSource={items}
        columns={columns}
        className={`business-table subtask-table subtask-table-${title === '管理查看' ? 'management' : 'personal'}`}
        tableLayout="fixed"
        scroll={{ x: 1120 }}
        title={() => renderTableHeader(title, items.length, description)}
      />
    ) : null
  );
  return (
    <PageShell title="子任务执行" subtitle="个人更新入口：执行人填写周更新，负责人查看跟进，管理查看只读区分">
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        {renderGroup('我执行', executionTasks, '可开启、完成并填写周更新')}
        {renderGroup('我负责', ownerTasks, '仅查看负责的子任务，不代执行人填写')}
        {renderGroup('管理查看', managementTasks, '全局查看人员的只读入口；管理员可兜底更新')}
        {!tasks.length && <Alert type="info" showIcon message="当前没有与你相关的子任务。" />}
      </Space>
    </PageShell>
  );
}

function SubTaskUpdate() {
  const navigate = useNavigate();
  const location = useLocation();
  const { subTaskId } = useParams();
  const [form] = Form.useForm();
  const weekKey = currentIsoWeekKey();
  const assigneeId = new URLSearchParams(location.search).get('assigneeId');
  const assigneeQuery = assigneeId ? `&assignee_id=${assigneeId}` : '';
  const subTaskApi = useApi<AnyRecord>(`/sub-tasks/${subTaskId}`, [subTaskId]);
  const updateApi = useApi<AnyRecord>(`/weekly-updates/current?sub_task_id=${subTaskId}&week_key=${weekKey}${assigneeQuery}`, [subTaskId, weekKey, assigneeId]);
  const subTask = subTaskApi.data;
  const update = updateApi.data;
  const [updateStatus, setUpdateStatus] = useState('empty');
  const isCompleted = subTask?.status === 'completed';
  const isStarted = Boolean(subTask && subTask.status !== 'pending_update');
  const canUpdateWeekly = Boolean(subTask?.can_update_weekly);
  const canEditUpdate = canUpdateWeekly && isStarted && !isCompleted;
  const shouldWarn = canEditUpdate && updateStatus !== 'submitted';

  useEffect(() => {
    if (!update) return;
    form.setFieldsValue({
      this_week: update.this_week,
      next_week: update.next_week,
      risk: update.risk,
      needs_coordination: update.needs_coordination || false
    });
    setUpdateStatus(update.status || 'empty');
  }, [update?.id, update?.status, subTaskId]);

  const saveUpdate = async (submitUpdate: boolean) => {
    if (!canEditUpdate) return;
    const values = form.getFieldsValue();
    await postJson('/weekly-updates', {
      sub_task_id: Number(subTaskId),
      assignee_id: update?.assignee_id || (assigneeId ? Number(assigneeId) : undefined),
      week_key: weekKey,
      this_week: values.this_week || null,
      next_week: values.next_week || null,
      risk: values.risk || null,
      needs_coordination: Boolean(values.needs_coordination),
      submit: submitUpdate
    });
    setUpdateStatus(submitUpdate ? 'submitted' : 'draft');
    if (submitUpdate) {
      message.success('周更新已提交');
    }
    updateApi.reload();
    subTaskApi.reload();
  };
  const autoSaveDraft = async () => {
    if (updateStatus === 'submitted' || !canEditUpdate) return;
    await saveUpdate(false);
  };
  const startTask = async () => {
    await postJson(`/sub-tasks/${subTaskId}/start`, {});
    message.success('任务已开启');
    subTaskApi.reload();
  };
  const completeTask = async () => {
    await postJson(`/sub-tasks/${subTaskId}/complete`, {});
    message.success('任务已完成');
    subTaskApi.reload();
  };
  const confirmLeave = (target?: string | number) => {
    if (!shouldWarn) {
      if (typeof target === 'number') navigate(target);
      else if (target) navigate(target);
      return;
    }
    Modal.confirm({
      title: '周更新尚未提交',
      content: '当前内容会先保存为草稿。你也可以直接提交本周更新。',
      okText: '提交保存',
      cancelText: '保存草稿暂不提交',
      onOk: async () => {
        await saveUpdate(true);
        if (typeof target === 'number') navigate(target);
        else if (target) navigate(target);
      },
      onCancel: async () => {
        await saveUpdate(false);
        if (typeof target === 'number') navigate(target);
        else if (target) navigate(target);
      }
    });
  };
  useBeforeUnload((event) => {
    if (!shouldWarn) return;
    event.preventDefault();
    event.returnValue = '';
  });
  useEffect(() => {
    const handler = (event: MouseEvent) => {
      if (!shouldWarn) return;
      const anchor = (event.target as HTMLElement | null)?.closest('a[href]') as HTMLAnchorElement | null;
      if (!anchor || anchor.target || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const url = new URL(anchor.href);
      if (url.origin !== window.location.origin || url.pathname === window.location.pathname) return;
      event.preventDefault();
      confirmLeave(`${url.pathname}${url.search}${url.hash}`);
    };
    document.addEventListener('click', handler, true);
    return () => document.removeEventListener('click', handler, true);
  }, [shouldWarn, updateStatus, subTaskId]);

  if (subTaskApi.loading && !subTask) {
    return (
      <PageShell
        title="子任务周更新"
        subtitle="正在加载子任务"
        back={<Button size="small" icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)}>返回</Button>}
      >
        <Card loading />
      </PageShell>
    );
  }

  if (subTaskApi.error || updateApi.error || !subTask) {
    const statusCode = (subTaskApi.error as any)?.response?.status || (updateApi.error as any)?.response?.status;
    const messageText = statusCode === 403 ? '你没有权限查看或更新该子任务。' : statusCode === 404 ? '没有找到这个子任务，可能已归档或链接已失效。' : '子任务更新页加载失败，请稍后重试。';
    return (
      <PageShell
        title="子任务周更新"
        subtitle="无法进入更新页"
        back={<Button size="small" icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)}>返回</Button>}
      >
        <Alert type="warning" showIcon message={messageText} />
      </PageShell>
    );
  }

  return (
    <PageShell
      title={subTask ? `${subTask.code} ${subTask.title}` : '子任务周更新'}
      subtitle={`当前周期 ${weekKey}，失焦后自动保存草稿`}
      back={<Button size="small" icon={<ArrowLeftOutlined />} onClick={() => confirmLeave(-1)}>返回</Button>}
    >
      <Card className="mb16">
        <Descriptions column={3}>
          <Descriptions.Item label="部门级任务">{subTask?.department_task || '-'}</Descriptions.Item>
          <Descriptions.Item label="执行人">{renderPeople(subTask?.executors || subTask?.executor)}</Descriptions.Item>
          <Descriptions.Item label="负责人">{renderPeople(subTask?.owners || subTask?.owner)}</Descriptions.Item>
          <Descriptions.Item label="当前填报人">{update?.assignee || '-'}</Descriptions.Item>
          <Descriptions.Item label="状态"><StatusTag value={subTask?.status} /></Descriptions.Item>
          <Descriptions.Item label="风险"><StatusTag value={subTask?.risk_level} /></Descriptions.Item>
          <Descriptions.Item label="本周状态"><StatusTag value={subTask?.weekly_status} /></Descriptions.Item>
        </Descriptions>
        <Space className="mt16">
          {canUpdateWeekly && !isStarted && <Button type="primary" onClick={startTask}>开启任务</Button>}
          {canEditUpdate && <Button danger onClick={completeTask}>标记已完成</Button>}
          {!canUpdateWeekly && <Tag>只读查看</Tag>}
          {isCompleted && <Tag color="green">该子任务已完成</Tag>}
        </Space>
      </Card>
      <Card title="本周更新">
        {!isStarted && <Alert type="info" showIcon className="mb16" message="该任务尚未开启。请先点击“开启任务”，再填写本周更新。" />}
        {isCompleted && <Alert type="success" showIcon className="mb16" message="该任务已完成，周更新表单已锁定。" />}
        <Form form={form} layout="vertical" initialValues={{ needs_coordination: false }}>
          <Form.Item name="this_week" label="本周完成内容">
            <Input.TextArea rows={5} disabled={!canEditUpdate} onBlur={autoSaveDraft} placeholder="请填写本周完成内容" />
          </Form.Item>
          <Form.Item name="next_week" label="下周计划">
            <Input.TextArea rows={4} disabled={!canEditUpdate} onBlur={autoSaveDraft} placeholder="请填写下周计划" />
          </Form.Item>
          <Form.Item name="risk" label="遗留事项">
            <Input.TextArea rows={4} disabled={!canEditUpdate} onBlur={autoSaveDraft} placeholder="请填写遗留事项、卡点或需要后续处理的问题" />
          </Form.Item>
          <Form.Item name="needs_coordination" valuePropName="checked">
            <Checkbox disabled={!canEditUpdate} onBlur={autoSaveDraft}>需要协调，进入会议看板候选事项</Checkbox>
          </Form.Item>
          <Space>
            <Button disabled={!canEditUpdate} onClick={() => saveUpdate(false)}>保存草稿暂不提交</Button>
            <Button disabled={!canEditUpdate} type="primary" onClick={() => saveUpdate(true)}>提交保存</Button>
          </Space>
        </Form>
      </Card>
    </PageShell>
  );
}

function MeetingBoardTabs() {
  const location = useLocation();
  const items = [
    { path: '/meeting-board/overview', label: '总览' },
    { path: '/meeting-board/parent', label: '母任务看板' },
    { path: '/meeting-board/department', label: '部门看板' }
  ];
  return (
    <Space className="mb16 meeting-tabs" wrap>
      {items.map((item) => (
        <Button key={item.path} type={location.pathname === item.path ? 'primary' : 'default'}>
          <Link to={item.path}>{item.label}</Link>
        </Button>
      ))}
    </Space>
  );
}

function MeetingBoardOverview() {
  const { data, loading } = useApi<AnyRecord>('/meeting-board/overview', []);
  const cards = data?.cards || {};
  const weeklyBar = data?.weekly_bar || [];
  const riskPie = data?.risk_pie || [];
  const trend = data?.trend || [];
  const gantt = data?.gantt || [];
  const ganttBase = Math.min(...gantt.map((item: AnyRecord) => new Date(item.start_date).getTime()), Date.now());
  const ganttCategories = gantt.map((item: AnyRecord) => item.code);
  const ganttOffset = gantt.map((item: AnyRecord) => Math.max(0, Math.round((new Date(item.start_date).getTime() - ganttBase) / 86400000)));
  const ganttDuration = gantt.map((item: AnyRecord) => {
    const start = new Date(item.start_date).getTime();
    const end = new Date(item.due_date).getTime();
    return Math.max(1, Math.round((end - start) / 86400000));
  });
  return (
    <PageShell title="会议看板" subtitle={`当前周期 ${data?.week_key || '-'}，汇总周更新、风险、逾期和任务节奏`}>
      <MeetingBoardTabs />
      <Row gutter={[16, 16]} className="meeting-metric-row">
        {[
          ['进行中子任务', cards.active_sub_tasks, '#2457d6'],
          ['本周已更新', cards.updated_this_week, '#5f9f25'],
          ['本周待更新', cards.missing_updates, '#d97706'],
          ['风险任务', cards.risk_tasks, '#dc2626'],
          ['逾期任务', cards.overdue_tasks, '#b91c1c'],
          ['已完成任务', cards.completed_tasks, '#0f766e']
        ].map(([label, value, color]) => (
          <Col xs={24} sm={12} xl={4} key={String(label)}>
            <Card loading={loading} className="metric-card meeting-metric-card" style={{ borderTopColor: String(color) }}>
              <Statistic title={label} value={Number(value || 0)} valueStyle={{ color: String(color) }} />
            </Card>
          </Col>
        ))}
      </Row>
      <Row gutter={[16, 16]} className="section-row">
        <Col xs={24} xl={12}>
          <ChartCard
            title="本周更新状态"
            className="meeting-chart-card"
            option={{
              tooltip: {},
              grid: { left: 40, right: 16, top: 32, bottom: 32 },
              xAxis: { type: 'category', data: weeklyBar.map((item: AnyRecord) => item.name) },
              yAxis: { type: 'value' },
              series: [{ type: 'bar', data: weeklyBar.map((item: AnyRecord) => item.value), itemStyle: { color: '#2457d6' } }]
            }}
          />
        </Col>
        <Col xs={24} xl={12}>
          <ChartCard
            title="风险占比"
            className="meeting-chart-card"
            option={{
              tooltip: { trigger: 'item' },
              legend: { bottom: 0 },
              series: [{ type: 'pie', radius: ['45%', '68%'], data: riskPie }]
            }}
          />
        </Col>
        <Col xs={24} xl={12}>
          <ChartCard
            title="近周提交趋势"
            className="meeting-chart-card"
            option={{
              tooltip: { trigger: 'axis' },
              legend: { top: 0 },
              grid: { left: 40, right: 16, top: 42, bottom: 32 },
              xAxis: { type: 'category', data: trend.map((item: AnyRecord) => item.week_key) },
              yAxis: { type: 'value' },
              series: [
                { name: '已提交', type: 'line', smooth: true, data: trend.map((item: AnyRecord) => item.submitted), itemStyle: { color: '#2457d6' } },
                { name: '草稿', type: 'line', smooth: true, data: trend.map((item: AnyRecord) => item.draft), itemStyle: { color: '#8cc63f' } }
              ]
            }}
          />
        </Col>
        <Col xs={24} xl={12}>
          <ChartCard
            title="近期任务甘特"
            height={340}
            className="meeting-chart-card"
            option={{
              tooltip: { trigger: 'axis' },
              grid: { left: 80, right: 20, top: 24, bottom: 30 },
              xAxis: { type: 'value', name: '天' },
              yAxis: { type: 'category', data: ganttCategories, inverse: true },
              series: [
                { type: 'bar', stack: 'total', data: ganttOffset, itemStyle: { color: 'transparent' }, emphasis: { disabled: true } },
                { type: 'bar', stack: 'total', data: ganttDuration, itemStyle: { color: '#5f9f25' } }
              ]
            }}
          />
        </Col>
      </Row>
      <Card id="risk-overdue" className="section-row meeting-table-card business-card">
        <Table
          rowKey="id"
          dataSource={data?.risk_overdue || []}
          className="business-table"
          tableLayout="fixed"
          scroll={{ x: 960 }}
          title={() => renderTableHeader('风险与逾期汇总', data?.risk_overdue?.length || 0, '风险、逾期和负责人快速核对')}
          columns={[
            { title: '类型', dataIndex: 'issue_type', width: 78, render: (value) => <Tag color={value === '逾期' ? 'red' : 'orange'}>{value}</Tag> },
            { title: '编号', dataIndex: 'code', width: 124 },
            { title: '子任务', dataIndex: 'title', width: 230, ellipsis: true, render: renderEllipsis },
            { title: '部门级任务', dataIndex: 'department_task', width: 190, ellipsis: true, render: renderEllipsis },
            { title: '执行人', dataIndex: 'executors', width: 132, render: renderPeople },
            { title: '负责人', dataIndex: 'owners', width: 132, render: renderPeople },
            { title: '风险', dataIndex: 'risk_level', width: 88, render: (value) => <StatusTag value={value} /> },
            { title: '截止日期', dataIndex: 'due_date', width: 108, responsive: ['lg'] }
          ]}
        />
      </Card>
    </PageShell>
  );
}

function MeetingBoardParent() {
  const { data } = useApi<AnyRecord>('/meeting-board/parent', []);
  const rows = data?.rows || [];
  return (
    <PageShell title="母任务看板" subtitle={`当前周期 ${data?.week_key || '-'}，按母任务汇总任务推进风险`}>
      <MeetingBoardTabs />
      <ChartCard
        title="母任务待更新排行"
        className="meeting-chart-card"
        option={{
          tooltip: { trigger: 'axis' },
          grid: { left: 80, right: 20, top: 24, bottom: 80 },
          xAxis: { type: 'category', data: rows.map((item: AnyRecord) => item.code), axisLabel: { rotate: 35 } },
          yAxis: { type: 'value' },
          series: [{ type: 'bar', data: rows.map((item: AnyRecord) => item.missing_updates), itemStyle: { color: '#d97706' } }]
        }}
      />
      <Card className="section-row meeting-table-card business-card">
        <Table
          rowKey="id"
          dataSource={rows}
          className="business-table"
          tableLayout="fixed"
          scroll={{ x: 900 }}
          title={() => renderTableHeader('母任务汇总', rows.length, '按母任务查看待更新、风险和完成情况')}
          columns={[
            { title: '编号', dataIndex: 'code', width: 106 },
            { title: '母任务', dataIndex: 'title', width: 230, ellipsis: true, render: renderEllipsis },
            { title: '牵头部门', dataIndex: 'department', width: 120, ellipsis: true, render: renderEllipsis },
            { title: '负责人', dataIndex: 'owners', width: 132, render: (_: AnyRecord[] | string | null, row: AnyRecord) => renderPeople(row.owners || row.owner) },
            { title: '部门任务', dataIndex: 'department_task_count', width: 88 },
            { title: '子任务', dataIndex: 'sub_task_count', width: 76 },
            { title: '待更新', dataIndex: 'missing_updates', width: 76 },
            { title: '风险', dataIndex: 'risk_count', width: 68 },
            { title: '逾期', dataIndex: 'overdue_count', width: 68 },
            { title: '完成', dataIndex: 'completed_count', width: 68 }
          ]}
        />
      </Card>
    </PageShell>
  );
}

function MeetingBoardDepartment() {
  const { data } = useApi<AnyRecord>('/meeting-board/department', []);
  const rows = data?.rows || [];
  return (
    <PageShell title="部门看板" subtitle={`当前周期 ${data?.week_key || '-'}，按负责部门汇总任务状态`}>
      <MeetingBoardTabs />
      <Row gutter={[16, 16]}>
        <Col xs={24} xl={12}>
          <ChartCard
            title="部门任务量"
            className="meeting-chart-card"
            option={{
              tooltip: { trigger: 'axis' },
              grid: { left: 80, right: 16, top: 24, bottom: 80 },
              xAxis: { type: 'category', data: rows.map((item: AnyRecord) => item.name), axisLabel: { rotate: 35 } },
              yAxis: { type: 'value' },
              series: [{ type: 'bar', data: rows.map((item: AnyRecord) => item.sub_task_count), itemStyle: { color: '#2457d6' } }]
            }}
          />
        </Col>
        <Col xs={24} xl={12}>
          <ChartCard
            title="部门待更新"
            className="meeting-chart-card"
            option={{
              tooltip: { trigger: 'axis' },
              grid: { left: 80, right: 16, top: 24, bottom: 80 },
              xAxis: { type: 'category', data: rows.map((item: AnyRecord) => item.name), axisLabel: { rotate: 35 } },
              yAxis: { type: 'value' },
              series: [{ type: 'bar', data: rows.map((item: AnyRecord) => item.missing_updates), itemStyle: { color: '#d97706' } }]
            }}
          />
        </Col>
      </Row>
      <Card className="section-row meeting-table-card business-card">
        <Table
          rowKey="id"
          dataSource={rows}
          className="business-table"
          tableLayout="fixed"
          scroll={{ x: 680 }}
          title={() => renderTableHeader('部门汇总', rows.length, '按部门查看任务量和风险分布')}
          columns={[
            { title: '部门', dataIndex: 'name', width: 200, ellipsis: true, render: renderEllipsis },
            { title: '部门任务', dataIndex: 'department_task_count', width: 92 },
            { title: '子任务', dataIndex: 'sub_task_count', width: 78 },
            { title: '待更新', dataIndex: 'missing_updates', width: 78 },
            { title: '风险', dataIndex: 'risk_count', width: 68 },
            { title: '逾期', dataIndex: 'overdue_count', width: 68 },
            { title: '完成', dataIndex: 'completed_count', width: 68 }
          ]}
        />
      </Card>
    </PageShell>
  );
}

function TimelinePage() {
  const { data, loading } = useApi<AnyRecord>('/timeline/matrix', []);
  const weeks: string[] = data?.weeks || [];
  const timelineColumns = `240px 132px repeat(${weeks.length}, 156px)`;
  const renderCell = (value?: string | null) => renderTimelineText(value);
  return (
    <PageShell title="历史时间线" subtitle="按任务层级展开，以周为主轴查看完成内容、遗留事项和附件">
      <Card loading={loading} className="timeline-card">
        <div className="timeline-matrix">
          <div className="timeline-grid timeline-header" style={{ gridTemplateColumns: timelineColumns }}>
            <strong>任务</strong>
            <strong>任务开始时间</strong>
            {weeks.map((week) => <strong key={week}>{week.replace('2026-', '')}</strong>)}
          </div>
          {(data?.parents || []).map((parent: AnyRecord) => (
            <details key={parent.id} open className="timeline-node">
              <summary><span className="timeline-code">{parent.code}</span>{renderTimelineText(parent.title)}</summary>
              {(parent.department_tasks || []).map((departmentTask: AnyRecord) => (
                <details key={departmentTask.id} open className="timeline-node child">
                  <summary><span className="timeline-code">{departmentTask.code}</span>{renderTimelineText(departmentTask.title)}</summary>
                  {(departmentTask.sub_tasks || []).map((subTask: AnyRecord) => (
                    <div key={subTask.id} className="timeline-subtask">
                      <div className="timeline-grid timeline-subtask-title" style={{ gridTemplateColumns: timelineColumns }}>
                        <strong><span className="timeline-code">{subTask.code}</span>{renderTimelineText(subTask.title)}</strong>
                        <span>{subTask.started_at || '-'}</span>
                        {weeks.map((week) => <span key={week}><StatusTag value={subTask.status} /></span>)}
                      </div>
                      {[
                        ['完成内容', 'this_week'],
                        ['遗留事项', 'risk']
                      ].map(([label, field]) => (
                        <div key={field} className="timeline-grid timeline-metric-row" style={{ gridTemplateColumns: timelineColumns }}>
                          <span>{label}</span>
                          <span />
                          {weeks.map((week) => <span key={week}>{renderCell(subTask.cells?.[week]?.[field])}</span>)}
                        </div>
                      ))}
                      <div className="timeline-grid timeline-metric-row" style={{ gridTemplateColumns: timelineColumns }}>
                        <span>附件</span>
                        <span />
                        {weeks.map((week) => {
                          const attachments = subTask.cells?.[week]?.attachments || [];
                          return <span key={week}>{attachments.length ? renderTimelineText(attachments.map((item: AnyRecord) => item.filename).join('、')) : <span className="muted-cell timeline-cell-text">暂无附件</span>}</span>;
                        })}
                      </div>
                    </div>
                  ))}
                </details>
              ))}
            </details>
          ))}
        </div>
      </Card>
    </PageShell>
  );
}

function Notifications() {
  const { data, reload } = useApi<AnyRecord[]>('/notifications', []);
  const { data: users } = useApi<AnyRecord[]>('/user-options', []);
  const [loading, setLoading] = useState(false);
  const [testTargetUserId, setTestTargetUserId] = useState<number | null>(null);
  const userOptions = (users || []).map((item) => ({
    value: item.id,
    label: `${item.name}${item.department ? ` / ${item.department}` : ''}`
  }));
  const createMock = async () => {
    setLoading(true);
    try {
      await postJson('/notifications/mock-reminders', { week_key: currentIsoWeekKey() });
      message.success('已生成模拟提醒记录');
      reload();
    } finally {
      setLoading(false);
    }
  };
  const sendLark = async () => {
    setLoading(true);
    try {
      const result = await postJson('/notifications/lark-weekly-reminders', { week_key: currentIsoWeekKey() });
      message.success(`已生成 ${result.created || 0} 条飞书提醒，成功 ${result.sent || 0} 条`);
      reload();
    } finally {
      setLoading(false);
    }
  };
  const checkLark = async () => {
    setLoading(true);
    try {
      const result = await getJson('/lark/diagnostics');
      if (result.ok) {
        message.success(result.message || '飞书配置可用');
      } else {
        message.warning(result.message || '飞书配置不可用');
      }
    } finally {
      setLoading(false);
    }
  };
  const resolveOpenIds = async () => {
    setLoading(true);
    try {
      const result = await postJson('/lark/resolve-open-ids', {});
      message.success(`已解析 ${result.resolved || 0} 人，阻塞 ${result.blocked || 0} 人，失败 ${result.failed || 0} 人`);
      reload();
    } finally {
      setLoading(false);
    }
  };
  const importEmails = async (file: File) => {
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const response = await fetch('/api/lark/import-user-emails', {
        method: 'POST',
        body: formData,
        credentials: 'include'
      });
      if (!response.ok) {
        throw new Error(await response.text());
      }
      const result = await response.json();
      message.success(`已导入 ${result.imported || 0} 人邮箱，阻塞 ${result.blocked || 0} 人`);
      reload();
    } catch (error) {
      message.error(`邮箱导入失败：${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      setLoading(false);
    }
    return false;
  };
  const sendTest = async () => {
    if (!testTargetUserId) {
      message.warning('请选择测试接收人');
      return;
    }
    setLoading(true);
    try {
      const result = await postJson('/notifications/lark-test-message', {
        target_user_id: testTargetUserId
      });
      if (result.ok) {
        message.success('飞书测试卡片已发送');
      } else {
        message.warning(result.message || '飞书测试卡片未发送成功');
      }
      reload();
    } finally {
      setLoading(false);
    }
  };
  const statusColor = (value: string) => {
    if (value === 'sent' || value === 'mock_sent') return 'green';
    if (value === 'pending') return 'blue';
    if (value === 'blocked') return 'orange';
    return 'red';
  };
  return (
    <PageShell
      title="通知记录"
      subtitle="追踪飞书机器人触达效果与用户响应情况"
    >
      <Card className="admin-toolbar-card mb16">
        <Space direction="vertical" size={12} className="full-width">
          <Space wrap className="admin-toolbar">
            <Button onClick={checkLark} loading={loading}>飞书诊断</Button>
            <Upload beforeUpload={importEmails} showUploadList={false} accept=".csv,.xlsx">
              <Button icon={<UploadOutlined />} loading={loading}>导入邮箱表</Button>
            </Upload>
            <Button onClick={resolveOpenIds} loading={loading}>邮箱解析 open_id</Button>
            <Button onClick={createMock} loading={loading}>生成模拟提醒</Button>
          </Space>
          <Space wrap className="admin-toolbar primary-toolbar">
            <Select
              allowClear
              showSearch
              placeholder="测试接收人"
              optionFilterProp="label"
              options={userOptions}
              value={testTargetUserId}
              onChange={(value) => setTestTargetUserId(value || null)}
              className="toolbar-select"
            />
            <Button onClick={sendTest} loading={loading}>发送测试卡片</Button>
            <Button type="primary" onClick={sendLark} loading={loading}>发送飞书提醒</Button>
          </Space>
        </Space>
      </Card>
      <Card className="business-card">
        <Table
          rowKey="id"
          dataSource={data || []}
          className="business-table"
          tableLayout="fixed"
          scroll={{ x: 980 }}
          title={() => renderTableHeader('通知记录', data?.length || 0, '记录飞书提醒、测试卡片和模拟提醒的发送结果')}
          columns={[
            {
              title: '通知时间',
              dataIndex: 'created_at',
              width: 150,
              render: (value) => value ? dayjs(value).format('YYYY-MM-DD HH:mm') : '-'
            },
            { title: '通知对象', dataIndex: 'target_user', width: 120, ellipsis: true, render: renderEllipsis },
            { title: '通知类型', dataIndex: 'notification_type', width: 160, ellipsis: true, render: renderEllipsis },
            { title: '关联对象', width: 130, render: (_, row) => renderEllipsis(`${row.related_type || '-'} ${row.related_id || ''}`) },
            {
              title: '发送状态',
              dataIndex: 'send_status',
              width: 104,
              render: (value) => <Tag color={statusColor(value)}>{value}</Tag>
            },
            { title: '是否点击', dataIndex: 'clicked', width: 88, render: (value) => value ? <Tag color="green">已点击</Tag> : <Tag>未点击</Tag> },
            { title: '处理结果', dataIndex: 'result', width: 228, ellipsis: true, render: renderEllipsis }
          ]}
        />
      </Card>
    </PageShell>
  );
}

function People() {
  const { data, reload } = useApi<AnyRecord[]>('/people', []);
  const { data: departments } = useApi<AnyRecord[]>('/departments', []);
  const { data: roles } = useApi<AnyRecord[]>('/roles', []);
  const [form] = Form.useForm();
  const [editForm] = Form.useForm();
  const [editing, setEditing] = useState<AnyRecord | null>(null);
  const departmentOptions = (departments || []).map((item) => ({ value: item.id, label: item.name }));
  const roleOptions = (roles || []).map((item) => ({ value: item.id, label: item.name }));
  const createPerson = async (values: AnyRecord) => {
    await postJson('/people', values);
    message.success('人员已创建');
    form.resetFields();
    reload();
  };
  const openEdit = (person: AnyRecord) => {
    setEditing(person);
    editForm.setFieldsValue({
      name: person.name,
      department_id: person.department_id,
      title: person.title,
      status: person.status,
      open_id: person.open_id,
      email: person.email,
      role_ids: (person.roles || []).map((role: AnyRecord) => role.id)
    });
  };
  const saveEdit = async () => {
    const values = await editForm.validateFields();
    if (!editing) return;
    await putJson(`/people/${editing.id}`, values);
    message.success('人员已更新');
    setEditing(null);
    reload();
  };
  return (
    <PageShell title="人员" subtitle="预设员工姓名、部门和角色；实际登录后绑定 open_id">
      <Card title="新增预设人员" className="mb16 admin-form-card">
        <Form form={form} layout="vertical" onFinish={createPerson} initialValues={{ status: 'active', role_ids: [] }}>
          <Row gutter={16}>
            <Col xs={24} md={6}>
              <Form.Item name="name" label="姓名" rules={[{ required: true, message: '请输入姓名' }]}>
                <Input />
              </Form.Item>
            </Col>
            <Col xs={24} md={6}>
              <Form.Item name="department_id" label="部门">
                <Select allowClear options={departmentOptions} />
              </Form.Item>
            </Col>
            <Col xs={24} md={6}>
              <Form.Item name="title" label="岗位">
                <Input />
              </Form.Item>
            </Col>
            <Col xs={24} md={6}>
              <Form.Item name="status" label="状态">
                <Select
                  options={[
                    { value: 'active', label: '启用' },
                    { value: 'pending', label: '待完善' },
                    { value: 'disabled', label: '停用' }
                  ]}
                />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="open_id" label="飞书 open_id">
            <Input placeholder="手动录入飞书 open_id，或通过邮箱解析自动绑定" />
          </Form.Item>
          <Form.Item name="email" label="邮箱">
            <Input placeholder="用于 2.0.4 批量解析飞书 open_id" />
          </Form.Item>
          <Form.Item name="role_ids" label="角色">
            <Select mode="multiple" allowClear options={roleOptions} />
          </Form.Item>
          <Button type="primary" htmlType="submit">新增人员</Button>
        </Form>
      </Card>
      <Card className="business-card">
        <Table
          rowKey="id"
          dataSource={data || []}
          className="business-table"
          tableLayout="fixed"
          scroll={{ x: 1040 }}
          title={() => renderTableHeader('人员列表', data?.length || 0, '维护部门、角色、邮箱和飞书绑定状态')}
          columns={[
            { title: '姓名', dataIndex: 'name', width: 110, ellipsis: true, render: renderEllipsis },
            { title: '部门', dataIndex: 'department', width: 140, ellipsis: true, render: renderEllipsis },
            { title: '岗位', dataIndex: 'title', width: 150, ellipsis: true, render: renderEllipsis },
            {
              title: '角色',
              dataIndex: 'roles',
              width: 190,
              render: (value: AnyRecord[]) => (
                <Space wrap size={[4, 4]}>{(value || []).map((role) => <Tag className="role-tag" key={role.id}>{role.name}</Tag>)}</Space>
              )
            },
            { title: '状态', dataIndex: 'status', width: 88, render: (value) => <StatusTag value={value} /> },
            {
              title: 'open_id',
              dataIndex: 'open_id',
              width: 96,
              render: (value) => renderBindingStatus(value)
            },
            {
              title: '邮箱',
              dataIndex: 'email',
              width: 210,
              render: renderEmail
            },
            {
              title: '来源',
              dataIndex: 'source',
              width: 96,
              render: (value) => <Tag>{value || '-'}</Tag>
            },
            { title: '操作', width: 88, render: (_, row) => <Button size="small" onClick={() => openEdit(row)}>编辑</Button> }
          ]}
        />
      </Card>
      <Modal title="编辑人员" open={Boolean(editing)} onOk={saveEdit} onCancel={() => setEditing(null)} destroyOnClose>
        <Form form={editForm} layout="vertical">
          <Form.Item name="name" label="姓名" rules={[{ required: true, message: '请输入姓名' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="department_id" label="部门">
            <Select allowClear options={departmentOptions} />
          </Form.Item>
          <Form.Item name="title" label="岗位">
            <Input />
          </Form.Item>
          <Form.Item name="open_id" label="飞书 open_id">
            <Input placeholder="清空后保存即可解绑 open_id" />
          </Form.Item>
          <Form.Item name="email" label="邮箱">
            <Input placeholder="清空后保存即可移除邮箱" />
          </Form.Item>
          <Form.Item name="role_ids" label="角色">
            <Select mode="multiple" allowClear options={roleOptions} />
          </Form.Item>
          <Form.Item name="status" label="状态">
            <Select
              options={[
                { value: 'active', label: '启用' },
                { value: 'pending', label: '待完善' },
                { value: 'disabled', label: '停用' }
              ]}
            />
          </Form.Item>
        </Form>
      </Modal>
    </PageShell>
  );
}

function BaseSync() {
  const [preview, setPreview] = useState<AnyRecord | null>(null);
  const [result, setResult] = useState<AnyRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const runPreview = async () => {
    setLoading(true);
    try {
      const data = await postJson('/sync/base-2026/preview', {});
      setPreview(data);
      setResult(null);
      if (!data.ok) {
        message.warning('Base 预览未完成，请查看阻塞信息');
      }
    } finally {
      setLoading(false);
    }
  };
  const runImport = async () => {
    setLoading(true);
    try {
      const data = await postJson('/sync/base-2026/import', {});
      setResult(data);
      if (data.ok) {
        message.success(`已导入 ${data.imported || 0} 条任务`);
      } else {
        message.warning('导入未完成，请查看阻塞信息');
      }
    } finally {
      setLoading(false);
    }
  };
  return (
    <PageShell title="Base同步" subtitle="从飞书多维表格 2026任务跟踪表一次性导入真实任务">
      <Alert
        type="info"
        showIcon
        className="mb16"
        message="导入会清空现有业务任务数据，保留管理员、部门、角色和权限基础数据。"
      />
      <Card>
        <Space>
          <Button onClick={runPreview} loading={loading}>预览 Base</Button>
          <Button type="primary" danger onClick={runImport} loading={loading}>清空并导入</Button>
        </Space>
        {preview && (
          <div className="json-panel">
            <Typography.Title level={5}>预览结果</Typography.Title>
            {!preview.ok && <Alert type="warning" showIcon message={preview.message || 'Base CLI 暂不可用'} className="mb16" />}
            <pre>{JSON.stringify(preview, null, 2)}</pre>
          </div>
        )}
        {result && (
          <div className="json-panel">
            <Typography.Title level={5}>导入结果</Typography.Title>
            {!result.ok && <Alert type="warning" showIcon message={result.message || '导入被阻塞'} className="mb16" />}
            <pre>{JSON.stringify(result, null, 2)}</pre>
          </div>
        )}
      </Card>
    </PageShell>
  );
}

function Permissions() {
  const { data, reload } = useApi<AnyRecord>('/permissions', []);
  const permissions = data?.permissions || [];
  const matrix = data?.matrix || [];
  const updateRole = async (roleId: number, values: string[]) => {
    await putJson('/permissions/matrix', { role_id: roleId, permission_codes: values });
    message.success('权限矩阵已更新');
    reload();
  };
  return (
    <PageShell title="角色权限" subtitle="角色动作矩阵可配置，并叠加任务关系权限">
      <Row gutter={[16, 16]} className="mb16">
        {matrix.map((role: AnyRecord) => (
          <Col xs={24} lg={12} xl={8} key={role.role_id}>
            <Card title={role.role_name}>
              <Checkbox.Group
                className="permission-grid"
                value={role.permission_codes}
                options={permissions.map((item: AnyRecord) => ({ value: item.code, label: item.name }))}
                onChange={(values) => updateRole(role.role_id, values as string[])}
              />
            </Card>
          </Col>
        ))}
      </Row>
    </PageShell>
  );
}

function TaskDetail() {
  return <Navigate to="/parent-tasks" replace />;
}

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/*" element={<AppLayout />} />
      </Routes>
    </Router>
  );
}
