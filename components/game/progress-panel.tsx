"use client"

interface ProgressPanelProps {
  currentIndex: number
  totalTracks: number
  currentStage: number
  stageDurations: readonly number[]
  progress: number
  isPlaying: boolean
}

export function ProgressPanel({
  currentIndex,
  totalTracks,
  currentStage,
  stageDurations,
  progress,
  isPlaying,
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
          <div className="flex gap-3">
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
            <div className="absolute left-0 top-0 bottom-0 bg-white/[0.03]" style={{ width: `${(stageDurations[currentStage] / 15000) * 100}%` }} />
            <div
              className={`h-full absolute left-0 top-0 bottom-0 bg-[#10b981] rounded-full ${isPlaying ? "shadow-[0_0_18px_rgba(16,185,129,0.65)]" : ""}`}
              style={{
                width: `${(progress / 100) * (stageDurations[currentStage] / 15000) * 100}%`,
                transition: isPlaying ? "width 50ms linear" : "none",
              }}
            />
            <div className="absolute inset-0 pointer-events-none flex justify-between">
              {[3.33, 6.67, 13.33, 26.67, 53.33].map((pos) => (
                <div key={pos} className="absolute top-0 bottom-0 w-[1px] bg-[#020617]/90" style={{ left: `${pos}%` }} />
              ))}
            </div>
          </div>
        </div>
        <div className="flex justify-between items-center text-xs font-semibold text-[#6b7280] px-1">
          <span>0s</span>
          <div className="flex space-x-7 sm:space-x-8">
            <span>0.5s</span><span>1s</span><span>2s</span><span>4s</span><span>8s</span>
          </div>
          <span className="text-[#10b981] font-bold">15s</span>
        </div>
      </div>
    </>
  )
}
