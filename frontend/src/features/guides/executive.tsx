import type { GuideBuildContext, GuideSteps } from './types';

export function buildExecutiveSteps({ refs }: GuideBuildContext): Record<string, GuideSteps> {
  const { brandRef, menuRef, contentRef, headerMetaRef, guideButtonRef } = refs;
  return {
    executive_framework: [
      {
        title: '公司任务推进与会议决策支持',
        description: '系统用于统一呈现公司重点任务的责任分解、周度进展、风险与逾期情况，为经营会议审阅和决策提供依据。',
        target: () => brandRef.current || document.body
      },
      {
        title: '任务体系与补充材料',
        description: '正式任务仍按战略目标、母任务、部门任务和子任务逐级拆解；待归类事项用于补充临时、协作和周报材料，不替代正式任务树。',
        target: () => contentRef.current || document.body
      },
      {
        title: '工作台是行动入口',
        description: '登录后先进入工作台。首屏只保留待归类事项、子任务执行周更新和拆解入口，便于快速进入对应业务页面。',
        target: () => menuRef.current || document.body
      },
      {
        title: '会议看板是审阅主入口',
        description: '会议看板用于集中审阅全局指标、风险逾期、未更新和部门差异；战略目标、母任务、部门任务和历史时间线用于继续追溯。',
        target: () => menuRef.current || document.body
      },
      {
        title: '确认身份与会议周期',
        description: '顶部显示当前登录人员、所属部门和系统周次。会议审阅前建议先确认当前周期，避免混用不同周次的数据。',
        target: () => headerMetaRef.current || document.body
      },
      {
        title: '板块内还有专项说明',
        description: '首次主动点击左侧板块时，系统会提供该板块的专项引导。需要回顾时，可通过右上角使用指南再次查看。',
        target: () => guideButtonRef.current || document.body
      }
    ],
    executive_meeting_board: [
      {
        title: '会议看板用于审阅',
        description: '会议看板不替代工作台，它用于会议中集中审阅公司任务推进状态，并为现场追问和会后跟进提供依据。',
        target: () => document.querySelector('#meeting-guide-tabs') as HTMLElement || document.body
      },
      {
        title: '先看总览异常',
        description: '建议先从总览识别本周待更新、风险任务和逾期任务。点击指标可打开明细，核对任务、责任人和当前状态。',
        target: () => document.querySelector('#meeting-guide-metrics') as HTMLElement || document.body
      },
      {
        title: '重点审阅风险与逾期',
        description: '风险与逾期汇总用于确认高风险事项、处理责任人和截止日期。具备处理权限时，可直接进入风险处置。',
        target: () => document.querySelector('#risk-overdue') as HTMLElement || document.body
      },
      {
        title: '判断本周更新完整度',
        description: '本周更新状态和近周提交趋势用于判断填报是否充分，并识别持续未更新或执行节奏不稳定的事项。',
        target: () => document.querySelector('#meeting-guide-weekly') as HTMLElement || document.body
      },
      {
        title: '比较部门差异',
        description: '需要部门横向比较时，可切换到部门看板查看任务量、待更新、风险和逾期分布，识别推进压力集中的方向。',
        target: () => document.querySelector('#meeting-guide-deadline') as HTMLElement || document.body
      },
      {
        title: '建议的会议审阅顺序',
        description: '建议按“总览异常、风险逾期、未更新、部门差异、下钻明细、形成会后跟进”的顺序审阅。',
        target: () => contentRef.current || document.body
      }
    ]
  };
}
