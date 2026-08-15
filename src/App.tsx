import { useState } from 'react';
import Sidebar from './components/Sidebar';
import Topbar from './components/Topbar';
import { ViewKey, ReportType } from './types';
import { uploadVideo, summarize, getReport, Task } from './api';
import UploadScreen from './screens/UploadScreen';
import ProcessingScreen from './screens/ProcessingScreen';
import TypeDetectScreen from './screens/TypeDetectScreen';
import ComicReportScreen from './screens/ComicReportScreen';
import PaperReportScreen from './screens/PaperReportScreen';
import TimelineReportScreen from './screens/TimelineReportScreen';
import LibraryScreen from './screens/LibraryScreen';
import SettingsScreen from './screens/SettingsScreen';
import PlaceholderScreen from './screens/PlaceholderScreen';

const TITLE: Record<ViewKey, string> = {
  upload: '上传视频',
  processing: '处理中',
  detect: '类型识别确认',
  report: '视频总结报告',
  library: '报告库',
  tasks: '任务中心',
  templates: '模板中心',
  settings: '设置',
};

export default function App() {
  const [view, setView] = useState<ViewKey>('upload');
  const [reportType, setReportType] = useState<ReportType>('comic');
  const [taskId, setTaskId] = useState<string | null>(null);
  const [currentReport, setCurrentReport] = useState<Task | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const handleUpload = async (file: File) => {
    setUploadError(null);
    try {
      const { id } = await uploadVideo(file);
      setTaskId(id);
      setView('processing');
    } catch (e: any) {
      setUploadError(e?.message || '上传失败');
    }
  };

  const handleAnalyzed = () => setView('detect');

  const handleDone = async (task: Task) => {
    setReportType(task.type || 'comic');
    try {
      const { report } = await getReport(task.id);
      setCurrentReport(report);
    } catch {
      setCurrentReport(task);
    }
    setView('report');
  };

  const handleChoose = async (type: ReportType) => {
    if (!taskId) return;
    setReportType(type);
    await summarize(taskId, type);
    setView('processing');
  };

  const openReport = async (id: string) => {
    try {
      const { report } = await getReport(id);
      setCurrentReport(report);
      setReportType(report.type || 'comic');
      setView('report');
    } catch (e: any) {
      setUploadError(e?.message || '打开报告失败');
    }
  };

  return (
    <div className="flex h-full w-full bg-canvas overflow-hidden">
      <Sidebar active={view} onNav={setView} onNew={() => setView('upload')} />

      <div className="flex-1 flex flex-col min-w-0">
        <Topbar title={TITLE[view]} />

        <main className="flex-1 overflow-auto bg-canvas">
          {uploadError && (
            <div className="m-6 mb-0 rounded-btn bg-red-50 border border-red-200 text-red-600 text-[13px] px-4 py-2">
              {uploadError}
            </div>
          )}

          {view === 'upload' && (
            <UploadScreen onUpload={handleUpload} onOpenLibrary={() => setView('library')} />
          )}
          {view === 'processing' && taskId && (
            <ProcessingScreen
              taskId={taskId}
              onAnalyzed={handleAnalyzed}
              onDone={handleDone}
              onCancel={() => setView('upload')}
            />
          )}
          {view === 'detect' && taskId && (
            <TypeDetectScreen taskId={taskId} onChoose={handleChoose} />
          )}
          {view === 'report' && currentReport?.type === 'comic' && (
            <ComicReportScreen report={currentReport} onBack={() => setView('library')} />
          )}
          {view === 'report' && currentReport?.type === 'paper' && (
            <PaperReportScreen report={currentReport} onBack={() => setView('library')} />
          )}
          {view === 'report' && currentReport?.type === 'timeline' && (
            <TimelineReportScreen report={currentReport} onBack={() => setView('library')} />
          )}
          {view === 'library' && (
            <LibraryScreen onOpen={openReport} onUpload={() => setView('upload')} />
          )}
          {view === 'settings' && <SettingsScreen />}
          {view === 'tasks' && (
            <PlaceholderScreen title="任务中心" desc="所有视频处理任务会在此展示排队、进行中与历史记录。" />
          )}
          {view === 'templates' && (
            <PlaceholderScreen title="模板中心" desc="科普漫画 / 科研论文 / 通用摘要 三种报告模板。" />
          )}
        </main>
      </div>
    </div>
  );
}
