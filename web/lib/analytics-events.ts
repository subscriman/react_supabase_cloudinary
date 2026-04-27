export const ANALYTICS_EVENTS = {
  exhibitionDetailView: 'exhibition_detail_view',
  favoriteToggle: 'favorite_toggle',
  startAlertToggle: 'start_alert_toggle',
  reviewSubmitSuccess: 'review_submit_success',
  searchUsed: 'search_used',
  filterUsed: 'filter_used',
  adminApprovalAction: 'admin_approval_action',
} as const;

export type AnalyticsEventName = (typeof ANALYTICS_EVENTS)[keyof typeof ANALYTICS_EVENTS];

export const ANALYTICS_EVENT_REQUIREMENTS: Record<
  AnalyticsEventName,
  {
    description: string;
    requiredFields: string[];
  }
> = {
  exhibition_detail_view: {
    description: '사용자가 전시 상세 페이지를 조회할 때 발생',
    requiredFields: ['exhibition_id', 'slug'],
  },
  favorite_toggle: {
    description: '사용자가 전시 찜을 추가하거나 해제할 때 발생',
    requiredFields: ['exhibition_id', 'action'],
  },
  start_alert_toggle: {
    description: '사용자가 전시 시작 알림을 추가하거나 해제할 때 발생',
    requiredFields: ['exhibition_id', 'action'],
  },
  review_submit_success: {
    description: '리뷰 저장 또는 수정이 성공했을 때 발생',
    requiredFields: ['exhibition_id', 'action'],
  },
  search_used: {
    description: '검색어로 전시를 탐색했을 때 발생',
    requiredFields: ['query', 'result_count'],
  },
  filter_used: {
    description: '필터를 적용해 전시 목록을 좁혔을 때 발생',
    requiredFields: ['status', 'city', 'tag', 'sort'],
  },
  admin_approval_action: {
    description: '관리자가 승인/반려/보류를 처리했을 때 발생',
    requiredFields: ['exhibition_id', 'action', 'next_status'],
  },
};
