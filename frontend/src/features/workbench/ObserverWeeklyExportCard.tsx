import { DownloadOutlined } from '@ant-design/icons';
import { Button, Card, Input, Space, Typography } from 'antd';
import { useMemo, useState } from 'react';

function currentMonthValue() {
  const now = new Date();
  const month = `${now.getMonth() + 1}`.padStart(2, '0');
  return `${now.getFullYear()}-${month}`;
}

export function ObserverWeeklyExportCard() {
  const defaultMonth = useMemo(() => currentMonthValue(), []);
  const [month, setMonth] = useState(defaultMonth);

  const handleExport = () => {
    const targetMonth = month || defaultMonth;
    window.location.href = `/api/weekly-reports/monthly-export?month=${encodeURIComponent(targetMonth)}`;
  };

  return (
    <Card className="business-card workbench-role-card observer-export-card">
      <Space direction="vertical" size={14} className="full-width">
        <div className="workbench-role-card-head">
          <div>
            <Typography.Text type="secondary">观察者</Typography.Text>
            <Typography.Title level={4}>月度周报导出</Typography.Title>
            <Typography.Text type="secondary">
              按月份导出 active 人员周报材料；已确认周报优先，未确认周次以草稿标记。
            </Typography.Text>
          </div>
        </div>
        <div className="observer-export-controls">
          <Input
            type="month"
            value={month}
            onChange={(event) => setMonth(event.target.value)}
            aria-label="选择导出月份"
          />
          <Button type="primary" icon={<DownloadOutlined />} onClick={handleExport}>
            导出 Excel
          </Button>
        </div>
      </Space>
    </Card>
  );
}
