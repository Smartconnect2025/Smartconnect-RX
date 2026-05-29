import React from 'react';
import { AvailabilityBlock } from '../types';
import { AvailabilityCard } from './AvailabilityCard';

interface AvailabilityListProps {
  availability: AvailabilityBlock[];
  onEdit: (blockId: string) => void;
}

export const AvailabilityList: React.FC<AvailabilityListProps> = ({ availability, onEdit }) => {
  return (
    <div className="space-y-4">
      {availability.map((block) => (
        <AvailabilityCard key={block.id} block={block} onEdit={onEdit} />
      ))}
    </div>
  );
}; 