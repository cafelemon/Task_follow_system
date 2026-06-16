import type { GuideBuildContext, GuideSteps } from './types';

export function buildTaskOwnerSteps({ refs }: GuideBuildContext): Record<string, GuideSteps> {
  const { brandRef, menuRef, contentRef, headerMetaRef, guideButtonRef } = refs;
  return {
    task_owner_framework: [
      {
        title: '把部门任务拆成可执行子任务',
        description: '任务负责人负责本人名下部门任务的执行拆解，把任务落到具体执行人、截止日期和可跟踪的子任务上。',
        target: () => brandRef.current || document.body
      },
      {
        title: '工作台先看拆解入口',
        description: '工作台中的“拆解入口”用于快速查看待处理事项、可转子任务、负责部门任务和待拆子任务。',
        target: () => menuRef.current || document.body
      },
      {
        title: '处理部门任务补充',
        description: '员工挂载到部门任务的补充事项，可由任务负责人同意、退回、关闭；确实需要进入任务树时，再转为正式子任务。',
        target: () => contentRef.current || document.body
      },
      {
        title: '拆解规则保持责任一致',
        description: '创建子任务时明确执行人和截止日期；子任务负责人继承部门任务负责人，避免责任链分叉。',
        target: () => contentRef.current || document.body
      },
      {
        title: '跟进执行但不代填',
        description: '任务负责人需要关注执行人周更新、遗留事项、风险和完成状态；只有本人也是执行人时，才需要提交周更新。',
        target: () => headerMetaRef.current || document.body
      },
      {
        title: '板块首次进入会继续提示',
        description: '首次主动点击部门任务或子任务执行板块时，会出现专项说明；需要回顾时，可从右上角重新打开。',
        target: () => guideButtonRef.current || document.body
      }
    ],
    task_owner_department_tasks: [
      {
        title: '从拆解入口进入部门任务',
        description: '工作台会提示待处理事项、可转子任务和待拆任务；完整拆解仍回到部门任务页完成。',
        target: () => document.querySelector('#department-owner-department-task-table') as HTMLElement || contentRef.current || document.body
      },
      {
        title: '先判断是否需要拆解',
        description: '建议优先查看任务负责人、状态、待拆解数量和截止日期，确认哪些任务还没有落到执行层。',
        target: () => document.querySelector('#department-owner-department-task-table') as HTMLElement || contentRef.current || document.body
      },
      {
        title: '补充事项可转正式子任务',
        description: '部门任务补充事项经判断需要纳入正式推进时，可转成子任务；否则可作为补充记录保留。',
        target: () => document.querySelector('#department-owner-department-task-table') as HTMLElement || contentRef.current || document.body
      },
      {
        title: '点击拆解创建子任务',
        description: '点击“拆解”后填写具体任务、执行人和截止日期。子任务应足够具体，便于执行人按周提交进展。',
        target: () => document.querySelector('#department-owner-department-task-table') as HTMLElement || contentRef.current || document.body
      },
      {
        title: '负责人自动继承',
        description: '子任务负责人自动继承部门任务负责人，不在拆解窗口单独选择，避免部门任务责任和子任务责任分叉。',
        target: () => document.querySelector('#department-owner-department-task-table') as HTMLElement || contentRef.current || document.body
      },
      {
        title: '展开检查执行情况',
        description: '展开部门任务后，可以检查子任务执行人、本周进展、遗留事项、截止日期和风险状态，及时发现推进异常。',
        target: () => document.querySelector('#department-owner-department-task-table') as HTMLElement || contentRef.current || document.body
      }
    ],
    task_owner_sub_tasks: [
      {
        title: '先看你在子任务中的身份',
        description: '“我负责”用于跟踪推进，“我执行”需要填写周更新，“负责+执行”则两类责任都要关注。',
        target: () => document.querySelector('#sub-task-guide-groups') as HTMLElement || contentRef.current || document.body
      },
      {
        title: '负责不等于代填',
        description: '在“我负责”任务中，你需要跟进执行人进展、遗留事项和风险，但不代替执行人填写周更新。',
        target: () => document.querySelector('#sub-task-guide-groups') as HTMLElement || contentRef.current || document.body
      },
      {
        title: '执行任务进入更新页',
        description: '只有“我执行”或“负责+执行”的子任务需要你进入更新页，按执行人身份提交本周进展。',
        target: () => document.querySelector('#sub-task-guide-execution') as HTMLElement || contentRef.current || document.body
      },
      {
        title: '区分草稿和正式提交',
        description: '保存草稿便于临时记录；只有点击“提交保存”，系统才认为本周更新已经正式提交。',
        target: () => contentRef.current || document.body
      },
      {
        title: '遗留事项不是风险',
        description: '遗留事项用于记录距离完成还剩什么；确有影响和可能性的问题，请单独登记风险项。',
        target: () => contentRef.current || document.body
      },
      {
        title: '完成后更新入口会收口',
        description: '任务完成后周更新表单会锁定，后续主要通过历史记录查看提交内容。',
        target: () => contentRef.current || document.body
      }
    ]
  };
}
