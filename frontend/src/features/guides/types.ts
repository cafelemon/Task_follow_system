import type { TourProps } from 'antd';
import type { RefObject } from 'react';

export type GuideSteps = TourProps['steps'];

export type GuideRefs = {
  brandRef: RefObject<any>;
  menuRef: RefObject<any>;
  headerMetaRef: RefObject<any>;
  contentRef: RefObject<any>;
  guideButtonRef: RefObject<any>;
};

export type GuideBuildContext = {
  refs: GuideRefs;
  guideProfile?: string | null;
};

export type GuideState = {
  guide_key?: string;
  version?: string;
  required?: boolean;
  status?: string | null;
  completed_at?: string | null;
};

export type GuideAuthPayload = {
  onboarding?: {
    version?: string;
    required?: boolean;
  } | null;
  guides?: {
    system?: GuideState | null;
    modules?: Record<string, GuideState | undefined>;
  } | null;
};
