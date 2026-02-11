import React from 'react';
import { SubstitutionRecord } from '../types';
import { Youtube, Link } from 'lucide-react';
import { getLinkFromContent } from '../constants';

interface CaptureContentProps {
  data: SubstitutionRecord;
  captureId: string;
}

export const CaptureContent: React.FC<CaptureContentProps> = ({ data, captureId }) => {
  return (
    <div 
      id={captureId} 
      className="bg-white p-10 rounded-[40px] border-4 border-slate-900 shadow-2xl space-y-8 min-w-[800px]"
    >
      <div className="flex justify-between items-end border-b-8 border-slate-900 pb-5">
        <div>
          <div className="bg-indigo-600 text-white px-3 py-1 rounded-lg text-[10px] font-black inline-block mb-2 uppercase tracking-widest">
            Substitution Record
          </div>
          <h3 className="text-4xl font-black text-slate-900 tracking-tighter">
            보결 수업 계획 확인서
          </h3>
        </div>
        <div className="text-right space-y-1">
          <p className="text-xl font-black text-slate-900 underline decoration-indigo-500 decoration-4 underline-offset-4">
            {data.grade ? `${data.grade}학년 ${data.classNum}반 ` : ''}
            {data.absentTeacher} 선생님
          </p>
          <p className="text-sm font-bold text-slate-400">{data.date}</p>
        </div>
      </div>

      <div className="grid grid-cols-4 lg:grid-cols-7 gap-4">
        {data.schedule.map((s, i) => {
          const linkInfo = getLinkFromContent(s.content);
          
          let subTeacherDisplay = s.subTeacher || '-';
          let contentDisplay = s.content || '-';
          let typeColorClass = "text-slate-900"; // Default

          if (s.type === '전담') {
             subTeacherDisplay = '전담 수업';
             typeColorClass = "text-emerald-500";
          } else if (s.type === '수업없음') {
             subTeacherDisplay = '수업 없음';
             contentDisplay = '';
             typeColorClass = "text-slate-300";
          }

          return (
            <div 
              key={i} 
              className={`bg-slate-50 p-4 rounded-3xl border-2 border-slate-100 flex flex-col h-full min-h-[140px] relative overflow-hidden group ${s.type === '수업없음' ? 'opacity-60 bg-slate-100' : ''}`}
            >
              <div className="absolute top-0 right-0 p-2 bg-slate-200/50 rounded-bl-xl text-[9px] font-black text-slate-400">
                {i + 1}
              </div>
              <div className="text-[10px] font-black text-indigo-400 mb-2 uppercase tracking-widest">
                {s.period}
              </div>
              <div className={`text-sm font-black mb-2 leading-tight ${typeColorClass}`}>
                {subTeacherDisplay}
              </div>
              <div className="text-[10px] text-slate-500 leading-relaxed font-bold border-t border-slate-200 mt-auto pt-2 line-clamp-3 italic relative z-10">
                {contentDisplay}
              </div>
              
              {/* Link Overlay / Button */}
              {linkInfo && s.type === '보결' && (
                <a 
                  href={linkInfo.url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className={`absolute bottom-2 right-2 p-1.5 rounded-full shadow-sm z-20 transition-all transform hover:scale-110 ${linkInfo.type === 'youtube' ? 'bg-red-50 text-red-500 hover:bg-red-100' : 'bg-blue-50 text-blue-500 hover:bg-blue-100'}`}
                  title="자료 보기"
                  onClick={(e) => e.stopPropagation()} // Prevent bubble up if card has click
                >
                  {linkInfo.type === 'youtube' ? <Youtube className="w-4 h-4" /> : <Link className="w-4 h-4" />}
                </a>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex justify-between items-center text-[10px] font-bold text-slate-300 border-t-2 border-slate-100 pt-5 italic">
        <p>Substitution Management Archive</p>
        <p>문서 생성일: {new Date().toLocaleDateString()}</p>
      </div>
    </div>
  );
};