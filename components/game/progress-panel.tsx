"use client"

interface ProgressPanelProps {
  currentIndex: number
  totalTracks: number
  currentStage: number
  stageDurations: readonly number[]
  progress: number
  isPlaying: boolean
  score: number
  correctCount: number
}

export function ProgressPanel({
  currentIndex,
  totalTracks,
  currentStage,
  stageDurations,
  progress,
  isPlaying,
  score,
  correctCount,
}: ProgressPanelProps) {
  return (
    <>
      <div className="bg-[#090d16]/60 backdrop-blur-xl border border-white/10 rounded-2xl p-6 mb-6 ring-1 ring-white/5 shadow-2xl">
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="text-center sm:text-left">
            <span className="font-display text-xs font-semibold text-[#10b981] uppercase tracking-widest">Playlist Progress</span>
            <h2 className="text-white font-extrabold text-xl font-display">
              Track {currentIndex + 1} <span className="text-[#6b7280] text-sm">of {totalTracks}</span>
            </h2>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex sm:gap-3 w-full sm:w-auto">
            <div className="bg-white/[0.03] border border-white/10 rounded-xl px-3 py-2.5 text-center">
              <p className="text-[10px] text-gray-400 uppercase tracking-wide">Score</p>
              <p className="text-white font-extrabold text-lg">{score}</p>
            </div>
            <div className="bg-white/[0.03] border border-white/10 rounded-xl px-3 py-2.5 text-center">
              <p className="text-[10px] text-gray-400 uppercase tracking-wide">Solved</p>
              <p className="text-white font-extrabold text-lg">{correctCount}</p>
            </div>
            <div className="bg-[#10b981]/10 border border-[#10b981]/20 rounded-xl px-4 py-2.5 text-center">
              <p className="text-[10px] text-[#10b981] uppercase tracking-wide">Current Stage</p>
              <p className="text-white font-extrabold text-lg">{currentStage + 1} / 6</p>
            </div>
            <div className="bg-indigo-500/10 border border-indigo-400/20 rounded-xl px-4 py-2.5 text-center">
              <p className="text-[10px] text-indigo-300 uppercase tracking-wide">Clip Duration</p>
              <p className="text-white font-extrabold text-lg">{(stageDurations[currentStage] / 1000).toFixed(1)}s</p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-[#090d16]/60 backdrop-blur-xl border border-white/10 rounded-2xl p-6 mb-6 ring-1 ring-white/5 shadow-2xl">
        <div className="relative mb-3">
          <div className="bg-[#030712]/90 rounded-full h-4 overflow-hidden relative border border-white/5">
            {/* Unlocked background portion */}
            <div 
              className="absolute left-0 top-0 bottom-0 bg-white/[0.03]" 
              style={{ width: `${(stageDurations[currentStage] / 15000) * 100}%` }} 
            />
            {/* Active green playhead */}
            <div
              className={`h-full absolute left-0 top-0 bottom-0 bg-[#10b981] rounded-full ${isPlaying ? "shadow-[0_0_18px_rgba(16,185,129,0.65)]" : ""}`}
              style={{
                width: `${(progress / 100) * (stageDurations[currentStage] / 15000) * 100}%`,
                transition: isPlaying ? "width 50ms linear" : "none",
              }}
            />
            {/* Separators */}
            <div className="absolute inset-0 pointer-events-none">
              {[3.33, 6.67, 13.33, 26.67, 53.33].map((pos) => (
                <div key={pos} className="absolute top-0 bottom-0 w-[1px] bg-[#020617]/90" style={{ left: `${pos}%` }} />
              ))}
            </div>
          </div>
        </div>
        {/* Dynamic aligned & staggered labels */}
        <div className="relative w-full h-9 text-[10px] sm:text-xs font-semibold text-[#6b7280]">
          <span className="absolute left-0 top-0">0s</span>
          <span className="absolute top-4" style={{ left: "3.33%", transform: "translateX(-50%)" }}>0.5s</span>
          <span className="absolute top-0" style={{ left: "6.67%", transform: "translateX(-50%)" }}>1s</span>
          <span className="absolute top-4" style={{ left: "13.33%", transform: "translateX(-50%)" }}>2s</span>
          <span className="absolute top-0" style={{ left: "26.67%", transform: "translateX(-50%)" }}>4s</span>
          <span className="absolute top-4" style={{ left: "53.33%", transform: "translateX(-50%)" }}>8s</span>
          <span className="absolute right-0 top-0 text-[#10b981] font-bold">15s</span>
        </div>
      </div>
    </>
  )
}
