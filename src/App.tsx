import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Video, Target, X, StopCircle, RotateCcw } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { LogicalSize } from "@tauri-apps/api/dpi";
import SnipOverlay from "./SnipOverlay";

export default function App() {
  const startSnip = async () => {
    const window = getCurrentWebviewWindow();
    await window.setFullscreen(true);
    await window.setAlwaysOnTop(true);
    setView("snapping");
  };
  const cancelAll = async () => {
    const window = getCurrentWebviewWindow();
    await window.setFullscreen(false);
    await window.setSize(new LogicalSize(400, 56)); 
    setView("standby");
  };
  const [view, setView] = useState<"standby" | "snapping" | "recording">("standby");
  const [timer, setTimer] = useState(0);

  const handleExit = async () => {
    const window = getCurrentWebviewWindow();
    await window.destroy();
  };

  const stopRecording = async () => {
    await invoke("stop_recording");
    cancelAll();
  };

  useEffect(() => {
    let interval: any;
    if (view === "recording") {
      interval = setInterval(() => setTimer((t) => t + 1), 1000);
    } else {
      setTimer(0);
    }
    return () => clearInterval(interval);
  }, [view]);



  const onAreaSelected = async (area: any) => {
    const window = getCurrentWebviewWindow();
    await window.setFullscreen(false); 
    await window.setSize(new LogicalSize(400, 56)); 
    
    console.log("Area grabbed:", area);
    setView("recording");
    await invoke("start_recording", area);
  };

  const formatTime = (s: number) => {
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="h-screen w-screen overflow-hidden">
      <AnimatePresence mode="wait">
        {view === "standby" && (
          <motion.div
            key="standby"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            data-tauri-drag-region
            className="h-full w-full bg-[#0a0f1a] border border-cyan-500/30 rounded-2xl flex items-center justify-between px-5 cursor-grab active:cursor-grabbing select-none"
          >
            <div data-tauri-drag-region className="flex items-center gap-3 pointer-events-none">
              <div className="p-1.5 bg-cyan-900/40 rounded-lg border border-cyan-500/20">
                <Video className="text-cyan-400" size={16} />
              </div>
              <div data-tauri-drag-region className="flex flex-col">
                <h1 className="text-[11px] font-black tracking-widest text-white leading-none">RUSTED</h1>
                <div className="flex items-center gap-1 mt-1">
                  <span className="w-1 h-1 rounded-full bg-cyan-400 animate-pulse"></span>
                  <span className="text-[7px] text-cyan-500/80 font-mono uppercase tracking-widest">Ready</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <button
                onClick={startSnip}
                className="px-4 py-1.5 bg-cyan-500 text-[#0a0f1a] rounded-lg text-[10px] font-black hover:bg-white hover:shadow-[0_0_15px_rgba(34,211,238,0.5)] transition-all flex items-center gap-2"
              >
                <Target size={12} /> Record
              </button>
              <button onClick={handleExit} className="text-slate-500 hover:text-red-400 transition-colors">
                <X size={16} />
              </button>
            </div>
          </motion.div>
        )}

        {view === "snapping" && (
          <motion.div key="snapping" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <SnipOverlay onComplete={onAreaSelected} onCancel={stopRecording} />
          </motion.div>
        )}

        {view === "recording" && (
        <motion.div
          key="recording"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          data-tauri-drag-region
          className="h-full w-full bg-[#0a0f1a] border border-red-500/40 rounded-2xl flex items-center justify-between px-5 cursor-grab active:cursor-grabbing select-none"
        >
          <div data-tauri-drag-region className="flex items-center gap-4 pointer-events-none">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
              <span className="text-[12px] font-mono font-bold text-white">{formatTime(timer)}</span>
            </div>
            <div className="h-4 w-[1px] bg-white/10" />
            <span data-tauri-drag-region className="text-[8px] text-red-500/80 font-black tracking-tighter uppercase">
              REC • AREA ACTIVE
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button 
              onClick={stopRecording}
              className="p-1.5 text-slate-500 hover:text-white hover:bg-white/5 rounded-md transition-all"
              title="Abort Recording"
            >
              <RotateCcw size={14} />
            </button>
            <button
              onClick={stopRecording}
              className="px-4 py-1.5 bg-red-500/10 border border-red-500/50 text-red-500 rounded-lg text-[10px] font-black hover:bg-red-500 hover:text-white transition-all flex items-center gap-2"
            >
              <StopCircle size={12} /> STOP
            </button>
          </div>
        </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}