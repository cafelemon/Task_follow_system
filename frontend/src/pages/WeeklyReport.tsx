import { Alert, Button, Card, Modal, Space, Typography, message } from 'antd';
import { useEffect, useState } from 'react';
import { getJson, postJson } from '../api/client';
import type { AnyRecord } from '../api/client';
import { PageShell } from '../components/PageShell';
import { WeeklyReportDraft } from '../features/weeklyReport/WeeklyReportDraft';
import { WeeklyReportHistory } from '../features/weeklyReport/WeeklyReportHistory';

export function WeeklyReport() {
  const [draft, setDraft] = useState<AnyRecord | null>(null);
  const [reports, setReports] = useState<AnyRecord[]>([]);
  const [selectedReport, setSelectedReport] = useState<AnyRecord | null>(null);
  const [copyText, setCopyText] = useState('');
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState(false);

  const reload = async () => {
    setLoading(true);
    setError(false);
    try {
      const [draftPayload, historyPayload] = await Promise.all([
        getJson<AnyRecord>('/weekly-reports/draft'),
        getJson<AnyRecord[]>('/weekly-reports/history')
      ]);
      setDraft(draftPayload);
      setReports(historyPayload);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  const openReport = async (report: AnyRecord) => {
    setDetailLoading(true);
    try {
      setSelectedReport(await getJson<AnyRecord>(`/weekly-reports/${report.id}`));
    } catch {
      message.error('历史周报详情加载失败，请刷新重试');
    } finally {
      setDetailLoading(false);
    }
  };

  const copyReport = async (report: AnyRecord) => {
    try {
      const result = await getJson<AnyRecord>(`/weekly-reports/${report.id}/copy-text`);
      const text = result.text || '';
      try {
        await navigator.clipboard.writeText(text);
        message.success('周报文本已复制');
      } catch {
        message.warning('浏览器未允许自动复制，请在弹窗中手动复制');
        setCopyText(text);
      }
    } catch {
      message.error('复制文本生成失败，请刷新周报历史后重试');
    }
  };

  const confirmReport = () => {
    if (!draft?.week_key) return;
    Modal.confirm({
      title: `确认 ${draft.week_key} 周报？`,
      content: '确认后形成历史快照，后续任务或待归类事项变化不会自动改变本次记录；如同一周再次确认，会用当前草稿覆盖本周快照。',
      okText: '确认周报',
      cancelText: '取消',
      onOk: async () => {
        setConfirming(true);
        try {
          const report = await postJson<AnyRecord>('/weekly-reports/confirm', { week_key: draft.week_key });
          message.success('周报已确认');
          setSelectedReport(report);
          await reload();
        } catch {
          message.error('周报确认失败，请刷新重试');
        } finally {
          setConfirming(false);
        }
      }
    });
  };

  useEffect(() => {
    reload();
  }, []);

  const confirmedReport = reports.find((item) => item.week_key === draft?.week_key);

  return (
    <PageShell
      title="周报中心"
      subtitle="聚合本人周报材料；这里不处理他人待归类事项，责任人处理从 4.4.0 开始"
      extra={<Button onClick={reload} loading={loading}>刷新</Button>}
    >
      <Space direction="vertical" size={16} className="full-width">
        <Card className="business-card">
          <div className="weekly-report-current-head">
            <Space direction="vertical" size={6} className="full-width">
              <Typography.Text type="secondary">当前草稿</Typography.Text>
              <Typography.Title level={3} style={{ margin: 0 }}>
                {draft?.user?.name || '-'} / {draft?.week_key || '-'}
              </Typography.Title>
              <Typography.Text type="secondary">
                生成时间：{draft?.generated_at ? String(draft.generated_at).slice(0, 16).replace('T', ' ') : '-'}
              </Typography.Text>
              {confirmedReport ? (
                <Typography.Text type="secondary">
                  本周已确认：{confirmedReport.confirmed_at ? String(confirmedReport.confirmed_at).slice(0, 16).replace('T', ' ') : '-'}
                </Typography.Text>
              ) : null}
            </Space>
            <Space wrap className="weekly-report-actions">
              <Button type="primary" onClick={confirmReport} loading={confirming} disabled={!draft}>确认本周周报</Button>
              <Button onClick={() => confirmedReport ? copyReport(confirmedReport) : message.warning('请先确认本周周报后再复制文本')}>
                复制周报文本
              </Button>
            </Space>
          </div>
        </Card>
        <Alert
          type="info"
          showIcon
          message="周报快照说明"
          description="确认后的历史快照不会随任务或事项变化自动改变；如需要修正，同一周再次确认会覆盖本周快照。"
        />
        {error ? <Alert type="warning" showIcon message="周报草稿加载失败，请刷新重试。" /> : null}
        {draft ? (
          <WeeklyReportDraft draft={draft} />
        ) : (
          <Card className="business-card" loading={loading}>
            <Typography.Text type="secondary">正在生成周报草稿...</Typography.Text>
          </Card>
        )}
        <WeeklyReportHistory reports={reports} loading={loading} onOpen={openReport} onCopy={copyReport} />
        <Modal
          open={Boolean(selectedReport)}
          title={selectedReport ? `${selectedReport.week_key} 历史周报` : '历史周报'}
          footer={[
            <Button key="copy" onClick={() => selectedReport && copyReport(selectedReport)}>复制文本</Button>,
            <Button key="close" type="primary" onClick={() => setSelectedReport(null)}>关闭</Button>
          ]}
          width={960}
          onCancel={() => setSelectedReport(null)}
          className="weekly-report-detail-modal"
        >
          {detailLoading ? (
            <Card loading />
          ) : selectedReport ? (
            <WeeklyReportDraft draft={selectedReport} />
          ) : null}
        </Modal>
        <Modal
          open={Boolean(copyText)}
          title="复制周报文本"
          okText="关闭"
          cancelButtonProps={{ style: { display: 'none' } }}
          onOk={() => setCopyText('')}
          onCancel={() => setCopyText('')}
        >
          <Typography.Paragraph type="secondary">浏览器未允许自动复制，请手动复制以下内容。</Typography.Paragraph>
          <Typography.Paragraph className="weekly-report-copy-text" copyable>{copyText}</Typography.Paragraph>
        </Modal>
      </Space>
    </PageShell>
  );
}
