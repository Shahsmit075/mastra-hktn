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
      <div className="flex items-center min-w-[700px] justify-between px-4 relative">
        
        {/* Connecting Lines (Background) */}
        <div className="absolute left-[10%] right-[10%] top-1/2 -translate-y-1/2 h-0.5 bg-gray-800 z-0"></div>

        {NODES.map((node, index) => {
          const Icon = node.icon;
          const isActive = node.activeStates.includes(status);
          const isCurrent = 
            (status === 'triaging' && node.id === 'triage') ||
            (status === 'awaiting_approval' && node.id === 'approval') ||
            (status === 'executing' && node.id === 'remediation') ||
            (status === 'post_mortem' && node.id === 'post_mortem') ||
            (status === 'resolved' && node.id === 'post_mortem'); // Cap off at the end

          let nodeClasses = "w-16 h-16 rounded-lg flex items-center justify-center border-2 z-10 transition-all duration-500 bg-background ";
          let iconClasses = "w-7 h-7 transition-colors duration-500 ";
          
          if (isFailed) {
            nodeClasses += "border-gray-800 opacity-50";
            iconClasses += "text-gray-600";
          } else if (isCurrent) {
            nodeClasses += "border-amber bg-amber/10 shadow-[0_0_15px_rgba(232,168,56,0.5)] scale-110";
            iconClasses += "text-amber animate-pulse";
          } else if (isActive) {
            nodeClasses += "border-high/50 bg-surface";
            iconClasses += "text-high";
          } else {
            nodeClasses += "border-gray-800 bg-surface";
            iconClasses += "text-gray-600";
          }

          return (
            <div key={node.id} className="relative flex flex-col items-center group">
              <div className={nodeClasses}>
                <Icon className={iconClasses} strokeWidth={1.5} />
              </div>
              <div className="absolute top-20 text-[10px] font-mono font-bold tracking-widest text-center uppercase whitespace-nowrap">
                <span className={isCurrent ? 'text-amber' : isActive && !isFailed ? 'text-high' : 'text-gray-600'}>
                  {node.label}
                </span>
              </div>
              
              {/* Animated Progress Line bridging to the next node */}
              {index < NODES.length - 1 && (
                <div className="absolute left-[100%] top-8 w-full h-0.5 -translate-y-1/2 z-0 overflow-hidden">
                  {isActive && !isFailed && !isCurrent && (
                     <div className="h-full bg-high w-full"></div>
                  )}
                  {isCurrent && (
                     <div className="h-full bg-amber w-full origin-left animate-pulse"></div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
      
      {/* Final Outcome Indicator */}
      <div className="flex justify-center mt-12 min-h-8">
        {status === 'resolved' && (
          <div className="flex items-center gap-2 text-green-500 font-mono text-sm animate-pulse shadow-[0_0_10px_rgba(34,197,94,0.3)] bg-green-500/10 px-4 py-1.5 rounded-full border border-green-500/30">
            <CheckCircle2 className="w-4 h-4" />
            <span>INCIDENT_RESOLVED</span>
          </div>
        )}
        {status === 'failed' && (
          <div className="flex items-center gap-2 text-critical font-mono text-sm shadow-[0_0_10px_rgba(255,69,69,0.3)] bg-critical/10 px-4 py-1.5 rounded-full border border-critical/30">
            <XCircle className="w-4 h-4" />
            <span>INCIDENT_FAILED</span>
          </div>
        )}
      </div>
    </div>
  );
}
