import { ContentTemplate, ScheduleItem } from './types';

// Default Schedule (for Grade 5, 6)
export const INITIAL_SCHEDULE_HIGH: ScheduleItem[] = [
  { period: '1교시', type: '보결', subTeacher: '', content: '' },
  { period: '2교시', type: '보결', subTeacher: '', content: '' },
  { period: '3교시', type: '보결', subTeacher: '', content: '' },
  { period: '4교시', type: '보결', subTeacher: '', content: '' },
  { period: '5교시', type: '보결', subTeacher: '', content: '' },
  { period: '점심시간', type: '보결', subTeacher: '', content: '급식지도 및 휴게지원' },
  { period: '6교시', type: '보결', subTeacher: '', content: '' },
];

// Schedule for Grade 4 (Lunch after 4th period)
export const INITIAL_SCHEDULE_MID: ScheduleItem[] = [
  { period: '1교시', type: '보결', subTeacher: '', content: '' },
  { period: '2교시', type: '보결', subTeacher: '', content: '' },
  { period: '3교시', type: '보결', subTeacher: '', content: '' },
  { period: '4교시', type: '보결', subTeacher: '', content: '' },
  { period: '점심시간', type: '보결', subTeacher: '', content: '급식지도 및 휴게지원' },
  { period: '5교시', type: '보결', subTeacher: '', content: '' },
  { period: '6교시', type: '보결', subTeacher: '', content: '' },
];

export const CONTENT_TEMPLATES: ContentTemplate[] = [
  { label: '국어', text: '국어-단원평가(미래엔 ai 클래스 기능 추천)' },
  { label: '수학', text: '수학-단원평가(미래엔 ai 클래스 기능 추천)' },
  { label: '미술', text: '(자동배정)', type: 'youtube' }, 
  { 
    label: '창체1(진로영상)', 
    text: '창체1-진로교육(영상 시청)', 
    link: 'https://sites.google.com/view/sonssam/손쌤의-교육자료-아카이브', 
    type: 'site' 
  },
  { 
    label: '창체2(자유영상시청)', 
    text: '창체2-자유영상시청', 
    link: 'https://sites.google.com/view/sonssam/손쌤의-교육자료-아카이브', 
    type: 'site' 
  },
  { label: '직접 입력', text: '' }
];

export interface ArtActivity {
  title: string;
  url: string;
}

export const ART_ACTIVITIES: ArtActivity[] = [
  { title: "나비 젠탱글", url: "https://www.youtube.com/watch?v=tl-Snui7YYs" },
  { title: "그림 마인드맵 그리기", url: "https://youtu.be/Ds08CGLeGRU?si=1t-m1XtdjfTt4ioG" },
  { title: "선과 면으로 손 그리기", url: "https://youtu.be/SviKxM3GfLQ?si=Dhtkzww1yF23SJVw" },
  { title: "손모양 활용 동물 그리기", url: "https://www.youtube.com/watch?v=lYp8k6gVICQ&list=PLwYGwTe8eOIhB0vktzu6x-CJnbuaEuqnn&index=8" },
  { title: "바다 꾸미기", url: "https://www.youtube.com/watch?v=IoU_zSSzUas&list=PLwYGwTe8eOIhB0vktzu6x-CJnbuaEuqnn&index=10" },
  { title: "숫자 연상 동물 그리기", url: "https://www.youtube.com/watch?v=HDY9axyZzc4&list=PLwYGwTe8eOIhB0vktzu6x-CJnbuaEuqnn&index=13" },
  { title: "코끼리 팝아트", url: "https://www.youtube.com/watch?v=PLx42shlEbA&list=PLwYGwTe8eOIhB0vktzu6x-CJnbuaEuqnn&index=15" },
  { title: "선으로 동물 그리기", url: "https://www.youtube.com/watch?v=LwOvuK1SUhA&list=PLwYGwTe8eOIhB0vktzu6x-CJnbuaEuqnn&index=30" },
  { title: "음표 나무 그리기", url: "https://www.youtube.com/watch?v=tXjy2vm062A&list=PLwYGwTe8eOIhB0vktzu6x-CJnbuaEuqnn&index=31" },
  { title: "5분 크로키 동물", url: "https://www.youtube.com/watch?v=PjyBs49HBKQ" },
  { title: "랜드마크 5분 크로키", url: "https://www.youtube.com/watch?v=BCi453eY4qs&t=1s" },
  { title: "스포츠 5분 크로키", url: "https://www.youtube.com/watch?v=4M5TDY5QklY" },
  { title: "멸종위기동물 5분 크로키", url: "https://www.youtube.com/watch?v=zpBk81JfjpM" },
  { title: "과자봉지 5분 크로키", url: "https://www.youtube.com/watch?v=Aa-aysNGyF8" },
  { title: "김홍도 5분 크로키", url: "https://www.youtube.com/watch?v=1aL3OQBAX8o" }
];

// Helper to find link in content string
export const getLinkFromContent = (content: string) => {
  if (!content) return null;

  // 1. Check Art Activities (High Priority)
  for (const art of ART_ACTIVITIES) {
    if (content.includes(art.title)) {
      return { url: art.url, type: 'youtube' as const };
    }
  }

  // 2. Check Templates (Creative, etc)
  for (const temp of CONTENT_TEMPLATES) {
    if (temp.link && (content.includes(temp.label) || content.includes(temp.text))) {
      return { url: temp.link, type: temp.type || 'site' };
    }
  }
  
  return null;
};