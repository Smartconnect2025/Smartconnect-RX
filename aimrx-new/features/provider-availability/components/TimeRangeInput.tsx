import React from 'react';
import { Input } from '@/components/ui/input';
import { Copy, Plus, Trash2 } from 'lucide-react';
import { TimeRange } from '../types';
import { Button } from '@/components/ui/button';

interface TimeRangeInputProps {
  timeRanges: TimeRange[];
  onChange: (timeRanges: TimeRange[]) => void;
}

const TimeRangeInput: React.FC<TimeRangeInputProps> = ({ timeRanges, onChange }) => {
  const addTimeRange = () => {
    const newRanges = [...timeRanges, { startTime: '08:30', endTime: '17:00' }];
    onChange(newRanges);
  };

  const removeTimeRange = (index: number) => {
    if (timeRanges.length <= 1) return;
    const newRanges = timeRanges.filter((_, i) => i !== index);
    onChange(newRanges);
  };

  const updateTimeRange = (index: number, field: keyof TimeRange, value: string) => {
    const newRanges = timeRanges.map((range, i) =>
      i === index ? { ...range, [field]: value } : range
    );
    onChange(newRanges);
  };

  const duplicateTimeRange = (index: number) => {
    const rangeToDuplicate = timeRanges[index];
    const newRanges = [...timeRanges, { ...rangeToDuplicate }];
    onChange(newRanges);
  };

  return (
    <div className="space-y-2">
      {timeRanges.map((range, index) => (
        <div key={index} className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 flex-grow min-w-[200px]">
            <Input
              type="time"
              value={range.startTime}
              onChange={e => updateTimeRange(index, 'startTime', e.target.value)}
              className="w-full max-w-[110px] border-gray-200"
            />
            <span className="text-gray-500">-</span>
            <Input
              type="time"
              value={range.endTime}
              onChange={e => updateTimeRange(index, 'endTime', e.target.value)}
              className="w-full max-w-[110px] border-gray-200"
            />
          </div>
          <div className="flex items-center gap-1 ml-auto">
            <Button
              variant="ghost"
              size="icon"
              onClick={addTimeRange}
              className="hover:bg-gray-100 h-8 w-8"
            >
              <Plus className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => duplicateTimeRange(index)}
              className="hover:bg-gray-100 h-8 w-8"
            >
              <Copy className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => removeTimeRange(index)}
              className="text-destructive hover:bg-gray-100 h-8 w-8"
              disabled={timeRanges.length <= 1}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
};

export default TimeRangeInput; 