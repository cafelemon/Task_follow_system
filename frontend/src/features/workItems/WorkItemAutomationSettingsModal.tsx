import { Alert, Button, Modal, Space, Switch, Typography, message } from 'antd';
import { useEffect, useState } from 'react';
import { getJson, putJson } from '../../api/client';
import type { AnyRecord } from '../../api/client';

type Props = {
  open: boolean;
  onClose: () => void;
};

export function WorkItemAutomationSettingsModal({ open, onClose }: Props) {
  const [settings, setSettings] = useState<AnyRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const payload = await getJson<AnyRecord>('/work-items/automation-settings');
      setSettings(payload.settings || []);
    } catch (error: any) {
      message.error(error?.response?.data?.detail || '审批与通知设置加载失败');
      onClose();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      load();
    }
  }, [open]);

  const updateSetting = (category: string, field: 'notify_enabled' | 'auto_approve_enabled', value: boolean) => {
    setSettings((current) => current.map((item) => (
      item.category === category ? { ...item, [field]: value } : item
    )));
  };

  const save = async () => {
    setSaving(true);
    try {
      const payload = await putJson<AnyRecord>('/work-items/automation-settings', {
        settings: settings.map((item) => ({
          category: item.category,
          notify_enabled: Boolean(item.notify_enabled),
          auto_approve_enabled: Boolean(item.auto_approve_enabled),
        }))
      });
      setSettings(payload.settings || []);
      message.success('审批与通知设置已保存');
      onClose();
    } catch (error: any) {
      message.error(error?.response?.data?.detail || '设置保存失败');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title="审批与通知设置"
      open={open}
      onCancel={onClose}
      onOk={save}
      confirmLoading={saving}
      okText="保存设置"
      cancelText="取消"
      destroyOnClose
      className="mobile-form-modal"
      width={720}
    >
      <Space direction="vertical" size={12} className="full-width">
        <Alert
          type="info"
          showIcon
          message="这些设置只对你本人负责范围内的待归类事项生效，默认全部关闭。"
          description="飞书通知仍受系统级通知总开关、open_id 和白名单规则约束；个人开启不会绕过生产暂停。"
        />
        {loading ? (
          <Typography.Text type="secondary">正在加载设置...</Typography.Text>
        ) : (
          <div className="work-item-settings-list">
            {settings.map((item) => (
              <div className="work-item-settings-row" key={item.category}>
                <div>
                  <Typography.Text strong>{item.category_label || item.category}</Typography.Text>
                  {item.category === 'cross_department_collaboration' ? (
                    <Typography.Paragraph type="secondary">
                      跨部门协作需要两侧分别自动或人工确认后，才会最终变为已确认。
                    </Typography.Paragraph>
                  ) : null}
                </div>
                <Space className="work-item-settings-switches" wrap>
                  <span>飞书通知</span>
                  <Switch
                    checked={Boolean(item.notify_enabled)}
                    onChange={(checked) => updateSetting(item.category, 'notify_enabled', checked)}
                  />
                  <span>自动同意</span>
                  <Switch
                    checked={Boolean(item.auto_approve_enabled)}
                    onChange={(checked) => updateSetting(item.category, 'auto_approve_enabled', checked)}
                  />
                </Space>
              </div>
            ))}
          </div>
        )}
        <Button onClick={load} loading={loading}>重新加载</Button>
      </Space>
    </Modal>
  );
}
