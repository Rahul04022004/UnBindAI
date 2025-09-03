import React from 'react';
import type { AnalysisResponse } from '../types';
import { CalendarIcon } from './Icons';

interface KeyDatesViewProps {
  analysisResult: AnalysisResponse;
}

const generateIcsFile = (dateStr: string, description: string) => {
    // This is a very basic parser and may not handle all date formats.
    // A more robust solution would use a date parsing library.
    let startDate = new Date();
    try {
        const parsedDate = new Date(dateStr);
        if(!isNaN(parsedDate.getTime())) {
            startDate = parsedDate;
        }
    } catch(e) {
        // Fallback to today if parsing fails
    }

    const pad = (num: number) => (num < 10 ? '0' + num : num);
    const formatDate = (date: Date) => {
        return `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`;
    };

    const icsContent = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//UnBind//AI Contract Analysis//EN',
        'BEGIN:VEVENT',
        `UID:${Date.now()}@unbind.app`,
        `DTSTAMP:${formatDate(new Date())}`,
        `DTSTART;VALUE=DATE:${formatDate(startDate).substring(0,8)}`,
        `SUMMARY:${description}`,
        `DESCRIPTION:Key date from contract: ${description}. Date mentioned: ${dateStr}.`,
        'END:VEVENT',
        'END:VCALENDAR'
    ].join('\r\n');

    const blob = new Blob([icsContent], { type: 'text/calendar' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'contract_event.ics';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
};


const KeyDatesView: React.FC<KeyDatesViewProps> = ({ analysisResult }) => {
  if (!analysisResult.keyDates || analysisResult.keyDates.length === 0) {
    return (
        <div>
            <h3 className="text-2xl font-bold text-white mb-2">Key Dates</h3>
            <p className="text-gray-400">No specific dates or deadlines were identified in this document.</p>
        </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-2xl font-bold text-white">Key Dates & Deadlines</h3>
        <p className="text-gray-300 mt-2 max-w-3xl">
          The AI has identified the following important dates and deadlines. You can add them to your calendar for reminders.
        </p>
      </div>
      <div className="space-y-4">
        {analysisResult.keyDates.map((item, index) => (
          <div key={index} className="flex items-center justify-between p-4 rounded-lg bg-gray-900/50 hover:bg-gray-900/80 border border-gray-700 transition-colors">
            <div>
              <p className="font-semibold text-indigo-300">{item.date}</p>
              <p className="text-sm text-gray-300">{item.description}</p>
            </div>
            <button 
                onClick={() => generateIcsFile(item.date, item.description)}
                className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-500 transition-colors"
                title="Add to Calendar"
            >
              <CalendarIcon className="mr-1.5 h-4 w-4" />
              Add
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default KeyDatesView;