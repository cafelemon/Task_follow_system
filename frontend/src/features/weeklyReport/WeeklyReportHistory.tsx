import { Button, Card, Empty, Space, Tag, Typography } from 'antd';
import type { AnyRecord } from '../../api/client';

type WeeklyReportHistoryProps = {
  reports: AnyRecord[];
  loading?: boolean;
  onOpen: (report: AnyRecord) => void;
  onCopy: (report: AnyRecord) => void;
};

export function WeeklyReportHistory({ reports, loading, onOpen, onCopy }: WeeklyReportHistoryProps) {
  return (
    <Card className="business-card weekly-report-section-card" loading={loading}>
      <div className="weekly-report-section-head">
        <div>
          <Typography.Title level={4}>历史周报</Typography.Title>
          <Typography.Text type="secondary">已确认周报形成快照，后续任务或事项变化不影响这里的内容。</Typography.Text>
        </div>
        <Tag>{reports.length}</Tag>
      </div>
      {reports.length ? (
        <div className="weekly-report-list">
          {reports.map((report) => {
            const summary = report.summary || {};
            const riskCount = Number(summary.risk_text_count || 0) + Number(summary.risk_item_count || 0);
            return (
              <div className="weekly-report-item-card" key={report.id}>
                <Space direction="vertical" size={10} className="full-width">
                  <div className="weekly-report-card-head">
                    <div>
                      <Typography.Title level={5}>{report.week_key}</Typography.Title>
                      <Typography.Text type="secondary">
                        确认时间：{report.confirmed_at ? String(report.confirmed_at).slice(0, 16).replace('T', ' ') : '-'}
                      </Typography.Text>
                    </div>
                    <Tag color="green">{report.status_label || report.status}</Tag>
                  </div>
                  <Space wrap size={[6, 6]}>
                    <Tag>正式任务 {summary.task_update_count || 0}</Tag>
                    <Tag>待归类 {summary.work_item_count || 0}</Tag>
                    <Tag>风险卡点 {riskCount}</Tag>
                    <Tag>下周计划 {summary.next_plan_count || 0}</Tag>
                  </Space>
                  <Space wrap className="weekly-report-history-actions">
                    <Button size="small" onClick={() => onOpen(report)}>查看详情</Button>
                    <Button size="small" onClick={() => onCopy(report)}>复制文本</Button>
                  </Space>
                </Space>
              </div>
            );
          })}
        </div>
      ) : (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无已确认周报；确认本周周报后会形成历史快照。" />
      )}
    </Card>
  );
}
