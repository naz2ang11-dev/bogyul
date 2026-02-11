import React, { useState, useEffect } from 'react';
import { 
  Calendar, User, Zap, Save, Trash, History, Download, Copy, 
  ChevronUp, ChevronDown, Youtube, Link, RefreshCcw, Check, FileText,
  Info, Edit, X, ExternalLink
} from 'lucide-react';
import { signInAnonymously, onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { addDoc, serverTimestamp, onSnapshot, query, orderBy, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { auth, getRecordsCollection, db, APP_ID, APP_COLLECTION_PATH } from './firebase';
import { INITIAL_SCHEDULE_HIGH, INITIAL_SCHEDULE_MID, CONTENT_TEMPLATES, ART_ACTIVITIES, ArtActivity, getLinkFromContent } from './constants';
import { ScheduleItem, SubstitutionRecord } from './types';
import { CaptureContent } from './components/CaptureContent';

// Declare html2canvas globally as it is loaded via CDN
declare const html2canvas: any;

function App() {
  // --- State Management ---
  const [user, setUser] = useState<FirebaseUser | null>(null);
  
  // Form State
  const [absentTeacher, setAbsentTeacher] = useState('');
  const [grade, setGrade] = useState('6'); // Default to 6
  const [classNum, setClassNum] = useState('1');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [schedule, setSchedule] = useState<ScheduleItem[]>(INITIAL_SCHEDULE_HIGH);
  
  // App State
  const [history, setHistory] = useState<SubstitutionRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [expandedHistory, setExpandedHistory] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [showGuide, setShowGuide] = useState(true);

  // Edit Mode State (Inline)
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editSchedule, setEditSchedule] = useState<ScheduleItem[]>([]);
  const [editTeacher, setEditTeacher] = useState('');

  // --- Auth & Data Fetching ---
  useEffect(() => {
    signInAnonymously(auth).catch(err => console.error("Auth Error:", err));
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    if (!user) return;
    const q = query(getRecordsCollection(), orderBy('createdAt', 'desc'));
    const unsubscribeSnapshot = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data() 
      } as SubstitutionRecord));
      setHistory(data);
    });
    return () => unsubscribeSnapshot();
  }, [user]);

  // --- Logic Helpers ---

  const handleGradeChange = (newGrade: string) => {
    setGrade(newGrade);
    // Reset schedule based on grade structure
    if (newGrade === '4') {
      setSchedule(JSON.parse(JSON.stringify(INITIAL_SCHEDULE_MID)));
    } else {
      setSchedule(JSON.parse(JSON.stringify(INITIAL_SCHEDULE_HIGH)));
    }
  };

  const handleToggleType = (index: number) => {
    if (schedule[index].period === '점심시간') return;
    const newSchedule = [...schedule];
    const currentType = newSchedule[index].type;
    
    // Cycle: 보결 -> 전담 -> 수업없음 -> 보결
    if (currentType === '보결') {
      newSchedule[index].type = '전담';
      newSchedule[index].subTeacher = '-';
      newSchedule[index].content = '';
    } else if (currentType === '전담') {
      newSchedule[index].type = '수업없음';
      newSchedule[index].subTeacher = '';
      newSchedule[index].content = '';
    } else {
      newSchedule[index].type = '보결';
      newSchedule[index].subTeacher = '';
      newSchedule[index].content = '';
    }
    
    setSchedule(newSchedule);
  };

  const updateScheduleItem = (index: number, field: keyof ScheduleItem, value: string) => {
    const newSchedule = [...schedule];
    (newSchedule[index] as any)[field] = value;
    setSchedule(newSchedule);
  };

  const getRandomArtActivity = (currentGrade: string, currentClass: string, usedInCurrentSession: string[] = []): ArtActivity => {
    const previousArtTitles = new Set<string>();
    
    history.forEach(record => {
      if (record.grade === currentGrade && record.classNum === currentClass) {
        record.schedule.forEach(s => {
          if (s.content && s.content.includes('미술')) {
             previousArtTitles.add(s.content);
          }
        });
      }
    });

    const available = ART_ACTIVITIES.filter(art => {
      const artStr = `미술-${art.title}`;
      const isUsedInHistory = Array.from(previousArtTitles).some(title => title.includes(art.title));
      const isUsedNow = usedInCurrentSession.some(title => title.includes(art.title));
      return !isUsedInHistory && !isUsedNow;
    });

    const pool = available.length > 0 ? available : ART_ACTIVITIES.filter(art => !usedInCurrentSession.some(title => title.includes(art.title)));
    
    return pool[Math.floor(Math.random() * pool.length)];
  };

  const autoAssignContent = () => {
    const newSchedule = [...schedule];
    // Find valid slots (indices) where type is '보결' (Substitution)
    const subIndices = newSchedule
      .map((item, idx) => (item.type === '보결' && item.period !== '점심시간') ? idx : -1)
      .filter(idx => idx !== -1);

    const count = subIndices.length;
    let subjects: string[] = [];
    let hasArt = false;

    // Define subject pool based on count
    // Indices in CONTENT_TEMPLATES: 0:Korean, 1:Math, 2:Art, 3:CC1, 4:CC2
    if (count >= 5) {
       subjects = [CONTENT_TEMPLATES[0].text, CONTENT_TEMPLATES[1].text]; // Korean, Math
       hasArt = true;
       if (count - 4 > 0) subjects.push(CONTENT_TEMPLATES[3].text); // CC1
       if (count - 4 > 1) subjects.push(CONTENT_TEMPLATES[4].text); // CC2
    } else if (count === 4) {
       // Math, Art(2), CC1
       subjects = [CONTENT_TEMPLATES[1].text, CONTENT_TEMPLATES[3].text];
       hasArt = true;
    } else if (count === 3) {
       // Korean, Math, CC1 (No Art)
       subjects = [CONTENT_TEMPLATES[0].text, CONTENT_TEMPLATES[1].text, CONTENT_TEMPLATES[3].text];
    } else {
       // < 3: Just Math or Math, CC
       if (count >= 1) subjects.push(CONTENT_TEMPLATES[1].text);
       if (count >= 2) subjects.push(CONTENT_TEMPLATES[3].text);
    }

    let artIndices: [number, number] | null = null;
    
    if (hasArt) {
        // Find consecutive slots. Iterate backwards to prefer afternoon.
        // We only check adjacent indices in the *full array* to ensure strict consecutiveness.
        for (let i = subIndices.length - 2; i >= 0; i--) {
            if (subIndices[i+1] === subIndices[i] + 1) {
                artIndices = [subIndices[i], subIndices[i+1]];
                break;
            }
        }
    }

    const artInfo = hasArt ? getRandomArtActivity(grade, classNum, []) : null;
    const art1 = artInfo ? `미술-${artInfo.title} (영상보기)` : '';
    const art2 = artInfo ? `미술-${artInfo.title} (다듬기 및 채색)` : '';

    // Assign Art
    const artUsed = new Set<number>();
    if (artIndices) {
        artUsed.add(artIndices[0]);
        artUsed.add(artIndices[1]);
        newSchedule[artIndices[0]].content = art1;
        newSchedule[artIndices[1]].content = art2;
    } else if (hasArt) {
        // Split art if no consecutive slots found (append to end of queue)
        subjects.push(art1);
        subjects.push(art2);
    }

    // Assign remaining subjects
    let subjectIdx = 0;
    subIndices.forEach(idx => {
        if (!artUsed.has(idx)) {
            if (subjectIdx < subjects.length) {
                newSchedule[idx].content = subjects[subjectIdx++];
            }
        }
    });

    setSchedule(newSchedule);
  };

  // --- Main Save Logic ---
  const handleSave = async () => {
    if (!absentTeacher) {
      alert("결근 교사 성함을 입력해주세요.");
      return;
    }
    if (!user) return;
    
    setIsLoading(true);
    try {
      await addDoc(getRecordsCollection(), {
        absentTeacher,
        grade,
        classNum,
        date,
        schedule,
        createdAt: serverTimestamp(),
        authorId: user.uid
      });
      
      setAbsentTeacher('');
      setSchedule(grade === '4' ? JSON.parse(JSON.stringify(INITIAL_SCHEDULE_MID)) : JSON.parse(JSON.stringify(INITIAL_SCHEDULE_HIGH)));
      alert("성공적으로 저장되었습니다.");
    } catch (error) {
      console.error(error);
      alert("저장 실패");
    } finally {
      setIsLoading(false);
    }
  };

  // --- Inline Edit Logic ---
  const startEditing = (record: SubstitutionRecord) => {
    setEditingId(record.id);
    setEditTeacher(record.absentTeacher);
    setEditSchedule(JSON.parse(JSON.stringify(record.schedule)));
    setExpandedHistory(record.id); // Ensure expanded
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditTeacher('');
    setEditSchedule([]);
  };

  const saveEditing = async (id: string) => {
    try {
      const docRef = doc(db, 'artifacts', APP_ID, 'public', 'data', APP_COLLECTION_PATH, id);
      await updateDoc(docRef, {
        absentTeacher: editTeacher,
        schedule: editSchedule
      });
      setEditingId(null);
      alert("수정되었습니다.");
    } catch (error) {
      console.error(error);
      alert("수정 실패");
    }
  };

  const updateEditScheduleItem = (index: number, value: string) => {
    const newSchedule = [...editSchedule];
    newSchedule[index].content = value;
    setEditSchedule(newSchedule);
  };

  const updateEditTeacherItem = (index: number, value: string) => {
    const newSchedule = [...editSchedule];
    newSchedule[index].subTeacher = value;
    setEditSchedule(newSchedule);
  };
  
  const updateEditTypeItem = (index: number, value: '보결' | '전담' | '수업없음') => {
    const newSchedule = [...editSchedule];
    newSchedule[index].type = value;
    
    if (value === '보결') {
        newSchedule[index].subTeacher = '';
        newSchedule[index].content = '';
    } else if (value === '전담') {
        newSchedule[index].subTeacher = '-';
        newSchedule[index].content = '';
    } else { // 수업없음
        newSchedule[index].subTeacher = '';
        newSchedule[index].content = '';
    }
    setEditSchedule(newSchedule);
  };

  const rerollArtForEdit = (index: number, recordGrade: string, recordClass: string) => {
    const art = getRandomArtActivity(recordGrade, recordClass);
    const newSchedule = [...editSchedule];
    
    newSchedule[index].content = `미술-${art.title} (영상보기)`;
    
    // Automatically update next slot if valid
    const nextIndex = index + 1;
    if (nextIndex < newSchedule.length && newSchedule[nextIndex].type === '보결') {
      newSchedule[nextIndex].content = `미술-${art.title} (다듬기 및 채색)`;
    }
    
    setEditSchedule(newSchedule);
  };

  // --- History Actions ---

  const executeDelete = async (id: string) => {
    try {
      setProcessingId(id);
      const docRef = doc(db, 'artifacts', APP_ID, 'public', 'data', APP_COLLECTION_PATH, id);
      await deleteDoc(docRef);
      setDeleteConfirmId(null);
    } catch (error: any) {
      alert("삭제 실패: " + error.message);
    } finally {
      setProcessingId(null);
    }
  };

  const downloadImage = async (id: string) => {
    const element = document.getElementById(id);
    if (!element) return;
    setProcessingId(id);
    try {
      const canvas = await html2canvas(element, { backgroundColor: '#ffffff', scale: 2 });
      const link = document.createElement('a');
      link.download = `보결계획-${date}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (error) {
      alert("이미지 생성 오류");
    } finally {
      setProcessingId(null);
    }
  };

  const copyImageToClipboard = async (id: string) => {
    const element = document.getElementById(id);
    if (!element) return;
    setProcessingId(id);
    try {
      const canvas = await html2canvas(element, { backgroundColor: '#ffffff', scale: 2 });
      canvas.toBlob(async (blob: Blob | null) => {
        if (!blob) return;
        try {
          await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
          alert("이미지가 복사되었습니다. (Ctrl+V로 붙여넣기)");
        } catch (err) {
          alert("클립보드 복사 실패");
        }
      }, 'image/png');
    } catch (error) {
      alert("이미지 생성 오류");
    } finally {
      setProcessingId(null);
    }
  };

  // --- Render ---
  return (
    <div className="max-w-6xl mx-auto p-4 md:p-6 lg:p-8 space-y-8 pb-20 relative">
      
      {/* Operating Guide Toggle */}
      <div className="absolute top-4 right-4 md:right-8 z-10">
        <button 
          onClick={() => setShowGuide(!showGuide)}
          className="flex items-center gap-2 bg-white/80 backdrop-blur text-slate-600 px-4 py-2 rounded-full shadow-sm hover:shadow-md transition-all text-xs font-bold border border-slate-200"
        >
          <Info className="w-4 h-4" />
          운영 가이드 {showGuide ? '접기' : '보기'}
        </button>
      </div>

      {/* Guide Section */}
      {showGuide && (
        <div className="bg-blue-50/50 border border-blue-100 rounded-3xl p-6 md:p-8 animate-in slide-in-from-top-4 fade-in duration-300">
          <h3 className="text-lg font-black text-slate-800 mb-4 flex items-center gap-2">
            <Zap className="w-5 h-5 text-amber-500 fill-amber-500" />
            시스템 운영 가이드
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm text-slate-600 leading-relaxed font-medium">
            <div className="space-y-3">
              <p><span className="font-bold text-blue-600">📌 기본 조작:</span> '구분'란의 버튼을 클릭하여 [보결/전담/수업없음]을 전환할 수 있습니다. 전담/수업없음은 내용 입력이 비활성화됩니다.</p>
              <p><span className="font-bold text-blue-600">⚡ 자동 배정:</span> 우측 상단 '자동 배정' 버튼을 누르면 보결 수업 시수에 맞춰 최적화된 수업이 자동으로 구성됩니다.</p>
              <p><span className="font-bold text-blue-600">📝 직접 수정:</span> 학급 행사 등 특이사항이 있는 경우 입력란을 직접 수정하여 내용을 변경할 수 있습니다.</p>
            </div>
            <div className="space-y-3">
              <ul className="list-disc list-outside ml-4 space-y-1 marker:text-blue-300">
                <li><strong className="text-slate-800">국어/수학:</strong> 단원평가실시. 미래엔 AI클래스 평가 활용을 권장합니다</li>
                <li><strong className="text-slate-800">미술:</strong> 도화지와 기본 채색 도구만으로 가능한 활동이 랜덤 배정됩니다. (유튜브 영상 제공, 중복 방지 알고리즘 적용. 히스토리 창에서 다른 미술수업으로 변경 가능)</li>
                <li><strong className="text-slate-800">창체1:</strong> 링크 된 사이트에서 진로영상 시청</li>
                <li><strong className="text-slate-800">창체2:</strong> 링크 된 사이트에서 자유롭게 영상 시청</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Planner Card */}
      <div className="bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-200 relative">
        <div className="bg-gradient-to-br from-slate-800 to-slate-900 p-8 text-white">
          <h1 className="text-3xl font-black flex items-center gap-3">
            <Calendar className="w-8 h-8 text-blue-400" />
            보결 업무 관리 시스템
          </h1>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-10">
            {/* Teacher Info Inputs */}
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                Teacher Info
              </label>
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-2 bg-white/10 p-3 rounded-2xl border border-white/10 flex-1 min-w-[200px]">
                  <User className="w-5 h-5 text-blue-400" />
                  
                  <select 
                    value={grade} 
                    onChange={(e) => handleGradeChange(e.target.value)} 
                    className="bg-transparent border-none outline-none text-white font-bold cursor-pointer [&>option]:text-slate-800"
                  >
                    {[4,5,6].map(g => <option key={g} value={g}>{g}학년</option>)}
                  </select>
                  
                  <div className="w-[1px] h-4 bg-white/20 mx-1"></div>
                  
                  <select 
                    value={classNum} 
                    onChange={(e) => setClassNum(e.target.value)} 
                    className="bg-transparent border-none outline-none text-white font-bold cursor-pointer [&>option]:text-slate-800"
                  >
                    {[1,2,3,4,5,6,7,8,9,10,11].map(c => <option key={c} value={c}>{c}반</option>)}
                  </select>
                  
                  <div className="w-[1px] h-4 bg-white/20 mx-1"></div>
                  
                  <input 
                    type="text" 
                    value={absentTeacher} 
                    onChange={(e) => setAbsentTeacher(e.target.value)} 
                    className="bg-transparent border-none outline-none flex-1 text-white font-bold placeholder:text-slate-500" 
                    placeholder="선생님 성함" 
                  />
                </div>
              </div>
            </div>
            
            {/* Date Input */}
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                Target Date
              </label>
              <div className="flex items-center gap-3 bg-white/10 p-3 rounded-2xl border border-white/10 focus-within:border-blue-400 focus-within:bg-white/20 transition-all">
                <Calendar className="w-5 h-5 text-blue-400" />
                <input 
                  type="date" 
                  value={date} 
                  onChange={(e) => setDate(e.target.value)} 
                  className="bg-transparent border-none outline-none w-full text-white font-bold [color-scheme:dark]" 
                />
              </div>
            </div>
          </div>
        </div>

        {/* Schedule Table */}
        <div className="p-0 overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-[11px] font-black uppercase tracking-tighter">
                <th className="py-5 px-6 text-center w-28">교시</th>
                <th className="py-5 px-6 w-32">구분</th>
                <th className="py-5 px-6 w-48">보결 교사</th>
                <th className="py-5 px-6 min-w-[300px]">
                  <div className="flex items-center justify-between">
                    <span>수업 컨텐츠</span>
                    <button 
                      onClick={autoAssignContent} 
                      className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-xl flex items-center gap-1.5 transition-all shadow-md shadow-blue-200"
                    >
                      <Zap className="w-3.5 h-3.5" /> 
                      자동 배정
                    </button>
                  </div>
                </th>
              </tr>
            </thead>
            <tbody>
              {schedule.map((row, idx) => (
                <tr 
                  key={idx} 
                  className={`border-b border-slate-100 last:border-0 transition-colors ${row.type === '전담' ? 'bg-slate-50/50' : row.type === '수업없음' ? 'bg-slate-100 opacity-70' : 'hover:bg-blue-50/20'}`}
                >
                  <td className="py-6 px-6 text-center">
                    <div className={`inline-flex items-center justify-center px-4 py-2 rounded-xl font-black text-xs shadow-sm border whitespace-nowrap ${row.period === '점심시간' ? 'bg-amber-100 text-amber-700 border-amber-200' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                      {row.period}
                    </div>
                  </td>
                  <td className="py-6 px-6">
                    <button 
                      onClick={() => handleToggleType(idx)} 
                      disabled={row.period === '점심시간'} 
                      className={`w-24 py-2 rounded-2xl text-[11px] font-black transition-all transform active:scale-95 border shadow-sm ${
                        row.type === '전담' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 
                        row.type === '수업없음' ? 'bg-slate-200 text-slate-500 border-slate-300' :
                        'bg-blue-100 text-blue-700 border-blue-200'
                      }`}
                    >
                      {row.type}
                    </button>
                  </td>
                  <td className="py-6 px-6">
                    <input 
                      type="text" 
                      disabled={row.type !== '보결'} 
                      value={row.subTeacher} 
                      onChange={(e) => updateScheduleItem(idx, 'subTeacher', e.target.value)} 
                      className="w-full bg-white border border-slate-200 rounded-2xl px-4 py-2 text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none transition-all disabled:opacity-50 disabled:bg-slate-100 disabled:cursor-not-allowed" 
                      placeholder={row.type === '전담' ? 'X' : row.type === '수업없음' ? '-' : '이름'} 
                    />
                  </td>
                  <td className="py-6 px-6">
                    <div className={`flex flex-col gap-3 transition-opacity ${row.type !== '보결' ? 'opacity-30 pointer-events-none' : 'opacity-100'}`}>
                      <div className="relative">
                        <textarea 
                          rows={1} 
                          value={row.content} 
                          disabled={row.type !== '보결'}
                          onChange={(e) => updateScheduleItem(idx, 'content', e.target.value)} 
                          className="w-full bg-white border border-slate-200 rounded-2xl px-4 py-2 text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none resize-none transition-all pr-10" 
                          placeholder={row.type === '보결' ? "수업 상세 내용을 입력하세요" : ""} 
                        />
                        {/* Dynamic Link Icon in Planner */}
                        {getLinkFromContent(row.content) && (
                           <a 
                             href={getLinkFromContent(row.content)!.url}
                             target="_blank"
                             rel="noopener noreferrer"
                             className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-blue-500 transition-colors pointer-events-auto"
                             title="자료 보기"
                           >
                             {getLinkFromContent(row.content)!.type === 'youtube' ? <Youtube className="w-4 h-4" /> : <Link className="w-4 h-4" />}
                           </a>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {CONTENT_TEMPLATES.map(tmp => (
                          <div 
                            key={tmp.label} 
                            className="flex items-center bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm hover:border-blue-300 transition-colors"
                          >
                            <button 
                              onClick={() => {
                                if (tmp.label === '미술') {
                                   const art = getRandomArtActivity(grade, classNum);
                                   updateScheduleItem(idx, 'content', `미술-${art.title} (영상보기)`);
                                   // Auto-fill next slot if consecutive
                                   if (schedule[idx+1] && schedule[idx+1].type === '보결' && schedule[idx+1].period !== '점심시간') {
                                       updateScheduleItem(idx+1, 'content', `미술-${art.title} (다듬기 및 채색)`);
                                   }
                                } else {
                                   updateScheduleItem(idx, 'content', tmp.text);
                                }
                              }} 
                              className="text-[10px] text-slate-500 px-3 py-1.5 hover:bg-slate-50 font-bold border-r border-slate-100 tracking-tighter"
                            >
                              {tmp.label}
                            </button>
                            {tmp.link && (
                              <a 
                                href={tmp.link} 
                                target="_blank" 
                                rel="noopener noreferrer" 
                                className={`p-1.5 ${tmp.type === 'youtube' ? 'text-red-500 hover:bg-red-50' : 'text-blue-500 hover:bg-blue-50'}`}
                              >
                                {tmp.type === 'youtube' ? <Youtube className="w-3.5 h-3.5" /> : <Link className="w-3.5 h-3.5" />}
                              </a>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer Actions */}
        <div className="p-8 bg-slate-50 border-t border-slate-100 flex justify-between items-center gap-3">
          <div className="flex-1"></div>
          <button 
            onClick={handleSave} 
            disabled={isLoading} 
            className="bg-slate-900 hover:bg-black text-white px-12 py-4 rounded-2xl font-black text-lg flex items-center gap-3 transition-all shadow-xl active:translate-y-1 transform disabled:opacity-30"
          >
            {isLoading ? <RefreshCcw className="animate-spin w-5 h-5" /> : <Check className="w-5 h-5 text-emerald-400" />}
            계획 확정 및 저장
          </button>
        </div>
      </div>

      {/* History Section */}
      <div className="space-y-6 pt-10">
        <div className="flex items-center justify-between px-2">
          <h2 className="text-2xl font-black text-slate-800 flex items-center gap-3">
            <History className="w-7 h-7 text-indigo-500" />
            보결 히스토리
          </h2>
          <span className="bg-indigo-100 text-indigo-700 px-4 py-1.5 rounded-2xl font-black text-xs">
            {history.length} Records
          </span>
        </div>

        <div className="grid grid-cols-1 gap-5">
          {history.length === 0 ? (
            <div className="bg-white rounded-3xl border-2 border-dashed border-slate-200 py-20 text-center">
              <History className="w-12 h-12 text-slate-200 mx-auto" />
              <p className="text-slate-400 font-bold mt-4">기록이 없습니다.</p>
            </div>
          ) : (
            history.map((item) => (
              <div 
                key={item.id} 
                className={`group bg-white rounded-3xl border border-slate-200 shadow-sm transition-all ${expandedHistory === item.id ? 'ring-2 ring-indigo-500 ring-offset-2' : 'hover:shadow-md'}`}
              >
                {/* History Header (Summary) */}
                <div 
                  className="p-5 flex flex-col md:flex-row justify-between items-center cursor-pointer gap-4" 
                  onClick={() => {
                    if (editingId === item.id) return;
                    setExpandedHistory(expandedHistory === item.id ? null : item.id);
                  }}
                >
                  <div className="flex gap-4 items-center self-start md:self-center">
                    <div className="bg-indigo-600 text-white px-4 py-2 rounded-2xl text-xs font-black shadow-lg shadow-indigo-100">
                      {item.date}
                    </div>
                    <div className="font-black text-lg text-slate-800 flex items-center gap-2">
                       {/* Inline Editing Teacher Name */}
                       {editingId === item.id ? (
                         <input 
                           type="text" 
                           value={editTeacher} 
                           onClick={(e) => e.stopPropagation()}
                           onChange={(e) => setEditTeacher(e.target.value)} 
                           className="bg-slate-100 border border-slate-300 rounded px-2 py-1 text-sm w-32 focus:ring-2 focus:ring-indigo-500"
                         />
                       ) : (
                         <span>{item.absentTeacher} 선생님</span>
                       )}
                       <span className="text-slate-400 text-sm font-normal">
                         ({item.grade ? `${item.grade}학년 ${item.classNum}반` : ''})
                       </span>
                    </div>
                  </div>
                  
                  {/* Actions Area */}
                  <div className="flex items-center gap-2 self-end md:self-center">
                    
                    {editingId === item.id ? (
                      // Edit Mode Actions (Inline)
                      <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                        <button 
                          onClick={() => saveEditing(item.id)}
                          className="bg-emerald-500 hover:bg-emerald-600 text-white px-3 py-1.5 rounded-xl text-xs font-bold transition-colors shadow-md shadow-emerald-200 flex items-center gap-1"
                        >
                          <Check className="w-3 h-3" /> 저장
                        </button>
                        <button 
                          onClick={cancelEditing}
                          className="bg-slate-200 hover:bg-slate-300 text-slate-600 px-3 py-1.5 rounded-xl text-xs font-bold transition-colors flex items-center gap-1"
                        >
                          <X className="w-3 h-3" /> 취소
                        </button>
                      </div>
                    ) : deleteConfirmId === item.id ? (
                      // Delete Confirmation
                      <div className="flex items-center gap-2 bg-red-600 p-2 px-3 rounded-2xl animate-in fade-in zoom-in-95" onClick={(e) => e.stopPropagation()}>
                        <span className="text-[10px] font-black text-white mr-1 uppercase tracking-tighter whitespace-nowrap">삭제?</span>
                        <button 
                          onClick={() => executeDelete(item.id)} 
                          className="bg-white text-red-600 px-3 py-1 rounded-xl text-[10px] font-black hover:bg-red-50 transition-colors shadow-sm"
                        >
                          네
                        </button>
                        <button 
                          onClick={() => setDeleteConfirmId(null)} 
                          className="text-white px-2 py-1 text-[10px] font-black hover:underline"
                        >
                          아니요
                        </button>
                      </div>
                    ) : (
                      // Normal Actions
                      <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                        <button 
                          onClick={() => startEditing(item)} 
                          className="p-3 bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-800 hover:text-white rounded-2xl transition-all shadow-sm" 
                          title="수정"
                        >
                          <Edit className="w-5 h-5" />
                        </button>
                        <button 
                          onClick={() => copyImageToClipboard(item.id)} 
                          className="p-3 bg-indigo-50 text-indigo-700 border border-indigo-100 hover:bg-indigo-600 hover:text-white rounded-2xl transition-all shadow-sm" 
                          title="이미지 복사 (Ctrl+V)"
                        >
                          <Copy className="w-5 h-5" />
                        </button>
                        <button 
                          onClick={() => downloadImage(item.id)} 
                          className="p-3 bg-blue-50 text-blue-700 border border-blue-100 hover:bg-blue-600 hover:text-white rounded-2xl transition-all shadow-sm" 
                          title="이미지 다운로드"
                        >
                          <Download className="w-5 h-5" />
                        </button>
                        <button 
                          onClick={() => setDeleteConfirmId(item.id)} 
                          className="p-3 bg-red-50 text-red-700 border border-red-100 hover:bg-red-600 hover:text-white rounded-2xl transition-all shadow-sm" 
                          title="삭제"
                        >
                          <Trash className="w-5 h-5" />
                        </button>
                      </div>
                    )}

                    <div className="w-10 flex justify-center">
                      {expandedHistory === item.id ? <ChevronUp className="w-6 h-6 text-slate-500" /> : <ChevronDown className="w-6 h-6 text-slate-500" />}
                    </div>
                  </div>
                </div>
                
                {/* Expanded Content */}
                {expandedHistory === item.id && (
                  <div className="p-6 bg-slate-50 border-t border-slate-100 overflow-x-auto">
                    {editingId === item.id ? (
                      // Inline Edit Mode View
                      <div className="space-y-4">
                        <div className="grid grid-cols-1 gap-4">
                          {editSchedule.map((s, idx) => {
                            const linkInfo = getLinkFromContent(s.content);
                            // Only show art change if this slot has Art and it's the start of an art block
                            const showArtChange = s.content.includes('미술') && (idx === 0 || !editSchedule[idx-1].content.includes('미술'));
                            
                            return (
                              <div key={idx} className="flex flex-col md:flex-row gap-2 md:items-center bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
                                <div className="w-20 text-xs font-black text-slate-500 uppercase">{s.period}</div>
                                
                                <div className="flex-1 flex gap-2">
                                  {/* Type Selector in Edit Mode */}
                                  <select 
                                    value={s.type}
                                    onChange={(e) => updateEditTypeItem(idx, e.target.value as any)}
                                    className={`w-24 text-[11px] font-bold rounded-lg border px-1 outline-none ${
                                        s.type === '전담' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 
                                        s.type === '수업없음' ? 'bg-slate-100 text-slate-500 border-slate-200' :
                                        'bg-blue-50 text-blue-700 border-blue-200'
                                    }`}
                                  >
                                    <option value="보결">보결</option>
                                    <option value="전담">전담</option>
                                    <option value="수업없음">수업없음</option>
                                  </select>

                                  <input 
                                    type="text" 
                                    disabled={s.type !== '보결'}
                                    value={s.subTeacher} 
                                    onChange={(e) => updateEditTeacherItem(idx, e.target.value)} 
                                    placeholder={s.type === '전담' ? '전담' : s.type === '수업없음' ? '-' : '교사명'}
                                    className="w-24 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-sm focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                                  />
                                  <div className="flex-1 flex gap-2 relative">
                                    <input 
                                      type="text" 
                                      disabled={s.type !== '보결'}
                                      value={s.content} 
                                      onChange={(e) => updateEditScheduleItem(idx, e.target.value)} 
                                      className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-sm focus:ring-2 focus:ring-blue-500 pr-8 disabled:opacity-50"
                                    />
                                    {/* Link Icon in Edit Mode */}
                                    {linkInfo && s.type === '보결' && (
                                      <a 
                                        href={linkInfo.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-blue-500"
                                      >
                                        {linkInfo.type === 'youtube' ? <Youtube className="w-3.5 h-3.5" /> : <Link className="w-3.5 h-3.5" />}
                                      </a>
                                    )}

                                    {/* Reroll Art Button */}
                                    {showArtChange && s.type === '보결' && (
                                      <button 
                                        onClick={() => rerollArtForEdit(idx, item.grade, item.classNum)}
                                        className="px-2 py-1 bg-purple-100 text-purple-700 rounded-lg text-xs font-bold hover:bg-purple-200 whitespace-nowrap flex items-center gap-1"
                                        title="미술 랜덤 변경"
                                      >
                                        <RefreshCcw className="w-3 h-3" /> 미술변경
                                      </button>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ) : (
                      // Display Mode View (Image Capture Component)
                      <CaptureContent data={item} captureId={item.id} />
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export default App;