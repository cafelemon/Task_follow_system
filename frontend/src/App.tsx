import {
  Alert,
  Button,
  Card,
  Checkbox,
  Col,
  DatePicker,
  Descriptions,
  Divider,
  Drawer,
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
  Tour,
  Typography,
  Upload,
  message
} from 'antd';
import type { TourProps } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  ApartmentOutlined,
  AppstoreOutlined,
  ArrowLeftOutlined,
  BellOutlined,
  CheckCircleOutlined,
  DatabaseOutlined,
  FolderOutlined,
  HistoryOutlined,
  LockOutlined,
  MenuOutlined,
  NodeIndexOutlined,
  QuestionCircleOutlined,
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
import { api, deleteJson, getJson, postJson, putJson } from './api/client';
import type { AnyRecord } from './api/client';
import { PageShell } from './components/PageShell';
import { StatusTag } from './components/StatusTag';
import { Workbench } from './pages/Workbench';
import { buildSubTaskUpdatePath, relationLabels, renderPeople } from './ui/taskDisplay';
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

function useIsMobileLayout() {
  const [mobile, setMobile] = useState(() => window.innerWidth < 900);
  useEffect(() => {
    const onResize = () => setMobile(window.innerWidth < 900);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return mobile;
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

function ChartCard({ id, title, option, height = 300, className, onChartClick }: { id?: string; title: string; option: any; height?: number; className?: string; onChartClick?: (params: any) => void }) {
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!ref.current) return;
    const chart = echarts.init(ref.current);
    chart.setOption(option);
    const resize = () => chart.resize();
    window.addEventListener('resize', resize);
    if (onChartClick) {
      chart.on('click', onChartClick);
    }
    return () => {
      window.removeEventListener('resize', resize);
      if (onChartClick) {
        chart.off('click', onChartClick);
      }
      chart.dispose();
    };
  }, [option, onChartClick]);
  return (
    <Card id={id} title={title} className={className}>
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

function selectedPersonIds(record: AnyRecord, pluralKey: string, idsKey: string, idKey: string) {
  const directIds = record?.[idsKey];
  if (Array.isArray(directIds) && directIds.length) {
    return directIds;
  }
  const people = record?.[pluralKey];
  if (Array.isArray(people) && people.length) {
    return people.map((item) => item.id).filter(Boolean);
  }
  return record?.[idKey] ? [record[idKey]] : [];
}

function PeopleSelect({ options, ...props }: { options: { value: number; label: string }[]; [key: string]: any }) {
  return (
    <Select
      {...props}
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

function renderBlankEllipsis(value?: unknown) {
  if (value == null || value === '') return '';
  return renderEllipsis(value);
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

function renderAttachmentLinks(attachments: AnyRecord[]) {
  if (!attachments.length) {
    return <span className="muted-cell timeline-cell-text">暂无附件</span>;
  }
  return (
    <span className="attachment-link-list">
      {attachments.map((item) => (
        <a key={item.id} href={`/api/attachments/${item.id}/download`} target="_blank" rel="noreferrer">
          {item.filename}
        </a>
      ))}
    </span>
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
  { key: '/workbench', title: '工作台', icon: <AppstoreOutlined />, label: <Link to="/workbench">工作台</Link> },
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
  { key: '/department-management', title: '部门管理', icon: <ApartmentOutlined />, label: <Link to="/department-management">部门管理</Link> },
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
      navigate('/workbench');
    } catch {
      message.error('用户名或密码错误');
    } finally {
      setLoading(false);
    }
  };
  const larkLogin = () => {
    window.location.href = `/api/auth/lark-oauth/start?next_path=${encodeURIComponent('/workbench')}`;
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

function RiskItemModal({
  open,
  subTask,
  sourceWeeklyUpdateId,
  initialDescription,
  onClose,
  onCreated
}: {
  open: boolean;
  subTask?: AnyRecord | null;
  sourceWeeklyUpdateId?: number;
  initialDescription?: string;
  onClose: () => void;
  onCreated?: () => void;
}) {
  const mobileLayout = useIsMobileLayout();
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);
  const impactScore = Form.useWatch('impact_score', form) || 3;
  const likelihoodScore = Form.useWatch('likelihood_score', form) || 3;
  const score = Number(impactScore) * Number(likelihoodScore);
  const level = score >= 15 ? 'high' : score >= 8 ? 'medium' : 'low';
  const scoreOptions = [1, 2, 3, 4, 5].map((value) => ({ value, label: `${value}` }));
  const ownerOptions = subTask?.risk_owner_options || [];
  const defaultOwner = ownerOptions.find((item: AnyRecord) => item.id === subTask?.default_risk_owner_id) || ownerOptions[0];

  useEffect(() => {
    if (!open) return;
    form.setFieldsValue({
      title: '',
      description: initialDescription || '',
      impact_score: 3,
      likelihood_score: 3,
      due_date: null
    });
  }, [open, subTask?.id, initialDescription]);

  const submit = async () => {
    if (!subTask?.id) {
      message.warning('请选择子任务后登记风险');
      return;
    }
    const values = await form.validateFields();
    setSaving(true);
    try {
      await postJson('/risk-items', {
        sub_task_id: subTask?.id,
        source_weekly_update_id: sourceWeeklyUpdateId,
        title: values.title,
        description: values.description || null,
        impact_score: values.impact_score,
        likelihood_score: values.likelihood_score,
        due_date: values.due_date ? values.due_date.format('YYYY-MM-DD') : null
      });
      message.success('风险项已登记');
      onCreated?.();
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      className={mobileLayout ? 'mobile-form-modal' : undefined}
      title="新增风险项"
      open={open}
      onOk={submit}
      confirmLoading={saving}
      onCancel={onClose}
      destroyOnClose
    >
      <Alert
        type="info"
        showIcon
        className="mb16"
        message={subTask ? `${subTask.code || '-'} ${subTask.title || ''}` : '请选择子任务后登记风险'}
        description={defaultOwner ? `风险责任人默认设为子任务主负责人：${defaultOwner.name}` : '当前子任务没有可用负责人，无法登记风险。'}
      />
      <Form form={form} layout="vertical">
        <Form.Item name="title" label="风险标题" rules={[{ required: true, message: '请填写风险标题' }]}>
          <Input maxLength={120} placeholder="请概括风险事件或风险条件" />
        </Form.Item>
        <Form.Item name="description" label="风险说明">
          <Input.TextArea rows={4} placeholder="请补充影响范围、触发条件或当前迹象" />
        </Form.Item>
        <Row gutter={12}>
          <Col span={12}>
            <Form.Item name="impact_score" label="影响分" rules={[{ required: true, message: '请选择影响分' }]}>
              <Select options={scoreOptions} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="likelihood_score" label="可能性分" rules={[{ required: true, message: '请选择可能性分' }]}>
              <Select options={scoreOptions} />
            </Form.Item>
          </Col>
        </Row>
        <Form.Item label="自动等级">
          <Space>
            <StatusTag value={level} />
            <Typography.Text type="secondary">分值 {score}</Typography.Text>
          </Space>
        </Form.Item>
        <Form.Item name="due_date" label="处理日期">
          <DatePicker className="full-width" />
        </Form.Item>
      </Form>
    </Modal>
  );
}

function RiskManageModal({
  risk,
  onClose,
  onSaved
}: {
  risk: AnyRecord | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const mobileLayout = useIsMobileLayout();
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (!risk) return;
    form.setFieldsValue({
      owner_id: risk.owner_id,
      status: risk.status,
      due_date: risk.due_date ? dayjs(risk.due_date) : null,
      resolution_note: risk.resolution_note || ''
    });
  }, [risk?.id]);
  const save = async () => {
    if (!risk) return;
    const values = await form.validateFields();
    setSaving(true);
    try {
      await putJson(`/risk-items/${risk.id}`, {
        owner_id: values.owner_id,
        status: values.status,
        due_date: values.due_date ? values.due_date.format('YYYY-MM-DD') : null,
        resolution_note: values.resolution_note || null
      });
      message.success('风险项已更新');
      onSaved();
      onClose();
    } finally {
      setSaving(false);
    }
  };
  return (
    <Modal
      className={mobileLayout ? 'mobile-form-modal' : undefined}
      title={risk ? `处理风险项 ${risk.code}` : '处理风险项'}
      open={Boolean(risk)}
      onOk={save}
      confirmLoading={saving}
      onCancel={onClose}
      destroyOnClose
    >
      <Alert
        type={risk?.level === 'high' ? 'error' : 'warning'}
        showIcon
        className="mb16"
        message={risk?.title || '-'}
        description={risk ? `风险分值 ${risk.score}，来源子任务 ${risk.sub_task_code || '-'} ${risk.sub_task || ''}` : undefined}
      />
      <Form form={form} layout="vertical">
        <Form.Item name="owner_id" label="风险责任人" rules={[{ required: true, message: '请选择风险责任人' }]}>
          <Select options={(risk?.owner_options || []).map((item: AnyRecord) => ({ value: item.id, label: item.name }))} />
        </Form.Item>
        <Form.Item name="status" label="处理状态" rules={[{ required: true, message: '请选择处理状态' }]}>
          <Select options={[
            { value: 'open', label: '开放' },
            { value: 'in_progress', label: '处理中' },
            { value: 'closed', label: '关闭' }
          ]} />
        </Form.Item>
        <Form.Item name="due_date" label="处理日期">
          <DatePicker className="full-width" />
        </Form.Item>
        <Form.Item name="resolution_note" label="处理或关闭说明">
          <Input.TextArea rows={4} placeholder="填写处理进展、解决方案或关闭依据" />
        </Form.Item>
      </Form>
    </Modal>
  );
}

function AppLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { data: auth, error, loading, reload: reloadAuth } = useApi<AnyRecord>('/auth/me', []);
  const compactLayout = useIsCompactLayout();
  const mobileLayout = useIsMobileLayout();
  const brandRef = useRef<HTMLDivElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const headerMetaRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLElement | null>(null);
  const guideButtonRef = useRef<HTMLButtonElement | null>(null);
  const onboardingPresentedRef = useRef(false);
  const onboardingSavingRef = useRef(false);
  const tourCloseTimerRef = useRef<number | null>(null);
  const [tourOpen, setTourOpen] = useState(false);
  const [activeGuideKey, setActiveGuideKey] = useState<string | null>(null);
  const [tourTracksProgress, setTourTracksProgress] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [workbenchRiskTarget, setWorkbenchRiskTarget] = useState<AnyRecord | null>(null);
  const selectedKey = `/${location.pathname.split('/')[1] || 'workbench'}`;
  const isAdmin = Boolean(auth?.user?.is_admin || (auth?.permission_codes || []).includes('permission.manage'));
  const guideProfile = auth?.guide_profile as string | null | undefined;
  const guideProfileLabels: Record<string, string> = {
    executive_office: '总经办会议相关',
    department_owner: '部门负责人',
    task_owner: '任务负责人',
    executor: '子任务执行者',
    observer: '观察者'
  };
  const canViewParentTasks = Boolean(auth?.features?.can_view_parent_tasks || isAdmin);
  const visibleBaseMenuItems = baseMenuItems.filter((item) => item.key !== '/parent-tasks' || canViewParentTasks);
  const menuItems = isAdmin ? [...visibleBaseMenuItems, ...adminMenuItems] : visibleBaseMenuItems;
  const headerDate = `${dayjs().format('YYYY年MM月DD日')}--${auth?.week_key || '-'}`;
  const logout = async () => {
    await postJson('/auth/logout', {});
    navigate('/login');
  };
  useEffect(() => {
    if (onboardingPresentedRef.current) return;
    if (auth?.guides?.system?.required) {
      onboardingPresentedRef.current = true;
      setActiveGuideKey(auth.guides.system.guide_key);
      setTourTracksProgress(true);
      setTourOpen(true);
      return;
    }
    if (guideProfile && !auth?.guides?.system && auth?.onboarding?.required) {
      onboardingPresentedRef.current = true;
      setActiveGuideKey('legacy');
      setTourTracksProgress(true);
      setTourOpen(true);
    }
  }, [auth?.guides?.system, auth?.guides?.system?.required, auth?.onboarding?.required, guideProfile]);

  const saveGuideProgress = async (action: 'completed' | 'skipped') => {
    if (onboardingSavingRef.current || !activeGuideKey) return;
    const savingGuideKey = activeGuideKey;
    onboardingSavingRef.current = true;
    setTourOpen(false);
    try {
      if (savingGuideKey === 'legacy') {
        await postJson('/auth/onboarding', { version: auth?.onboarding?.version, action });
      } else {
        const guide = auth?.guides?.system?.guide_key === savingGuideKey
          ? auth?.guides?.system
          : Object.values(auth?.guides?.modules || {}).find((item: any) => item?.guide_key === savingGuideKey) as AnyRecord | undefined;
        await postJson('/auth/guides', {
          guide_key: guide?.guide_key,
          version: guide?.version,
          action
        });
      }
      await reloadAuth();
    } catch {
      message.error('使用指南状态保存失败，请稍后重试');
    } finally {
      onboardingSavingRef.current = false;
      setActiveGuideKey(null);
    }
  };
  const closeTour = (action: 'completed' | 'skipped') => {
    if (tourTracksProgress) {
      saveGuideProgress(action);
    } else {
      setTourOpen(false);
    }
  };
  const handleTourClose = () => {
    if (tourCloseTimerRef.current) window.clearTimeout(tourCloseTimerRef.current);
    tourCloseTimerRef.current = window.setTimeout(() => {
      tourCloseTimerRef.current = null;
      closeTour('skipped');
    }, 80);
  };
  const handleTourFinish = () => {
    if (tourCloseTimerRef.current) {
      window.clearTimeout(tourCloseTimerRef.current);
      tourCloseTimerRef.current = null;
    }
    closeTour('completed');
  };
  const guideDescriptions: Record<string, string> = {
    department_owner: '从“母任务管理”查看本部门牵头的母任务，并将任务拆分到相关部门；部门任务中可跟踪本部门负责事项。',
    task_owner: '从“部门任务”进入自己负责的任务，拆解到具体执行人并持续跟踪进展与风险。',
    executor: '从“子任务执行”进入本人任务，填写本周进展、遗留事项和下一步计划，发现问题时登记风险。',
    observer: '从会议看板和历史时间线查看任务推进情况，观察者不承担任务拆解和填报操作。'
  };
  const legacyTourSteps: TourProps['steps'] = [
    {
      title: `欢迎使用任务跟踪系统 · ${guideProfile ? guideProfileLabels[guideProfile] : ''}`,
      description: '这份短引导只在首次进入时自动展示，之后可以随时从右上角重新打开。',
      target: () => brandRef.current || document.body
    },
    {
      title: '从导航开始工作',
      description: guideDescriptions[guideProfile || ''] || '请从左侧导航进入与本人职责相关的工作板块。',
      target: () => menuRef.current || document.body
    },
    {
      title: '当前工作区',
      description: '列表、看板和编辑窗口都会在这里呈现。系统不会在引导过程中替你切换页面。',
      target: () => contentRef.current || document.body
    },
    {
      title: '确认身份与周期',
      description: '这里显示当前登录人员、所属部门、日期和系统周次，提交更新前可以先核对。',
      target: () => headerMetaRef.current || document.body
    },
    {
      title: '随时重看使用指南',
      description: '完成或跳过后都不会再次自动打扰；需要时点击这个问号即可重新查看。',
      target: () => guideButtonRef.current || document.body
    }
  ];
  const executiveSystemSteps: TourProps['steps'] = [
    {
      title: '公司任务推进与会议决策支持',
      description: '系统用于统一呈现公司重点任务的责任分解、周度进展、风险与逾期情况，为经营会议审阅和决策提供依据。',
      target: () => brandRef.current || document.body
    },
    {
      title: '四级任务框架',
      description: '战略目标明确方向，母任务承接公司重点事项，部门任务落实部门责任，子任务记录具体执行与周度进展。',
      target: () => contentRef.current || document.body
    },
    {
      title: '以会议看板为主要入口',
      description: '会议看板用于集中审阅全局状态；战略目标、母任务、部门任务和历史时间线用于进一步追溯任务来源与执行过程。',
      target: () => menuRef.current || document.body
    },
    {
      title: '确认身份与会议周期',
      description: '顶部显示当前登录人员、所属部门和系统周次。会议审阅前建议先确认当前周期，避免混用不同周次的数据。',
      target: () => headerMetaRef.current || document.body
    },
    {
      title: '板块内还有专项说明',
      description: '首次主动点击左侧板块时，系统会提供该板块的专项引导。需要回顾时，可通过右上角使用指南再次查看。',
      target: () => guideButtonRef.current || document.body
    }
  ];
  const executiveMeetingSteps: TourProps['steps'] = [
    {
      title: '三种会议视角',
      description: '“总览”用于快速识别异常，“母任务看板”用于检查公司级事项，“部门看板”用于横向比较各部门承接与推进情况。',
      target: () => document.querySelector('#meeting-guide-tabs') as HTMLElement || document.body
    },
    {
      title: '先看六项核心指标',
      description: '建议先关注本周待更新、风险任务和逾期任务。点击任一指标可打开对应明细，直接核对任务、责任人和当前状态。',
      target: () => document.querySelector('#meeting-guide-metrics') as HTMLElement || document.body
    },
    {
      title: '判断本周信息完整度',
      description: '本周更新状态用于判断填报完整度，近周提交趋势用于观察执行节奏是否稳定，并识别持续未更新的事项。',
      target: () => document.querySelector('#meeting-guide-weekly') as HTMLElement || document.body
    },
    {
      title: '集中审阅风险与逾期',
      description: '风险与逾期汇总用于确认高风险事项、处理责任人和截止日期。具备处理权限时，可直接进入风险处置。',
      target: () => document.querySelector('#risk-overdue') as HTMLElement || document.body
    },
    {
      title: '检查时间节点与部门差异',
      description: '母任务截止日期帮助识别临近节点；需要部门横向比较时，可切换到“部门看板”查看任务量、待更新、风险和逾期分布。',
      target: () => document.querySelector('#meeting-guide-deadline') as HTMLElement || document.body
    },
    {
      title: '建议的会议审阅顺序',
      description: '先从总览识别异常，再下钻任务明细，现场确认责任人与处理要求，最后形成会后跟进事项。',
      target: () => contentRef.current || document.body
    }
  ];
  const departmentOwnerFrameworkSteps: TourProps['steps'] = [
    {
      title: '部门任务承接与责任落地',
      description: '部门负责人负责承接本部门牵头的公司任务，并把任务拆分到清晰的负责部门、任务负责人和截止节点。',
      target: () => brandRef.current || document.body
    },
    {
      title: '查看范围以部门责任为边界',
      description: '你可以查看本部门牵头的母任务，以及与本人部门相关的部门任务；普通同部门人员不会自动获得这些视图。',
      target: () => contentRef.current || document.body
    },
    {
      title: '核心流程从母任务详情开始',
      description: '进入母任务详情后，通过“新增”建立部门任务，明确负责部门、任务负责人和截止日期，再由任务负责人继续拆解子任务。',
      target: () => menuRef.current || document.body
    },
    {
      title: '跟进部门任务闭环',
      description: '部门任务页用于检查任务状态、子任务进展、本周更新、遗留事项、风险和截止节点，便于及时推动责任人处理。',
      target: () => contentRef.current || document.body
    },
    {
      title: '区分管理责任和执行责任',
      description: '部门负责人权限不自动包含子任务拆解或周更新。若你同时是任务负责人或执行人，请按对应身份完成拆解或填报。',
      target: () => headerMetaRef.current || document.body
    },
    {
      title: '板块首次进入会继续提示',
      description: '首次主动点击母任务管理、部门任务等板块时，会出现专项说明；需要回顾时，可从右上角重新打开。',
      target: () => guideButtonRef.current || document.body
    }
  ];
  const departmentOwnerParentSteps: TourProps['steps'] = [
    {
      title: '只看本部门牵头母任务',
      description: '母任务管理中展示与你所属部门牵头责任相关的母任务，便于从公司级事项开始向下拆分。',
      target: () => document.querySelector('#department-owner-parent-list') as HTMLElement || contentRef.current || document.body
    },
    {
      title: '先核对母任务关键信息',
      description: '任务卡展示负责人、牵头部门、截止日期和进度指标。拆分前建议先确认这些信息是否与当前责任边界一致。',
      target: () => document.querySelector('#department-owner-parent-cards') as HTMLElement || contentRef.current || document.body
    },
    {
      title: '进入详情查看承接结果',
      description: '通过“查看任务详情”进入母任务详情，可看到已经建立的部门任务，以及展开后的子任务执行情况。',
      target: () => document.querySelector('#department-owner-parent-cards') as HTMLElement || contentRef.current || document.body
    },
    {
      title: '用新增完成部门任务拆分',
      description: '在母任务详情中点击“新增”，填写部门任务内容、负责部门、任务负责人和截止日期，这是部门负责人最核心的操作。',
      target: () => contentRef.current || document.body
    },
    {
      title: '任务负责人继续拆解子任务',
      description: '部门任务建立后，任务负责人会收到通知，并负责继续拆解到执行人。部门负责人重点检查责任是否清晰、节点是否合理。',
      target: () => contentRef.current || document.body
    },
    {
      title: '删除是归档隐藏',
      description: '删除部门任务时按归档处理，不物理删除历史记录。部门负责人不能仅凭该身份编辑母任务本身。',
      target: () => contentRef.current || document.body
    }
  ];
  const departmentOwnerDepartmentSteps: TourProps['steps'] = [
    {
      title: '查看本部门相关部门任务',
      description: '这里集中展示本人部门负责，或本人部门牵头母任务下的部门任务，用于日常跟踪承接结果。',
      target: () => document.querySelector('#department-owner-department-task-table') as HTMLElement || contentRef.current || document.body
    },
    {
      title: '重点核对四类信息',
      description: '建议优先查看负责部门、任务负责人、状态和待拆解数量，快速判断任务是否已经进入执行层。',
      target: () => document.querySelector('#department-owner-department-task-table') as HTMLElement || contentRef.current || document.body
    },
    {
      title: '展开查看执行进展',
      description: '展开部门任务后，可以看到子任务执行人、本周完成内容、遗留事项和截止日期，用于判断推进质量。',
      target: () => document.querySelector('#department-owner-department-task-table') as HTMLElement || contentRef.current || document.body
    },
    {
      title: '问题回到母任务详情维护',
      description: '如果发现责任人、负责部门或截止日期不合理，请回到对应母任务详情维护部门任务。',
      target: () => document.querySelector('#department-owner-department-task-table') as HTMLElement || contentRef.current || document.body
    },
    {
      title: '拆解子任务属于任务负责人',
      description: '“拆解”按钮只在你同时是该部门任务负责人时可用。部门负责人本身负责管理承接关系，不代替任务负责人拆子任务。',
      target: () => document.querySelector('#department-owner-department-task-table') as HTMLElement || contentRef.current || document.body
    }
  ];
  const departmentOwnerSubTaskSteps: TourProps['steps'] = [
    {
      title: '先区分你在子任务中的身份',
      description: '“我执行”表示需要你填写周更新；“我负责”表示跟进责任；“管理查看”是只读查看，不代执行人填写。',
      target: () => document.querySelector('#sub-task-guide-groups') as HTMLElement || contentRef.current || document.body
    },
    {
      title: '从执行任务进入更新页',
      description: '在“我执行”或“负责+执行”的子任务中点击“更新”，进入本周填报页面。',
      target: () => document.querySelector('#sub-task-guide-execution') as HTMLElement || contentRef.current || document.body
    },
    {
      title: '未开启任务先开启',
      description: '如果任务尚未开启，请先点击“开启任务”；任务完成后再标记已完成，完成后周更新表单会锁定。',
      target: () => contentRef.current || document.body
    },
    {
      title: '按周填写执行信息',
      description: '本周完成内容、下周计划和遗留事项分别记录已完成工作、下一步安排和距离完全完成仍需处理的尾项。',
      target: () => contentRef.current || document.body
    },
    {
      title: '提交状态会影响提醒',
      description: '保存草稿不会视为本周已提交；只有点击“提交保存”后，周五未提交提醒才会停止。',
      target: () => contentRef.current || document.body
    },
    {
      title: '遗留事项不等于风险',
      description: '遗留事项继续作为周更新文本；确有影响和可能性的问题，请使用“登记风险”单独形成风险项。',
      target: () => contentRef.current || document.body
    }
  ];
  const taskOwnerFrameworkSteps: TourProps['steps'] = [
    {
      title: '承接部门任务并拆解执行',
      description: '任务负责人负责承接本人名下的部门任务，并把任务拆解成可执行、可跟踪、可按周更新的子任务。',
      target: () => brandRef.current || document.body
    },
    {
      title: '只处理自己负责的部门任务',
      description: '任务负责人不承担母任务拆分职责，也不会因为任务负责人身份进入母任务管理；你的主入口是部门任务。',
      target: () => menuRef.current || document.body
    },
    {
      title: '从部门任务进入拆解',
      description: '在部门任务页找到本人负责的任务，点击“拆解”创建子任务，明确具体任务、执行人和截止日期。',
      target: () => contentRef.current || document.body
    },
    {
      title: '持续跟踪执行闭环',
      description: '拆解后需要关注待拆解数量、执行人周更新、遗留事项、风险和完成状态，确保任务进入真实推进。',
      target: () => contentRef.current || document.body
    },
    {
      title: '兼任执行人时要提交更新',
      description: '如果你同时是某个子任务的执行人，需要按执行人身份进入子任务执行页填写并提交本周进展。',
      target: () => headerMetaRef.current || document.body
    },
    {
      title: '板块首次进入会继续提示',
      description: '首次主动点击部门任务或子任务执行板块时，会出现专项说明；需要回顾时，可从右上角重新打开。',
      target: () => guideButtonRef.current || document.body
    }
  ];
  const taskOwnerDepartmentSteps: TourProps['steps'] = [
    {
      title: '集中查看本人负责的部门任务',
      description: '这里是任务负责人日常工作的主入口，用于查看本人负责的部门任务及其拆解情况。',
      target: () => document.querySelector('#department-owner-department-task-table') as HTMLElement || contentRef.current || document.body
    },
    {
      title: '先判断是否需要拆解',
      description: '建议优先查看任务负责人、状态、待拆解数量和截止日期，确认哪些任务还没有落到具体执行人。',
      target: () => document.querySelector('#department-owner-department-task-table') as HTMLElement || contentRef.current || document.body
    },
    {
      title: '点击拆解创建子任务',
      description: '点击“拆解”后填写具体任务、执行人和截止日期。子任务应足够具体，便于执行人按周提交进展。',
      target: () => document.querySelector('#department-owner-department-task-table') as HTMLElement || contentRef.current || document.body
    },
    {
      title: '负责人自动继承',
      description: '子任务负责人自动继承部门任务负责人，不在拆解窗口单独选择，避免部门任务责任和子任务责任分叉。',
      target: () => document.querySelector('#department-owner-department-task-table') as HTMLElement || contentRef.current || document.body
    },
    {
      title: '展开检查执行情况',
      description: '展开部门任务后，可以检查子任务执行人、本周进展、遗留事项和截止日期，及时发现未更新或推进异常。',
      target: () => document.querySelector('#department-owner-department-task-table') as HTMLElement || contentRef.current || document.body
    },
    {
      title: '编辑只维护执行层信息',
      description: '编辑子任务时只维护任务内容、执行人和截止日期；部门任务负责人变化会自动同步到子任务负责人。',
      target: () => document.querySelector('#department-owner-department-task-table') as HTMLElement || contentRef.current || document.body
    }
  ];
  const taskOwnerSubTaskSteps: TourProps['steps'] = [
    {
      title: '先看你在子任务中的身份',
      description: '“我负责”用于跟踪推进，“我执行”需要填写周更新，“负责+执行”则两类责任都要关注。',
      target: () => document.querySelector('#sub-task-guide-groups') as HTMLElement || contentRef.current || document.body
    },
    {
      title: '负责不等于代填',
      description: '在“我负责”任务中，你需要跟进执行人进展和风险，但不代替执行人填写周更新。',
      target: () => document.querySelector('#sub-task-guide-groups') as HTMLElement || contentRef.current || document.body
    },
    {
      title: '执行任务进入更新页',
      description: '在“我执行”或“负责+执行”的子任务中点击“更新”，进入本周填报页面。',
      target: () => document.querySelector('#sub-task-guide-execution') as HTMLElement || contentRef.current || document.body
    },
    {
      title: '区分草稿和正式提交',
      description: '保存草稿便于临时记录；只有点击“提交保存”，系统才认为本周更新已经正式提交。',
      target: () => contentRef.current || document.body
    },
    {
      title: '遗留事项不是风险',
      description: '遗留事项用于记录距离完成还剩什么；确有影响和可能性的问题，请单独登记风险项。',
      target: () => contentRef.current || document.body
    },
    {
      title: '完成后更新入口会收口',
      description: '任务完成后周更新表单会锁定，后续主要通过历史记录查看提交内容。',
      target: () => contentRef.current || document.body
    }
  ];
  const executorFrameworkSteps: TourProps['steps'] = [
    {
      title: '按计划推进本人子任务',
      description: '子任务执行者负责推进本人名下的具体任务，并按周提交真实、可追溯的执行进展。',
      target: () => brandRef.current || document.body
    },
    {
      title: '主要入口是子任务执行',
      description: '你的主要工作入口是“子任务执行”。执行人不承担母任务拆分或部门任务拆解职责。',
      target: () => menuRef.current || document.body
    },
    {
      title: '先确认任务状态',
      description: '任务可能处于待开启、进行中或已完成。待开启任务需要先开启，再填写本周进展。',
      target: () => contentRef.current || document.body
    },
    {
      title: '周更新要按周维护',
      description: '本周完成内容、下周计划和遗留事项分别记录已完成工作、下一步安排和距离完全完成仍需处理的事项。',
      target: () => contentRef.current || document.body
    },
    {
      title: '风险需要单独登记',
      description: '遗留事项不等于风险；确有影响和可能性的问题，请使用风险入口单独登记。',
      target: () => contentRef.current || document.body
    },
    {
      title: '正式提交影响提醒',
      description: '周五提醒以正式提交为准。保存草稿便于临时记录，但不会视为本周已提交。',
      target: () => guideButtonRef.current || document.body
    }
  ];
  const executorSubTaskSteps: TourProps['steps'] = [
    {
      title: '我执行是主要工作区',
      description: '“我执行”展示本人需要推进和更新的子任务，是执行人最常用的工作区。',
      target: () => document.querySelector('#sub-task-guide-execution') as HTMLElement || document.querySelector('#sub-task-guide-groups') as HTMLElement || contentRef.current || document.body
    },
    {
      title: '先核对任务关键信息',
      description: '更新前建议核对任务编号、任务名称、所属部门任务、负责人、状态和截止日期。',
      target: () => document.querySelector('#sub-task-guide-execution') as HTMLElement || contentRef.current || document.body
    },
    {
      title: '点击更新进入填报',
      description: '点击“更新”进入本周填报页面。待开启任务进入后先点击“开启任务”，再填写进展。',
      target: () => document.querySelector('#sub-task-guide-execution') as HTMLElement || contentRef.current || document.body
    },
    {
      title: '填写三类周更新内容',
      description: '本周完成内容写已经推进的工作，下周计划写下一步安排，遗留事项写距离完成仍需处理的尾项。',
      target: () => contentRef.current || document.body
    },
    {
      title: '草稿和提交要区分',
      description: '保存草稿不会停止周提醒；只有“提交保存”才代表本周更新正式完成。',
      target: () => contentRef.current || document.body
    },
    {
      title: '风险和完成状态单独处理',
      description: '发现真实风险时点击“风险”登记；任务完成后标记完成，后续更新入口会锁定。',
      target: () => contentRef.current || document.body
    }
  ];
  const observerFrameworkSteps: TourProps['steps'] = [
    {
      title: '全局只读审阅与任务追溯',
      description: '观察者用于公司级任务推进的只读审阅，重点关注任务推进质量、风险、逾期和历史过程。',
      target: () => brandRef.current || document.body
    },
    {
      title: '会议看板看全局',
      description: '会议看板是主要审阅入口，用于快速查看核心指标、风险逾期、更新完整度和部门差异。',
      target: () => menuRef.current || document.body
    },
    {
      title: '按任务层级理解责任拆解',
      description: '任务从母任务、部门任务到子任务逐级拆解。观察者可沿层级下钻，查看责任边界和执行进展。',
      target: () => contentRef.current || document.body
    },
    {
      title: '观察者保持只读边界',
      description: '观察者不负责新增、拆分、编辑或代填任务，主要用于审阅、追溯和会前准备。',
      target: () => contentRef.current || document.body
    },
    {
      title: '多重身份分开处理',
      description: '如果你同时也是任务负责人或执行人，对应任务仍按该身份跟进；观察者身份本身不增加写入职责。',
      target: () => headerMetaRef.current || document.body
    },
    {
      title: '板块首次进入会有专项说明',
      description: '首次主动点击左侧板块时，系统会补充该板块的审阅方法；右上角可随时重看当前页面指南。',
      target: () => guideButtonRef.current || document.body
    }
  ];
  const observerMeetingSteps: TourProps['steps'] = [
    {
      title: '先看核心指标',
      description: '会议看板先用于判断总体推进是否健康，再决定是否下钻风险、逾期、未更新和部门差异。',
      target: () => document.querySelector('#meeting-guide-metrics') as HTMLElement || contentRef.current || document.body
    },
    {
      title: '切换会议视角',
      description: '总览、母任务看板和部门看板分别对应不同审阅口径，可用于会前准备和会议中快速定位问题。',
      target: () => document.querySelector('#meeting-guide-tabs') as HTMLElement || contentRef.current || document.body
    },
    {
      title: '关注更新完整度',
      description: '本周更新情况和待更新人员帮助判断进展数据是否充分，避免会议只基于不完整信息讨论。',
      target: () => document.querySelector('#meeting-guide-weekly') as HTMLElement || contentRef.current || document.body
    },
    {
      title: '风险和逾期优先下钻',
      description: '风险、逾期和高风险事项是审阅重点，可点击明细查看来源任务、责任人和处理状态。',
      target: () => document.querySelector('#meeting-guide-risk') as HTMLElement || contentRef.current || document.body
    },
    {
      title: '看趋势和部门差异',
      description: '趋势和部门横向对比用于识别连续未更新、推进滞后或压力集中的方向。',
      target: () => document.querySelector('#meeting-guide-trend') as HTMLElement || contentRef.current || document.body
    },
    {
      title: '建议会议顺序',
      description: '建议按“总览异常、下钻明细、确认责任人、形成会后跟进”的顺序审阅。',
      target: () => document.querySelector('#meeting-guide-deadline') as HTMLElement || contentRef.current || document.body
    }
  ];
  const observerParentSteps: TourProps['steps'] = [
    {
      title: '查看公司级母任务',
      description: '母任务管理用于只读查看公司级任务、牵头部门、负责人、截止日期和当前状态。',
      target: () => document.querySelector('#department-owner-parent-list') as HTMLElement || contentRef.current || document.body
    },
    {
      title: '从任务卡进入详情',
      description: '进入详情后可查看该母任务下的部门任务拆解、子任务推进和周更新脉络。',
      target: () => document.querySelector('#department-owner-parent-cards') as HTMLElement || contentRef.current || document.body
    },
    {
      title: '沿层级追溯责任',
      description: '重点关注牵头部门、任务负责人、负责部门和截止日期是否清晰，便于会议追问到具体责任层级。',
      target: () => contentRef.current || document.body
    },
    {
      title: '保持只读审阅',
      description: '观察者不在这里新增、拆分或编辑任务；如本人另有部门负责人职责，请按对应身份处理。',
      target: () => contentRef.current || document.body
    }
  ];
  const observerDepartmentSteps: TourProps['steps'] = [
    {
      title: '查看部门承接情况',
      description: '部门任务用于查看各部门承接、任务负责人、截止日期、状态和待拆解情况。',
      target: () => document.querySelector('#department-owner-department-task-table') as HTMLElement || contentRef.current || document.body
    },
    {
      title: '展开查看子任务推进',
      description: '展开部门任务后，可查看子任务执行人、本周进展、遗留事项、风险和截止节点。',
      target: () => document.querySelector('#department-owner-department-task-table') as HTMLElement || contentRef.current || document.body
    },
    {
      title: '兼任任务负责人时要跟进',
      description: '如果本人也是某个部门任务的任务负责人，需要额外关注待拆解、执行人更新和风险处理。',
      target: () => contentRef.current || document.body
    },
    {
      title: '观察者不代替维护',
      description: '观察者身份只做审阅和追溯，不代替负责人新增子任务、调整执行人或填写周更新。',
      target: () => contentRef.current || document.body
    }
  ];
  const observerTimelineSteps: TourProps['steps'] = [
    {
      title: '按周追溯任务过程',
      description: '历史时间线按任务层级和周次展开，适合回看完成内容、遗留事项、附件和历史提交。',
      target: () => document.querySelector('#timeline-guide-card') as HTMLElement || contentRef.current || document.body
    },
    {
      title: '横向比较周次变化',
      description: '同一任务可以横向查看不同周次的更新，帮助判断问题是偶发、连续还是已经改善。',
      target: () => document.querySelector('#timeline-guide-matrix') as HTMLElement || contentRef.current || document.body
    },
    {
      title: '纵向追溯任务层级',
      description: '从母任务到部门任务再到子任务逐层展开，可定位进展内容来自哪个责任层级。',
      target: () => document.querySelector('#timeline-guide-matrix') as HTMLElement || contentRef.current || document.body
    },
    {
      title: '作为审阅证据来源',
      description: '时间线用于会前准备、会后复盘和过程追溯，不在这里直接修改历史提交。',
      target: () => contentRef.current || document.body
    }
  ];
  const observerSubTaskSteps: TourProps['steps'] = [
    {
      title: '仅在兼任执行人时出现',
      description: '观察者身份本身不承担填报责任；这里出现，说明你当前也有需要执行和更新的子任务。',
      target: () => document.querySelector('#sub-task-guide-execution') as HTMLElement || document.querySelector('#sub-task-guide-groups') as HTMLElement || contentRef.current || document.body
    },
    {
      title: '按执行人身份更新',
      description: '属于本人执行的子任务，需要进入更新页填写本周完成内容、下周计划和遗留事项。',
      target: () => document.querySelector('#sub-task-guide-execution') as HTMLElement || contentRef.current || document.body
    },
    {
      title: '草稿不等于提交',
      description: '保存草稿只用于临时记录；只有正式提交后，系统才认为本周更新完成。',
      target: () => contentRef.current || document.body
    },
    {
      title: '风险仍需单独登记',
      description: '遗留事项用于说明剩余工作；影响和可能性明确的问题，应单独登记风险项。',
      target: () => contentRef.current || document.body
    }
  ];
  const guideStepsByKey: Record<string, TourProps['steps']> = {
    legacy: legacyTourSteps,
    executive_framework: executiveSystemSteps,
    executive_meeting_board: executiveMeetingSteps,
    department_owner_framework: departmentOwnerFrameworkSteps,
    department_owner_parent_tasks: departmentOwnerParentSteps,
    department_owner_department_tasks: departmentOwnerDepartmentSteps,
    department_owner_sub_tasks: departmentOwnerSubTaskSteps,
    task_owner_framework: taskOwnerFrameworkSteps,
    task_owner_department_tasks: taskOwnerDepartmentSteps,
    task_owner_sub_tasks: taskOwnerSubTaskSteps,
    executor_framework: executorFrameworkSteps,
    executor_sub_tasks: executorSubTaskSteps,
    observer_framework: observerFrameworkSteps,
    observer_meeting_board: observerMeetingSteps,
    observer_parent_tasks: observerParentSteps,
    observer_department_tasks: observerDepartmentSteps,
    observer_timeline: observerTimelineSteps,
    observer_sub_tasks: observerSubTaskSteps
  };
  const tourSteps = guideStepsByKey[activeGuideKey || 'legacy'] || legacyTourSteps;

  const guideKeyForCurrentPage = () => {
    if (guideProfile === 'executive_office') {
      return location.pathname.startsWith('/meeting-board')
        ? auth?.guides?.modules?.meeting_board?.guide_key
        : auth?.guides?.system?.guide_key;
    }
    if (guideProfile === 'department_owner') {
      if (location.pathname.startsWith('/parent-tasks')) return auth?.guides?.modules?.parent_tasks?.guide_key;
      if (location.pathname.startsWith('/department-tasks')) return auth?.guides?.modules?.department_tasks?.guide_key;
      if (location.pathname.startsWith('/sub-tasks')) return auth?.guides?.modules?.sub_tasks?.guide_key;
      return auth?.guides?.system?.guide_key;
    }
    if (guideProfile === 'task_owner') {
      if (location.pathname.startsWith('/department-tasks')) return auth?.guides?.modules?.department_tasks?.guide_key;
      if (location.pathname.startsWith('/sub-tasks')) return auth?.guides?.modules?.sub_tasks?.guide_key;
      return auth?.guides?.system?.guide_key;
    }
    if (guideProfile === 'executor') {
      if (location.pathname.startsWith('/sub-tasks')) return auth?.guides?.modules?.sub_tasks?.guide_key;
      return auth?.guides?.system?.guide_key;
    }
    if (guideProfile === 'observer') {
      if (location.pathname.startsWith('/meeting-board')) return auth?.guides?.modules?.meeting_board?.guide_key;
      if (location.pathname.startsWith('/parent-tasks')) return auth?.guides?.modules?.parent_tasks?.guide_key;
      if (location.pathname.startsWith('/department-tasks')) return auth?.guides?.modules?.department_tasks?.guide_key;
      if (location.pathname.startsWith('/timeline')) return auth?.guides?.modules?.timeline?.guide_key;
      if (location.pathname.startsWith('/sub-tasks')) return auth?.guides?.modules?.sub_tasks?.guide_key;
      return auth?.guides?.system?.guide_key;
    }
    return guideProfile ? 'legacy' : null;
  };

  const openManualGuide = () => {
    setActiveGuideKey(guideKeyForCurrentPage() || auth?.guides?.system?.guide_key || 'legacy');
    setTourTracksProgress(false);
    setTourOpen(true);
  };

  const guideForMenuPath = (key: string) => (
    key === '/meeting-board'
      ? auth?.guides?.modules?.meeting_board
      : key === '/parent-tasks'
        ? auth?.guides?.modules?.parent_tasks
        : key === '/department-tasks'
          ? auth?.guides?.modules?.department_tasks
          : key === '/sub-tasks'
            ? auth?.guides?.modules?.sub_tasks
            : key === '/timeline'
              ? auth?.guides?.modules?.timeline
              : null
  );
  const triggerModuleGuide = (key: string) => {
    const moduleGuide = guideForMenuPath(key);
    if (moduleGuide?.required) {
      window.setTimeout(() => {
        setActiveGuideKey(moduleGuide.guide_key);
        setTourTracksProgress(true);
        setTourOpen(true);
      }, 180);
    }
  };
  const handleMenuClick = ({ key }: { key: string }) => {
    if (mobileLayout) setMobileNavOpen(false);
    triggerModuleGuide(key);
  };
  const handleMenuLinkCapture = (event: React.MouseEvent<HTMLDivElement>) => {
    const anchor = (event.target as HTMLElement | null)?.closest('a[href]') as HTMLAnchorElement | null;
    if (!anchor) return;
    triggerModuleGuide(new URL(anchor.href).pathname);
  };

  if ((error as any)?.response?.status === 401) {
    return <Navigate to="/login" replace />;
  }

  const brandNode = (
    <div className="brand" ref={mobileLayout ? undefined : brandRef}>
      <img className="brand-icon" src={taskFollowIcon} alt="任务跟踪系统" />
      <div className="brand-text">
        <strong>任务跟踪系统</strong>
        <span>闭环管理</span>
      </div>
    </div>
  );
  const siderFooterNode = (
    <div className="sider-footer">
      <img src={companyLogoCompact} alt="Fortune Microbot" />
      <div className="sider-user">
        <TeamOutlined />
        <span>{loading ? '加载中' : auth?.user?.name || '-'}</span>
      </div>
    </div>
  );
  const menuNode = (
    <Menu mode="inline" selectedKeys={[selectedKey]} items={menuItems} onClick={handleMenuClick} />
  );

  return (
    <Layout className="app-layout">
      {!mobileLayout ? (
        <Sider width={256} collapsedWidth={76} collapsed={compactLayout} className="app-sider">
          {brandNode}
          <div ref={menuRef} className="app-menu-guide-target" onClickCapture={handleMenuLinkCapture}>
            {menuNode}
          </div>
          {siderFooterNode}
        </Sider>
      ) : null}
      <Layout>
        <Header className="app-header">
          <Space size={mobileLayout ? 10 : 20} className="header-title-group">
            {mobileLayout ? (
              <div ref={menuRef}>
                <Button
                  aria-label="打开导航"
                  icon={<MenuOutlined />}
                  onClick={() => setMobileNavOpen(true)}
                />
              </div>
            ) : null}
            <div ref={mobileLayout ? brandRef : undefined} className="mobile-header-brand">
              <Typography.Title level={4}>{mobileLayout ? '任务跟踪系统' : '公司任务推进与周更新跟踪系统'}</Typography.Title>
            </div>
          </Space>
          <Space ref={headerMetaRef} className="header-meta" split={<Divider type="vertical" />}>
            {!mobileLayout ? <img className="header-company-logo" src={companyLogoCompact} alt="Fortune Microbot" /> : null}
            <span>{auth?.user?.name}</span>
            {!mobileLayout ? <span>{auth?.user?.department}</span> : null}
            <Tag color="blue">{headerDate}</Tag>
          </Space>
          <Space className="header-actions">
            {guideProfile ? <Tooltip title="使用指南">
              <Button
                ref={guideButtonRef}
                aria-label="使用指南"
                icon={<QuestionCircleOutlined />}
                onClick={openManualGuide}
              />
            </Tooltip> : null}
            <Button onClick={logout}>退出</Button>
          </Space>
        </Header>
        {mobileLayout ? (
          <Drawer
            className="mobile-nav-drawer"
            width={300}
            placement="left"
            open={mobileNavOpen}
            onClose={() => setMobileNavOpen(false)}
            closable={false}
          >
            {brandNode}
            <div className="app-menu-guide-target" onClickCapture={handleMenuLinkCapture}>
              {menuNode}
            </div>
            {siderFooterNode}
          </Drawer>
        ) : null}
        <Content ref={contentRef} className="app-content">
          <Routes>
            <Route path="/" element={<Navigate to="/workbench" replace />} />
            <Route path="/dashboard" element={<Navigate to="/workbench" replace />} />
            <Route path="/workbench" element={<Workbench auth={auth} onCreateRisk={setWorkbenchRiskTarget} />} />
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
            <Route path="/department-management" element={<DepartmentManagement />} />
            <Route path="/base-sync" element={<BaseSync />} />
            <Route path="/task-detail" element={<TaskDetail />} />
          </Routes>
        </Content>
      </Layout>
      <Tour
        open={tourOpen}
        steps={tourSteps}
        onClose={handleTourClose}
        onFinish={handleTourFinish}
      />
      <RiskItemModal
        open={Boolean(workbenchRiskTarget)}
        subTask={workbenchRiskTarget}
        onClose={() => setWorkbenchRiskTarget(null)}
      />
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
  const mobileLayout = useIsMobileLayout();
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

  useEffect(() => {
    if (!editing) return;
    editForm.resetFields();
    editForm.setFieldsValue({
      title: editing.title,
      description: editing.description,
      goal_id: editing.goal_id,
      department_id: editing.department_id,
      owner_ids: selectedPersonIds(editing, 'owners', 'owner_ids', 'owner_id'),
      due_date: editing.due_date ? dayjs(editing.due_date) : null
    });
  }, [editing, editForm]);

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
  };
  const saveEdit = async () => {
    const values = await editForm.validateFields();
    if (!editing) return;
    await putJson(`/parent-tasks/${editing.id}`, normalizeParentTaskValues(values));
    message.success('母任务已更新');
    setEditing(null);
    editForm.resetFields();
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
        <Space wrap className={mobileLayout ? 'mobile-page-actions' : undefined}>
          <Button type="primary" onClick={() => setCreateOpen(true)}>新增母任务</Button>
          <Button danger onClick={() => setDeleteOpen(true)}>删除母任务</Button>
        </Space>
      ) : null}
    >
      {mobileLayout ? (
        <Select
          showSearch
          optionFilterProp="label"
          placeholder="选择母任务并进入详情"
          className="mobile-section-selector mb16"
          options={(data || []).map((task) => ({ value: task.id, label: `${task.code} ${task.title}` }))}
          onChange={(value) => navigate(`/parent-tasks/${value}`)}
        />
      ) : null}
      <div id="department-owner-parent-list" className="parent-task-layout">
        {!mobileLayout ? <aside className="page-directory">
          <Typography.Text type="secondary">母任务目录</Typography.Text>
          <Menu
            mode="inline"
            items={(data || []).map((task) => ({ key: String(task.id), label: `${task.code} ${task.title}` }))}
            onClick={({ key }) => navigate(`/parent-tasks/${key}`)}
          />
        </aside> : null}
        <Row id="department-owner-parent-cards" gutter={[16, 16]} className="full-width">
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
      <Modal className={mobileLayout ? 'mobile-form-modal' : undefined} title="新增母任务" open={createOpen} onOk={createParentTask} onCancel={() => setCreateOpen(false)} destroyOnClose>
        <ParentTaskForm form={createForm} goalOptions={goalOptions} departmentOptions={departmentOptions} peopleOptions={peopleOptions} />
      </Modal>
      <Modal
        className={mobileLayout ? 'mobile-form-modal' : undefined}
        title="编辑母任务"
        open={Boolean(editing)}
        onOk={saveEdit}
        onCancel={() => setEditing(null)}
        afterOpenChange={(open) => {
          if (open && editing) {
            editForm.setFieldsValue({
              title: editing.title,
              description: editing.description,
              goal_id: editing.goal_id,
              department_id: editing.department_id,
              owner_ids: selectedPersonIds(editing, 'owners', 'owner_ids', 'owner_id'),
              due_date: editing.due_date ? dayjs(editing.due_date) : null
            });
          }
        }}
        destroyOnClose
        forceRender
      >
        <ParentTaskForm form={editForm} goalOptions={goalOptions} departmentOptions={departmentOptions} peopleOptions={peopleOptions} />
      </Modal>
      <Modal className={mobileLayout ? 'mobile-form-modal' : undefined} title="删除母任务" open={deleteOpen} onOk={archiveParentTask} onCancel={() => setDeleteOpen(false)} okText="归档隐藏" okButtonProps={{ danger: true }} destroyOnClose>
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
          <Form.Item name="owner_ids" label="任务负责人" rules={[{ required: true, message: '请选择任务负责人' }]}>
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
          <Descriptions.Item label="任务负责人">{renderPeople(task.owners || task.owner)}</Descriptions.Item>
        </Descriptions>
      )}
      <Form.Item name="title" label="具体任务" rules={[{ required: true, message: '请输入具体任务' }]}>
        <Input.TextArea rows={4} />
      </Form.Item>
      <Alert type="info" showIcon className="mb16" message="子任务负责人自动继承所属部门任务的任务负责人，无需重复选择。" />
      <Row gutter={16}>
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

function SubTaskEditForm({ form, task, peopleOptions }: {
  form: any;
  task?: AnyRecord | null;
  peopleOptions: { value: number; label: string }[];
}) {
  return (
    <Form form={form} layout="vertical">
      {task && (
        <Alert
          type="info"
          showIcon
          className="mb16"
          message={`正在编辑：${task.code || ''} ${task.title || ''}`}
        />
      )}
      <Form.Item name="title" label="具体任务" rules={[{ required: true, message: '请输入具体任务' }]}>
        <Input.TextArea rows={4} />
      </Form.Item>
      <Descriptions column={1} size="small" className="mb16" bordered>
        <Descriptions.Item label="任务负责人">{renderPeople(task?.owners || task?.owner)}</Descriptions.Item>
      </Descriptions>
      <Alert type="info" showIcon className="mb16" message="任务负责人由所属部门任务统一维护；此处仅调整执行人和任务内容。" />
      <Row gutter={16}>
        <Col xs={24} md={12}>
          <Form.Item name="executor_ids" label="执行人" rules={[{ required: true, message: '请选择执行人' }]}>
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

function ParentTaskDetail() {
  const navigate = useNavigate();
  const mobileLayout = useIsMobileLayout();
  const { parentTaskId } = useParams();
  const { data: task, reload: reloadParentTask } = useApi<AnyRecord>(`/parent-tasks/${parentTaskId}`, [parentTaskId]);
  const { data: departmentTasks, reload } = useApi<AnyRecord[]>(`/parent-tasks/${parentTaskId}/department-tasks`, [parentTaskId]);
  const { data: departments } = useApi<AnyRecord[]>('/departments', []);
  const { data: people } = useApi<AnyRecord[]>('/user-options', []);
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editing, setEditing] = useState<AnyRecord | null>(null);
  const [expandedDepartmentTaskIds, setExpandedDepartmentTaskIds] = useState<number[]>([]);
  const [createForm] = Form.useForm();
  const [editForm] = Form.useForm();
  const [deleteForm] = Form.useForm();
  const departmentOptions = (departments || []).map((item) => ({ value: item.id, label: item.name }));
  const peopleOptions = personOptions(people);
  const canCreateDepartmentTasks = Boolean(task?.can_create_department_task);
  const canDeleteDepartmentTasks = Boolean((departmentTasks || []).some((item) => item.can_delete));

  useEffect(() => {
    if (!editing) return;
    editForm.resetFields();
    editForm.setFieldsValue({
      title: editing.title,
      department_ids: editing.department_ids?.length ? editing.department_ids : (editing.department_id ? [editing.department_id] : []),
      owner_ids: selectedPersonIds(editing, 'owners', 'owner_ids', 'owner_id'),
      due_date: editing.due_date ? dayjs(editing.due_date) : null
    });
  }, [editing, editForm]);

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
  };
  const saveDepartmentTaskEdit = async () => {
    const values = await editForm.validateFields();
    if (!editing) return;
    await putJson(`/department-tasks/${editing.id}`, normalizeDepartmentTaskValues(values));
    message.success('部门级任务已更新');
    setEditing(null);
    editForm.resetFields();
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
    { title: '任务负责人', dataIndex: 'owners', width: 140, render: renderPeople },
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
  const toggleDepartmentTask = (taskId: number) => {
    setExpandedDepartmentTaskIds((current) => current.includes(taskId)
      ? current.filter((item) => item !== taskId)
      : [...current, taskId]);
  };
  const renderMobileDepartmentTask = (row: AnyRecord) => {
    const expanded = expandedDepartmentTaskIds.includes(row.id);
    return (
      <Card key={row.id} className="mobile-department-task-card">
        <Space direction="vertical" size={10} className="full-width">
          <div className="mobile-subtask-card-head">
            <div>
              <Typography.Text className="task-code">{row.code || '-'}</Typography.Text>
              <Typography.Title level={5}>{row.title || '-'}</Typography.Title>
            </div>
            <StatusTag value={row.status} />
          </div>
          <div className="mobile-task-meta">
            <span>负责部门</span><div>{renderDepartments(row.departments || row.department)}</div>
            <span>任务负责人</span><div>{renderPeople(row.owners || row.owner)}</div>
            <span>子任务</span><Typography.Text>{(row.sub_tasks || []).length} 项</Typography.Text>
          </div>
          <Space wrap className="mobile-card-actions">
            {row.can_edit ? <Button onClick={() => openDepartmentTaskEdit(row)}>编辑部门任务</Button> : null}
            {(row.sub_tasks || []).length ? (
              <Button onClick={() => toggleDepartmentTask(row.id)}>
                {expanded ? '收起子任务' : `查看子任务（${row.sub_tasks.length}）`}
              </Button>
            ) : <Typography.Text type="secondary">暂无子任务</Typography.Text>}
          </Space>
          {expanded ? (
            <div className="mobile-department-subtask-list">
              {(row.sub_tasks || []).map((subTask: AnyRecord) => (
                <div className="mobile-department-subtask" key={subTask.id}>
                  <div className="mobile-department-subtask-head">
                    <Typography.Text className="task-code">{subTask.code || '-'}</Typography.Text>
                    <StatusTag value={subTask.status} />
                  </div>
                  <Typography.Text strong>{subTask.title || '-'}</Typography.Text>
                  <div className="mobile-task-meta compact">
                    <span>执行人</span><div>{renderPeople(subTask.executors || subTask.executor)}</div>
                    <span>本周完成</span><Typography.Text>{subTask.weekly_this_week || '-'}</Typography.Text>
                    <span>遗留事项</span><Typography.Text>{subTask.weekly_risk || '-'}</Typography.Text>
                    <span>截止</span><Typography.Text>{subTask.due_date || '-'}</Typography.Text>
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </Space>
      </Card>
    );
  };
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
        id="department-owner-parent-detail-actions"
        className="business-card"
        title="部门级任务"
        extra={canCreateDepartmentTasks || canDeleteDepartmentTasks ? (
          <Space wrap className={mobileLayout ? 'mobile-page-actions' : undefined}>
            {canCreateDepartmentTasks ? <Button type="primary" onClick={() => setCreateOpen(true)}>新增</Button> : null}
            {canDeleteDepartmentTasks ? <Button danger onClick={() => setDeleteOpen(true)}>删除</Button> : null}
          </Space>
        ) : null}
      >
        {mobileLayout ? (
          <div className="mobile-card-list">
            {(departmentTasks || []).map(renderMobileDepartmentTask)}
          </div>
        ) : <Table
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
                  { title: '子任务编号', dataIndex: 'code', width: 124 },
                  { title: '具体任务', dataIndex: 'title', width: 210, ellipsis: true, render: renderEllipsis },
                  { title: '执行人', dataIndex: 'executors', width: 124, render: renderPeople },
                  { title: '本周完成内容', dataIndex: 'weekly_this_week', width: 190, render: renderBlankEllipsis },
                  { title: '遗留事项', dataIndex: 'weekly_risk', width: 190, render: renderBlankEllipsis },
                  { title: '截止日期', dataIndex: 'due_date', width: 104, responsive: ['lg'] }
                ]}
                tableLayout="fixed"
                scroll={{ x: 940 }}
              />
            ),
            rowExpandable: (row) => Boolean((row.sub_tasks || []).length)
          }}
        />}
      </Card>
      <Modal className={mobileLayout ? 'mobile-form-modal' : undefined} title="新增部门级任务" open={createOpen} onOk={createDepartmentTask} onCancel={() => setCreateOpen(false)} destroyOnClose>
        <DepartmentTaskForm form={createForm} parentTask={task} departmentOptions={departmentOptions} peopleOptions={peopleOptions} />
      </Modal>
      <Modal
        className={mobileLayout ? 'mobile-form-modal' : undefined}
        title="编辑部门级任务"
        open={Boolean(editing)}
        onOk={saveDepartmentTaskEdit}
        onCancel={() => setEditing(null)}
        afterOpenChange={(open) => {
          if (open && editing) {
            editForm.setFieldsValue({
              title: editing.title,
              department_ids: editing.department_ids?.length ? editing.department_ids : (editing.department_id ? [editing.department_id] : []),
              owner_ids: selectedPersonIds(editing, 'owners', 'owner_ids', 'owner_id'),
              due_date: editing.due_date ? dayjs(editing.due_date) : null
            });
          }
        }}
        destroyOnClose
        forceRender
      >
        <DepartmentTaskForm form={editForm} parentTask={task} departmentOptions={departmentOptions} peopleOptions={peopleOptions} />
      </Modal>
      <Modal className={mobileLayout ? 'mobile-form-modal' : undefined} title="删除部门级任务" open={deleteOpen} onOk={archiveDepartmentTask} onCancel={() => setDeleteOpen(false)} okText="归档隐藏" okButtonProps={{ danger: true }} destroyOnClose>
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
  const mobileLayout = useIsMobileLayout();
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<number | null>(null);
  const query = selectedDepartmentId ? `/department-tasks/overview?department_id=${selectedDepartmentId}` : '/department-tasks/overview';
  const { data, reload } = useApi<AnyRecord>(query, [selectedDepartmentId]);
  const { data: people } = useApi<AnyRecord[]>('/user-options', []);
  const [splitting, setSplitting] = useState<AnyRecord | null>(null);
  const [editingSubTask, setEditingSubTask] = useState<AnyRecord | null>(null);
  const [expandedTaskIds, setExpandedTaskIds] = useState<number[]>([]);
  const [splitForm] = Form.useForm();
  const [subTaskEditForm] = Form.useForm();
  const departmentTasks: AnyRecord[] = data?.department_tasks || [];
  const peopleOptions = personOptions(people);

  useEffect(() => {
    if (!splitting) return;
    splitForm.resetFields();
    splitForm.setFieldsValue({
      title: undefined,
      executor_ids: undefined,
      due_date: splitting.due_date ? dayjs(splitting.due_date) : null
    });
  }, [splitting, splitForm]);

  useEffect(() => {
    if (!editingSubTask) return;
    subTaskEditForm.resetFields();
    subTaskEditForm.setFieldsValue({
      title: editingSubTask.title,
      executor_ids: selectedPersonIds(editingSubTask, 'executors', 'executor_ids', 'executor_id'),
      due_date: editingSubTask.due_date ? dayjs(editingSubTask.due_date) : null
    });
  }, [editingSubTask, subTaskEditForm]);

  const openSplit = (row: AnyRecord) => {
    setSplitting(row);
  };
  const openSubTaskEdit = (subTask: AnyRecord) => {
    setEditingSubTask(subTask);
  };
  const createSubTask = async () => {
    const values = await splitForm.validateFields();
    if (!splitting) return;
    await postJson('/sub-tasks', {
      department_task_id: splitting.id,
      title: values.title,
      executor_ids: values.executor_ids,
      due_date: values.due_date ? values.due_date.format('YYYY-MM-DD') : null
    });
    message.success('子任务已拆解');
    setSplitting(null);
    splitForm.resetFields();
    await reload();
  };
  const saveSubTaskEdit = async () => {
    const values = await subTaskEditForm.validateFields();
    if (!editingSubTask) return;
    await putJson(`/sub-tasks/${editingSubTask.id}`, {
      title: values.title,
      executor_ids: values.executor_ids,
      due_date: values.due_date ? values.due_date.format('YYYY-MM-DD') : null
    });
    message.success('子任务已更新');
    setEditingSubTask(null);
    subTaskEditForm.resetFields();
    await reload();
  };
  const departmentTaskColumns: ColumnsType<AnyRecord> = [
    { title: '任务编号', dataIndex: 'code', width: 106 },
    { title: '部门任务', dataIndex: 'title', width: 220, ellipsis: true, render: renderEllipsis },
    { title: '所属母任务', dataIndex: 'parent_task', width: 190, ellipsis: true, render: renderEllipsis },
    { title: '负责部门', dataIndex: 'departments', width: 160, responsive: ['lg'], render: renderDepartments },
    { title: '任务负责人', dataIndex: 'owners', width: 138, render: renderPeople },
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
  const toggleDepartmentTask = (taskId: number) => {
    setExpandedTaskIds((current) => current.includes(taskId)
      ? current.filter((item) => item !== taskId)
      : [...current, taskId]);
  };
  const renderMobileSubTask = (subTask: AnyRecord, departmentTask: AnyRecord) => (
    <div className="mobile-department-subtask" key={subTask.id}>
      <div className="mobile-department-subtask-head">
        <Typography.Text className="task-code">{subTask.code || '-'}</Typography.Text>
        <StatusTag value={subTask.status} />
      </div>
      <Typography.Text strong>{subTask.title || '-'}</Typography.Text>
      <div className="mobile-task-meta compact">
        <span>执行人</span>
        <div>{renderPeople(subTask.executors || subTask.executor)}</div>
        <span>本周完成</span>
        <Typography.Text>{subTask.weekly_this_week || '-'}</Typography.Text>
        <span>遗留事项</span>
        <Typography.Text>{subTask.weekly_risk || '-'}</Typography.Text>
        <span>截止</span>
        <Typography.Text>{subTask.due_date || '-'}</Typography.Text>
      </div>
      {departmentTask.can_split ? (
        <Button size="small" onClick={() => openSubTaskEdit(subTask)}>编辑子任务</Button>
      ) : null}
    </div>
  );
  const renderMobileDepartmentTask = (row: AnyRecord) => {
    const expanded = expandedTaskIds.includes(row.id);
    const subTasks = row.sub_tasks || [];
    return (
      <Card key={row.id} className="mobile-department-task-card">
        <Space direction="vertical" size={10} className="full-width">
          <div className="mobile-subtask-card-head">
            <div>
              <Typography.Text className="task-code">{row.code || '-'}</Typography.Text>
              <Typography.Title level={5}>{row.title || '-'}</Typography.Title>
            </div>
            <StatusTag value={row.status} />
          </div>
          <div className="mobile-task-meta">
            <span>母任务</span>
            <Typography.Text>{row.parent_task || '-'}</Typography.Text>
            <span>负责部门</span>
            <div>{renderDepartments(row.departments || row.department)}</div>
            <span>负责人</span>
            <div>{renderPeople(row.owners || row.owner)}</div>
            <span>待拆解</span>
            <div>{row.pending_split_count ? <Tag color="orange">{row.pending_split_count} 个</Tag> : <Tag>无</Tag>}</div>
          </div>
          <Space wrap className="mobile-card-actions">
            <Button type="primary" disabled={!row.can_split} onClick={() => openSplit(row)}>拆解子任务</Button>
            {subTasks.length ? (
              <Button onClick={() => toggleDepartmentTask(row.id)}>{expanded ? '收起子任务' : `查看子任务（${subTasks.length}）`}</Button>
            ) : <Tag>暂无子任务</Tag>}
          </Space>
          {expanded ? (
            <Space direction="vertical" size={10} className="full-width mobile-department-subtask-list">
              {subTasks.map((subTask: AnyRecord) => renderMobileSubTask(subTask, row))}
            </Space>
          ) : null}
        </Space>
      </Card>
    );
  };
  return (
    <PageShell title="部门任务总览" subtitle="按部门直接查看部门级任务，展开后查看有效子任务">
      <div className={data?.can_switch_department ? 'department-task-layout' : 'department-task-layout no-sidebar'}>
        {data?.can_switch_department && mobileLayout && (
          <Select
            className="mobile-department-selector"
            value={data?.selected_department_id || selectedDepartmentId || 'all'}
            options={[
              { value: 'all', label: '全部部门' },
              ...((data?.departments || []).map((item: AnyRecord) => ({ value: item.id, label: item.name })))
            ]}
            onChange={(value) => setSelectedDepartmentId(value === 'all' ? null : Number(value))}
          />
        )}
        {data?.can_switch_department && !mobileLayout && (
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
          {mobileLayout ? (
            <section id="department-owner-department-task-table" className="mobile-department-task-list">
              <div className="mobile-subtask-section-title">
                {renderTableHeader('部门级任务', departmentTasks.length, '按负责部门和母任务快速扫描')}
              </div>
              <Space direction="vertical" size={12} className="full-width">
                {departmentTasks.map(renderMobileDepartmentTask)}
              </Space>
              {!departmentTasks.length ? <Alert type="info" showIcon message="当前没有可查看的部门任务。" /> : null}
            </section>
          ) : <Card id="department-owner-department-task-table" className="business-card">
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
                      { title: '具体任务', dataIndex: 'title', width: 210, ellipsis: true, render: renderEllipsis },
                      { title: '执行人', dataIndex: 'executors', width: 124, render: renderPeople },
                      { title: '本周完成内容', dataIndex: 'weekly_this_week', width: 190, render: renderBlankEllipsis },
                      { title: '遗留事项', dataIndex: 'weekly_risk', width: 190, render: renderBlankEllipsis },
                      { title: '截止日期', dataIndex: 'due_date', width: 104, responsive: ['lg'] },
                      {
                        title: '操作',
                        width: 82,
                        render: (_: unknown, subTask: AnyRecord) => (
                          <Button size="small" disabled={!row.can_split} onClick={() => openSubTaskEdit(subTask)}>
                            编辑
                          </Button>
                        )
                      }
                    ]}
                    tableLayout="fixed"
                    scroll={{ x: 1112 }}
                  />
                ),
                rowExpandable: (row) => Boolean((row.sub_tasks || []).length)
              }}
            />
          </Card>}
        </Space>
      </div>
      <Modal
        className="mobile-form-modal"
        title="拆解子任务"
        open={Boolean(splitting)}
        onOk={createSubTask}
        onCancel={() => setSplitting(null)}
        afterOpenChange={(open) => {
          if (open && splitting) {
            splitForm.setFieldsValue({
              title: undefined,
              executor_ids: undefined,
              due_date: splitting.due_date ? dayjs(splitting.due_date) : null
            });
          }
        }}
        destroyOnClose
        forceRender
      >
        <SplitSubTaskForm form={splitForm} task={splitting} peopleOptions={peopleOptions} />
      </Modal>
      <Modal
        className="mobile-form-modal"
        title="编辑子任务"
        open={Boolean(editingSubTask)}
        onOk={saveSubTaskEdit}
        onCancel={() => setEditingSubTask(null)}
        afterOpenChange={(open) => {
          if (open && editingSubTask) {
            subTaskEditForm.setFieldsValue({
              title: editingSubTask.title,
              executor_ids: selectedPersonIds(editingSubTask, 'executors', 'executor_ids', 'executor_id'),
              due_date: editingSubTask.due_date ? dayjs(editingSubTask.due_date) : null
            });
          }
        }}
        destroyOnClose
        forceRender
      >
        <SubTaskEditForm form={subTaskEditForm} task={editingSubTask} peopleOptions={peopleOptions} />
      </Modal>
    </PageShell>
  );
}

function SubTasks() {
  const { data } = useApi<AnyRecord[]>('/sub-tasks', []);
  const [riskTarget, setRiskTarget] = useState<AnyRecord | null>(null);
  const mobileLayout = useIsMobileLayout();
  const tasks = data || [];
  const executionTasks = tasks.filter((task) => task.viewer_relation === 'executor' || task.viewer_relation === 'both');
  const ownerTasks = tasks.filter((task) => task.viewer_relation === 'owner');
  const managementTasks = tasks.filter((task) => task.viewer_relation === 'management');
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
    { title: '截止日期', dataIndex: 'due_date', width: 108, responsive: ['lg'] },
    {
      title: '操作',
      width: 150,
      render: (_, row) => (
        <Space size={4}>
          {row.can_update_weekly
            ? <Link className="table-action-link" to={buildSubTaskUpdatePath(row)}>更新</Link>
            : row.can_reopen && row.status === 'completed'
              ? <Link className="table-action-link" to={`/sub-tasks/${row.id}/update`}>处理</Link>
            : <Typography.Text type="secondary">只读</Typography.Text>}
          {row.can_create_risk && (
            <Button size="small" type="link" icon={<SafetyOutlined />} onClick={() => setRiskTarget(row)}>风险</Button>
          )}
        </Space>
      )
    }
  ];
  const renderSubTaskCard = (row: AnyRecord) => {
    const relationMeta = relationLabels[String(row.viewer_relation)] || { label: '-', color: 'default' };
    return (
      <Card key={row.id} className="mobile-subtask-card">
        <Space direction="vertical" size={10} className="full-width">
          <div className="mobile-subtask-card-head">
            <div>
              <Typography.Text className="task-code">{row.code || '-'}</Typography.Text>
              <Typography.Title level={5}>{row.title || '-'}</Typography.Title>
            </div>
            <Tag color={relationMeta.color}>{relationMeta.label}</Tag>
          </div>
          <div className="mobile-task-meta">
            <span>部门任务</span>
            <Typography.Text>{row.department_task || '-'}</Typography.Text>
            <span>执行人</span>
            <div>{renderPeople(row.executors || row.executor)}</div>
            <span>负责人</span>
            <div>{renderPeople(row.owners || row.owner)}</div>
            <span>状态</span>
            <div><StatusTag value={row.status} /></div>
            <span>本周</span>
            <div><StatusTag value={row.weekly_status} /></div>
            <span>截止</span>
            <Typography.Text>{row.due_date || '-'}</Typography.Text>
          </div>
          <Space wrap className="mobile-card-actions">
            {row.can_update_weekly
              ? (
                <Link className="mobile-primary-link" to={buildSubTaskUpdatePath(row)}>
                  更新
                </Link>
              )
              : row.can_reopen && row.status === 'completed'
                ? <Link className="mobile-primary-link" to={`/sub-tasks/${row.id}/update`}>处理</Link>
              : <Tag>只读</Tag>}
            {row.can_create_risk && (
              <Button size="small" icon={<SafetyOutlined />} onClick={() => setRiskTarget(row)}>风险</Button>
            )}
          </Space>
        </Space>
      </Card>
    );
  };
  const renderGroup = (title: string, items: AnyRecord[], description: string, id?: string) => (
    items.length ? (
      mobileLayout ? (
        <section id={id} key={title} className={`mobile-subtask-section mobile-subtask-section-${title === '管理查看' ? 'management' : 'personal'}`}>
          <div className="mobile-subtask-section-title">
            {renderTableHeader(title, items.length, description)}
          </div>
          <Space direction="vertical" size={12} className="full-width">
            {items.map(renderSubTaskCard)}
          </Space>
        </section>
      ) : (
        <Table
          id={id}
          key={title}
          rowKey="id"
          dataSource={items}
          columns={columns}
          className={`business-table subtask-table subtask-table-${title === '管理查看' ? 'management' : 'personal'}`}
          tableLayout="fixed"
          scroll={{ x: 1120 }}
          title={() => renderTableHeader(title, items.length, description)}
        />
      )
    ) : null
  );
  return (
    <PageShell title="子任务执行" subtitle="个人更新入口：执行人填写周更新，负责人查看跟进，管理查看只读区分">
      <Space id="sub-task-guide-groups" direction="vertical" size={16} style={{ width: '100%' }}>
        {renderGroup('我执行', executionTasks, '可开启、完成并填写周更新', 'sub-task-guide-execution')}
        {renderGroup('我负责', ownerTasks, '仅查看负责的子任务，不代执行人填写')}
        {renderGroup('管理查看', managementTasks, '全局查看人员的只读入口；管理员可兜底更新')}
        {!tasks.length && <Alert type="info" showIcon message="当前没有与你相关的子任务。" />}
      </Space>
      <RiskItemModal
        open={Boolean(riskTarget)}
        subTask={riskTarget}
        onClose={() => setRiskTarget(null)}
      />
    </PageShell>
  );
}

function SubTaskUpdate() {
  const navigate = useNavigate();
  const location = useLocation();
  const { subTaskId } = useParams();
  const [form] = Form.useForm();
  const mobileLayout = useIsMobileLayout();
  const weekKey = currentIsoWeekKey();
  const assigneeId = new URLSearchParams(location.search).get('assigneeId');
  const assigneeQuery = assigneeId ? `&assignee_id=${assigneeId}` : '';
  const subTaskApi = useApi<AnyRecord>(`/sub-tasks/${subTaskId}`, [subTaskId]);
  const updateApi = useApi<AnyRecord>(`/weekly-updates/current?sub_task_id=${subTaskId}&week_key=${weekKey}${assigneeQuery}`, [subTaskId, weekKey, assigneeId]);
  const subTask = subTaskApi.data;
  const update = updateApi.data;
  const [updateStatus, setUpdateStatus] = useState('empty');
  const [riskModalOpen, setRiskModalOpen] = useState(false);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const isCompleted = subTask?.status === 'completed';
  const isStarted = Boolean(subTask && subTask.status !== 'pending_update');
  const canUpdateWeekly = Boolean(subTask?.can_update_weekly);
  const canEditUpdate = canUpdateWeekly && isStarted && !isCompleted;
  const shouldWarn = canEditUpdate && updateStatus !== 'submitted';
  const attachments = update?.attachments || [];

  useEffect(() => {
    if (!update) return;
    form.setFieldsValue({
      this_week: update.this_week,
      next_week: update.next_week,
      risk: update.risk,
      needs_coordination: false
    });
    setUpdateStatus(update.status || 'empty');
  }, [update?.id, update?.status, subTaskId]);

  const saveUpdate = async (submitUpdate: boolean) => {
    if (!canEditUpdate) return null;
    const values = form.getFieldsValue();
    const saved = await postJson('/weekly-updates', {
      sub_task_id: Number(subTaskId),
      assignee_id: update?.assignee_id || (assigneeId ? Number(assigneeId) : undefined),
      week_key: weekKey,
      this_week: values.this_week || null,
      next_week: values.next_week || null,
      risk: values.risk || null,
      needs_coordination: false,
      submit: submitUpdate
    });
    setUpdateStatus(submitUpdate ? 'submitted' : 'draft');
    if (submitUpdate) {
      message.success('周更新已提交');
    }
    updateApi.reload();
    subTaskApi.reload();
    return saved;
  };
  const ensureWeeklyUpdateForAttachment = async () => {
    if (update?.id) return update.id;
    const saved = await saveUpdate(false);
    if (!saved?.id) throw new Error('无法创建周更新草稿');
    return saved.id;
  };
  const uploadAttachment = async (file: File) => {
    if (!canEditUpdate) {
      message.warning('当前状态不能上传附件');
      return;
    }
    setUploadingAttachment(true);
    try {
      const weeklyUpdateId = await ensureWeeklyUpdateForAttachment();
      const formData = new FormData();
      formData.append('file', file);
      await api.post(`/weekly-updates/${weeklyUpdateId}/attachments`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      message.success('附件已上传');
      await updateApi.reload();
    } catch (error: any) {
      const detail = error?.response?.data?.detail;
      message.error(detail || '附件上传失败');
    } finally {
      setUploadingAttachment(false);
    }
  };
  const deleteAttachment = async (attachment: AnyRecord) => {
    Modal.confirm({
      title: '删除附件？',
      content: attachment.filename,
      okText: '删除',
      okButtonProps: { danger: true },
      cancelText: '取消',
      onOk: async () => {
        await deleteJson(`/attachments/${attachment.id}`);
        message.success('附件已删除');
        updateApi.reload();
      }
    });
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
    Modal.confirm({
      title: '确认完成子任务？',
      content: '完成后周更新表单会锁定。若误操作，需由子任务负责人或管理员撤回完成。',
      okText: '确认完成',
      okButtonProps: { danger: true },
      cancelText: '取消',
      onOk: async () => {
        await postJson(`/sub-tasks/${subTaskId}/complete`, {});
        message.success('任务已完成');
        await subTaskApi.reload();
        await updateApi.reload();
      }
    });
  };
  const reopenTask = async () => {
    Modal.confirm({
      title: '撤回子任务完成状态？',
      content: '任务将恢复为进行中，当前进度清零；历史周更新和完成记录会保留。',
      okText: '确认撤回',
      cancelText: '取消',
      onOk: async () => {
        await postJson(`/sub-tasks/${subTaskId}/reopen`, {});
        message.success('已撤回完成，任务恢复为进行中');
        await subTaskApi.reload();
        await updateApi.reload();
      }
    });
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
      <Card className="mb16 subtask-update-summary-card">
        <Descriptions column={mobileLayout ? 1 : 3}>
          <Descriptions.Item label="部门级任务">{subTask?.department_task || '-'}</Descriptions.Item>
          <Descriptions.Item label="执行人">{renderPeople(subTask?.executors || subTask?.executor)}</Descriptions.Item>
          <Descriptions.Item label="负责人">{renderPeople(subTask?.owners || subTask?.owner)}</Descriptions.Item>
          <Descriptions.Item label="当前填报人">{update?.assignee || '-'}</Descriptions.Item>
          <Descriptions.Item label="状态"><StatusTag value={subTask?.status} /></Descriptions.Item>
          <Descriptions.Item label="风险项">
            {subTask?.can_create_risk
              ? <Button size="small" icon={<SafetyOutlined />} onClick={() => setRiskModalOpen(true)}>登记风险</Button>
              : <Typography.Text type="secondary">无登记权限</Typography.Text>}
          </Descriptions.Item>
          <Descriptions.Item label="本周状态"><StatusTag value={subTask?.weekly_status} /></Descriptions.Item>
        </Descriptions>
        <Space className="mt16 subtask-update-top-actions" wrap direction={mobileLayout ? 'vertical' : 'horizontal'}>
          {canUpdateWeekly && !isStarted && <Button type="primary" onClick={startTask}>开启任务</Button>}
          {canEditUpdate && <Button danger onClick={completeTask}>标记已完成</Button>}
          {isCompleted && subTask?.can_reopen && <Button onClick={reopenTask}>撤回完成</Button>}
          {!canUpdateWeekly && <Tag>只读查看</Tag>}
          {isCompleted && <Tag color="green">该子任务已完成</Tag>}
        </Space>
      </Card>
      <Card title="本周更新" className="subtask-update-form-card">
        {!isStarted && <Alert type="info" showIcon className="mb16" message="该任务尚未开启。请先点击“开启任务”，再填写本周更新。" />}
        {isCompleted && <Alert type="success" showIcon className="mb16" message="该任务已完成，周更新表单已锁定。" />}
        <Form form={form} layout="vertical">
          <Form.Item name="this_week" label="本周完成内容">
            <Input.TextArea rows={5} disabled={!canEditUpdate} onBlur={autoSaveDraft} placeholder="请填写本周完成内容" />
          </Form.Item>
          <Form.Item name="next_week" label="下周计划">
            <Input.TextArea rows={4} disabled={!canEditUpdate} onBlur={autoSaveDraft} placeholder="请填写下周计划" />
          </Form.Item>
          <Form.Item
            name="risk"
            label={
              <Space>
                <span>遗留事项</span>
                {subTask?.can_create_risk && (
                  <Button size="small" type="link" icon={<SafetyOutlined />} onClick={() => setRiskModalOpen(true)}>登记风险</Button>
                )}
              </Space>
            }
          >
            <Input.TextArea rows={4} disabled={!canEditUpdate} onBlur={autoSaveDraft} placeholder="请填写距离完全完成仍遗留的事项、尾项或待确认内容" />
          </Form.Item>
          <Space className="subtask-update-submit-bar" direction={mobileLayout ? 'vertical' : 'horizontal'}>
            <Button disabled={!canEditUpdate} onClick={() => saveUpdate(false)}>保存草稿暂不提交</Button>
            <Button disabled={!canEditUpdate} type="primary" onClick={() => saveUpdate(true)}>提交保存</Button>
          </Space>
        </Form>
      </Card>
      <Card title="附件" className="subtask-update-attachments-card mt16">
        <Space direction="vertical" className="full-width">
          <Upload
            beforeUpload={async (file) => {
              await uploadAttachment(file);
              return false;
            }}
            showUploadList={false}
            disabled={!canEditUpdate || uploadingAttachment}
          >
            <Button icon={<UploadOutlined />} loading={uploadingAttachment} disabled={!canEditUpdate}>
              上传附件
            </Button>
          </Upload>
          {!canEditUpdate && <Typography.Text type="secondary">当前状态不能上传新附件。</Typography.Text>}
          {attachments.length ? (
            <div className="attachment-list">
              {attachments.map((attachment: AnyRecord) => (
                <div className="attachment-row" key={attachment.id}>
                  <a href={attachment.download_url} target="_blank" rel="noreferrer">{attachment.filename}</a>
                  {attachment.can_delete && (
                    <Button size="small" danger onClick={() => deleteAttachment(attachment)}>删除</Button>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <Typography.Text type="secondary">暂无附件</Typography.Text>
          )}
        </Space>
      </Card>
      <RiskItemModal
        open={riskModalOpen}
        subTask={subTask}
        sourceWeeklyUpdateId={update?.id}
        initialDescription={form.getFieldValue('risk')}
        onClose={() => setRiskModalOpen(false)}
        onCreated={() => {
          updateApi.reload();
          subTaskApi.reload();
        }}
      />
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
    <Space id="meeting-guide-tabs" className="mb16 meeting-tabs" wrap>
      {items.map((item) => (
        <Button key={item.path} type={location.pathname === item.path ? 'primary' : 'default'}>
          <Link to={item.path}>{item.label}</Link>
        </Button>
      ))}
    </Space>
  );
}

function DashboardDetailModal({ detail, onClose, onChanged }: { detail: AnyRecord | null; onClose: () => void; onChanged: () => void }) {
  const mobileLayout = useIsMobileLayout();
  const [keyword, setKeyword] = useState('');
  const [editingRisk, setEditingRisk] = useState<AnyRecord | null>(null);
  useEffect(() => {
    setKeyword('');
  }, [detail?.title]);
  const rows: AnyRecord[] = detail?.rows || [];
  const visibleRows = rows.filter((row) => JSON.stringify(row).toLowerCase().includes(keyword.trim().toLowerCase()));
  const subTaskColumns: ColumnsType<AnyRecord> = [
    { title: '母任务', width: 190, render: (_, row) => renderEllipsis(`${row.parent_task_code || '-'} ${row.parent_task || ''}`) },
    { title: '部门任务', width: 190, render: (_, row) => renderEllipsis(`${row.department_task_code || '-'} ${row.department_task || ''}`) },
    { title: '子任务', width: 210, render: (_, row) => renderEllipsis(`${row.code || '-'} ${row.title || ''}`) },
    { title: '执行人', dataIndex: 'executors', width: 126, render: renderPeople },
    { title: '负责人', dataIndex: 'owners', width: 126, render: renderPeople },
    { title: '状态', dataIndex: 'status', width: 88, render: (value) => <StatusTag value={value} /> },
    { title: '本周', dataIndex: 'weekly_status', width: 88, render: (value) => <StatusTag value={value} /> },
    { title: '截止', dataIndex: 'due_date', width: 104 },
    { title: '本周完成内容', dataIndex: 'weekly_this_week', width: 210, render: renderBlankEllipsis },
    { title: '遗留事项', dataIndex: 'weekly_risk', width: 210, render: renderBlankEllipsis }
  ];
  const parentColumns: ColumnsType<AnyRecord> = [
    { title: '母任务编号', dataIndex: 'code', width: 120 },
    { title: '母任务', dataIndex: 'title', width: 280, ellipsis: true, render: renderEllipsis },
    { title: '负责人', dataIndex: 'owners', width: 150, render: (_: AnyRecord[] | string | null, row: AnyRecord) => renderPeople(row.owners || row.owner) },
    { title: '牵头部门', dataIndex: 'department', width: 150, ellipsis: true, render: renderEllipsis },
    { title: '状态', dataIndex: 'status', width: 100, render: (value) => <StatusTag value={value} /> },
    { title: '截止日期', dataIndex: 'due_date', width: 120 }
  ];
  const riskColumns: ColumnsType<AnyRecord> = [
    { title: '风险编号', dataIndex: 'code', width: 116 },
    { title: '风险项', dataIndex: 'title', width: 220, ellipsis: true, render: renderEllipsis },
    { title: '等级', dataIndex: 'level', width: 88, render: (value) => <StatusTag value={value} /> },
    { title: '分值', dataIndex: 'score', width: 72 },
    { title: '影响', dataIndex: 'impact_score', width: 70 },
    { title: '可能性', dataIndex: 'likelihood_score', width: 78 },
    { title: '状态', dataIndex: 'status', width: 96, render: (value) => <StatusTag value={value} /> },
    { title: '责任人', dataIndex: 'owner', width: 120, render: renderPeople },
    { title: '来源子任务', width: 230, render: (_, row) => renderEllipsis(`${row.sub_task_code || '-'} ${row.sub_task || ''}`) },
    { title: '部门任务', width: 190, render: (_, row) => renderEllipsis(`${row.department_task_code || '-'} ${row.department_task || ''}`) },
    { title: '处理日期', dataIndex: 'due_date', width: 112 },
    { title: '说明', dataIndex: 'description', width: 220, render: renderBlankEllipsis },
    {
      title: '操作',
      width: 88,
      fixed: 'right',
      render: (_: unknown, row: AnyRecord) => row.can_manage
        ? <Button size="small" type="link" onClick={() => setEditingRisk(row)}>处理</Button>
        : <Typography.Text type="secondary">只读</Typography.Text>
    }
  ];
  const columns = detail?.type === 'parent' ? parentColumns : detail?.type === 'risk' ? riskColumns : subTaskColumns;
  const scrollX = detail?.type === 'parent' ? 920 : detail?.type === 'risk' ? 1690 : 1620;
  const renderMobileDetailCard = (row: AnyRecord) => {
    if (detail?.type === 'parent') {
      return (
        <Card key={`parent-${row.id}`} className="mobile-dashboard-detail-card">
          <Space direction="vertical" size={10} className="full-width">
            <div className="mobile-subtask-card-head">
              <div>
                <Typography.Text className="task-code">{row.code || '-'}</Typography.Text>
                <Typography.Title level={5}>{row.title || '-'}</Typography.Title>
              </div>
              <StatusTag value={row.status} />
            </div>
            <div className="mobile-task-meta">
              <span>负责人</span><div>{renderPeople(row.owners || row.owner)}</div>
              <span>牵头部门</span><Typography.Text>{row.department || '-'}</Typography.Text>
              <span>截止</span><Typography.Text>{row.due_date || '-'}</Typography.Text>
            </div>
          </Space>
        </Card>
      );
    }
    if (detail?.type === 'risk') {
      return (
        <Card key={`risk-${row.id}`} className="mobile-dashboard-detail-card">
          <Space direction="vertical" size={10} className="full-width">
            <div className="mobile-subtask-card-head">
              <div>
                <Typography.Text className="task-code">{row.code || '-'}</Typography.Text>
                <Typography.Title level={5}>{row.title || '-'}</Typography.Title>
              </div>
              <StatusTag value={row.level} />
            </div>
            <div className="mobile-task-meta">
              <span>分值</span><Typography.Text>{row.score ?? '-'}</Typography.Text>
              <span>责任人</span><div>{renderPeople(row.owner)}</div>
              <span>来源任务</span><Typography.Text>{`${row.sub_task_code || '-'} ${row.sub_task || ''}`}</Typography.Text>
              <span>部门任务</span><Typography.Text>{`${row.department_task_code || '-'} ${row.department_task || ''}`}</Typography.Text>
              <span>处理日期</span><Typography.Text>{row.due_date || '-'}</Typography.Text>
              <span>状态</span><div><StatusTag value={row.status} /></div>
            </div>
            {row.can_manage ? <Button onClick={() => setEditingRisk(row)}>处理风险</Button> : <Tag>只读</Tag>}
          </Space>
        </Card>
      );
    }
    return (
      <Card key={`sub-task-${row.id}`} className="mobile-dashboard-detail-card">
        <Space direction="vertical" size={10} className="full-width">
          <div className="mobile-subtask-card-head">
            <div>
              <Typography.Text className="task-code">{row.code || '-'}</Typography.Text>
              <Typography.Title level={5}>{row.title || '-'}</Typography.Title>
            </div>
            <StatusTag value={row.status} />
          </div>
          <div className="mobile-task-meta">
            <span>母任务</span><Typography.Text>{`${row.parent_task_code || '-'} ${row.parent_task || ''}`}</Typography.Text>
            <span>部门任务</span><Typography.Text>{`${row.department_task_code || '-'} ${row.department_task || ''}`}</Typography.Text>
            <span>执行人</span><div>{renderPeople(row.executors)}</div>
            <span>负责人</span><div>{renderPeople(row.owners)}</div>
            <span>本周</span><div><StatusTag value={row.weekly_status} /></div>
            <span>截止</span><Typography.Text>{row.due_date || '-'}</Typography.Text>
            <span>完成内容</span><Typography.Text>{row.weekly_this_week || '-'}</Typography.Text>
            <span>遗留事项</span><Typography.Text>{row.weekly_risk || '-'}</Typography.Text>
          </div>
        </Space>
      </Card>
    );
  };
  return (
    <>
      <Modal
        title={detail ? `${detail.title}（${visibleRows.length}/${rows.length}）` : '数据详情'}
        open={Boolean(detail)}
        onCancel={onClose}
        footer={null}
        width={mobileLayout ? '100%' : 1280}
        className={mobileLayout ? 'dashboard-detail-modal mobile-fullscreen-modal' : 'dashboard-detail-modal'}
        destroyOnClose
      >
        <Input.Search
          allowClear
          placeholder="请输入关键词搜索"
          value={keyword}
          onChange={(event) => setKeyword(event.target.value)}
          className="mb16"
        />
        {mobileLayout ? (
          <Space direction="vertical" size={12} className="full-width mobile-dashboard-detail-list">
            {visibleRows.map(renderMobileDetailCard)}
            {!visibleRows.length ? <Alert type="info" showIcon message="没有匹配的数据。" /> : null}
          </Space>
        ) : (
          <Table
            rowKey={(row) => `${detail?.type || 'detail'}-${row.id}`}
            size="small"
            dataSource={visibleRows}
            columns={columns}
            tableLayout="fixed"
            scroll={{ x: scrollX, y: 520 }}
            pagination={{ pageSize: 12, showSizeChanger: false }}
          />
        )}
      </Modal>
      <RiskManageModal
        risk={editingRisk}
        onClose={() => setEditingRisk(null)}
        onSaved={onChanged}
      />
    </>
  );
}

function MeetingBoardOverview() {
  const mobileLayout = useIsMobileLayout();
  const { data, loading, reload } = useApi<AnyRecord>('/meeting-board/overview', []);
  const [detail, setDetail] = useState<AnyRecord | null>(null);
  const [editingRisk, setEditingRisk] = useState<AnyRecord | null>(null);
  const cards = data?.cards || {};
  const weeklyBar = data?.weekly_bar || [];
  const riskPie = data?.risk_pie || [];
  const trend = data?.trend || [];
  const gantt = data?.gantt || [];
  const detailRows = data?.details || {};
  const parentDetails = data?.parent_details || [];
  const ganttMonths = Array.from(new Set(gantt.map((item: AnyRecord) => String(item.due_date || '').slice(0, 7) || '-'))).sort();
  const ganttCategories = gantt.map((item: AnyRecord) => item.code);
  const openSubTaskDetail = (title: string, detailKey: string) => {
    const type = detailKey === 'risk_tasks' || detailKey.startsWith('risk_') ? 'risk' : 'sub_task';
    setDetail({ title, type, rows: detailRows[detailKey] || [] });
  };
  const openParentDetail = (title = '母任务截止日期明细', rows = parentDetails) => {
    setDetail({ title, type: 'parent', rows });
  };
  return (
    <PageShell title="会议看板" subtitle={`当前周期 ${data?.week_key || '-'}，汇总周更新、风险、逾期和任务节奏`}>
      <MeetingBoardTabs />
      <Row id="meeting-guide-metrics" gutter={[16, 16]} className="meeting-metric-row">
        {[
          ['进行中子任务', cards.active_sub_tasks, '#2457d6', 'active_sub_tasks'],
          ['本周已更新', cards.updated_this_week, '#5f9f25', 'updated_this_week'],
          ['本周待更新', cards.missing_updates, '#d97706', 'missing_updates'],
          ['风险任务', cards.risk_tasks, '#dc2626', 'risk_tasks'],
          ['逾期任务', cards.overdue_tasks, '#b91c1c', 'overdue_tasks'],
          ['已完成任务', cards.completed_tasks, '#0f766e', 'completed_tasks']
        ].map(([label, value, color, detailKey]) => (
          <Col xs={12} xl={4} key={String(label)}>
            <Card loading={loading} hoverable className="metric-card meeting-metric-card clickable-card" style={{ borderTopColor: String(color) }} onClick={() => openSubTaskDetail(String(label), String(detailKey))}>
              <Statistic title={label} value={Number(value || 0)} valueStyle={{ color: String(color) }} />
            </Card>
          </Col>
        ))}
      </Row>
      <Row gutter={[16, 16]} className="section-row">
        <Col xs={24} xl={12}>
          <ChartCard
            id="meeting-guide-weekly"
            title="本周更新状态"
            className="meeting-chart-card"
            height={mobileLayout ? 240 : 300}
            onChartClick={(params) => {
              const item = params?.data;
              if (item?.detail_key) openSubTaskDetail(`本周更新状态：${item.name}`, item.detail_key);
            }}
            option={{
              tooltip: {},
              grid: { left: 40, right: 16, top: 32, bottom: 32 },
              xAxis: { type: 'category', data: weeklyBar.map((item: AnyRecord) => item.name) },
              yAxis: { type: 'value' },
              series: [{ type: 'bar', data: weeklyBar.map((item: AnyRecord) => ({ name: item.name, value: item.value, detail_key: item.detail_key })), itemStyle: { color: '#2457d6' } }]
            }}
          />
        </Col>
        <Col xs={24} xl={12}>
          <ChartCard
            id="meeting-guide-risk"
            title="风险占比"
            className="meeting-chart-card"
            height={mobileLayout ? 240 : 300}
            onChartClick={(params) => {
              const item = params?.data;
              if (item?.detail_key) openSubTaskDetail(`风险占比：${item.name}`, item.detail_key);
            }}
            option={{
              tooltip: { trigger: 'item' },
              legend: { bottom: 0 },
              series: [{ type: 'pie', radius: ['45%', '68%'], data: riskPie }]
            }}
          />
        </Col>
        <Col xs={24} xl={12}>
          <ChartCard
            id="meeting-guide-trend"
            title="近周提交趋势"
            className="meeting-chart-card"
            height={mobileLayout ? 240 : 300}
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
            id="meeting-guide-deadline"
            title="母任务截止日期管理"
            height={mobileLayout ? 280 : 340}
            className="meeting-chart-card"
            onChartClick={(params) => {
              const id = params?.data?.parent_id;
              const row = parentDetails.find((item: AnyRecord) => item.id === id);
              openParentDetail(row ? `母任务截止日期：${row.code}` : '母任务截止日期明细', row ? [row] : parentDetails);
            }}
            option={{
              tooltip: {
                trigger: 'item',
                formatter: (params: AnyRecord) => {
                  const item = params.data || {};
                  return `${item.code} ${item.title}<br/>负责人：${item.owner || '-'}<br/>牵头部门：${item.department || '-'}<br/>截止日期：${item.due_date || '-'}<br/>状态：${item.status || '-'}`;
                }
              },
              grid: { left: 82, right: 24, top: 24, bottom: 44 },
              xAxis: { type: 'category', name: '月份', data: ganttMonths },
              yAxis: { type: 'category', data: ganttCategories, inverse: true },
              series: [
                {
                  type: 'scatter',
                  symbol: 'roundRect',
                  symbolSize: [54, 20],
                  label: { show: true, formatter: (params: AnyRecord) => params.data?.code || '', color: '#fff', fontSize: 11 },
                  itemStyle: { color: '#2457d6' },
                  data: gantt.map((item: AnyRecord) => ({
                    value: [String(item.due_date || '').slice(0, 7) || '-', item.code],
                    parent_id: item.id,
                    code: item.code,
                    title: item.title,
                    owner: item.owner,
                    department: item.department,
                    due_date: item.due_date,
                    status: item.status
                  }))
                }
              ]
            }}
          />
        </Col>
      </Row>
      <Card id="risk-overdue" className="section-row meeting-table-card business-card">
        {mobileLayout ? (
          <Space direction="vertical" size={12} className="full-width mobile-risk-overdue-list">
            <div>{renderTableHeader('风险与逾期汇总', data?.risk_overdue?.length || 0, '风险、逾期和负责人快速核对')}</div>
            {(data?.risk_overdue || []).map((row: AnyRecord) => (
              <div className="mobile-risk-overdue-card" key={`${row.issue_type}-${row.id}`}>
                <div className="mobile-subtask-card-head">
                  <div>
                    <Tag color={String(row.issue_type).includes('逾期') ? 'red' : 'orange'}>{row.issue_type}</Tag>
                    <Typography.Title level={5}>{row.title || '-'}</Typography.Title>
                  </div>
                  <StatusTag value={row.risk_level} />
                </div>
                <div className="mobile-task-meta compact">
                  <span>编号</span><Typography.Text>{row.code || '-'}</Typography.Text>
                  <span>来源任务</span><Typography.Text>{row.sub_task_code ? `${row.sub_task_code} ${row.sub_task || ''}` : `${row.code || '-'} ${row.title || ''}`}</Typography.Text>
                  <span>部门任务</span><Typography.Text>{row.department_task || '-'}</Typography.Text>
                  <span>负责人</span><div>{renderPeople(row.owners || row.owner)}</div>
                  <span>截止</span><Typography.Text>{row.due_date || '-'}</Typography.Text>
                </div>
                {row.can_manage ? <Button size="small" onClick={() => setEditingRisk(row)}>处理</Button> : null}
              </div>
            ))}
            {!data?.risk_overdue?.length ? <Alert type="success" showIcon message="当前没有风险或逾期事项。" /> : null}
          </Space>
        ) : <Table
          rowKey="id"
          dataSource={data?.risk_overdue || []}
          className="business-table"
          tableLayout="fixed"
          scroll={{ x: 1050 }}
          title={() => renderTableHeader('风险与逾期汇总', data?.risk_overdue?.length || 0, '风险、逾期和负责人快速核对')}
          columns={[
            { title: '类型', dataIndex: 'issue_type', width: 88, render: (value) => <Tag color={String(value).includes('逾期') ? 'red' : 'orange'}>{value}</Tag> },
            { title: '编号', dataIndex: 'code', width: 124 },
            { title: '事项', dataIndex: 'title', width: 230, ellipsis: true, render: renderEllipsis },
            { title: '来源子任务', width: 190, render: (_: unknown, row: AnyRecord) => renderEllipsis(row.sub_task_code ? `${row.sub_task_code} ${row.sub_task || ''}` : `${row.code || '-'} ${row.title || ''}`) },
            { title: '部门级任务', dataIndex: 'department_task', width: 190, ellipsis: true, render: renderEllipsis },
            { title: '负责人', width: 132, render: (_: unknown, row: AnyRecord) => renderPeople(row.owners || row.owner) },
            { title: '风险', dataIndex: 'risk_level', width: 88, render: (value) => <StatusTag value={value} /> },
            { title: '分值', dataIndex: 'score', width: 72 },
            { title: '截止日期', dataIndex: 'due_date', width: 108, responsive: ['lg'] },
            {
              title: '操作',
              width: 88,
              render: (_: unknown, row: AnyRecord) => row.can_manage
                ? <Button size="small" type="link" onClick={() => setEditingRisk(row)}>处理</Button>
                : null
            }
          ]}
        />}
      </Card>
      <DashboardDetailModal
        detail={detail}
        onClose={() => setDetail(null)}
        onChanged={() => {
          setDetail(null);
          reload();
        }}
      />
      <RiskManageModal
        risk={editingRisk}
        onClose={() => setEditingRisk(null)}
        onSaved={reload}
      />
    </PageShell>
  );
}

function MeetingBoardParent() {
  const mobileLayout = useIsMobileLayout();
  const { data } = useApi<AnyRecord>('/meeting-board/parent', []);
  const rows = data?.rows || [];
  const chartRows = mobileLayout
    ? [...rows].sort((a: AnyRecord, b: AnyRecord) => b.missing_updates - a.missing_updates).slice(0, 10).reverse()
    : rows;
  return (
    <PageShell title="母任务看板" subtitle={`当前周期 ${data?.week_key || '-'}，按母任务汇总任务推进风险`}>
      <MeetingBoardTabs />
      <ChartCard
        title="母任务待更新排行"
        className="meeting-chart-card"
        height={mobileLayout ? Math.max(280, chartRows.length * 38) : 300}
        option={{
          tooltip: { trigger: 'axis' },
          grid: mobileLayout ? { left: 64, right: 20, top: 18, bottom: 28 } : { left: 80, right: 20, top: 24, bottom: 80 },
          xAxis: mobileLayout ? { type: 'value' } : { type: 'category', data: chartRows.map((item: AnyRecord) => item.code), axisLabel: { rotate: 35 } },
          yAxis: mobileLayout ? { type: 'category', data: chartRows.map((item: AnyRecord) => item.code) } : { type: 'value' },
          series: [{ type: 'bar', data: chartRows.map((item: AnyRecord) => item.missing_updates), itemStyle: { color: '#d97706' } }]
        }}
      />
      <Card className="section-row meeting-table-card business-card">
        {mobileLayout ? (
          <div className="mobile-board-list">
            {rows.map((row: AnyRecord) => (
              <div className="mobile-board-card" key={row.id}>
                <div className="mobile-board-card-head">
                  <div><Typography.Text className="task-code">{row.code}</Typography.Text><Typography.Title level={5}>{row.title}</Typography.Title></div>
                  <Tag color={row.missing_updates ? 'orange' : 'green'}>{row.missing_updates} 待更新</Tag>
                </div>
                <div className="mobile-task-meta compact">
                  <span>牵头部门</span><Typography.Text>{row.department || '-'}</Typography.Text>
                  <span>负责人</span><div>{renderPeople(row.owners || row.owner)}</div>
                  <span>任务构成</span><Typography.Text>{row.department_task_count} 部门任务 / {row.sub_task_count} 子任务</Typography.Text>
                  <span>异常</span><Typography.Text>{row.risk_count} 风险 / {row.overdue_count} 逾期</Typography.Text>
                  <span>完成</span><Typography.Text>{row.completed_count} 项</Typography.Text>
                </div>
              </div>
            ))}
          </div>
        ) : <Table
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
        />}
      </Card>
    </PageShell>
  );
}

function MeetingBoardDepartment() {
  const mobileLayout = useIsMobileLayout();
  const { data } = useApi<AnyRecord>('/meeting-board/department', []);
  const rows = data?.rows || [];
  const volumeRows = mobileLayout
    ? [...rows].sort((a: AnyRecord, b: AnyRecord) => b.sub_task_count - a.sub_task_count).slice(0, 10).reverse()
    : rows;
  const missingRows = mobileLayout
    ? [...rows].sort((a: AnyRecord, b: AnyRecord) => b.missing_updates - a.missing_updates).slice(0, 10).reverse()
    : rows;
  const mobileBarOption = (items: AnyRecord[], field: string, color: string) => ({
    tooltip: { trigger: 'axis' },
    grid: { left: 92, right: 18, top: 18, bottom: 28 },
    xAxis: { type: 'value' },
    yAxis: { type: 'category', data: items.map((item: AnyRecord) => item.name), axisLabel: { width: 82, overflow: 'truncate' } },
    series: [{ type: 'bar', data: items.map((item: AnyRecord) => item[field]), itemStyle: { color } }]
  });
  return (
    <PageShell title="部门看板" subtitle={`当前周期 ${data?.week_key || '-'}，按负责部门汇总任务状态`}>
      <MeetingBoardTabs />
      <Row gutter={[16, 16]}>
        <Col xs={24} xl={12}>
          <ChartCard
            title="部门任务量"
            className="meeting-chart-card"
            height={mobileLayout ? Math.max(280, volumeRows.length * 38) : 300}
            option={mobileLayout ? mobileBarOption(volumeRows, 'sub_task_count', '#2457d6') : {
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
            height={mobileLayout ? Math.max(280, missingRows.length * 38) : 300}
            option={mobileLayout ? mobileBarOption(missingRows, 'missing_updates', '#d97706') : {
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
        {mobileLayout ? (
          <div className="mobile-board-list">
            {rows.map((row: AnyRecord) => (
              <div className="mobile-board-card" key={row.id}>
                <div className="mobile-board-card-head">
                  <Typography.Title level={5}>{row.name}</Typography.Title>
                  <Tag color={row.missing_updates ? 'orange' : 'green'}>{row.missing_updates} 待更新</Tag>
                </div>
                <div className="mobile-task-meta compact">
                  <span>任务构成</span><Typography.Text>{row.department_task_count} 部门任务 / {row.sub_task_count} 子任务</Typography.Text>
                  <span>风险</span><Typography.Text>{row.risk_count} 项</Typography.Text>
                  <span>逾期</span><Typography.Text>{row.overdue_count} 项</Typography.Text>
                  <span>完成</span><Typography.Text>{row.completed_count} 项</Typography.Text>
                </div>
              </div>
            ))}
          </div>
        ) : <Table
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
        />}
      </Card>
    </PageShell>
  );
}

function TimelinePage() {
  const mobileLayout = useIsMobileLayout();
  const { data, loading } = useApi<AnyRecord>('/timeline/matrix', []);
  const weeks: string[] = data?.weeks || [];
  const [selectedWeek, setSelectedWeek] = useState<string | undefined>();
  useEffect(() => {
    if (!weeks.length) return;
    if (!selectedWeek || !weeks.includes(selectedWeek)) setSelectedWeek(weeks[weeks.length - 1]);
  }, [weeks.join('|'), selectedWeek]);
  const timelineColumns = `240px 132px repeat(${weeks.length}, 156px)`;
  const renderCell = (value?: string | null) => renderTimelineText(value);
  return (
    <PageShell title="历史时间线" subtitle="按任务层级展开，以周为主轴查看完成内容、遗留事项和附件">
      <Card id="timeline-guide-card" loading={loading} className="timeline-card">
        {mobileLayout ? (
          <div id="timeline-guide-matrix" className="mobile-timeline">
            <Select
              value={selectedWeek}
              onChange={setSelectedWeek}
              options={weeks.map((week) => ({ value: week, label: week }))}
              className="mobile-section-selector mb16"
              placeholder="选择查看周次"
            />
            {(data?.parents || []).map((parent: AnyRecord) => (
              <details key={parent.id} className="mobile-timeline-node">
                <summary><span className="timeline-code">{parent.code}</span>{parent.title}</summary>
                {(parent.department_tasks || []).map((departmentTask: AnyRecord) => (
                  <details key={departmentTask.id} className="mobile-timeline-node child">
                    <summary><span className="timeline-code">{departmentTask.code}</span>{departmentTask.title}</summary>
                    <div className="mobile-timeline-subtasks">
                      {(departmentTask.sub_tasks || []).map((subTask: AnyRecord) => {
                        const cell = selectedWeek ? subTask.cells?.[selectedWeek] : null;
                        const attachments = cell?.attachments || [];
                        return (
                          <div className="mobile-timeline-card" key={subTask.id}>
                            <div className="mobile-department-subtask-head">
                              <Typography.Text className="task-code">{subTask.code}</Typography.Text>
                              <StatusTag value={subTask.status} />
                            </div>
                            <Typography.Text strong>{subTask.title}</Typography.Text>
                            <div className="mobile-task-meta compact">
                              <span>开始时间</span><Typography.Text>{subTask.started_at || '-'}</Typography.Text>
                              <span>完成内容</span><Typography.Text>{cell?.this_week || '-'}</Typography.Text>
                              <span>遗留事项</span><Typography.Text>{cell?.risk || '-'}</Typography.Text>
                              <span>附件</span><Typography.Text>{renderAttachmentLinks(attachments)}</Typography.Text>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </details>
                ))}
              </details>
            ))}
          </div>
        ) : <div id="timeline-guide-matrix" className="timeline-matrix">
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
                          return <span key={week}>{renderAttachmentLinks(attachments)}</span>;
                        })}
                      </div>
                    </div>
                  ))}
                </details>
              ))}
            </details>
          ))}
        </div>}
      </Card>
    </PageShell>
  );
}

function Notifications() {
  const mobileLayout = useIsMobileLayout();
  const [includeHistorical, setIncludeHistorical] = useState(false);
  const { data, reload } = useApi<AnyRecord[]>(`/notifications?include_historical=${includeHistorical}`, [includeHistorical]);
  const { data: scheduler, reload: reloadScheduler } = useApi<AnyRecord>('/notifications/scheduler-status', []);
  const [loading, setLoading] = useState(false);
  const [notificationType, setNotificationType] = useState<string | undefined>();
  const notificationTypeLabels: Record<string, string> = {
    weekly_update_digest: '周更新汇总提醒',
    department_task_split_required: '部门任务拆解提醒',
    department_task_due_soon: '部门任务临期提醒',
    risk_item_alert: '风险项提醒',
    lark_test_message: '历史测试卡片',
    weekly_update_reminder: '历史周更新模拟',
  };
  const filteredNotifications = notificationType
    ? (data || []).filter((item) => item.notification_type === notificationType)
    : (data || []);
  const runOfficialNotification = (title: string, content: string, action: () => Promise<void>) => {
    Modal.confirm({
      title,
      content,
      okText: '确认正式发送',
      cancelText: '取消',
      okButtonProps: { danger: true },
      onOk: action
    });
  };
  const sendLark = () => runOfficialNotification(
    '确认发送本周更新提醒？',
    '系统将向所有符合条件且尚未提交本周更新的执行人正式发送飞书卡片；同一周已发送对象会按去重规则跳过。',
    async () => {
    setLoading(true);
    try {
      const result = await postJson('/notifications/lark-weekly-reminders', { week_key: currentIsoWeekKey() });
      message.success(`周更新汇总：生成 ${result.created || 0} 条，成功 ${result.sent || 0} 条，抑制 ${result.suppressed || 0} 条，跳过 ${result.skipped || 0} 条`);
      reload();
    } finally {
      setLoading(false);
    }
  });
  const sendDepartmentDue = () => runOfficialNotification(
    '确认发送部门任务临期提醒？',
    '系统将扫描未来 7 天内到期的未完成部门任务，并向任务负责人正式发送飞书卡片；已发送记录会按截止日期去重。',
    async () => {
    setLoading(true);
    try {
      const result = await postJson('/notifications/department-task-due-reminders', {});
      message.success(`部门任务临期提醒：任务 ${result.tasks || 0} 项，生成 ${result.created || 0} 条，成功 ${result.sent || 0} 条，抑制 ${result.suppressed || 0} 条`);
      reload();
      reloadScheduler();
    } finally {
      setLoading(false);
    }
  });
  const sendRiskOverdue = () => runOfficialNotification(
    '确认发送风险逾期提醒？',
    '系统将扫描开放或处理中的逾期风险，并向风险责任人及相关任务负责人正式发送飞书卡片。',
    async () => {
    setLoading(true);
    try {
      const result = await postJson('/notifications/risk-overdue', {});
      message.success(`风险逾期提醒：风险 ${result.risks || 0} 项，通知 ${result.created || 0} 条，成功 ${result.sent || 0} 条，抑制 ${result.suppressed || 0} 条，跳过 ${result.skipped || 0} 条`);
      reload();
    } finally {
      setLoading(false);
    }
  });
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
      message.success(`邮箱更新 ${result.imported || 0} 人，新增 ${result.created || 0} 人，跳过 ${result.skipped || 0} 条，阻塞 ${result.blocked || 0} 人`);
      reload();
    } catch (error) {
      message.error(`邮箱导入失败：${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      setLoading(false);
    }
    return false;
  };
  const statusColor = (value: string) => {
    if (value === 'sent' || value === 'mock_sent') return 'green';
    if (value === 'pending') return 'blue';
    if (value === 'blocked') return 'orange';
    if (value === 'suppressed') return 'default';
    return 'red';
  };
  const scheduleText = (scheduler?.jobs || [])
    .map((job: AnyRecord) => {
      const labels: Record<string, string> = {
        weekly_update_digest: '周更新',
        department_task_due_scan: '部门任务临期',
        risk_overdue_scan: '风险逾期'
      };
      return `${labels[job.id] || job.id}：${job.next_run_time ? dayjs(job.next_run_time).format('YYYY-MM-DD HH:mm') : '未安排'}`;
    })
    .join('；');
  const deliveryModeText = scheduler?.delivery_mode === 'allowlist' ? '白名单试运行' : '正式全员投递';
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
            <Select
              allowClear
              placeholder="通知类型"
              value={notificationType}
              onChange={setNotificationType}
              options={Object.entries(notificationTypeLabels).map(([value, label]) => ({ value, label }))}
              style={{ minWidth: 180 }}
            />
            <Checkbox checked={includeHistorical} onChange={(event) => setIncludeHistorical(event.target.checked)}>
              查看历史测试记录
            </Checkbox>
          </Space>
          <Space wrap className="admin-toolbar primary-toolbar">
            <Button type="primary" onClick={sendLark} loading={loading}>发送飞书提醒</Button>
            <Button icon={<ScheduleOutlined />} onClick={sendDepartmentDue} loading={loading}>部门任务临期提醒</Button>
            <Button danger icon={<SafetyOutlined />} onClick={sendRiskOverdue} loading={loading}>风险逾期提醒</Button>
          </Space>
          <Alert
            type={scheduler?.running ? 'success' : 'warning'}
            showIcon
            message={`通知调度：${scheduler?.running ? '运行中' : '未运行'} · ${scheduler?.timezone || 'Asia/Shanghai'} · ${deliveryModeText}`}
            description={scheduleText || '暂无调度任务'}
          />
        </Space>
      </Card>
      <Card className="business-card">
        {mobileLayout ? (
          <div className="mobile-notification-list">
            <div>{renderTableHeader('通知记录', filteredNotifications.length, '记录正式业务提醒、点击状态和异常结果')}</div>
            {filteredNotifications.map((row) => (
              <div className="mobile-notification-card" key={row.id}>
                <div className="mobile-board-card-head">
                  <div>
                    <Typography.Text strong>{notificationTypeLabels[row.notification_type] || row.notification_type}</Typography.Text>
                    <div><Typography.Text type="secondary">{row.created_at ? dayjs(row.created_at).format('YYYY-MM-DD HH:mm') : '-'}</Typography.Text></div>
                  </div>
                  <Tag color={statusColor(row.send_status)}>{row.send_status}</Tag>
                </div>
                <div className="mobile-task-meta compact">
                  <span>通知对象</span><Typography.Text>{row.target_user || '-'}</Typography.Text>
                  <span>关联对象</span><Typography.Text>{`${row.related_type || '-'} ${row.related_id || ''}`}</Typography.Text>
                  <span>点击状态</span><Typography.Text>{row.clicked ? `已点击 ${row.click_count || 0} 次` : '未点击'}</Typography.Text>
                  <span>首次点击</span><Typography.Text>{row.first_clicked_at ? dayjs(row.first_clicked_at).format('YYYY-MM-DD HH:mm') : '-'}</Typography.Text>
                  <span>处理结果</span><Typography.Text>{row.result || '-'}</Typography.Text>
                </div>
              </div>
            ))}
          </div>
        ) : <Table
          rowKey="id"
          dataSource={filteredNotifications}
          className="business-table"
          tableLayout="fixed"
          scroll={{ x: 1320 }}
          title={() => renderTableHeader('通知记录', filteredNotifications.length, '记录飞书业务提醒、点击状态和异常结果')}
          columns={[
            {
              title: '通知时间',
              dataIndex: 'created_at',
              width: 150,
              render: (value) => value ? dayjs(value).format('YYYY-MM-DD HH:mm') : '-'
            },
            { title: '通知对象', dataIndex: 'target_user', width: 120, ellipsis: true, render: renderEllipsis },
            { title: '通知类型', dataIndex: 'notification_type', width: 160, ellipsis: true, render: (value) => renderEllipsis(notificationTypeLabels[value] || value) },
            { title: '关联对象', width: 130, render: (_, row) => renderEllipsis(`${row.related_type || '-'} ${row.related_id || ''}`) },
            {
              title: '发送状态',
              dataIndex: 'send_status',
              width: 104,
              render: (value) => <Tag color={statusColor(value)}>{value}</Tag>
            },
            {
              title: <Tooltip title="表示飞书卡片中的签名链接已验证成功，不代表业务事项已处理">点击状态</Tooltip>,
              dataIndex: 'clicked',
              width: 96,
              render: (value) => value ? <Tag color="green">已点击</Tag> : <Tag>未点击</Tag>
            },
            { title: '点击次数', dataIndex: 'click_count', width: 88, render: (value) => value || 0 },
            {
              title: '首次点击',
              dataIndex: 'first_clicked_at',
              width: 150,
              render: (value) => value ? dayjs(value).format('YYYY-MM-DD HH:mm') : '-'
            },
            {
              title: '最后点击',
              dataIndex: 'last_clicked_at',
              width: 150,
              render: (value) => value ? dayjs(value).format('YYYY-MM-DD HH:mm') : '-'
            },
            { title: '处理结果', dataIndex: 'result', width: 228, ellipsis: true, render: renderEllipsis }
          ]}
        />}
      </Card>
    </PageShell>
  );
}

function People() {
  const mobileLayout = useIsMobileLayout();
  const { data, reload } = useApi<AnyRecord[]>('/people', []);
  const { data: departments } = useApi<AnyRecord[]>('/departments', []);
  const { data: roles } = useApi<AnyRecord[]>('/roles', []);
  const [form] = Form.useForm();
  const [editForm] = Form.useForm();
  const [createOpen, setCreateOpen] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [editing, setEditing] = useState<AnyRecord | null>(null);
  const departmentOptions = (departments || []).map((item) => ({ value: item.id, label: item.name }));
  const roleOptions = (roles || []).map((item) => ({ value: item.id, label: item.name }));
  const createPerson = async (values: AnyRecord) => {
    await postJson('/people', values);
    message.success('人员已创建');
    form.resetFields();
    setCreateOpen(false);
    reload();
  };
  const submitCreatePerson = async () => createPerson(await form.validateFields());
  const openEdit = (person: AnyRecord) => {
    setEditing(person);
    editForm.setFieldsValue({
      name: person.name,
      department_id: person.department_id,
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
  const filteredPeople = (data || []).filter((person) => person.name?.includes(searchText.trim()));
  const createFormContent = (
    <Form form={form} layout="vertical" onFinish={createPerson} initialValues={{ status: 'active', role_ids: [] }}>
      <Row gutter={16}>
        <Col xs={24} md={6}>
          <Form.Item name="name" label="姓名" rules={[{ required: true, message: '请输入姓名' }]}><Input /></Form.Item>
        </Col>
        <Col xs={24} md={6}>
          <Form.Item name="department_id" label="部门"><Select allowClear options={departmentOptions} /></Form.Item>
        </Col>
        <Col xs={24} md={6}>
          <Form.Item name="status" label="状态">
            <Select options={[{ value: 'active', label: '启用' }, { value: 'pending', label: '待完善' }, { value: 'disabled', label: '停用' }]} />
          </Form.Item>
        </Col>
      </Row>
      <Form.Item name="open_id" label="飞书 open_id"><Input placeholder="手动录入飞书 open_id，或通过邮箱解析自动绑定" /></Form.Item>
      <Form.Item name="email" label="邮箱"><Input placeholder="用于批量解析飞书 open_id" /></Form.Item>
      <Form.Item name="role_ids" label="角色"><Select mode="multiple" allowClear options={roleOptions} /></Form.Item>
      {!mobileLayout ? <Button type="primary" htmlType="submit">新增人员</Button> : null}
    </Form>
  );
  return (
    <PageShell
      title="人员"
      subtitle="预设员工姓名、部门、角色和邮箱；实际登录后绑定 open_id"
      extra={mobileLayout ? <Button type="primary" onClick={() => setCreateOpen(true)}>新增人员</Button> : null}
    >
      {!mobileLayout ? <Card title="新增预设人员" className="mb16 admin-form-card">{createFormContent}</Card> : (
        <Input.Search value={searchText} onChange={(event) => setSearchText(event.target.value)} allowClear placeholder="搜索人员姓名" className="mb16" />
      )}
      <Card className="business-card">
        {mobileLayout ? (
          <div className="mobile-people-list">
            <div>{renderTableHeader('人员列表', filteredPeople.length, '维护部门、角色、邮箱和飞书绑定状态')}</div>
            {filteredPeople.map((person) => (
              <div className="mobile-person-card" key={person.id}>
                <div className="mobile-board-card-head">
                  <Typography.Title level={5}>{person.name}</Typography.Title>
                  <StatusTag value={person.status} />
                </div>
                <div className="mobile-task-meta compact">
                  <span>部门</span><Typography.Text>{person.department || '未分配'}</Typography.Text>
                  <span>角色</span><div><Space wrap size={[4, 4]}>{(person.roles || []).map((role: AnyRecord) => <Tag className="role-tag" key={role.id}>{role.name}</Tag>)}</Space></div>
                  <span>飞书绑定</span><div>{renderBindingStatus(person.open_id)}</div>
                  <span>邮箱</span><Typography.Text className="mobile-break-text">{person.email || '未录入'}</Typography.Text>
                  <span>来源</span><Typography.Text>{person.source || '-'}</Typography.Text>
                </div>
                <Button onClick={() => openEdit(person)}>编辑人员</Button>
              </div>
            ))}
          </div>
        ) : <Table
          rowKey="id"
          dataSource={data || []}
          className="business-table"
          tableLayout="fixed"
          scroll={{ x: 900 }}
          title={() => renderTableHeader('人员列表', data?.length || 0, '维护部门、角色、邮箱和飞书绑定状态')}
          columns={[
            { title: '姓名', dataIndex: 'name', width: 110, ellipsis: true, render: renderEllipsis },
            { title: '部门', dataIndex: 'department', width: 140, ellipsis: true, render: renderEllipsis },
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
        />}
      </Card>
      {mobileLayout ? <Modal className="mobile-form-modal" title="新增人员" open={createOpen} onOk={submitCreatePerson} onCancel={() => setCreateOpen(false)} destroyOnClose>
        {createFormContent}
      </Modal> : null}
      <Modal className={mobileLayout ? 'mobile-form-modal' : undefined} title="编辑人员" open={Boolean(editing)} onOk={saveEdit} onCancel={() => setEditing(null)} destroyOnClose>
        <Form form={editForm} layout="vertical">
          <Form.Item name="name" label="姓名" rules={[{ required: true, message: '请输入姓名' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="department_id" label="部门">
            <Select allowClear options={departmentOptions} />
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

function DepartmentManagement() {
  const mobileLayout = useIsMobileLayout();
  const { data, reload, loading } = useApi<AnyRecord[]>('/departments/manage', []);
  const [form] = Form.useForm();
  const [editing, setEditing] = useState<AnyRecord | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const departments = data || [];
  const referenceLabels: Record<string, string> = {
    users: '人员',
    parent_tasks: '母任务',
    department_tasks: '部门任务',
    department_task_departments: '部门任务多部门关联',
    child_departments: '子部门'
  };
  const referenceSummary = (department: AnyRecord) => {
    const counts = department.reference_counts || {};
    const items = Object.entries(referenceLabels)
      .map(([key, label]) => ({ key, label, count: Number(counts[key] || 0) }))
      .filter((item) => item.count > 0);
    return items.length ? items.map((item) => `${item.label} ${item.count} 项`).join('，') : '无引用';
  };
  const openCreate = () => {
    setEditing(null);
    form.resetFields();
    setModalOpen(true);
  };
  const openEdit = (department: AnyRecord) => {
    setEditing(department);
    form.setFieldsValue({ name: department.name });
    setModalOpen(true);
  };
  const submitDepartment = async () => {
    const values = await form.validateFields();
    if (editing) {
      await putJson(`/departments/${editing.id}`, values);
      message.success('部门已更新');
    } else {
      await postJson('/departments', values);
      message.success('部门已新增');
    }
    setModalOpen(false);
    setEditing(null);
    form.resetFields();
    await reload();
  };
  const deleteDepartment = (department: AnyRecord) => {
    if (!department.can_delete) {
      message.warning(`该部门仍有引用，不能删除：${referenceSummary(department)}`);
      return;
    }
    Modal.confirm({
      title: `确认删除部门“${department.name}”？`,
      content: '删除后该部门会从所有部门选择器中移除。该操作只允许无任何引用的错字或误建部门使用。',
      okText: '确认删除',
      cancelText: '取消',
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await deleteJson(`/departments/${department.id}`);
          message.success('部门已删除');
          await reload();
        } catch (error: any) {
          const detail = error?.response?.data?.detail;
          const reasons = Array.isArray(detail?.delete_blocking_reasons) ? detail.delete_blocking_reasons.join('，') : '';
          message.error(reasons ? `该部门仍有引用，不能删除：${reasons}` : '部门删除失败');
          throw error;
        }
      }
    });
  };
  const columns: ColumnsType<AnyRecord> = [
    { title: '部门名称', dataIndex: 'name', width: 220, ellipsis: true, render: renderEllipsis },
    { title: '状态', dataIndex: 'status', width: 100, render: (value) => <Tag>{value || '-'}</Tag> },
    { title: '引用情况', width: 340, render: (_, row) => renderEllipsis(referenceSummary(row)) },
    {
      title: '是否可删除',
      dataIndex: 'can_delete',
      width: 120,
      render: (value) => value ? <Tag color="green">可删除</Tag> : <Tag color="orange">有引用</Tag>
    },
    {
      title: '操作',
      width: 180,
      render: (_, row) => (
        <Space>
          <Button size="small" onClick={() => openEdit(row)}>编辑</Button>
          <Tooltip title={row.can_delete ? '删除无引用部门' : `请先清理引用：${referenceSummary(row)}`}>
            <Button size="small" danger disabled={!row.can_delete} onClick={() => deleteDepartment(row)}>删除</Button>
          </Tooltip>
        </Space>
      )
    }
  ];
  return (
    <PageShell
      title="部门管理"
      subtitle="维护部门基础数据；只有无任何引用的部门可以删除"
      extra={<Button type="primary" onClick={openCreate}>新增部门</Button>}
    >
      <Alert
        type="info"
        showIcon
        className="mb16"
        message="改名会同步影响任务和人员中显示的部门名称；删除只用于处理误创建或错字部门。"
      />
      <Card className="business-card">
        {mobileLayout ? (
          <div className="mobile-people-list">
            <div>{renderTableHeader('部门列表', departments.length, '查看引用情况并维护部门名称')}</div>
            {departments.map((department) => (
              <div className="mobile-person-card" key={department.id}>
                <div className="mobile-board-card-head">
                  <Typography.Title level={5}>{department.name}</Typography.Title>
                  {department.can_delete ? <Tag color="green">可删除</Tag> : <Tag color="orange">有引用</Tag>}
                </div>
                <div className="mobile-task-meta compact">
                  <span>状态</span><Typography.Text>{department.status || '-'}</Typography.Text>
                  <span>引用情况</span><Typography.Text>{referenceSummary(department)}</Typography.Text>
                </div>
                <Space className="full-width mobile-action-stack" direction="vertical">
                  <Button onClick={() => openEdit(department)}>编辑部门</Button>
                  <Button danger disabled={!department.can_delete} onClick={() => deleteDepartment(department)}>删除部门</Button>
                </Space>
              </div>
            ))}
          </div>
        ) : (
          <Table
            rowKey="id"
            dataSource={departments}
            loading={loading}
            className="business-table"
            tableLayout="fixed"
            scroll={{ x: 960 }}
            title={() => renderTableHeader('部门列表', departments.length, '查看引用情况并维护部门名称')}
            columns={columns}
          />
        )}
      </Card>
      <Modal
        className={mobileLayout ? 'mobile-form-modal' : undefined}
        title={editing ? '编辑部门' : '新增部门'}
        open={modalOpen}
        onOk={submitDepartment}
        onCancel={() => {
          setModalOpen(false);
          setEditing(null);
        }}
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="部门名称" rules={[{ required: true, message: '请输入部门名称' }]}>
            <Input maxLength={120} placeholder="例如：产品运营中心" />
          </Form.Item>
        </Form>
      </Modal>
    </PageShell>
  );
}

function BaseSync() {
  const mobileLayout = useIsMobileLayout();
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
  const executeImport = async () => {
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
  const runImport = () => {
    let confirmationText = '';
    Modal.confirm({
      title: '确认清空并导入 Base 数据？',
      content: (
        <Space direction="vertical" className="full-width">
          <Alert type="error" showIcon message="该操作会清空现有业务任务数据，无法通过页面撤销。" />
          <Typography.Text>请输入“清空并导入”后继续：</Typography.Text>
          <Input onChange={(event) => { confirmationText = event.target.value; }} placeholder="清空并导入" />
        </Space>
      ),
      okText: '确认清空并导入',
      cancelText: '取消',
      okButtonProps: { danger: true },
      onOk: async () => {
        if (confirmationText !== '清空并导入') {
          message.error('确认文字不正确');
          throw new Error('confirmation mismatch');
        }
        await executeImport();
      }
    });
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
        <Space direction={mobileLayout ? 'vertical' : 'horizontal'} className={mobileLayout ? 'full-width mobile-action-stack' : undefined}>
          <Button onClick={runPreview} loading={loading}>预览 Base</Button>
          <Button type="primary" danger onClick={runImport} loading={loading}>清空并导入</Button>
        </Space>
        {preview && (
          <div className="json-panel">
            <Typography.Title level={5}>预览结果</Typography.Title>
            {!preview.ok && <Alert type="warning" showIcon message={preview.message || 'Base CLI 暂不可用'} className="mb16" />}
            <pre className="mobile-json-output">{JSON.stringify(preview, null, 2)}</pre>
          </div>
        )}
        {result && (
          <div className="json-panel">
            <Typography.Title level={5}>导入结果</Typography.Title>
            {!result.ok && <Alert type="warning" showIcon message={result.message || '导入被阻塞'} className="mb16" />}
            <pre className="mobile-json-output">{JSON.stringify(result, null, 2)}</pre>
          </div>
        )}
      </Card>
    </PageShell>
  );
}

function Permissions() {
  const mobileLayout = useIsMobileLayout();
  const { data, reload } = useApi<AnyRecord>('/permissions', []);
  const permissions = data?.permissions || [];
  const matrix = data?.matrix || [];
  const [draftPermissions, setDraftPermissions] = useState<Record<number, string[]>>({});
  useEffect(() => {
    setDraftPermissions(Object.fromEntries(matrix.map((role: AnyRecord) => [role.role_id, role.permission_codes || []])));
  }, [JSON.stringify(matrix)]);
  const updateRole = async (roleId: number, values: string[]) => {
    const role = matrix.find((item: AnyRecord) => item.role_id === roleId);
    Modal.confirm({
      title: `确认更新“${role?.role_name || '角色'}”权限？`,
      content: '权限变更会立即影响该角色人员可见页面和可执行操作，请确认勾选结果无误。',
      okText: '确认保存',
      cancelText: '取消',
      okButtonProps: { danger: true },
      onOk: async () => {
        await putJson('/permissions/matrix', { role_id: roleId, permission_codes: values });
        message.success('权限矩阵已更新');
        await reload();
      }
    });
  };
  return (
    <PageShell title="角色权限" subtitle="角色动作矩阵可配置，并叠加任务关系权限">
      <Row gutter={[16, 16]} className="mb16">
        {matrix.map((role: AnyRecord) => (
          <Col xs={24} lg={12} xl={8} key={role.role_id}>
            <Card title={role.role_name}>
              <Checkbox.Group
                className="permission-grid"
                value={draftPermissions[role.role_id] || []}
                options={permissions.map((item: AnyRecord) => ({ value: item.code, label: item.name }))}
                onChange={(values) => setDraftPermissions((current) => ({ ...current, [role.role_id]: values as string[] }))}
              />
              <Button
                type="primary"
                className={mobileLayout ? 'full-width mt16' : 'mt16'}
                disabled={JSON.stringify([...(draftPermissions[role.role_id] || [])].sort()) === JSON.stringify([...(role.permission_codes || [])].sort())}
                onClick={() => updateRole(role.role_id, draftPermissions[role.role_id] || [])}
              >
                保存权限
              </Button>
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
