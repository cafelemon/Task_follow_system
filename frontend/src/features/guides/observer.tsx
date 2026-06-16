import type { GuideBuildContext, GuideSteps } from './types';

export function buildObserverSteps({ refs }: GuideBuildContext): Record<string, GuideSteps> {
  const { brandRef, menuRef, contentRef, headerMetaRef, guideButtonRef } = refs;
  return {
    observer_framework: [
      {
        title: '只读审阅与材料导出',
        description: '观察者用于公司级任务推进的只读审阅、过程追溯和人事周报材料导出，重点关注任务推进质量、风险、逾期和历史证据。',
        target: () => brandRef.current || document.body
      },
      {
        title: '工作台按身份展示入口',
        description: '工作台会按本人角色叠加展示入口。观察者可看到月度周报 Excel 导出；如果本人兼任执行人或负责人，也会看到对应处理入口。',
        target: () => menuRef.current || document.body
      },
      {
        title: '会议看板用于全局审阅',
        description: '会议看板用于查看总览异常、风险逾期、未更新、部门差异和任务下钻明细，是管理审阅的主入口。',
        target: () => contentRef.current || document.body
      },
      {
        title: '沿任务层级追溯过程',
        description: '任务从母任务、部门任务到子任务逐级拆解。观察者可沿层级下钻，并通过历史时间线查看周更新、附件和处理痕迹。',
        target: () => contentRef.current || document.body
      },
      {
        title: '月度导出服务人事材料',
        description: '观察者可在工作台按月份导出 Excel。系统优先使用已确认周报，未确认周次会使用实时草稿并标记为未确认。',
        target: () => headerMetaRef.current || document.body
      },
      {
        title: '保持只读边界和多身份边界',
        description: '观察者身份不新增、拆分、编辑或代填任务；如果同时也是任务负责人或执行人，对应事项按该身份处理。',
        target: () => guideButtonRef.current || document.body
      }
    ],
    observer_meeting_board: [
      {
        title: '先看总览异常',
        description: '会议看板先用于判断总体推进是否健康，优先识别未更新、风险、逾期和推进异常。',
        target: () => document.querySelector('#meeting-guide-metrics') as HTMLElement || contentRef.current || document.body
      },
      {
        title: '风险和逾期优先审阅',
        description: '风险、逾期和高风险事项需要优先下钻，核对来源任务、责任人、处理状态和截止日期。',
        target: () => document.querySelector('#meeting-guide-tabs') as HTMLElement || contentRef.current || document.body
      },
      {
        title: '判断本周更新完整度',
        description: '本周更新情况和待更新人员用于判断数据是否完整，避免基于不充分信息做审阅判断。',
        target: () => document.querySelector('#meeting-guide-weekly') as HTMLElement || contentRef.current || document.body
      },
      {
        title: '比较部门差异',
        description: '部门横向对比用于识别推进压力集中、更新不稳定或风险较多的部门，再进入明细核对。',
        target: () => document.querySelector('#meeting-guide-risk') as HTMLElement || contentRef.current || document.body
      },
      {
        title: '下钻查看证据',
        description: '从总览进入母任务、部门任务、子任务和历史时间线，查看周更新、附件、风险和处理痕迹。',
        target: () => document.querySelector('#meeting-guide-trend') as HTMLElement || contentRef.current || document.body
      },
      {
        title: '建议审阅顺序',
        description: '建议按“总览异常、风险逾期、未更新、部门差异、下钻明细、会后跟进”的顺序审阅。',
        target: () => document.querySelector('#meeting-guide-deadline') as HTMLElement || contentRef.current || document.body
      }
    ],
    observer_parent_tasks: [
      {
        title: '追溯公司级母任务',
        description: '母任务管理用于只读查看公司级任务、牵头部门、负责人、截止日期和当前状态。',
        target: () => document.querySelector('#department-owner-parent-list') as HTMLElement || contentRef.current || document.body
      },
      {
        title: '从任务卡进入详情',
        description: '进入详情后可查看该母任务下的部门任务拆解、子任务推进、周更新和补充材料脉络。',
        target: () => document.querySelector('#department-owner-parent-cards') as HTMLElement || contentRef.current || document.body
      },
      {
        title: '沿层级追溯责任',
        description: '重点关注牵头部门、任务负责人、负责部门、执行人和截止日期是否清晰，便于追溯到具体责任层级。',
        target: () => contentRef.current || document.body
      },
      {
        title: '保持只读审阅',
        description: '观察者不在这里新增、拆分或编辑任务；如本人另有部门负责人职责，请按对应身份进入相应入口处理。',
        target: () => contentRef.current || document.body
      }
    ],
    observer_department_tasks: [
      {
        title: '查看部门承接情况',
        description: '部门任务用于查看各部门承接、任务负责人、截止日期、状态、子任务拆解和补充记录。',
        target: () => document.querySelector('#department-owner-department-task-table') as HTMLElement || contentRef.current || document.body
      },
      {
        title: '展开查看子任务推进',
        description: '展开部门任务后，可查看子任务执行人、本周进展、遗留事项、风险、附件和截止节点。',
        target: () => document.querySelector('#department-owner-department-task-table') as HTMLElement || contentRef.current || document.body
      },
      {
        title: '兼任任务负责人时按职责跟进',
        description: '如果本人也是某个部门任务的任务负责人，需要额外关注待拆解、待处理补充事项、执行人更新和风险处理。',
        target: () => contentRef.current || document.body
      },
      {
        title: '观察者不代替维护',
        description: '观察者身份只做审阅和追溯，不代替负责人新增子任务、调整执行人、确认事项或填写周更新。',
        target: () => contentRef.current || document.body
      }
    ],
    observer_timeline: [
      {
        title: '按周追溯任务过程',
        description: '历史时间线按任务层级和周次展开，适合回看完成内容、遗留事项、附件、风险和历史提交。',
        target: () => document.querySelector('#timeline-guide-card') as HTMLElement || contentRef.current || document.body
      },
      {
        title: '横向比较周次变化',
        description: '同一任务可以横向查看不同周次的更新，帮助判断问题是偶发、连续、改善还是停滞。',
        target: () => document.querySelector('#timeline-guide-matrix') as HTMLElement || contentRef.current || document.body
      },
      {
        title: '纵向追溯任务层级',
        description: '从母任务到部门任务再到子任务逐层展开，可定位进展、附件和遗留事项来自哪个责任层级。',
        target: () => document.querySelector('#timeline-guide-matrix') as HTMLElement || contentRef.current || document.body
      },
      {
        title: '作为审阅证据来源',
        description: '时间线用于审阅、复盘和过程追溯，不在这里直接修改历史提交或代替业务处理。',
        target: () => contentRef.current || document.body
      }
    ],
    observer_sub_tasks: [
      {
        title: '仅在兼任执行人时出现',
        description: '观察者身份本身不承担填报责任；这里出现，说明你当前也有需要执行和更新的子任务。',
        target: () => document.querySelector('#sub-task-guide-execution') as HTMLElement || document.querySelector('#sub-task-guide-groups') as HTMLElement || contentRef.current || document.body
      },
      {
        title: '按执行人身份更新',
        description: '属于本人执行的子任务，需要进入更新页填写本周完成内容、下周计划、遗留事项，并按需要上传附件。',
        target: () => document.querySelector('#sub-task-guide-execution') as HTMLElement || contentRef.current || document.body
      },
      {
        title: '草稿不等于提交',
        description: '保存草稿只用于临时记录；只有正式提交后，系统才认为本周更新完成。',
        target: () => contentRef.current || document.body
      },
      {
        title: '风险仍需单独登记',
        description: '遗留事项用于说明剩余工作；影响和可能性明确的问题，应单独登记风险项。这里的填报责任来自执行人身份，而不是观察者身份。',
        target: () => contentRef.current || document.body
      }
    ]
  };
}
