
export interface ScheduleItem {
  period: string;
  type: '보결' | '전담' | '수업없음';
  subTeacher: string;
  content: string;
}

export interface SubstitutionRecord {
  id: string;
  absentTeacher: string;
  grade: string;
  classNum: string;
  date: string;
  schedule: ScheduleItem[];
  createdAt: any; // Firestore Timestamp
  authorId: string;
}

export interface ContentTemplate {
  label: string;
  text: string;
  link?: string;
  type?: 'youtube' | 'site';
}
