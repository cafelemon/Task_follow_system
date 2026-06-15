import { Alert, Button, Card, DatePicker, Empty, Form, Input, Modal, Select, Space, Tabs, Tag, Typography, message } from 'antd';
import { useEffect, useState } from 'react';
import { getJson, postJson } from '../../api/client';
import type { AnyRecord } from '../../api/client';

const statusColors: Record<string, string> = {
  pending: 'blue',
  withdrawn: 'default',
  approved: 'green',
  rejected: 'red',
  closed: 'default',
  converted_to_sub_task: 'purple',
  escalated_department_task: 'orange',
  escalated_parent_task: 'volcano'
};

type ActionType = 'reject' | 'close';

const crossDepartmentSideLabels: Record<string, string> = {
  submitter_department: '提交部门',
  collaboration_department: '协作部门'
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

function userOptions(users: AnyRecord[]) {
  return users.map((item) => ({
    value: item.id,
    label: item.department ? `${item.name}（${item.department}）` : item.name
  }));
}

function latestEvent(item: AnyRecord) {
  const events = item.events || [];
  return events.length ? events[events.length - 1] : null;
}

function approvalText(approved: boolean, user?: AnyRecord | null, at?: string | null) {
  if (!approved) return '待确认';
  const name = user?.name || '-';
  return `${name} / ${formatDateTime(at)}`;
}

function WorkItemCard({
  item,
  onWithdraw,
  onApprove,
  onReject,
  onClose,
  onConvert,
  onCrossApprove,
  onEscalate
}: {
  item: AnyRecord;
  onWithdraw?: (item: AnyRecord) => void;
  onApprove?: (item: AnyRecord) => void;
  onReject?: (item: AnyRecord) => void;
  onClose?: (item: AnyRecord) => void;
  onConvert?: (item: AnyRecord) => void;
  onCrossApprove?: (item: AnyRecord) => void;
  onEscalate?: (item: AnyRecord) => void;
}) {
  const event = latestEvent(item);
  const crossApproval = item.cross_department_approval;
  const isConverted = item.status === 'converted_to_sub_task';
  const isEscalated = item.status === 'escalated_department_task' || item.status === 'escalated_parent_task';
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
          {item.withdrawn_at ? (
            <>
              <span>撤回时间</span><Typography.Text>{formatDateTime(item.withdrawn_at)}</Typography.Text>
            </>
          ) : null}
          {item.converted_sub_task ? (
            <>
              <span>转子任务</span><Typography.Text>{`${item.converted_sub_task.code || '-'} ${item.converted_sub_task.title || '-'}`}</Typography.Text>
            </>
          ) : null}
          {item.converted_at ? (
            <>
              <span>转换时间</span><Typography.Text>{formatDateTime(item.converted_at)}</Typography.Text>
            </>
          ) : null}
          {item.escalated_by ? (
            <>
              <span>上提人</span><Typography.Text>{item.escalated_by.name || '-'}</Typography.Text>
            </>
          ) : null}
          {item.escalated_at ? (
            <>
              <span>上提时间</span><Typography.Text>{formatDateTime(item.escalated_at)}</Typography.Text>
            </>
          ) : null}
          {item.escalation_comment ? (
            <>
              <span>诉求说明</span><Typography.Text>{item.escalation_comment}</Typography.Text>
            </>
          ) : null}
        </div>
        {crossApproval ? (
          <div className="mobile-task-meta compact">
            <span>提交部门</span><Typography.Text>{crossApproval.submitter_department?.name || '-'}</Typography.Text>
            <span>提交部门确认</span>
            <Typography.Text>
              {approvalText(
                crossApproval.submitter_department_approved,
                crossApproval.submitter_department_approved_by,
                crossApproval.submitter_department_approved_at
              )}
            </Typography.Text>
            <span>协作部门</span><Typography.Text>{crossApproval.collaboration_department?.name || '-'}</Typography.Text>
            <span>协作部门确认</span>
            <Typography.Text>
              {approvalText(
                crossApproval.collaboration_department_approved,
                crossApproval.collaboration_department_approved_by,
                crossApproval.collaboration_department_approved_at
              )}
            </Typography.Text>
          </div>
        ) : null}
        {crossApproval?.blocker ? (
          <Alert type="warning" showIcon message={crossApproval.blocker} />
        ) : null}
        {event && event.action !== 'created' ? (
          <Alert
            type={event.action === 'rejected' ? 'warning' : event.action === 'closed' ? 'info' : 'success'}
            showIcon
            message={`${event.action_label || event.action}：${event.actor?.name || '-'}`}
            description={event.comment || '无补充说明'}
          />
        ) : null}
        {isConverted ? (
          <Alert type="success" showIcon message="已转为正式子任务，后续进展请通过正式子任务周更新跟踪。" />
        ) : null}
        {isEscalated ? (
          <Alert type="info" showIcon message="该诉求已进入 4.5.x 的部门负责人/总经办会议工作台深化范围，本页只做追溯展示。" />
        ) : null}
        {item.can_withdraw ? (
          <Button danger onClick={() => onWithdraw?.(item)}>撤回</Button>
        ) : null}
        {(item.can_approve || item.can_reject || item.can_close || item.can_convert_to_sub_task || item.can_cross_department_approve || item.can_escalate) ? (
          <Space wrap className="work-item-actions">
            {item.can_approve ? <Button type="primary" onClick={() => onApprove?.(item)}>同意</Button> : null}
            {item.can_cross_department_approve ? <Button type="primary" onClick={() => onCrossApprove?.(item)}>确认协作</Button> : null}
            {item.can_reject ? <Button danger onClick={() => onReject?.(item)}>退回</Button> : null}
            {item.can_close ? <Button onClick={() => onClose?.(item)}>关闭</Button> : null}
            {item.can_convert_to_sub_task ? <Button onClick={() => onConvert?.(item)}>转子任务</Button> : null}
            {item.can_escalate ? <Button onClick={() => onEscalate?.(item)}>上提诉求</Button> : null}
          </Space>
        ) : null}
        {item.category === 'cross_department_collaboration' && item.status === 'pending' ? (
          <Alert type="info" showIcon message="跨部门协作需提交部门和协作部门双方确认；任一方退回或关闭后流程结束。" />
        ) : null}
      </Space>
    </div>
  );
}

export function WorkItemPanel({ refreshKey = 0 }: { refreshKey?: number }) {
  const [submitted, setSubmitted] = useState<AnyRecord[]>([]);
  const [received, setReceived] = useState<AnyRecord[]>([]);
  const [departmentRoutine, setDepartmentRoutine] = useState<AnyRecord[]>([]);
  const [canViewDepartmentRoutine, setCanViewDepartmentRoutine] = useState(false);
  const [departmentEscalations, setDepartmentEscalations] = useState<AnyRecord[]>([]);
  const [canViewDepartmentEscalations, setCanViewDepartmentEscalations] = useState(false);
  const [parentEscalations, setParentEscalations] = useState<AnyRecord[]>([]);
  const [canViewParentEscalations, setCanViewParentEscalations] = useState(false);
  const [loading, setLoading] = useState(false);
  const [actionForm] = Form.useForm();
  const [actionType, setActionType] = useState<ActionType | null>(null);
  const [actionTarget, setActionTarget] = useState<AnyRecord | null>(null);
  const [actionSubmitting, setActionSubmitting] = useState(false);
  const [detectedMobile, setDetectedMobile] = useState(false);
  const [convertForm] = Form.useForm();
  const [convertTarget, setConvertTarget] = useState<AnyRecord | null>(null);
  const [users, setUsers] = useState<AnyRecord[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [converting, setConverting] = useState(false);
  const [crossForm] = Form.useForm();
  const [crossTarget, setCrossTarget] = useState<AnyRecord | null>(null);
  const [crossApproving, setCrossApproving] = useState(false);
  const [escalateForm] = Form.useForm();
  const [escalateTarget, setEscalateTarget] = useState<AnyRecord | null>(null);
  const [escalating, setEscalating] = useState(false);

  const reload = async () => {
    setLoading(true);
    try {
      const [submittedItems, receivedItems] = await Promise.all([
        getJson<AnyRecord[]>('/work-items?scope=submitted'),
        getJson<AnyRecord[]>('/work-items?scope=received')
      ]);
      setSubmitted(submittedItems);
      setReceived(receivedItems);
      try {
        const routineItems = await getJson<AnyRecord[]>('/work-items?scope=department-routine');
        setDepartmentRoutine(routineItems);
        setCanViewDepartmentRoutine(true);
      } catch (error: any) {
        setDepartmentRoutine([]);
        setCanViewDepartmentRoutine(false);
        if (error?.response?.status !== 403) {
          message.warning('本部门常态化记录加载失败，请刷新重试');
        }
      }
      try {
        const escalationItems = await getJson<AnyRecord[]>('/work-items?scope=department-escalations');
        setDepartmentEscalations(escalationItems);
        setCanViewDepartmentEscalations(true);
      } catch (error: any) {
        setDepartmentEscalations([]);
        setCanViewDepartmentEscalations(false);
        if (error?.response?.status !== 403) {
          message.warning('缺部门任务诉求加载失败，请刷新重试');
        }
      }
      try {
        const escalationItems = await getJson<AnyRecord[]>('/work-items?scope=parent-escalations');
        setParentEscalations(escalationItems);
        setCanViewParentEscalations(true);
      } catch (error: any) {
        setParentEscalations([]);
        setCanViewParentEscalations(false);
        if (error?.response?.status !== 403) {
          message.warning('缺母任务诉求加载失败，请刷新重试');
        }
      }
    } catch {
      message.error('待归类事项加载失败，请刷新重试');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    reload();
  }, [refreshKey]);

  useEffect(() => {
    const query = window.matchMedia('(max-width: 900px)');
    const update = () => setDetectedMobile(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

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

  const approve = (item: AnyRecord) => {
    Modal.confirm({
      title: '同意该待归类事项？',
      content: '同意后该事项进入当前归类记录；未转成正式任务前仍不进入会议看板正式任务统计。',
      okText: '确认同意',
      cancelText: '取消',
      onOk: async () => {
        try {
          await postJson(`/work-items/${item.id}/approve`, {});
          message.success('已同意');
          await reload();
        } catch (error: any) {
          message.error(error?.response?.data?.detail || '处理失败');
        }
      }
    });
  };

  const openActionModal = (item: AnyRecord, type: ActionType) => {
    actionForm.resetFields();
    setActionTarget(item);
    setActionType(type);
  };

  const openConvertModal = async (item: AnyRecord) => {
    setConvertTarget(item);
    convertForm.resetFields();
    convertForm.setFieldsValue({
      title: item.content,
      executor_ids: item.submitter_id ? [item.submitter_id] : undefined,
      comment: undefined,
      due_date: null
    });
    if (!users.length) {
      setLoadingUsers(true);
      try {
        setUsers(await getJson<AnyRecord[]>('/user-options'));
      } catch {
        message.error('人员选项加载失败，请刷新重试');
      } finally {
        setLoadingUsers(false);
      }
    }
  };

  const openCrossApproveModal = (item: AnyRecord) => {
    const sides = item.cross_department_approval_sides || [];
    crossForm.resetFields();
    crossForm.setFieldsValue({
      side: sides.length === 1 ? sides[0] : undefined,
      comment: undefined
    });
    setCrossTarget(item);
  };

  const openEscalateModal = (item: AnyRecord) => {
    escalateForm.resetFields();
    escalateForm.setFieldsValue({ target: 'department_task', comment: undefined });
    setEscalateTarget(item);
  };

  const submitConvert = async () => {
    if (!convertTarget) return;
    const values = await convertForm.validateFields();
    setConverting(true);
    try {
      await postJson(`/work-items/${convertTarget.id}/convert-to-sub-task`, {
        title: values.title,
        executor_ids: values.executor_ids,
        due_date: values.due_date ? values.due_date.format('YYYY-MM-DD') : null,
        comment: values.comment
      });
      message.success('已转为正式子任务');
      setConvertTarget(null);
      await reload();
    } catch (error: any) {
      message.error(error?.response?.data?.detail || '转子任务失败');
    } finally {
      setConverting(false);
    }
  };

  const submitCrossApprove = async () => {
    if (!crossTarget) return;
    const values = await crossForm.validateFields();
    setCrossApproving(true);
    try {
      await postJson(`/work-items/${crossTarget.id}/cross-department-approve`, {
        side: values.side,
        comment: values.comment
      });
      message.success('已确认跨部门协作');
      setCrossTarget(null);
      await reload();
    } catch (error: any) {
      message.error(error?.response?.data?.detail || '确认协作失败');
    } finally {
      setCrossApproving(false);
    }
  };

  const submitEscalate = async () => {
    if (!escalateTarget) return;
    const values = await escalateForm.validateFields();
    setEscalating(true);
    try {
      await postJson(`/work-items/${escalateTarget.id}/escalate`, {
        target: values.target,
        comment: values.comment
      });
      message.success(values.target === 'parent_task' ? '已上提缺母任务诉求' : '已上提缺部门任务诉求');
      setEscalateTarget(null);
      await reload();
    } catch (error: any) {
      message.error(error?.response?.data?.detail || '上提诉求失败');
    } finally {
      setEscalating(false);
    }
  };

  const submitAction = async () => {
    if (!actionTarget || !actionType) return;
    const values = await actionForm.validateFields();
    setActionSubmitting(true);
    try {
      await postJson(`/work-items/${actionTarget.id}/${actionType}`, { comment: values.comment });
      message.success(actionType === 'reject' ? '已退回' : '已关闭');
      setActionTarget(null);
      setActionType(null);
      await reload();
    } catch (error: any) {
      message.error(error?.response?.data?.detail || '处理失败');
    } finally {
      setActionSubmitting(false);
    }
  };

  const actionTitle = actionType === 'reject' ? '退回待归类事项' : '关闭待归类事项';
  const actionLabel = actionType === 'reject' ? '退回原因' : '关闭说明';

  return (
    <Card className="business-card workbench-section-card">
      <div className="workbench-section-head">
        <div>
          <Typography.Title level={4}>待归类事项</Typography.Title>
          <Typography.Text type="secondary">按当前身份叠加展示你的提交、待处理事项、部门记录和任务缺口诉求；未转成正式任务前不进入会议看板正式任务统计。</Typography.Text>
        </div>
        <Button onClick={reload} loading={loading}>刷新</Button>
      </div>
      <Alert
        type="info"
        showIcon
        message="处理口径"
        description="待我处理只展示当前仍需你处理的事项；已处理记录保留在我的提交、本部门常态化或诉求视图中。缺任务诉求只形成追溯和会议候选，不会自动创建任务。"
      />
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
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无已提交待归类事项；临时或补充工作可从上方入口登记。" />
            )
          },
          {
            key: 'received',
            label: `待我处理 ${received.length}`,
            children: received.length ? (
              <div className="work-item-list">
                {received.map((item) => (
                  <WorkItemCard
                    key={item.id}
                    item={item}
                    onApprove={approve}
                    onReject={(target) => openActionModal(target, 'reject')}
                    onClose={(target) => openActionModal(target, 'close')}
                    onConvert={openConvertModal}
                    onCrossApprove={openCrossApproveModal}
                    onEscalate={openEscalateModal}
                  />
                ))}
              </div>
            ) : (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无当前需要你处理的事项；已处理记录可在对应视图或我的提交中追溯。" />
            )
          },
          ...(canViewDepartmentRoutine ? [
            {
              key: 'department-routine',
              label: `本部门常态化 ${departmentRoutine.length}`,
              children: departmentRoutine.length ? (
                <div className="work-item-list">
                  {departmentRoutine.map((item) => (
                    <WorkItemCard
                      key={item.id}
                      item={item}
                      onApprove={approve}
                      onReject={(target) => openActionModal(target, 'reject')}
                      onClose={(target) => openActionModal(target, 'close')}
                      onCrossApprove={openCrossApproveModal}
                      onEscalate={openEscalateModal}
                    />
                  ))}
                </div>
              ) : (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="本部门暂无常态化事项记录；同意后的常态化工作会在这里留痕。" />
              )
            }
          ] : []),
          ...(canViewDepartmentEscalations ? [
            {
              key: 'department-escalations',
              label: `缺部门任务诉求 ${departmentEscalations.length}`,
              children: departmentEscalations.length ? (
                <Space direction="vertical" size={10} className="full-width">
                  <Alert type="info" showIcon message="缺部门任务诉求将在 4.5.x 进入部门负责人工作台深化处理，本版只追溯诉求来源和上提说明。" />
                  <div className="work-item-list">
                    {departmentEscalations.map((item) => <WorkItemCard key={item.id} item={item} />)}
                  </div>
                </Space>
              ) : (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无缺部门任务诉求；后续由 4.5.x 深化部门负责人处理闭环。" />
              )
            }
          ] : []),
          ...(canViewParentEscalations ? [
            {
              key: 'parent-escalations',
              label: `缺母任务诉求 ${parentEscalations.length}`,
              children: parentEscalations.length ? (
                <Space direction="vertical" size={10} className="full-width">
                  <Alert type="info" showIcon message="缺母任务诉求将在 4.5.x 进入总经办会议工作台深化处理，本版只追溯诉求来源和上提说明。" />
                  <div className="work-item-list">
                    {parentEscalations.map((item) => <WorkItemCard key={item.id} item={item} />)}
                  </div>
                </Space>
              ) : (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无缺母任务诉求；后续由 4.5.x 深化总经办会议处理闭环。" />
              )
            }
          ] : [])
        ]}
      />
      <Modal
        className={detectedMobile ? 'mobile-form-modal' : undefined}
        title={actionTitle}
        open={Boolean(actionTarget && actionType)}
        onOk={submitAction}
        onCancel={() => {
          setActionTarget(null);
          setActionType(null);
        }}
        confirmLoading={actionSubmitting}
        okText={actionType === 'reject' ? '确认退回' : '确认关闭'}
        cancelText="取消"
        destroyOnClose
      >
        <Form form={actionForm} layout="vertical">
          <Form.Item
            name="comment"
            label={actionLabel}
            rules={[
              { required: true, whitespace: true, message: `请填写${actionLabel}` },
              { max: 1000, message: `${actionLabel}不能超过 1000 字` }
            ]}
          >
            <Input.TextArea rows={4} placeholder={actionType === 'reject' ? '说明退回原因，便于提交人修改或重新归类' : '说明关闭原因，该事项不会进入后续周报草稿'} />
          </Form.Item>
        </Form>
      </Modal>
      <Modal
        className={detectedMobile ? 'mobile-form-modal' : undefined}
        title="转为正式子任务"
        open={Boolean(convertTarget)}
        onOk={submitConvert}
        onCancel={() => setConvertTarget(null)}
        confirmLoading={converting}
        okText="确认转子任务"
        cancelText="取消"
        destroyOnClose
      >
        <Space direction="vertical" size={12} className="full-width">
          <Alert
            type="info"
            showIcon
            message="转成正式子任务后，该事项不再进入待归类周报草稿。"
            description="后续进展将通过新建子任务的周更新进入正式任务链路。"
          />
          <Form form={convertForm} layout="vertical">
            <Form.Item
              name="title"
              label="子任务标题"
              rules={[
                { required: true, whitespace: true, message: '请填写子任务标题' },
                { max: 500, message: '子任务标题不能超过 500 字' }
              ]}
            >
              <Input.TextArea rows={3} placeholder="请压缩为适合跟踪的子任务标题" />
            </Form.Item>
            <Form.Item
              name="executor_ids"
              label="执行人"
              rules={[{ required: true, message: '请选择执行人' }]}
            >
              <Select
                mode="multiple"
                showSearch
                placeholder="请选择执行人"
                optionFilterProp="label"
                options={userOptions(users)}
                loading={loadingUsers}
              />
            </Form.Item>
            <Form.Item name="due_date" label="截止日期">
              <DatePicker className="full-width" />
            </Form.Item>
            <Form.Item
              name="comment"
              label="转换说明"
              rules={[{ max: 1000, message: '转换说明不能超过 1000 字' }]}
            >
              <Input.TextArea rows={3} placeholder="可补充说明为何转为正式子任务" />
            </Form.Item>
          </Form>
        </Space>
      </Modal>
      <Modal
        className={detectedMobile ? 'mobile-form-modal' : undefined}
        title="确认跨部门协作"
        open={Boolean(crossTarget)}
        onOk={submitCrossApprove}
        onCancel={() => setCrossTarget(null)}
        confirmLoading={crossApproving}
        okText="确认协作"
        cancelText="取消"
        destroyOnClose
      >
        <Space direction="vertical" size={12} className="full-width">
          <Alert
            type="info"
            showIcon
            message="双方都确认后，该事项才会进入已确认状态。"
            description="确认后的跨部门事项进入提交人周报材料，但不会进入正式任务树和进度统计。"
          />
          <Form form={crossForm} layout="vertical">
            {(crossTarget?.cross_department_approval_sides || []).length > 1 ? (
              <Form.Item
                name="side"
                label="确认侧"
                rules={[{ required: true, message: '请选择确认侧' }]}
              >
                <Select
                  placeholder="请选择确认侧"
                  options={(crossTarget?.cross_department_approval_sides || []).map((side: string) => ({
                    value: side,
                    label: crossDepartmentSideLabels[side] || side
                  }))}
                />
              </Form.Item>
            ) : null}
            <Form.Item
              name="comment"
              label="确认说明"
              rules={[{ max: 1000, message: '确认说明不能超过 1000 字' }]}
            >
              <Input.TextArea rows={3} placeholder="可补充协作内容、边界或确认依据" />
            </Form.Item>
          </Form>
        </Space>
      </Modal>
      <Modal
        className={detectedMobile ? 'mobile-form-modal' : undefined}
        title="上提任务诉求"
        open={Boolean(escalateTarget)}
        onOk={submitEscalate}
        onCancel={() => setEscalateTarget(null)}
        confirmLoading={escalating}
        okText="确认上提"
        cancelText="取消"
        destroyOnClose
      >
        <Space direction="vertical" size={12} className="full-width">
          <Alert
            type="info"
            showIcon
            message="上提只形成诉求和追溯记录，不会自动创建部门任务或母任务。"
            description="缺部门任务进入部门负责人工作台；缺母任务进入总经办/秘书工作台作为会议议题候选。"
          />
          <Form form={escalateForm} layout="vertical">
            <Form.Item
              name="target"
              label="诉求类型"
              rules={[{ required: true, message: '请选择诉求类型' }]}
            >
              <Select
                options={[
                  { value: 'department_task', label: '缺部门任务' },
                  { value: 'parent_task', label: '缺母任务' }
                ]}
              />
            </Form.Item>
            <Form.Item
              name="comment"
              label="上提说明"
              rules={[
                { required: true, whitespace: true, message: '请填写上提说明' },
                { max: 1000, message: '上提说明不能超过 1000 字' }
              ]}
            >
              <Input.TextArea rows={4} placeholder="说明为什么当前任务树无法承接，以及建议由谁继续判断" />
            </Form.Item>
          </Form>
        </Space>
      </Modal>
    </Card>
  );
}
