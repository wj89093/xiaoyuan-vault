export const BUBBLE_HTML = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:transparent;overflow:hidden;user-select:none}
.bubble{
  width:48px;height:48px;border-radius:50%;
  background:#ffffff;
  position:absolute;top:8px;left:8px;
  display:flex;align-items:center;justify-content:center;
  box-shadow:0 2px 12px rgba(0,0,0,0.08),0 0 0 1px rgba(0,0,0,0.04);
  transition:transform .15s,box-shadow .15s;
  color:#515154;
  cursor:pointer;
}
.bubble:hover{transform:scale(1.08);box-shadow:0 4px 20px rgba(0,0,0,0.12),0 0 0 1px rgba(122,122,255,0.15)}
.bubble.drag-over{transform:scale(1.15);box-shadow:0 0 0 3px #007aff,0 6px 24px rgba(0,122,255,0.2)}
</style></head><body>
<div class="bubble" id="bubble"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg></div>
<script>
var ipc = require('electron').ipcRenderer
var spawn = require('child_process').spawn
var b = document.getElementById('bubble')

var sx, sy, dragging = false, moved = false
b.addEventListener('mousedown', function(e) { sx=e.screenX; sy=e.screenY; dragging=true; moved=false; e.preventDefault() })
document.addEventListener('mousemove', function(e) {
  if(!dragging) return
  if(Math.abs(e.screenX-sx)>2||Math.abs(e.screenY-sy)>2) moved=true
  if(moved){
    ipc.send('bubble:move', e.screenX-sx, e.screenY-sy)
    sx=e.screenX; sy=e.screenY
  }
})
document.addEventListener('mouseup', function() { dragging=false })
b.addEventListener('click', function() { if(!moved) ipc.send('bubble:expand') })

document.addEventListener('dragover', function(e) {
  e.preventDefault(); e.stopPropagation()
  b.classList.add('drag-over')
  document.body.style.background = 'rgba(0,122,255,0.08)'
})
document.addEventListener('dragleave', function(e) {
  if (e.target === document.body || !document.body.contains(e.relatedTarget)) {
    b.classList.remove('drag-over')
    document.body.style.background = 'transparent'
  }
})

document.addEventListener('drop', function(e) {
  e.preventDefault(); e.stopPropagation()
  b.classList.remove('drag-over')
  document.body.style.background = 'transparent'

  var files = Array.from(e.dataTransfer.files || [])
  var paths = files.map(function(f){ return f.path || '' }).filter(Boolean)

  if (paths.length === 0) {
    var proc = spawn('/usr/bin/osascript', ['-e', 'tell application "SystemEvents" to POSIX path of (the clipboard as alias)'], {timeout: 500})
    var chunks = []
    proc.stdout.on('data', function(d){ chunks.push(d) })
    proc.on('close', function(code){
      if (code === 0 && chunks.length) {
        var raw = Buffer.concat(chunks).toString().trim()
        var lines = raw.split('\n').filter(Boolean)
        if (lines.length > 0) {
          paths = lines.map(function(p){ return decodeURIComponent(p.replace(/^file:\\/\\//, '').replace(/^\\/Volumes\\//, '/')) })
          console.log('[Bubble renderer] osascript got paths:', paths)
          if (paths.length) { ipc.send('bubble:drop', { filePaths: paths, text: '' }); flashGreen(); return }
        }
      }
      var txt = e.dataTransfer.getData('text/plain') || ''
      if (txt) ipc.send('bubble:drop', { filePaths: [], text: txt })
      else console.log('[Bubble renderer] drop: no files, no text')
    })
    return
  }

  ipc.send('bubble:drop', { filePaths: paths, text: '' })
  flashGreen()
})

function flashGreen() {
  b.style.background = '#34c759'; b.style.color = '#fff'
  setTimeout(function(){ b.style.background = '#ffffff'; b.style.color = '#515154' }, 600)
}
</script></body></html>`
