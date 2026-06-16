import { message } from 'antd';
import { useEffect, useRef, useState } from 'react';
import { postJson } from '../../api/client';
import type { AnyRecord } from '../../api/client';
import { buildGuideStepsByKey } from './guideRegistry';
import { guideForMenuPath, guideKeyForCurrentPage } from './guideRouting';
import type { GuideRefs } from './types';

export function useGuideTour({
  auth,
  guideProfile,
  pathname,
  refs,
  reloadAuth
}: {
  auth?: AnyRecord | null;
  guideProfile?: string | null;
  pathname: string;
  refs: GuideRefs;
  reloadAuth: () => Promise<void>;
}) {
  const onboardingPresentedRef = useRef(false);
  const onboardingSavingRef = useRef(false);
  const tourCloseTimerRef = useRef<number | null>(null);
  const [tourOpen, setTourOpen] = useState(false);
  const [activeGuideKey, setActiveGuideKey] = useState<string | null>(null);
  const [tourTracksProgress, setTourTracksProgress] = useState(false);
  const guideStepsByKey = buildGuideStepsByKey({ refs, guideProfile });
  const tourSteps = guideStepsByKey[activeGuideKey || 'legacy'] || guideStepsByKey.legacy;

  useEffect(() => {
    if (onboardingPresentedRef.current) return;
    if (auth?.guides?.system?.required) {
      onboardingPresentedRef.current = true;
      setActiveGuideKey(auth.guides.system.guide_key);
      setTourTracksProgress(true);
      setTourOpen(true);
      return;
    }
    if (guideProfile && !auth?.guides?.system && auth?.onboarding?.required) {
      onboardingPresentedRef.current = true;
      setActiveGuideKey('legacy');
      setTourTracksProgress(true);
      setTourOpen(true);
    }
  }, [auth?.guides?.system, auth?.guides?.system?.required, auth?.onboarding?.required, guideProfile]);

  const saveGuideProgress = async (action: 'completed' | 'skipped') => {
    if (onboardingSavingRef.current || !activeGuideKey) return;
    const savingGuideKey = activeGuideKey;
    onboardingSavingRef.current = true;
    setTourOpen(false);
    try {
      if (savingGuideKey === 'legacy') {
        await postJson('/auth/onboarding', { version: auth?.onboarding?.version, action });
      } else {
        const guide = auth?.guides?.system?.guide_key === savingGuideKey
          ? auth?.guides?.system
          : Object.values(auth?.guides?.modules || {}).find((item: any) => item?.guide_key === savingGuideKey) as AnyRecord | undefined;
        await postJson('/auth/guides', {
          guide_key: guide?.guide_key,
          version: guide?.version,
          action
        });
      }
      await reloadAuth();
    } catch {
      message.error('使用指南状态保存失败，请稍后重试');
    } finally {
      onboardingSavingRef.current = false;
      setActiveGuideKey(null);
    }
  };

  const closeTour = (action: 'completed' | 'skipped') => {
    if (tourTracksProgress) {
      saveGuideProgress(action);
    } else {
      setTourOpen(false);
    }
  };

  const handleTourClose = () => {
    if (tourCloseTimerRef.current) window.clearTimeout(tourCloseTimerRef.current);
    tourCloseTimerRef.current = window.setTimeout(() => {
      tourCloseTimerRef.current = null;
      closeTour('skipped');
    }, 80);
  };

  const handleTourFinish = () => {
    if (tourCloseTimerRef.current) {
      window.clearTimeout(tourCloseTimerRef.current);
      tourCloseTimerRef.current = null;
    }
    closeTour('completed');
  };

  const openManualGuide = () => {
    setActiveGuideKey(
      guideKeyForCurrentPage({
        guideProfile,
        pathname,
        guides: auth?.guides
      }) || auth?.guides?.system?.guide_key || 'legacy'
    );
    setTourTracksProgress(false);
    setTourOpen(true);
  };

  const triggerModuleGuide = (key: string) => {
    const moduleGuide = guideForMenuPath(auth?.guides, key);
    if (moduleGuide?.required) {
      window.setTimeout(() => {
        setActiveGuideKey(moduleGuide.guide_key || null);
        setTourTracksProgress(true);
        setTourOpen(true);
      }, 180);
    }
  };

  return {
    tourOpen,
    tourSteps,
    openManualGuide,
    triggerModuleGuide,
    handleTourClose,
    handleTourFinish
  };
}
