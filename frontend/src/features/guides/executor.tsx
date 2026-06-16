import type { GuideBuildContext, GuideSteps } from './types';

export function buildExecutorSteps({ refs }: GuideBuildContext): Record<string, GuideSteps> {
  const { brandRef, menuRef, contentRef, guideButtonRef } = refs;
  return {
    executor_framework: [
      {
        title: '推进本人子任务',
        description: '子任务执行者负责推进本人名下的具体任务，并按周提交真实、可追溯的执行进展。',
        target: () => brandRef.current || document.body
      },
      {
        title: '工作台先看周更新入口',
        description: '工作台中的“子任务执行周更新”用于快速看到待更新、草稿、临近截止和风险入口；完整列表仍回到“子任务执行”页面。',
        target: () => menuRef.current || document.body
      },
      {
        title: '先确认任务状态',
        description: '任务可能处于待开启、进行中或已完成。待开启任务先开启再填报；已完成任务以查看为主，误点完成需要由子任务负责人或管理员撤回。',
        target: () => contentRef.current || document.body
      },
      {
        title: '周更新要按周维护',
        description: '本周完成、下周计划、遗留事项和附件共同构成本周记录。保存草稿便于临时记录，正式提交才代表本周更新完成。',
        target: () => contentRef.current || document.body
      },
      {
        title: '补充事项进入待归类',
        description: '不适合直接写进某个子任务的临时或日常工作，可通过“待归类事项”提交，再由责任人确认归类；周报中心会把正式任务和归类项分开展示。',
        target: () => contentRef.current || document.body
      },
      {
        title: '风险和完成要分开处理',
        description: '遗留事项不等于风险；确有影响和可能性的问题请单独登记风险。任务完成前请确认内容无误，完成后更新入口会锁定。',
        target: () => guideButtonRef.current || document.body
      }
    ],
    executor_sub_tasks: [
      {
        title: '区分我执行和我负责',
        description: '“我执行”是需要本人填报周更新的任务；如果同时出现“我负责”，那是跟进责任，不代表可以代执行人填报。',
        target: () => document.querySelector('#sub-task-guide-execution') as HTMLElement || document.querySelector('#sub-task-guide-groups') as HTMLElement || contentRef.current || document.body
      },
      {
        title: '先核对任务关键信息',
        description: '更新前建议核对任务编号、任务名称、所属部门任务、负责人、状态、本周提交状态和截止日期。',
        target: () => document.querySelector('#sub-task-guide-execution') as HTMLElement || contentRef.current || document.body
      },
      {
        title: '先开启再更新',
        description: '点击“更新”进入本周填报页面。待开启任务需要先点击“开启任务”，再填写本周进展。',
        target: () => document.querySelector('#sub-task-guide-execution') as HTMLElement || contentRef.current || document.body
      },
      {
        title: '填写本周记录',
        description: '本周完成内容写已经推进的工作，下周计划写下一步安排，遗留事项写距离完成仍需处理的尾项；需要留存材料时可上传附件。',
        target: () => contentRef.current || document.body
      },
      {
        title: '草稿和提交要区分',
        description: '保存草稿便于中途记录，但不代表本周已经提交；只有“提交保存”才算正式完成本周更新。',
        target: () => contentRef.current || document.body
      },
      {
        title: '风险和完成边界',
        description: '发现真实风险时点击“风险”登记；标记完成后后续填报会锁定，误点完成或审批后需要继续推进时，由子任务负责人或管理员撤回为进行中。',
        target: () => contentRef.current || document.body
      }
    ]
  };
}
