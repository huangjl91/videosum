export type ReportType = 'comic' | 'paper' | 'timeline';

export type ViewKey =
  | 'upload'
  | 'processing'
  | 'detect'
  | 'report'
  | 'library'
  | 'tasks'
  | 'templates'
  | 'settings';

export interface ReportItem {
  id: string;
  title: string;
  type: ReportType;
  typeLabel: string;
  duration: string;
  createdAt: string;
  cover: string; // tailwind 背景类
}
