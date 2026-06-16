import type { GuideBuildContext, GuideSteps } from './types';

export function buildDepartmentOwnerSteps({ refs }: GuideBuildContext): Record<string, GuideSteps> {
  const { brandRef, menuRef, contentRef, headerMetaRef, guideButtonRef } = refs;
  return {
    department_owner_framework: [
      {
        title: '部门承接、推进质量和材料完整度',
        description: '部门负责人负责本部门任务承接和推进质量，同时关注部门任务补充、常态化事项和本周材料是否完整。',
        target: () => brandRef.current || document.body
      },
      {
        title: '工作台先看行动入口',
        description: '工作台首屏只保留待归类事项、子任务执行周更新和拆解入口。部门负责人完整信息在下方详细面板中查看。',
        target: () => contentRef.current || document.body
      },
      {
        title: '查看范围以部门责任为边界',
        description: '你可以查看本部门牵头母任务、本部门相关部门任务、本部门常态化记录和部门周报材料。',
        target: () => menuRef.current || document.body
      },
      {
        title: '关注推进异常和材料补充',
        description: '部门负责人重点看未更新、风险逾期、部门任务补充记录和本周材料统计，发现异常后再进入对应业务页处理。',
        target: () => contentRef.current || document.body
      },
      {
        title: '区分管理责任和执行责任',
        description: '部门负责人权限不自动包含子任务拆解或代填周更新。若你同时是任务负责人或执行人，请按对应身份完成拆解或填报。',
        target: () => headerMetaRef.current || document.body
      },
      {
        title: '板块首次进入会继续提示',
        description: '首次主动点击母任务管理、部门任务等板块时，会出现专项说明；需要回顾时，可从右上角重新打开。',
        target: () => guideButtonRef.current || document.body
      }
    ],
    department_owner_parent_tasks: [
      {
        title: '只看本部门牵头母任务',
        description: '母任务管理中展示与你所属部门牵头责任相关的母任务，用于从公司级事项查看本部门承接边界。',
        target: () => document.querySelector('#department-owner-parent-list') as HTMLElement || contentRef.current || document.body
      },
      {
        title: '先核对母任务关键信息',
        description: '任务卡展示负责人、牵头部门、截止日期和进度指标。拆分前建议先确认这些信息是否与当前责任边界一致。',
        target: () => document.querySelector('#department-owner-parent-cards') as HTMLElement || contentRef.current || document.body
      },
      {
        title: '进入详情查看承接结果',
        description: '通过“查看任务详情”进入母任务详情，可查看和维护该母任务下的部门任务承接关系。',
        target: () => document.querySelector('#department-owner-parent-cards') as HTMLElement || contentRef.current || document.body
      },
      {
        title: '维护部门任务承接关系',
        description: '在母任务详情中新增或维护部门任务，明确负责部门、任务负责人和截止日期。',
        target: () => contentRef.current || document.body
      },
      {
        title: '任务负责人继续拆解子任务',
        description: '部门任务建立后，由任务负责人继续拆解到执行人。部门负责人重点检查责任是否清晰、节点是否合理。',
        target: () => contentRef.current || document.body
      },
      {
        title: '删除是归档隐藏',
        description: '删除部门任务时按归档处理，不物理删除历史记录。部门负责人不能仅凭该身份编辑母任务本身。',
        target: () => contentRef.current || document.body
      }
    ],
    department_owner_department_tasks: [
      {
        title: '查看本部门相关部门任务',
        description: '这里集中展示本人部门负责，或本人部门牵头母任务下的部门任务，用于日常跟踪承接和推进质量。',
        target: () => document.querySelector('#department-owner-department-task-table') as HTMLElement || contentRef.current || document.body
      },
      {
        title: '重点核对推进状态',
        description: '建议优先查看负责部门、任务负责人、状态、待拆解数量、未更新和截止日期。',
        target: () => document.querySelector('#department-owner-department-task-table') as HTMLElement || contentRef.current || document.body
      },
      {
        title: '展开查看执行进展',
        description: '展开部门任务后，可以查看子任务执行人、本周完成内容、遗留事项、截止日期和补充记录。',
        target: () => document.querySelector('#department-owner-department-task-table') as HTMLElement || contentRef.current || document.body
      },
      {
        title: '补充材料不等于正式进度',
        description: '部门任务补充、本部门常态化和周报补充用于完善材料；正式进度仍来自任务树和周更新。',
        target: () => document.querySelector('#department-owner-department-task-table') as HTMLElement || contentRef.current || document.body
      },
      {
        title: '拆解子任务属于任务负责人',
        description: '“拆解”按钮只在你同时是该部门任务负责人时可用。部门负责人本身负责管理承接关系，不代替任务负责人拆子任务。',
        target: () => document.querySelector('#department-owner-department-task-table') as HTMLElement || contentRef.current || document.body
      }
    ],
    department_owner_sub_tasks: [
      {
        title: '先区分你在子任务中的身份',
        description: '只有你同时具备执行关系时，才需要填写周更新；管理查看和负责跟进都不等于代执行人填报。',
        target: () => document.querySelector('#sub-task-guide-groups') as HTMLElement || contentRef.current || document.body
      },
      {
        title: '执行关系才进入更新页',
        description: '在“我执行”或“负责+执行”的子任务中点击“更新”，按执行人身份填写本周进展。',
        target: () => document.querySelector('#sub-task-guide-execution') as HTMLElement || contentRef.current || document.body
      },
      {
        title: '未开启任务先开启',
        description: '如果任务尚未开启，请先点击“开启任务”；任务完成后再标记已完成，完成后周更新表单会锁定。',
        target: () => contentRef.current || document.body
      },
      {
        title: '按周填写执行信息',
        description: '本周完成内容、下周计划和遗留事项分别记录已完成工作、下一步安排和距离完全完成仍需处理的尾项。',
        target: () => contentRef.current || document.body
      },
      {
        title: '提交状态会影响提醒',
        description: '保存草稿不会视为本周已提交；只有点击“提交保存”后，周五未提交提醒才会停止。',
        target: () => contentRef.current || document.body
      },
      {
        title: '遗留事项不等于风险',
        description: '遗留事项继续作为周更新文本；确有影响和可能性的问题，请使用“登记风险”单独形成风险项。',
        target: () => contentRef.current || document.body
      }
    ]
  };
}
