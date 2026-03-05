import { useState, useEffect } from "react";

interface Props {
  onComplete: (area: any) => void;
  onCancel: () => void;
}

export default function SnipOverlay({ onComplete, onCancel }: Props) {
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const [currentPos, setCurrentPos] = useState({ x: 0, y: 0 });
  const [isDrawing, setIsDrawing] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onCancel]);

  const onMouseDown = (e: React.MouseEvent) => {
    if (e.button === 2) {
      onCancel();
      return;
    }
    setStartPos({ x: e.clientX, y: e.clientY });
    setCurrentPos({ x: e.clientX, y: e.clientY });
    setIsDrawing(true);
  };

  const onMouseMove = (e: React.MouseEvent) => {
    if (isDrawing) setCurrentPos({ x: e.clientX, y: e.clientY });
  };

  const onMouseUp = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    
    const area = {
      x: Math.min(startPos.x, currentPos.x),
      y: Math.min(startPos.y, currentPos.y),
      width: Math.abs(currentPos.x - startPos.x),
      height: Math.abs(currentPos.y - startPos.y),
    };

    if (area.width > 10 && area.height > 10) {
      onComplete(area);
    } else {
      onCancel();
    }
  };

  return (
    <div 
      className="snip-container" 
      onMouseDown={onMouseDown} 
      onMouseMove={onMouseMove} 
      onMouseUp={onMouseUp}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-[#0a0f1a] border border-cyan-500/30 px-4 py-2 rounded-full text-[10px] text-cyan-400 font-bold shadow-2xl">
        DRAG TO SELECT AREA • ESC TO CANCEL
      </div>

      {isDrawing && (
        <div className="selection-box" style={{
          left: Math.min(startPos.x, currentPos.x),
          top: Math.min(startPos.y, currentPos.y),
          width: Math.abs(currentPos.x - startPos.x),
          height: Math.abs(currentPos.y - startPos.y),
        }}>
          {/* Show dimensions inside the box */}
          <span className="absolute -top-6 left-0 text-[10px] text-cyan-400 font-mono bg-[#0a0f1a] px-1 border border-cyan-500/20">
            {Math.abs(currentPos.x - startPos.x)} x {Math.abs(currentPos.y - startPos.y)}
          </span>
        </div>
      )}
    </div>
  );
}