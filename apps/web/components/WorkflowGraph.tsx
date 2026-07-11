import { Activity, BrainCircuit, Wrench, UserCheck, FileText, CheckCircle2, XCircle } from 'lucide-react';

export type WorkflowStatus = 'idle' | 'triaging' | 'awaiting_approval' | 'executing' | 'post_mortem' | 'resolved' | 'failed';

interface WorkflowGraphProps {
  status?: WorkflowStatus;
  className?: string;
}

const NODES = [
  { id: 'telemetry', label: 'TELEMETRY_INGEST', icon: Activity, activeStates: ['idle', 'triaging', 'awaiting_approval', 'executing', 'post_mortem', 'resolved'] },
  { id: 'triage', label: 'AI_TRIAGE', icon: BrainCircuit, activeStates: ['triaging', 'awaiting_approval', 'executing', 'post_mortem', 'resolved'] },
  { id: 'remediation', label: 'PLAN_GENERATION', icon: Wrench, activeStates: ['awaiting_approval', 'executing', 'post_mortem', 'resolved'] },
  { id: 'approval', label: 'HITL_GATE', icon: UserCheck, activeStates: ['awaiting_approval', 'executing', 'post_mortem', 'resolved'] },
  { id: 'post_mortem', label: 'POST_MORTEM', icon: FileText, activeStates: ['post_mortem', 'resolved'] },
];

export function WorkflowGraph({ status = 'idle', className = '' }: WorkflowGraphProps) {
  const isFailed = status === 'failed';
  
  return (
    <div className={`w-full py-8 overflow-x-auto ${className}`}>
      <div className="flex items-center min-w-[700px] justify-between px-8 relative">
        
        {/* Connecting Lines (Background) */}
        <div className="absolute left-[10%] right-[10%] top-1/2 -translate-y-1/2 h-[2px] bg-border-hairline z-0"></div>

        {NODES.map((node, index) => {
          const Icon = node.icon;
          const isActive = node.activeStates.includes(status);
          const isCurrent = 
            (status === 'triaging' && node.id === 'triage') ||
            (status === 'awaiting_approval' && node.id === 'approval') ||
            (status === 'executing' && node.id === 'remediation') ||
            (status === 'post_mortem' && node.id === 'post_mortem') ||
            (status === 'resolved' && node.id === 'post_mortem'); // Cap off at the end
            
          const isCompleted = isActive && !isCurrent && !isFailed;

          let nodeClasses = "w-12 h-12 rounded-full flex items-center justify-center border-2 z-10 transition-all duration-base ";
          let iconClasses = "w-5 h-5 transition-colors duration-base ";
          
          if (isFailed) {
            nodeClasses += "border-border-strong bg-bg-surface opacity-50";
            iconClasses += "text-text-muted";
          } else if (isCurrent) {
            nodeClasses += "border-accent bg-bg-surface scale-110 shadow-[0_0_15px_var(--accent-muted)]";
            iconClasses += "text-accent";
          } else if (isCompleted) {
            nodeClasses += "border-accent bg-accent";
            iconClasses += "text-text-on-accent";
          } else {
            nodeClasses += "border-border-strong bg-bg-surface";
            iconClasses += "text-text-muted";
          }

          return (
            <div key={node.id} className="relative flex flex-col items-center group min-w-max">
              <div className={nodeClasses}>
                <Icon className={iconClasses} strokeWidth={2} />
              </div>
              <div className="absolute top-16 text-[10px] font-mono tracking-[0.04em] text-center uppercase whitespace-nowrap min-w-max">
                <span className={isCurrent ? 'text-accent font-bold' : isCompleted ? 'text-text-primary font-bold' : 'text-text-muted font-medium'}>
                  {node.label}
                </span>
              </div>
              
              {/* Animated Progress Line bridging to the next node */}
              {index < NODES.length - 1 && (
                <div className="absolute left-[100%] top-[23px] w-[calc(100%+32px)] h-[2px] -translate-y-1/2 z-0 overflow-hidden ml-4">
                  {isCompleted && !isCurrent && (
                     <div className="h-full bg-accent w-full"></div>
                  )}
                  {isCurrent && (
                     <div className="h-full w-full bg-gradient-to-r from-border-hairline via-accent to-border-hairline bg-[length:200%_100%] animate-[pulse_2s_ease-in-out_infinite]"></div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
      
      {/* Final Outcome Indicator */}
      <div className="flex justify-center mt-16 min-h-8">
        {status === 'resolved' && (
          <div className="flex items-center gap-2 text-healthy font-mono text-[10px] tracking-[0.04em] shadow-elevated bg-healthy-muted px-3 py-1 rounded-sm border border-healthy/20 uppercase">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>INCIDENT_RESOLVED</span>
          </div>
        )}
        {status === 'failed' && (
          <div className="flex items-center gap-2 text-critical font-mono text-[10px] tracking-[0.04em] shadow-elevated bg-critical-muted px-3 py-1 rounded-sm border border-critical/20 uppercase">
            <XCircle className="w-3.5 h-3.5" />
            <span>INCIDENT_FAILED</span>
          </div>
        )}
      </div>
    </div>
  );
}
