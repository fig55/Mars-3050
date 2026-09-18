// The shell deliberately does almost nothing. Game logic, AI and content all live
// in the JavaScript frontend; this crate exists to own the native window and to
// expose the store/dialog plugins the UI needs.
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_dialog::init())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
