import type { GuideBuildContext, GuideSteps } from './types';

const guideProfileLabels: Record<string, string> = {
  executive_office: '总经办会议相关',
  department_owner: '部门负责人',
  task_owner: '任务负责人',
  executor: '子任务执行者',
  observer: '观察者'
};

const guideDescriptions: Record<string, string> = {
  department_owner: '从“母任务管理”查看本部门牵头的母任务，并将任务拆分到相关部门；部门任务中可跟踪本部门负责事项。',
  task_owner: '从“部门任务”进入自己负责的任务，拆解到具体执行人并持续跟踪进展与风险。',
  executor: '从“子任务执行”进入本人任务，填写本周进展、遗留事项和下一步计划，发现问题时登记风险。',
  observer: '从会议看板和历史时间线查看任务推进情况，观察者不承担任务拆解和填报操作。'
};

export function buildLegacySteps({ refs, guideProfile }: GuideBuildContext): GuideSteps {
  const { brandRef, menuRef, contentRef, headerMetaRef, guideButtonRef } = refs;
  return [
    {
      title: `欢迎使用任务跟踪系统 · ${guideProfile ? guideProfileLabels[guideProfile] : ''}`,
      description: '这份短引导只在首次进入时自动展示，之后可以随时从右上角重新打开。',
      target: () => brandRef.current || document.body
    },
    {
      title: '从导航开始工作',
      description: guideDescriptions[guideProfile || ''] || '请从左侧导航进入与本人职责相关的工作板块。',
      target: () => menuRef.current || document.body
    },
    {
      title: '当前工作区',
      description: '列表、看板和编辑窗口都会在这里呈现。系统不会在引导过程中替你切换页面。',
      target: () => contentRef.current || document.body
    },
    {
      title: '确认身份与周期',
      description: '这里显示当前登录人员、所属部门、日期和系统周次，提交更新前可以先核对。',
      target: () => headerMetaRef.current || document.body
    },
    {
      title: '随时重看使用指南',
      description: '完成或跳过后都不会再次自动打扰；需要时点击这个问号即可重新查看。',
      target: () => guideButtonRef.current || document.body
    }
  ];
}
