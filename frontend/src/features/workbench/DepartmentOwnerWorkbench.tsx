import { Alert, Card, Col, Empty, Row, Space, Statistic, Tag, Typography } from 'antd';
import {
  ApartmentOutlined,
  ExclamationCircleOutlined,
  FolderOpenOutlined,
  ScheduleOutlined
} from '@ant-design/icons';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { AnyRecord } from '../../api/client';
import { StatusTag } from '../../components/StatusTag';
import { renderPeople } from '../../ui/taskDisplay';

function itemTitle(item: AnyRecord) {
  return item.title || item.content || '-';
}

function itemCode(item: AnyRecord) {
  return item.code || item.department_task_code || item.sub_task_code || '';
}

function DepartmentOwnerItemCard({
  item,
  meta,
  to,
  actionLabel = '查看'
}: {
  item: AnyRecord;
  meta?: ReactNode;
  to?: string;
  actionLabel?: string;
}) {
  return (
    <div className="workbench-task-card">
      <Space direction="vertical" size={10} className="full-width">
        <div className="workbench-task-card-head">
          <div>
            {itemCode(item) ? <Typography.Text className="task-code">{itemCode(item)}</Typography.Text> : null}
            <Typography.Title level={5}>{itemTitle(item)}</Typography.Title>
          </div>
          {item.status ? <StatusTag value={item.status} /> : item.status_label ? <Tag>{item.status_label}</Tag> : null}
        </div>
        {meta}
        {to ? (
          <Space wrap className="workbench-task-actions">
            <Link className="mobile-primary-link" to={to}>{actionLabel}</Link>
          </Space>
        ) : null}
      </Space>
    </div>
  );
}

function DepartmentOwnerSection({
  title,
  description,
  items,
  emptyText,
  renderItem
}: {
  title: string;
  description: string;
  items: AnyRecord[];
  emptyText: string;
  renderItem: (item: AnyRecord) => ReactNode;
}) {
  return (
    <Card className="business-card workbench-section-card">
      <div className="workbench-section-head">
        <div>
          <Typography.Title level={4}>{title}</Typography.Title>
          <Typography.Text type="secondary">{description}</Typography.Text>
        </div>
        <Tag>{items.length}</Tag>
      </div>
      {items.length ? (
        <div className="workbench-task-list">{items.map((item) => renderItem(item))}</div>
      ) : (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={emptyText} />
      )}
    </Card>
  );
}

const MATERIAL_STATUS_LABELS: Record<string, string> = {
  pending: '待确认',
  approved: '已确认',
  rejected: '已退回',
  closed: '已关闭',
  converted_to_sub_task: '已转子任务'
};

function statusCount(category: AnyRecord, status: string) {
  return Number((category.status_counts || {})[status] || 0);
}

function WorkItemMaterialCard({ item }: { item: AnyRecord }) {
  const isCrossDepartment = item.category === 'cross_department_collaboration';
  return (
    <div className="workbench-task-card">
      <Space direction="vertical" size={10} className="full-width">
        <div className="workbench-task-card-head">
          <div>
            <Typography.Text className="task-code">{item.category_label || '待归类事项'}</Typography.Text>
            <Typography.Title level={5}>{item.content || '-'}</Typography.Title>
          </div>
          <Tag>{item.status_label || MATERIAL_STATUS_LABELS[String(item.status)] || item.status || '-'}</Tag>
        </div>
        <div className="mobile-task-meta compact">
          <span>提交人</span><Typography.Text>{item.submitter?.name || '-'}</Typography.Text>
          <span>提交部门</span><Typography.Text>{item.department?.name || '-'}</Typography.Text>
          <span>关联部门任务</span><Typography.Text>{item.related_department_task?.title || '-'}</Typography.Text>
          <span>协作部门</span><Typography.Text>{item.collaboration_department?.name || '-'}</Typography.Text>
          {isCrossDepartment ? (
            <>
              <span>双确认</span>
              <Typography.Text>
                {item.cross_department_approval?.submitter_department_approved ? '提交部门已确认' : '提交部门待确认'} / {item.cross_department_approval?.collaboration_department_approved ? '协作部门已确认' : '协作部门待确认'}
              </Typography.Text>
            </>
          ) : null}
          <span>提交时间</span><Typography.Text>{item.created_at ? String(item.created_at).slice(0, 10) : '-'}</Typography.Text>
        </div>
      </Space>
    </div>
  );
}

function DepartmentWorkItemMaterials({ materials }: { materials?: AnyRecord | null }) {
  const categories = materials?.categories || [];
  const summary = materials?.summary || {};
  if (!categories.length) {
    return (
      <Card className="business-card workbench-section-card">
        <div className="workbench-section-head">
          <div>
            <Typography.Title level={4}>本周周报材料统计</Typography.Title>
            <Typography.Text type="secondary">按四类待归类事项统计本部门本周补充材料，不进入正式任务统计。</Typography.Text>
          </div>
          <Tag>{materials?.week_key || '-'}</Tag>
        </div>
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="本周暂无待归类事项材料。" />
      </Card>
    );
  }
  return (
    <Card className="business-card workbench-section-card">
      <Space direction="vertical" size={16} className="full-width">
        <div className="workbench-section-head">
          <div>
            <Typography.Title level={4}>本周周报材料统计</Typography.Title>
            <Typography.Text type="secondary">
              只统计部门任务补充、本部门常态化、跨部门协作和周报补充四类事项，服务部门周报材料查看。
            </Typography.Text>
          </div>
          <Tag color="blue">{materials?.week_key || '-'}</Tag>
        </div>
        <Row gutter={[12, 12]}>
          <Col xs={12} md={4}><Card className="workbench-metric-card"><Statistic title="本周材料" value={summary.total || 0} /></Card></Col>
          <Col xs={12} md={4}><Card className="workbench-metric-card"><Statistic title="待确认" value={summary.pending || 0} /></Card></Col>
          <Col xs={12} md={4}><Card className="workbench-metric-card"><Statistic title="已确认" value={summary.approved || 0} /></Card></Col>
          <Col xs={12} md={4}><Card className="workbench-metric-card"><Statistic title="已退回" value={summary.rejected || 0} /></Card></Col>
          <Col xs={12} md={4}><Card className="workbench-metric-card"><Statistic title="已关闭" value={summary.closed || 0} /></Card></Col>
          <Col xs={12} md={4}><Card className="workbench-metric-card"><Statistic title="已转子任务" value={summary.converted_to_sub_task || 0} /></Card></Col>
        </Row>
        <Row gutter={[12, 12]}>
          {categories.map((category: AnyRecord) => (
            <Col xs={24} md={12} xl={6} key={category.category}>
              <Card className="workbench-metric-card">
                <Space direction="vertical" size={8} className="full-width">
                  <div className="workbench-task-card-head">
                    <Typography.Title level={5}>{category.category_label || '-'}</Typography.Title>
                    <Tag>{category.total || 0}</Tag>
                  </div>
                  <Space wrap size={6}>
                    <Tag>待确认 {statusCount(category, 'pending')}</Tag>
                    <Tag color="green">已确认 {statusCount(category, 'approved')}</Tag>
                    <Tag color="red">退回/关闭 {statusCount(category, 'rejected') + statusCount(category, 'closed')}</Tag>
                    {statusCount(category, 'converted_to_sub_task') ? <Tag color="blue">转子任务 {statusCount(category, 'converted_to_sub_task')}</Tag> : null}
                  </Space>
                  {category.category === 'cross_department_collaboration' ? (
                    <Typography.Text type="secondary">
                      本部门提交 {category.submitted_by_department_count || 0} / 协作到本部门 {category.collaboration_to_department_count || 0}
                    </Typography.Text>
                  ) : null}
                </Space>
              </Card>
            </Col>
          ))}
        </Row>
        {categories.map((category: AnyRecord) => (
          <div key={`${category.category}-items`}>
            <div className="workbench-section-head compact">
              <div>
                <Typography.Title level={5}>{category.category_label || '-'}</Typography.Title>
                <Typography.Text type="secondary">最近记录，完整处理仍在待归类事项区完成。</Typography.Text>
              </div>
              <Tag>{category.items?.length || 0}</Tag>
            </div>
            {category.items?.length ? (
              <div className="workbench-task-list">
                {category.items.map((item: AnyRecord) => <WorkItemMaterialCard key={item.id} item={item} />)}
              </div>
            ) : (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={`本周暂无${category.category_label || '该类'}记录。`} />
            )}
          </div>
        ))}
      </Space>
    </Card>
  );
}

export function DepartmentOwnerWorkbench({ data }: { data: AnyRecord | null }) {
  if (!data?.can_view) {
    return null;
  }
  const summary = data.summary || {};
  const departmentName = data.department?.name || '本部门';
  return (
    <Card className="business-card department-owner-workbench-card">
      <Space direction="vertical" size={16} className="full-width">
        <div className="workbench-section-head">
          <div>
            <Typography.Text type="secondary">部门负责人模块</Typography.Text>
            <Typography.Title level={3}>{departmentName} 工作台</Typography.Title>
            <Typography.Text type="secondary">
              聚合本部门任务、未更新、风险逾期、部门任务补充记录和本周周报材料统计；本模块只读展示，不新增处理动作。
            </Typography.Text>
          </div>
          <Tag color="blue">统计周次 {data.week_key || '-'}</Tag>
        </div>
        <Row gutter={[12, 12]}>
          <Col xs={12} md={4}><Card className="workbench-metric-card"><Statistic title="牵头母任务" value={summary.parent_task_count || 0} prefix={<FolderOpenOutlined />} /></Card></Col>
          <Col xs={12} md={4}><Card className="workbench-metric-card"><Statistic title="相关部门任务" value={summary.department_task_count || 0} prefix={<ApartmentOutlined />} /></Card></Col>
          <Col xs={12} md={4}><Card className="workbench-metric-card"><Statistic title="待拆任务" value={summary.pending_split_count || 0} /></Card></Col>
          <Col xs={12} md={4}><Card className="workbench-metric-card"><Statistic title="未更新" value={summary.unsubmitted_count || 0} prefix={<ScheduleOutlined />} /></Card></Col>
          <Col xs={12} md={4}><Card className="workbench-metric-card"><Statistic title="风险/逾期" value={(summary.risk_count || 0) + (summary.overdue_count || 0)} prefix={<ExclamationCircleOutlined />} /></Card></Col>
          <Col xs={12} md={4}><Card className="workbench-metric-card"><Statistic title="补充记录" value={summary.department_task_supplement_count || 0} /></Card></Col>
          <Col xs={12} md={4}><Card className="workbench-metric-card"><Statistic title="本周材料" value={summary.work_item_material_count || 0} /></Card></Col>
        </Row>
        <Alert
          type="info"
          showIcon
          message="本模块当前聚焦查看和追溯"
          description="部门任务补充记录由既有同意、退回、关闭和转子任务动作形成；本模块本身不会直接改变任务或待归类事项状态。"
        />
        <DepartmentWorkItemMaterials materials={data.work_item_materials} />
        <DepartmentOwnerSection
          title="本部门牵头母任务"
          description="牵头部门为本部门的母任务，用于查看公司级任务承接情况。"
          items={data.leading_parent_tasks || []}
          emptyText="当前没有本部门牵头母任务。"
          renderItem={(item) => (
            <DepartmentOwnerItemCard
              key={item.id}
              item={item}
              to={`/parent-tasks/${item.id}`}
              actionLabel="查看母任务"
              meta={
                <div className="mobile-task-meta compact">
                  <span>负责人</span><div>{renderPeople(item.owners || item.owner)}</div>
                  <span>截止日期</span><Typography.Text>{item.due_date || '-'}</Typography.Text>
                  <span>进度</span><Typography.Text>{item.progress ?? 0}%</Typography.Text>
                </div>
              }
            />
          )}
        />
        <DepartmentOwnerSection
          title="待拆部门任务"
          description="待拆数量大于 0 或尚无有效子任务的部门任务。"
          items={data.pending_split_department_tasks || []}
          emptyText="当前没有待拆部门任务。"
          renderItem={(item) => (
            <DepartmentOwnerItemCard
              key={item.id}
              item={item}
              to="/department-tasks"
              actionLabel="进入部门任务"
              meta={
                <div className="mobile-task-meta compact">
                  <span>所属母任务</span><Typography.Text>{item.parent_task_title || item.parent_task || '-'}</Typography.Text>
                  <span>任务负责人</span><div>{renderPeople(item.owners || item.owner)}</div>
                  <span>待拆数量</span><Typography.Text>{item.pending_split_count || 0}</Typography.Text>
                </div>
              }
            />
          )}
        />
        <DepartmentOwnerSection
          title="本周未更新"
          description="本部门相关子任务中，本周仍缺正式提交的执行人。"
          items={data.unsubmitted_sub_tasks || []}
          emptyText="当前没有本周未更新子任务。"
          renderItem={(item) => (
            <DepartmentOwnerItemCard
              key={item.id}
              item={item}
              to="/sub-tasks"
              actionLabel="进入子任务执行"
              meta={
                <div className="mobile-task-meta compact">
                  <span>部门任务</span><Typography.Text>{item.department_task_title || '-'}</Typography.Text>
                  <span>缺更新人员</span><div>{renderPeople(item.missing_assignees || [])}</div>
                  <span>截止日期</span><Typography.Text>{item.due_date || '-'}</Typography.Text>
                </div>
              }
            />
          )}
        />
        <DepartmentOwnerSection
          title="风险与逾期"
          description="开放/处理中的风险项，以及已经逾期的未完成子任务。"
          items={[...(data.risk_items || []), ...(data.overdue_sub_tasks || [])]}
          emptyText="当前没有风险或逾期事项。"
          renderItem={(item) => (
            <DepartmentOwnerItemCard
              key={`${item.issue_type || 'overdue'}-${item.id}`}
              item={item}
              to="/meeting-board/overview#risk-overdue"
              actionLabel="查看会议看板"
              meta={
                <div className="mobile-task-meta compact">
                  <span>类型</span><Typography.Text>{item.issue_type || '子任务逾期'}</Typography.Text>
                  <span>部门任务</span><Typography.Text>{item.department_task_title || item.department_task || '-'}</Typography.Text>
                  <span>责任人</span><Typography.Text>{item.owner || item.executor || '-'}</Typography.Text>
                </div>
              }
            />
          )}
        />
        <DepartmentOwnerSection
          title="部门任务补充记录"
          description="员工挂载到本部门相关部门任务的补充事项，包含待确认、已确认、已转子任务等状态。"
          items={data.department_task_supplements || []}
          emptyText="当前没有部门任务补充记录。"
          renderItem={(item) => (
            <DepartmentOwnerItemCard
              key={item.id}
              item={item}
              to="/department-tasks"
              actionLabel="进入部门任务"
              meta={
                <div className="mobile-task-meta compact">
                  <span>部门任务</span><Typography.Text>{item.related_department_task?.title || '-'}</Typography.Text>
                  <span>提交人</span><Typography.Text>{item.submitter?.name || '-'}</Typography.Text>
                  <span>状态</span><Typography.Text>{item.status_label || '-'}</Typography.Text>
                  <span>关联子任务</span><Typography.Text>{item.converted_sub_task ? `${item.converted_sub_task.code || '-'} ${item.converted_sub_task.title || '-'}` : '-'}</Typography.Text>
                </div>
              }
            />
          )}
        />
        <DepartmentOwnerSection
          title="本部门常态化"
          description="本部门人员提交并进入处理流的常态化记录。"
          items={data.department_routine_items || []}
          emptyText="本部门暂无常态化事项记录。"
          renderItem={(item) => (
            <DepartmentOwnerItemCard
              key={item.id}
              item={item}
              to="#work-items"
              actionLabel="查看待归类事项区"
              meta={
                <div className="mobile-task-meta compact">
                  <span>提交人</span><Typography.Text>{item.submitter?.name || '-'}</Typography.Text>
                  <span>状态</span><Typography.Text>{item.status_label || '-'}</Typography.Text>
                  <span>提交时间</span><Typography.Text>{item.created_at ? String(item.created_at).slice(0, 10) : '-'}</Typography.Text>
                </div>
              }
            />
          )}
        />
      </Space>
    </Card>
  );
}
