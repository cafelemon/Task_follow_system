import { Alert, Form, Input, Modal, Select, Space, Typography, message } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import { getJson, postJson } from '../../api/client';
import type { AnyRecord } from '../../api/client';

const CATEGORY_DEPARTMENT_TASK = 'department_task_supplement';
const CATEGORY_CROSS_DEPARTMENT = 'cross_department_collaboration';

type WorkItemSubmitModalProps = {
  open: boolean;
  mobile?: boolean;
  onCancel: () => void;
  onSubmitted?: (item: AnyRecord) => void;
};

function departmentTaskLabel(task: AnyRecord) {
  const code = task.code || '-';
  const title = task.title || '-';
  const parent = task.parent_task_title ? ` / ${task.parent_task_title}` : '';
  return `${code} ${title}${parent}`;
}

export function WorkItemSubmitModal({ open, mobile, onCancel, onSubmitted }: WorkItemSubmitModalProps) {
  const [form] = Form.useForm();
  const [options, setOptions] = useState<AnyRecord | null>(null);
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [detectedMobile, setDetectedMobile] = useState(false);
  const category = Form.useWatch('category', form);

  const loadOptions = async () => {
    setLoadingOptions(true);
    try {
      setOptions(await getJson<AnyRecord>('/work-items/options'));
    } catch {
      message.error('待归类事项选项加载失败，请稍后重试');
    } finally {
      setLoadingOptions(false);
    }
  };

  useEffect(() => {
    if (open) {
      loadOptions();
    }
  }, [open]);

  useEffect(() => {
    const query = window.matchMedia('(max-width: 900px)');
    const update = () => setDetectedMobile(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    form.setFieldsValue({
      related_department_task_id: undefined,
      collaboration_department_id: undefined
    });
  }, [category, form]);

  const categoryOptions = useMemo(() => (options?.categories || []).map((item: AnyRecord) => ({
    label: item.value === CATEGORY_DEPARTMENT_TASK && options?.can_attach_department_task === false
      ? `${item.label}（需先补充所属部门）`
      : item.label,
    value: item.value,
    disabled: item.value === CATEGORY_DEPARTMENT_TASK && options?.can_attach_department_task === false
  })), [options]);

  const departmentTaskOptions = useMemo(() => (options?.department_tasks || []).map((task: AnyRecord) => ({
    label: departmentTaskLabel(task),
    value: task.id
  })), [options]);

  const collaborationDepartmentOptions = useMemo(() => (options?.collaboration_departments || []).map((department: AnyRecord) => ({
    label: department.name,
    value: department.id
  })), [options]);

  const submit = async () => {
    const values = await form.validateFields();
    setSubmitting(true);
    try {
      const item = await postJson('/work-items', values);
      message.success('待归类事项已提交，等待后续确认');
      form.resetFields();
      onSubmitted?.(item);
    } catch (error: any) {
      message.error(error?.response?.data?.detail || '待归类事项提交失败');
    } finally {
      setSubmitting(false);
    }
  };

  const close = () => {
    form.resetFields();
    onCancel();
  };

  return (
    <Modal
      className={(mobile ?? detectedMobile) ? 'mobile-form-modal' : undefined}
      title="提交待归类事项"
      open={open}
      onOk={submit}
      onCancel={close}
      okText="提交"
      cancelText="取消"
      confirmLoading={submitting}
      destroyOnClose
    >
      <Space direction="vertical" size={12} className="full-width">
        <Alert
          type="info"
          showIcon
          message="待归类事项不会直接进入正式任务统计。"
          description="提交后先进入待确认状态，后续由责任链判断是否挂入任务树、作为常态化工作或仅进入周报材料。"
        />
        <Form form={form} layout="vertical" disabled={loadingOptions || submitting}>
          <Form.Item
            name="content"
            label="事项内容"
            rules={[
              { required: true, whitespace: true, message: '请填写事项内容' },
              { max: 2000, message: '事项内容不能超过 2000 字' }
            ]}
          >
            <Input.TextArea rows={5} placeholder="简要写清楚这件临时或补充工作的背景、结果或当前需要处理的问题" />
          </Form.Item>
          <Form.Item name="category" label="归类方式" rules={[{ required: true, message: '请选择归类方式' }]}>
            <Select
              placeholder="请选择归类方式"
              options={categoryOptions}
              loading={loadingOptions}
            />
          </Form.Item>
          {options?.can_attach_department_task === false ? (
            <Alert type="warning" showIcon message="当前账号没有所属部门，暂不能选择“挂载已有部门任务”。" />
          ) : null}
          {category === CATEGORY_DEPARTMENT_TASK ? (
            options?.can_attach_department_task ? (
              <Form.Item
                name="related_department_task_id"
                label="本人所属部门的部门任务"
                rules={[{ required: true, message: '请选择本人所属部门的部门任务' }]}
              >
                <Select
                  showSearch
                  placeholder="请选择部门任务"
                  optionFilterProp="label"
                  options={departmentTaskOptions}
                  loading={loadingOptions}
                  notFoundContent="当前所属部门暂无可挂载部门任务"
                />
              </Form.Item>
            ) : (
              <Alert type="warning" showIcon message="当前账号没有所属部门，暂不能选择部门任务挂载。" />
            )
          ) : null}
          {category === CATEGORY_CROSS_DEPARTMENT ? (
            <Form.Item
              name="collaboration_department_id"
              label="协作部门"
              rules={[{ required: true, message: '请选择协作部门' }]}
            >
              <Select
                showSearch
                placeholder="请选择协作部门"
                optionFilterProp="label"
                options={collaborationDepartmentOptions}
                loading={loadingOptions}
              />
            </Form.Item>
          ) : null}
        </Form>
        <Typography.Text type="secondary">
          提交后可在工作台“待归类事项”查看状态；责任人可在待确认列表中处理。
        </Typography.Text>
      </Space>
    </Modal>
  );
}
