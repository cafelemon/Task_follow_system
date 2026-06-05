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
  List,
  Menu,
  Modal,
  Row,
  Select,
  Space,
  Statistic,
  Table,
  Tag,
  Timeline,
  Typography,
  message
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  AlertOutlined,
  ApartmentOutlined,
  ArrowLeftOutlined,
  BellOutlined,
  CheckCircleOutlined,
  DashboardOutlined,
  DatabaseOutlined,
  FolderOutlined,
  HistoryOutlined,
  LockOutlined,
  NodeIndexOutlined,
  SafetyOutlined,
  ScheduleOutlined,
  TeamOutlined,
  UserOutlined
} from '@ant-design/icons';
import { useEffect, useState } from 'react';
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
import dayjs from 'dayjs';
import { deleteJson, getJson, postJson, putJson } from './api/client';
import type { AnyRecord } from './api/client';
import { PageShell } from './components/PageShell';
import { StatusTag } from './components/StatusTag';

const { Header, Sider, Content } = Layout;

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

const baseMenuItems = [
  { key: '/dashboard', icon: <DashboardOutlined />, label: <Link to="/dashboard">工作台</Link> },
  { key: '/goals', icon: <NodeIndexOutlined />, label: <Link to="/goals">战略目标</Link> },
  { key: '/parent-tasks', icon: <FolderOutlined />, label: <Link to="/parent-tasks">母任务管理</Link> },
  { key: '/department-tasks', icon: <ApartmentOutlined />, label: <Link to="/department-tasks">部门任务</Link> },
  { key: '/sub-tasks', icon: <CheckCircleOutlined />, label: <Link to="/sub-tasks">子任务执行</Link> },
  { key: '/meeting-board', icon: <ScheduleOutlined />, label: <Link to="/meeting-board">会议看板</Link> },
  { key: '/risks', icon: <AlertOutlined />, label: <Link to="/risks">风险与逾期</Link> },
  { key: '/timeline', icon: <HistoryOutlined />, label: <Link to="/timeline">历史时间线</Link> },
  { key: '/notifications', icon: <BellOutlined />, label: <Link to="/notifications">通知记录</Link> }
];

const adminMenuItems = [
  { key: '/people', icon: <TeamOutlined />, label: <Link to="/people">人员</Link> },
  { key: '/permissions', icon: <SafetyOutlined />, label: <Link to="/permissions">角色权限</Link> },
  { key: '/base-sync', icon: <DatabaseOutlined />, label: <Link to="/base-sync">Base同步</Link> }
];

function Login() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const submit = async (values: AnyRecord) => {
    setLoading(true);
    try {
      await postJson('/auth/login', values);
      message.success('登录成功');
      navigate('/dashboard');
    } catch {
      message.error('用户名或密码错误');
    } finally {
      setLoading(false);
    }
  };
  return (
    <div className="login-page">
      <Card className="login-panel">
        <Space direction="vertical" size={18} className="full-width">
          <div>
            <Typography.Title level={3}>任务跟踪系统</Typography.Title>
            <Typography.Text type="secondary">系统管理员登录</Typography.Text>
          </div>
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
        </Space>
      </Card>
    </div>
  );
}

function AppLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { data: auth, error, loading } = useApi<AnyRecord>('/auth/me', []);
  const selectedKey = `/${location.pathname.split('/')[1] || 'dashboard'}`;
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
      <Sider width={256} className="app-sider">
        <div className="brand">
          <div className="brand-icon">任</div>
          <div>
            <strong>任务跟踪系统</strong>
            <span>闭环管理</span>
          </div>
        </div>
        <Menu mode="inline" selectedKeys={[selectedKey]} items={menuItems} />
        <div className="sider-user">
          <TeamOutlined />
          <span>{loading ? '加载中' : auth?.user?.name || '-'}</span>
        </div>
      </Sider>
      <Layout>
        <Header className="app-header">
          <Space size={20}>
            <Typography.Title level={4}>公司任务推进与周更新跟踪系统</Typography.Title>
          </Space>
          <Space split={<Divider type="vertical" />}>
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
            <Route path="/" element={<Navigate to="/dashboard" />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/goals" element={<Goals />} />
            <Route path="/goals/:goalId" element={<GoalDetail />} />
            <Route path="/parent-tasks" element={<ParentTasks />} />
            <Route path="/parent-tasks/:parentTaskId" element={<ParentTaskDetail />} />
            <Route path="/department-tasks" element={<DepartmentTasks />} />
            <Route path="/sub-tasks" element={<SubTasks />} />
            <Route path="/sub-tasks/:subTaskId/update" element={<SubTaskUpdate />} />
            <Route path="/weekly-updates" element={<Navigate to="/sub-tasks" replace />} />
            <Route path="/meeting-board" element={<MeetingBoard />} />
            <Route path="/risks" element={<Risks />} />
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

function Dashboard() {
  const { data, loading } = useApi<AnyRecord>('/dashboard', []);
  const cards = data?.cards || {};
  const weekly = data?.weekly_progress || {};
  const risk = data?.risk_summary || {};

  return (
    <PageShell title="工作台" subtitle="按角色查看任务推进、周更新和风险概览">
      <Row gutter={[16, 16]}>
        {[
          ['进行中母任务', cards.parent_in_progress, '#2563c9'],
          ['本周待更新子任务', cards.weekly_due, '#d97706'],
          ['存在风险任务', cards.risk_tasks, '#dc2626'],
          ['已逾期任务', cards.overdue_tasks, '#b91c1c']
        ].map(([label, value, color]) => (
          <Col xs={24} md={12} xl={6} key={String(label)}>
            <Card loading={loading} className="metric-card" style={{ borderTopColor: String(color) }}>
              <Statistic title={label} value={Number(value || 0)} valueStyle={{ color: String(color) }} />
            </Card>
          </Col>
        ))}
      </Row>
      <Row gutter={[16, 16]} className="section-row">
        <Col xs={24} xl={15}>
          <Card title="本周任务更新情况">
            <Row gutter={16}>
              {[
                ['应更新', weekly.expected],
                ['已提交', weekly.submitted],
                ['未提交', weekly.missing]
              ].map(([label, value]) => (
                <Col xs={24} md={8} key={String(label)}>
                  <Statistic title={label} value={Number(value || 0)} />
                </Col>
              ))}
            </Row>
          </Card>
        </Col>
        <Col xs={24} xl={9}>
          <Card title="本周风险概览">
            <Row gutter={12}>
              {[
                ['高风险', risk.high, 'red'],
                ['中风险', risk.medium, 'orange'],
                ['低风险', risk.low, 'green']
              ].map(([label, value, color]) => (
                <Col span={8} key={String(label)}>
                  <div className={`risk-tile ${color}`}>
                    <strong>{value || 0}</strong>
                    <span>{label}</span>
                  </div>
                </Col>
              ))}
            </Row>
          </Card>
        </Col>
      </Row>
    </PageShell>
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
              <Card loading={loading} hoverable className="task-card" extra={<StatusTag value={task.status} />}>
                <Space direction="vertical" className="full-width">
                  <Typography.Text type="secondary">{task.code}</Typography.Text>
                  <Typography.Title level={4}>{task.title}</Typography.Title>
                  <span>{task.department || '-'} · {task.owner || '-'}</span>
                  <Space wrap>
                    <Tag color="blue">{task.department_task_count || 0} 个部门任务</Tag>
                    <Tag color="green">{task.sub_task_count || 0} 个子任务</Tag>
                    {task.pending_split_count ? <Tag color="orange">{task.pending_split_count} 个待拆解</Tag> : null}
                  </Space>
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
  const peopleOptions = (people || []).map((item) => ({ value: item.id, label: item.name }));

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
    reload();
  };
  const openEdit = (task: AnyRecord) => {
    setEditing(task);
    editForm.setFieldsValue({
      title: task.title,
      description: task.description,
      goal_id: task.goal_id,
      department_id: task.department_id,
      owner_id: task.owner_id,
      priority: task.priority,
      due_date: task.due_date ? dayjs(task.due_date) : null
    });
  };
  const saveEdit = async () => {
    const values = await editForm.validateFields();
    if (!editing) return;
    await putJson(`/parent-tasks/${editing.id}`, normalizeParentTaskValues(values));
    message.success('母任务已更新');
    setEditing(null);
    reload();
  };
  const archiveParentTask = async () => {
    const values = await deleteForm.validateFields();
    await deleteJson(`/parent-tasks/${values.parent_task_id}`);
    message.success('母任务已归档');
    setDeleteOpen(false);
    deleteForm.resetFields();
    reload();
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
                className="task-card"
                extra={<StatusTag value={task.status} />}
                actions={[
                  <Link to={`/parent-tasks/${task.id}`} key="detail">查看任务详情</Link>,
                  task.can_edit ? <Button type="link" key="edit" onClick={() => openEdit(task)}>编辑</Button> : null
                ].filter(Boolean)}
              >
                <Space direction="vertical" className="full-width">
                  <Typography.Text type="secondary">{task.code}</Typography.Text>
                  <Typography.Title level={4}>{task.title}</Typography.Title>
                  <span>{task.department || '-'} · {task.owner || '-'}</span>
                  <span>截止 {task.due_date || '-'}</span>
                  <Space wrap>
                    <Tag color="blue">{task.department_task_count || 0} 个部门任务</Tag>
                    <Tag color="green">{task.sub_task_count || 0} 个子任务</Tag>
                    {task.pending_split_count ? <Tag color="orange">{task.pending_split_count} 个待拆解</Tag> : null}
                  </Space>
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
    <Form form={form} layout="vertical" initialValues={{ priority: 'normal' }}>
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
          <Form.Item name="owner_id" label="母任务负责人" rules={[{ required: true, message: '请选择负责人' }]}>
            <Select showSearch optionFilterProp="label" options={peopleOptions} />
          </Form.Item>
        </Col>
        <Col xs={24} md={12}>
          <Form.Item name="due_date" label="截止时间">
            <DatePicker className="full-width" />
          </Form.Item>
        </Col>
      </Row>
      <Form.Item name="priority" label="优先级">
        <Select
          options={[
            { value: 'low', label: '低' },
            { value: 'normal', label: '普通' },
            { value: 'high', label: '高' }
          ]}
        />
      </Form.Item>
    </Form>
  );
}

function ParentTaskDetail() {
  const navigate = useNavigate();
  const { parentTaskId } = useParams();
  const { data: task } = useApi<AnyRecord>(`/parent-tasks/${parentTaskId}`, [parentTaskId]);
  const { data: departmentTasks } = useApi<AnyRecord[]>(`/parent-tasks/${parentTaskId}/department-tasks`, [parentTaskId]);
  const columns: ColumnsType<AnyRecord> = [
    { title: '任务编号', dataIndex: 'code', width: 130 },
    { title: '部门级任务', dataIndex: 'title' },
    { title: '负责部门', dataIndex: 'departments', render: (value) => <Space wrap>{(value || []).map((item: AnyRecord) => <Tag key={item.id}>{item.name}</Tag>)}</Space> },
    { title: '负责人', dataIndex: 'owner', width: 100 },
    { title: '状态', dataIndex: 'status', width: 110, render: (value) => <StatusTag value={value} /> },
    {
      title: '待拆解',
      dataIndex: 'pending_split_count',
      width: 120,
      render: (value) => value ? <Tag color="orange">{value} 个</Tag> : <Tag>无</Tag>
    }
  ];
  return (
    <PageShell
      title={task ? `${task.code} ${task.title}` : '母任务详情'}
      subtitle="查看该母任务下的部门级任务与有效子任务"
      back={<Button size="small" icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)}>返回</Button>}
    >
      <Card className="mb16">
        <Descriptions column={3}>
          <Descriptions.Item label="战略目标">{task?.goal || '-'}</Descriptions.Item>
          <Descriptions.Item label="负责人">{task?.owner || '-'}</Descriptions.Item>
          <Descriptions.Item label="牵头部门">{task?.department || '-'}</Descriptions.Item>
          <Descriptions.Item label="状态"><StatusTag value={task?.status} /></Descriptions.Item>
          <Descriptions.Item label="截止日期">{task?.due_date || '-'}</Descriptions.Item>
        </Descriptions>
      </Card>
      <Card title="部门级任务">
        <Table
          rowKey="id"
          dataSource={departmentTasks || []}
          columns={columns}
          expandable={{
            expandedRowRender: (row) => (
              <Table
                rowKey="id"
                size="small"
                pagination={false}
                dataSource={row.sub_tasks || []}
                columns={[
                  { title: '子任务编号', dataIndex: 'code', width: 150 },
                  { title: '具体任务', dataIndex: 'title' },
                  { title: '执行人', dataIndex: 'executor', width: 110 },
                  { title: '风险', dataIndex: 'risk_level', width: 100, render: (value) => <StatusTag value={value} /> },
                  { title: '截止日期', dataIndex: 'due_date', width: 120 }
                ]}
              />
            ),
            rowExpandable: (row) => Boolean((row.sub_tasks || []).length)
          }}
        />
      </Card>
    </PageShell>
  );
}

function DepartmentTasks() {
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<number | null>(null);
  const query = selectedDepartmentId ? `/department-tasks/overview?department_id=${selectedDepartmentId}` : '/department-tasks/overview';
  const { data } = useApi<AnyRecord>(query, [selectedDepartmentId]);
  const departmentTasks: AnyRecord[] = data?.department_tasks || [];
  const departmentTaskColumns: ColumnsType<AnyRecord> = [
    { title: '任务编号', dataIndex: 'code', width: 120 },
    { title: '部门任务', dataIndex: 'title' },
    { title: '所属母任务', dataIndex: 'parent_task', width: 220 },
    { title: '负责部门', dataIndex: 'departments', render: (value) => <Space wrap>{(value || []).map((item: AnyRecord) => <Tag key={item.id}>{item.name}</Tag>)}</Space> },
    { title: '负责人', dataIndex: 'owner', width: 100 },
    { title: '状态', dataIndex: 'status', width: 110, render: (value) => <StatusTag value={value} /> },
    {
      title: '待拆解',
      dataIndex: 'pending_split_count',
      width: 120,
      render: (value, row) => value ? <Tag color="orange">{value} 个：{(row.pending_split_codes || []).join('、')}</Tag> : <Tag>无</Tag>
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
          <Card title="部门级任务" extra={<Tag>{departmentTasks.length} 项</Tag>}>
            <Table
              rowKey="id"
              dataSource={departmentTasks}
              columns={departmentTaskColumns}
              expandable={{
                expandedRowRender: (row) => (
                  <Table
                    rowKey="id"
                    size="small"
                    pagination={false}
                    dataSource={row.sub_tasks || []}
                    columns={[
                      { title: '子任务编号', dataIndex: 'code', width: 140 },
                      { title: '具体任务', dataIndex: 'title' },
                      { title: '执行人', dataIndex: 'executor', width: 100 },
                      { title: '风险', dataIndex: 'risk_level', width: 100, render: (value) => <StatusTag value={value} /> },
                      { title: '截止日期', dataIndex: 'due_date', width: 120 }
                    ]}
                  />
                ),
                rowExpandable: (row) => Boolean((row.sub_tasks || []).length)
              }}
            />
          </Card>
        </Space>
      </div>
    </PageShell>
  );
}

function SubTasks() {
  const { data } = useApi<AnyRecord[]>('/sub-tasks', []);
  const columns: ColumnsType<AnyRecord> = [
    { title: '编号', dataIndex: 'code', width: 150 },
    { title: '子任务', dataIndex: 'title' },
    { title: '所属母任务', dataIndex: 'parent_task' },
    { title: '执行人', dataIndex: 'executor', width: 110 },
    { title: '负责人', dataIndex: 'owner', width: 110 },
    { title: '状态', dataIndex: 'status', width: 120, render: (value) => <StatusTag value={value} /> },
    { title: '风险', dataIndex: 'risk_level', width: 110, render: (value) => <StatusTag value={value} /> },
    { title: '截止日期', dataIndex: 'due_date', width: 120 },
    {
      title: '操作',
      width: 100,
      render: (_, row) => <Link to={`/sub-tasks/${row.id}/update`}>更新</Link>
    }
  ];
  return (
    <PageShell title="子任务执行" subtitle="查看子任务并填写本周更新">
      <Card>
        <Table rowKey="id" dataSource={data || []} columns={columns} />
      </Card>
    </PageShell>
  );
}

function SubTaskUpdate() {
  const navigate = useNavigate();
  const { subTaskId } = useParams();
  const [form] = Form.useForm();
  const weekKey = dayjs().format('YYYY-[W]WW');
  const { data: subTasks } = useApi<AnyRecord[]>('/sub-tasks', []);
  const { data: update, reload } = useApi<AnyRecord>(`/weekly-updates/current?sub_task_id=${subTaskId}&week_key=${weekKey}`, [subTaskId, weekKey]);
  const subTask = (subTasks || []).find((item) => String(item.id) === String(subTaskId));
  const [updateStatus, setUpdateStatus] = useState('empty');
  const shouldWarn = updateStatus !== 'submitted';

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
    const values = form.getFieldsValue();
    await postJson('/weekly-updates', {
      sub_task_id: Number(subTaskId),
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
    reload();
  };
  const autoSaveDraft = async () => {
    if (updateStatus === 'submitted') return;
    await saveUpdate(false);
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

  return (
    <PageShell
      title={subTask ? `${subTask.code} ${subTask.title}` : '子任务周更新'}
      subtitle={`当前周期 ${weekKey}，失焦后自动保存草稿`}
      back={<Button size="small" icon={<ArrowLeftOutlined />} onClick={() => confirmLeave(-1)}>返回</Button>}
    >
      <Card className="mb16">
        <Descriptions column={3}>
          <Descriptions.Item label="所属母任务">{subTask?.parent_task || '-'}</Descriptions.Item>
          <Descriptions.Item label="执行人">{subTask?.executor || '-'}</Descriptions.Item>
          <Descriptions.Item label="负责人">{subTask?.owner || '-'}</Descriptions.Item>
          <Descriptions.Item label="状态"><StatusTag value={subTask?.status} /></Descriptions.Item>
          <Descriptions.Item label="风险"><StatusTag value={subTask?.risk_level} /></Descriptions.Item>
          <Descriptions.Item label="草稿状态"><StatusTag value={updateStatus} /></Descriptions.Item>
        </Descriptions>
      </Card>
      <Card title="本周更新">
        <Form form={form} layout="vertical" initialValues={{ needs_coordination: false }}>
          <Form.Item name="this_week" label="本周完成内容">
            <Input.TextArea rows={5} onBlur={autoSaveDraft} placeholder="请填写本周完成内容" />
          </Form.Item>
          <Form.Item name="next_week" label="下周计划">
            <Input.TextArea rows={4} onBlur={autoSaveDraft} placeholder="请填写下周计划" />
          </Form.Item>
          <Form.Item name="risk" label="遗留事项">
            <Input.TextArea rows={4} onBlur={autoSaveDraft} placeholder="请填写遗留事项、卡点或需要后续处理的问题" />
          </Form.Item>
          <Form.Item name="needs_coordination" valuePropName="checked">
            <Checkbox onBlur={autoSaveDraft}>需要协调，进入会议看板候选事项</Checkbox>
          </Form.Item>
          <Space>
            <Button onClick={() => saveUpdate(false)}>保存草稿暂不提交</Button>
            <Button type="primary" onClick={() => saveUpdate(true)}>提交保存</Button>
          </Space>
        </Form>
      </Card>
    </PageShell>
  );
}

function MeetingBoard() {
  const { data } = useApi<AnyRecord>('/meeting-board', []);
  const renderItems = (items: AnyRecord[] = []) => (
    <List
      dataSource={items}
      locale={{ emptyText: '暂无事项' }}
      renderItem={(item) => (
        <List.Item>
          <List.Item.Meta
            title={item.title}
            description={
              <Space direction="vertical">
                <span>负责人：{item.owner || '-'}</span>
                <span className="danger-text">问题：{item.problem || item.status || '-'}</span>
                <span className="success-text">建议：{item.suggestion || '-'}</span>
              </Space>
            }
          />
        </List.Item>
      )}
    />
  );
  return (
    <PageShell title="会议看板" subtitle="自动汇总高风险、未更新、协调事项和本周完成事项" extra={<Button href="/api/meeting-board/export">导出会议材料</Button>}>
      <Row gutter={[16, 16]}>
        <Col xs={24} xl={12}><Card title="本周必须决策事项">{renderItems(data?.decision_items)}</Card></Col>
        <Col xs={24} xl={12}><Card title="本周未更新任务">{renderItems(data?.missing_updates)}</Card></Col>
        <Col xs={24} xl={12}><Card title="高风险任务">{renderItems(data?.high_risks)}</Card></Col>
        <Col xs={24} xl={12}><Card title="下周重点关注">{renderItems(data?.next_focus)}</Card></Col>
      </Row>
    </PageShell>
  );
}

function Risks() {
  const { data } = useApi<AnyRecord[]>('/risks', []);
  return (
    <PageShell title="风险与逾期" subtitle="集中处理风险任务、逾期任务和协调动作">
      <Card>
        <Table
          rowKey="id"
          dataSource={data || []}
          columns={[
            { title: '风险编号', dataIndex: 'code' },
            { title: '任务名称', dataIndex: 'sub_task' },
            { title: '等级', dataIndex: 'level', render: (value) => <StatusTag value={value} /> },
            { title: '执行人', dataIndex: 'executor' },
            { title: '截止日期', dataIndex: 'due_date' },
            { title: '风险描述', dataIndex: 'description' },
            { title: '操作', render: () => <Space><Button>催办</Button><Button>升级协调</Button><Button>调整计划</Button></Space> }
          ]}
        />
      </Card>
    </PageShell>
  );
}

function TimelinePage() {
  const { data } = useApi<AnyRecord[]>('/timeline', []);
  return (
    <PageShell title="历史时间线" subtitle="展示任务创建、拆分、更新、风险和协调的全生命周期记录">
      <Card>
        <Timeline
          items={(data || []).map((item) => ({
            color: item.event_type.includes('risk') ? 'red' : item.event_type.includes('weekly') ? 'green' : 'blue',
            children: (
              <Space direction="vertical">
                <span>{dayjs(item.created_at).format('YYYY-MM-DD HH:mm')} <Tag>{item.event_type}</Tag></span>
                <strong>{item.title}</strong>
                <span>{item.content}</span>
                <Typography.Text type="secondary">操作人：{item.actor || '-'}</Typography.Text>
              </Space>
            )
          }))}
        />
      </Card>
    </PageShell>
  );
}

function Notifications() {
  const { data, reload } = useApi<AnyRecord[]>('/notifications', []);
  const createMock = async () => {
    await postJson('/notifications/mock-reminders', { week_key: dayjs().format('YYYY-[W]WW') });
    message.success('已生成模拟提醒记录');
    reload();
  };
  return (
    <PageShell title="通知记录" subtitle="追踪飞书机器人触达效果与用户响应情况" extra={<Button onClick={createMock}>生成模拟提醒</Button>}>
      <Card>
        <Table
          rowKey="id"
          dataSource={data || []}
          columns={[
            { title: '通知时间', dataIndex: 'created_at', render: (value) => value ? dayjs(value).format('YYYY-MM-DD HH:mm') : '-' },
            { title: '通知对象', dataIndex: 'target_user' },
            { title: '通知类型', dataIndex: 'notification_type' },
            { title: '关联对象', render: (_, row) => `${row.related_type || '-'} ${row.related_id || ''}` },
            { title: '发送状态', dataIndex: 'send_status', render: (value) => <Tag color={value === 'mock_sent' ? 'green' : 'red'}>{value}</Tag> },
            { title: '是否点击', dataIndex: 'clicked', render: (value) => value ? '已点击' : '未点击' },
            { title: '处理结果', dataIndex: 'result' }
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
      <Card title="新增预设人员" className="mb16">
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
          <Form.Item name="role_ids" label="角色">
            <Select mode="multiple" allowClear options={roleOptions} />
          </Form.Item>
          <Button type="primary" htmlType="submit">新增人员</Button>
        </Form>
      </Card>
      <Card title="人员列表">
        <Table
          rowKey="id"
          dataSource={data || []}
          columns={[
            { title: '姓名', dataIndex: 'name' },
            { title: '部门', dataIndex: 'department', render: (value) => value || '-' },
            { title: '岗位', dataIndex: 'title', render: (value) => value || '-' },
            {
              title: '角色',
              dataIndex: 'roles',
              render: (value: AnyRecord[]) => (
                <Space wrap>{(value || []).map((role) => <Tag key={role.id}>{role.name}</Tag>)}</Space>
              )
            },
            { title: '状态', dataIndex: 'status', render: (value) => <StatusTag value={value} /> },
            {
              title: 'open_id',
              dataIndex: 'open_id',
              render: (value) => value ? <Tag color="green">已绑定</Tag> : <Tag>未绑定</Tag>
            },
            {
              title: '来源',
              dataIndex: 'source',
              render: (value) => <Tag>{value || '-'}</Tag>
            },
            { title: '操作', render: (_, row) => <Button onClick={() => openEdit(row)}>编辑</Button> }
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
