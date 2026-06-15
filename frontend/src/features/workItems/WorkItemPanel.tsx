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
  converted_to_sub_task: 'purple'
};

type ActionType = 'reject' | 'close';

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

function WorkItemCard({
  item,
  onWithdraw,
  onApprove,
  onReject,
  onClose,
  onConvert
}: {
  item: AnyRecord;
  onWithdraw?: (item: AnyRecord) => void;
  onApprove?: (item: AnyRecord) => void;
  onReject?: (item: AnyRecord) => void;
  onClose?: (item: AnyRecord) => void;
  onConvert?: (item: AnyRecord) => void;
}) {
  const event = latestEvent(item);
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
          <span>转子任务</span><Typography.Text>{item.converted_sub_task ? `${item.converted_sub_task.code || '-'} ${item.converted_sub_task.title || '-'}` : '-'}</Typography.Text>
          <span>转换时间</span><Typography.Text>{formatDateTime(item.converted_at)}</Typography.Text>
        </div>
        {event && event.action !== 'created' ? (
          <Alert
            type={event.action === 'rejected' ? 'warning' : event.action === 'closed' ? 'info' : 'success'}
            showIcon
            message={`${event.action_label || event.action}：${event.actor?.name || '-'}`}
            description={event.comment || '无补充说明'}
          />
        ) : null}
        {item.can_withdraw ? (
          <Button danger onClick={() => onWithdraw?.(item)}>撤回</Button>
        ) : null}
        {(item.can_approve || item.can_reject || item.can_close || item.can_convert_to_sub_task) ? (
          <Space wrap className="work-item-actions">
            {item.can_approve ? <Button type="primary" onClick={() => onApprove?.(item)}>同意</Button> : null}
            {item.can_reject ? <Button danger onClick={() => onReject?.(item)}>退回</Button> : null}
            {item.can_close ? <Button onClick={() => onClose?.(item)}>关闭</Button> : null}
            {item.can_convert_to_sub_task ? <Button onClick={() => onConvert?.(item)}>转子任务</Button> : null}
          </Space>
        ) : null}
        {item.category === 'cross_department_collaboration' && item.status === 'pending' ? (
          <Alert type="info" showIcon message="跨部门协作的同意将在 4.4.4 双确认中开放，本版可退回或关闭。" />
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
          <Typography.Text type="secondary">提交的临时和补充事项先进入待确认，不进入正式任务统计；责任人可同意、退回、关闭或转为正式子任务。</Typography.Text>
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
                  />
                ))}
              </div>
            ) : (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无待你处理的事项。" />
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
                    />
                  ))}
                </div>
              ) : (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="本部门暂无常态化事项记录。" />
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
    </Card>
  );
}
