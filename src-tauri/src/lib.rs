use tauri::Manager;
use tauri_plugin_shell::ShellExt;
use tauri_plugin_shell::process::CommandChild;
use std::sync::{Arc, Mutex, atomic::{AtomicBool, Ordering}};
use cpal::traits::StreamTrait;
use std::io::Write;

mod audio_capture;

struct RecordingState(Mutex<Option<(Arc<Mutex<CommandChild>>, cpal::Stream, Arc<AtomicBool>,String, String, String)>>);

#[tauri::command]
async fn start_recording(
    app: tauri::AppHandle, 
    state: tauri::State<'_, RecordingState>,
    x: f64, y: f64, width: f64, height: f64
) -> Result<(), String> {

    let adj_width = (width as i32 / 2) * 2;
    let adj_height = (height as i32 / 2) * 2;
    let size_str = format!("{}x{}", adj_width, adj_height);

    let video_dir = app.path().video_dir().map_err(|e| e.to_string())?;
    let now = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_secs();
    
    let temp_v_path = video_dir.join(format!("v_{}.mkv", now)).to_string_lossy().to_string();
    let temp_a_path = video_dir.join(format!("a_{}.wav", now)).to_string_lossy().to_string();
    let mp4_path = video_dir.join(format!("record_{}.mp4", now)).to_string_lossy().to_string();

    let (tx, rx) = std::sync::mpsc::channel::<Vec<u8>>();
    let running = Arc::new(AtomicBool::new(false));
    let audio_stream = audio_capture::start_listening(tx, running.clone())?;


    running.store(true, std::sync::atomic::Ordering::SeqCst);

    std::thread::sleep(std::time::Duration::from_millis(200));

    let (mut rx_events, child) = app.shell()
        .sidecar("ffmpeg")
        .map_err(|e| e.to_string())?
        .args([
            "-y",
            "-f", "gdigrab", 
            "-framerate", "30",
            "-draw_mouse", "1",
            "-offset_x", &x.to_string(), 
            "-offset_y", &y.to_string(),
            "-video_size", &size_str, 
            "-i", "desktop",
            "-c:v", "libx264", 
            "-preset", "ultrafast", 
            "-crf", "25", 
            "-pix_fmt", "yuv420p",
            &temp_v_path
        ])
        .spawn()
        .map_err(|e| e.to_string())?;

    tauri::async_runtime::spawn(async move {
        while let Some(event) = rx_events.recv().await {
            if let tauri_plugin_shell::process::CommandEvent::Stderr(line) = event {
                println!("FFMPEG LOG: {}", String::from_utf8_lossy(&line));
            }
        }
    });

    let shared_child = Arc::new(Mutex::new(child));

    let a_path_clone = temp_a_path.clone();
    let running_audio = running.clone();

    std::thread::spawn(move || {
        let file = std::fs::File::create(&a_path_clone).unwrap();
        let mut writer = std::io::BufWriter::with_capacity(128 * 1024, file);
        
        let bytes_per_10ms: usize = 3840; // (48000 * 2 * 4) / 100
        let timeout = std::time::Duration::from_millis(10);

        let initial_offset_ms = 1000; 
        let _ = writer.write_all(&vec![0u8; (bytes_per_10ms * initial_offset_ms / 10)]);

        while running_audio.load(Ordering::SeqCst) {
            match rx.recv_timeout(timeout) {
                Ok(bytes) => {
                    let _ = writer.write_all(&bytes);
                }
                Err(std::sync::mpsc::RecvTimeoutError::Timeout) => {
                    let silence = vec![0u8; bytes_per_10ms];
                    let _ = writer.write_all(&silence);
                }
                Err(std::sync::mpsc::RecvTimeoutError::Disconnected) => break,
            }
        }
        let _ = writer.flush();
    });

    let mut state_guard = state.0.lock().unwrap();
    *state_guard = Some((shared_child, audio_stream, running, temp_v_path, temp_a_path, mp4_path));

    Ok(())
}

#[tauri::command]
async fn stop_recording(app: tauri::AppHandle, state: tauri::State<'_, RecordingState>) -> Result<(), String> {
    let mut state_guard = state.0.lock().unwrap();
    
    if let Some((shared_child, stream, running, temp_v, temp_a, mp4_path)) = state_guard.take() {
        let _ = running.store(false, Ordering::Relaxed);
        let _ = stream.pause();
        
        {
            let mut child_lock = shared_child.lock().unwrap();
            let _ = child_lock.write(b"q");
        } 

        std::thread::sleep(std::time::Duration::from_millis(800));

        if let Ok(arc_inner) = Arc::try_unwrap(shared_child) {
            if let Ok(child) = arc_inner.into_inner() {
                let _ = child.kill();
            }
        }

        println!("Merge video and audio...");

        std::thread::sleep(std::time::Duration::from_millis(3000));

        let _ = app.shell()
            .sidecar("ffmpeg")
            .map_err(|e| e.to_string())?
            .args([
                "-y",
                "-i", &temp_v,
                "-f", "f32le", "-ar", "48000", "-ac", "2", "-i", &temp_a,
                "-c:v", "copy", 
                "-c:a", "aac", "-b:a", "192k",
                "-map", "0:v:0", "-map", "1:a:0",
                "-shortest", 
                &mp4_path
            ])
            .spawn()
            .map_err(|e| e.to_string())?;

        println!("Record Successfull: {}", mp4_path);
    }
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(RecordingState(Mutex::new(None)))
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![start_recording, stop_recording])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}