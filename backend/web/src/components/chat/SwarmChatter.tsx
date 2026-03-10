import { useState } from 'react';

interface A2APacket {
  source_id: string;
  target_id: string;
  timestamp: number;
  message: {
    type: 'TaskAssignment' | 'TaskProgress' | 'TaskCompletion' | 'ClarificationRequest';
    payload: any;
  };
}

export function SwarmChatter() {
  const [packets] = useState<A2APacket[]>([]);

  return (
    <div className="swarm-chatter">
      <h3>Agent Communication</h3>
      {packets.map((p, i) => (
        <div key={i} className={`msg-${p.message.type.toLowerCase()}`}>
          {p.source_id} → {p.target_id}: {p.message.type}
        </div>
      ))}
    </div>
  );
}
