import { Tag } from 'antd';

const map: Record<string, { color: string; text: string }> = {
  active: { color: 'blue', text: '启用' },
  in_progress: { color: 'blue', text: '进行中' },
  pending_update: { color: 'orange', text: '待开启' },
  pending_split: { color: 'orange', text: '待拆解' },
  missing_update: { color: 'orange', text: '待更新' },
  not_started: { color: 'default', text: '待开启' },
  updated: { color: 'green', text: '已更新' },
  draft: { color: 'orange', text: '草稿' },
  submitted: { color: 'green', text: '已提交' },
  completed: { color: 'green', text: '已完成' },
  risk: { color: 'red', text: '存在风险' },
  blocked: { color: 'orange', text: '等待中' },
  high: { color: 'red', text: '高风险' },
  medium: { color: 'orange', text: '中风险' },
  low: { color: 'green', text: '低风险' },
  none: { color: 'default', text: '无风险' }
};

export function StatusTag({ value }: { value?: string }) {
  const config = map[value || ''] || { color: 'default', text: value || '-' };
  return <Tag color={config.color}>{config.text}</Tag>;
}
