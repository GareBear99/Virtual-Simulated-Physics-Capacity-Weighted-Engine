
/* TRON Overlay (No Server)
   - Draws a lightweight "TRON grid" minimap (unfolded cube faces) on a top-left overlay canvas.
   - Adds an "Import Folder" control (webkitdirectory) that works on file://
   - Highlights tiles targeted by ARC module.activate events.
*/
(function(){
  'use strict';

  function el(tag, attrs){
    var e = document.createElement(tag);
    if (attrs){
      Object.keys(attrs).forEach(function(k){
        if (k === 'style') e.style.cssText = attrs[k];
        else if (k === 'text') e.textContent = attrs[k];
        else e.setAttribute(k, attrs[k]);
      });
    }
    return e;
  }

  function clamp(v,a,b){ return v<a?a:(v>b?b:v); }

  var state = {
    visible: true,
    highlight: null, // {face,i,j,untilMs}
    lastImportCount: 0,
    lastImportAt: 0
  };

  // Overlay container
  var wrap = el('div', { id:'tron-wrap', style:[
    'position:fixed','left:12px','top:64px','z-index:999998',
    'pointer-events:none'
  ].join(';') });
  function computeSafeTop(){
    try{
      var tb = document.getElementById('topbar');
      if(tb && tb.getBoundingClientRect){
        return Math.round(tb.getBoundingClientRect().bottom + 10);
      }
    }catch(_e){}
    return 64;
  }
  function applySafeTop(){
    try{ wrap.style.top = computeSafeTop()+'px'; }catch(_e){}
  }


  // HUD box
  var hud = el('div', { id:'tron-hud', style:[
    'pointer-events:auto',
    'width:420px','max-width:calc(100vw - 24px)',
    'background:rgba(0,0,0,0.45)',
    'border:1px solid rgba(255,255,255,0.18)',
    'border-radius:14px','padding:10px',
    'color:#e9e9f2','font:12px system-ui'
  ].join(';') });

  var title = el('div', {style:'display:flex;align-items:center;gap:10px;'});
  title.appendChild(el('b', {text:'TRON GRID'}));
  title.appendChild(el('span', {id:'tron-status', text:'idle', style:'opacity:.7'}));
  var help = el('span', {text:'G toggle', style:'margin-left:auto;opacity:.6'});
  title.appendChild(help);
  hud.appendChild(title);

  // Controls
  var controls = el('div', {style:'display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:8px;'});
  var inp = el('input', {type:'file', id:'tron-folder', webkitdirectory:'', directory:'', multiple:'', style:'display:none'});
  try{ inp.webkitdirectory = true; inp.multiple = true; inp.setAttribute('webkitdirectory',''); inp.setAttribute('directory',''); }catch(_e){}
  var btn = el('button', {id:'tron-btn', text:'Import Folder → Tiles', style:[
    'pointer-events:auto',
    'background:rgba(255,255,255,0.08)','color:#fff',
    'border:1px solid rgba(255,255,255,0.18)',
    'border-radius:12px','padding:8px 12px','cursor:pointer',
    'font:600 12px/1.0 system-ui','min-width:132px','text-align:center','backdrop-filter: blur(10px)','box-shadow:0 10px 30px rgba(0,0,0,0.35)'
  ].join(';') });
  var inpSnap = el('input', {type:'file', id:'tron-snapshot', accept:'.json,application/json', style:'display:none'});
  try{ inpSnap.multiple = false; }catch(_e){}
  var btnSnap = el('button', {id:'tron-btn-snap', text:'Import Snapshot JSON', style:[
    'pointer-events:auto',
    'background:rgba(255,255,255,0.08)','color:#fff',
    'border:1px solid rgba(255,255,255,0.18)','border-radius:10px',
    'padding:8px 12px','font:600 12px/1.0 system-ui',
    'backdrop-filter: blur(10px)',
    'box-shadow:0 10px 30px rgba(0,0,0,0.35)'
  ].join(';')});

  var meta = el('span', {id:'tron-meta', text:'', style:'opacity:.7'});
  var hint = el('span', {id:'tron-click-hint', text:'', style:'opacity:.55'});
  var btnExport = el('button', {id:'tron-btn-export', text:'Export Blueprint', style:[
    'pointer-events:auto',
    'background:rgba(255,255,255,0.06)','color:#fff',
    'border:1px solid rgba(255,255,255,0.14)',
    'border-radius:12px','padding:8px 12px','cursor:pointer',
    'font:600 12px/1.0 system-ui','min-width:132px','text-align:center','backdrop-filter: blur(10px)','box-shadow:0 10px 30px rgba(0,0,0,0.35)'
  ].join(';') });
  controls.appendChild(btn);
    controls.appendChild(btnSnap);
    controls.appendChild(inpSnap);
  controls.appendChild(btnExport);
  controls.appendChild(meta);
  controls.appendChild(hint);
  hud.appendChild(controls);
  hud.appendChild(inp);

  // Canvas
  var canvas = el('canvas', {id:'tron-canvas'});
  canvas.width = 400;
  canvas.height = 260;
  canvas.style.cssText = 'margin-top:10px;border-radius:12px;border:1px solid rgba(255,255,255,0.14);background:rgba(0,0,0,0.25);pointer-events:auto;';
  hud.appendChild(canvas);

  // Top tiles list
  var list = el('div', {id:'tron-top', style:'margin-top:10px;display:flex;flex-wrap:wrap;gap:6px;'});
  hud.appendChild(list);
  var mods = el('div', {id:'tron-mods', style:'margin-top:10px;display:flex;flex-direction:column;gap:8px;'});
  hud.appendChild(mods);

  wrap.appendChild(hud);
  document.body.appendChild(wrap);
  applySafeTop();

  var ctx = canvas.getContext('2d', { alpha:true });

  
  // Blueprint-driven face ordering (display only)
  var displayOrder = [0,1,2,3,4,5]; // slot -> logical face
  function faceFromDir(dir){
    var ax=Math.abs(dir.x), ay=Math.abs(dir.y), az=Math.abs(dir.z);
    var face=4;
    if(ax>=ay && ax>=az) face = dir.x>=0 ? 0 : 1;
    else if(ay>=ax && ay>=az) face = dir.y>=0 ? 2 : 3;
    else face = dir.z>=0 ? 4 : 5;
    return face;
  }
  function neighbors(face){
    switch(face){
      case 4: return {up:2,down:3,left:1,right:0,back:5};
      case 5: return {up:2,down:3,left:0,right:1,back:4};
      case 0: return {up:2,down:3,left:4,right:5,back:1};
      case 1: return {up:2,down:3,left:5,right:4,back:0};
      case 2: return {up:5,down:4,left:1,right:0,back:3};
      case 3: return {up:4,down:5,left:1,right:0,back:2};
      default: return {up:2,down:3,left:1,right:0,back:5};
    }
  }
  function recomputeDisplayOrder(){
    try{
      if(!(window.SYNTH && window.SYNTH.getPivotDirs)) return;
      var dirs = window.SYNTH.getPivotDirs();
      if(!dirs || !dirs.length) return;
      var counts=[0,0,0,0,0,0];
      for(var i=0;i<dirs.length;i++){
        var f = faceFromDir(dirs[i]);
        counts[f] = (counts[f]||0)+1;
      }
      var dom=4, best=-1;
      for(var f2=0;f2<6;f2++){ if(counts[f2]>best){ best=counts[f2]; dom=f2; } }
      var nb = neighbors(dom);
      displayOrder = [nb.back, nb.up, nb.down, nb.left, dom, nb.right];
      state.__faceCounts = counts;
      state.__domFace = dom;
    }catch(_e){}
  }
function faceRect(slot, cell){
    // cube net slots: [0 1 2] on top row, [3 4 5] on bottom row
    var col = slot % 3;
    var row = (slot/3)|0;
    var pad = 10;
    var w = (canvas.width - pad*2) / 3;
    var h = (canvas.height - pad*2) / 2;
    var x0 = pad + col*w;
    var y0 = pad + row*h;
    return {x:x0,y:y0,w:w,h:h,cell:cell};
  }

  function draw(){
    ctx.clearRect(0,0,canvas.width,canvas.height);

    // Face frames
    recomputeDisplayOrder();

    for (var s=0; s<6; s++){
      var f = displayOrder[s];
      var fr = faceRect(s);
      ctx.globalAlpha = 1;
      ctx.strokeStyle = 'rgba(255,255,255,0.16)';
      ctx.lineWidth = 1;
      ctx.strokeRect(fr.x, fr.y, fr.w, fr.h);

      // label
      var cnt = (state.__faceCounts && state.__faceCounts[f]) ? state.__faceCounts[f] : 0;
      ctx.fillStyle = (f===state.__domFace) ? 'rgba(255,255,255,0.78)' : (cnt>0 ? 'rgba(255,255,255,0.58)' : 'rgba(255,255,255,0.35)');
      ctx.font = (f===state.__domFace) ? '700 11px system-ui' : '11px system-ui';
      ctx.fillText('face '+f + (cnt>0 ? ('  • '+cnt) : ''), fr.x+6, fr.y+14);
    }

    if (!window.FS_TILES) return;

    var N = window.FS_TILES.N;
    var tiles = window.FS_TILES.tiles;

    // Draw heatmap
    recomputeDisplayOrder();

    for (var s=0; s<6; s++){
      var f = displayOrder[s];
      var fr = faceRect(s);
      var tw = fr.w / N;
      var th = fr.h / N;

      // compute max usedKB for scaling per face (cheap)
      var maxKB = 0;
      var arr = tiles[f];
      for (var idx=0; idx<arr.length; idx++){
        if (arr[idx].usedKB > maxKB) maxKB = arr[idx].usedKB;
      }
      maxKB = Math.max(1, maxKB);

      for (var i=0;i<N;i++){
        for (var j=0;j<N;j++){
          var s = arr[i*N + j];
          if (s.usedKB <= 0) continue;
          var a = clamp(s.usedKB / maxKB, 0, 1);
          // alpha encodes load; color is cyan-ish TRON
          ctx.fillStyle = 'rgba(0, 255, 255, ' + (0.06 + 0.28*a).toFixed(3) + ')';
          ctx.fillRect(fr.x + i*tw, fr.y + j*th, tw, th);
        }
      }
    }

    // Highlight from ARC
    if (state.highlight && Date.now() < state.highlight.untilMs){
      var h = state.highlight;
      var fr = faceRect(h.face);
      var N = window.FS_TILES.N;
      var tw = fr.w / N;
      var th = fr.h / N;
      var x = fr.x + h.i*tw;
      var y = fr.y + h.j*th;

      ctx.strokeStyle = 'rgba(255,255,255,0.85)';
      ctx.lineWidth = 2;
      ctx.strokeRect(x, y, tw, th);

      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.font = '12px system-ui';
      ctx.fillText('TARGET', x+4, y+14);
    }
  }

  function renderTop(){
    if (!window.FS_TILES) return;
    var top = window.FS_TILES.topTiles(10);
    list.innerHTML = top.map(function(t){
      // reverse idx to i/j
      var N = window.FS_TILES.N;
      var i = (t.idx / N)|0;
      var j = (t.idx % N);
      var id = window.FS_TILES.tileId(t.face,i,j);
      return '<span style="display:inline-block;padding:2px 10px;border-radius:999px;border:1px solid rgba(255,255,255,0.18);">'
        + id + ' • ' + t.usedKB + 'KB • ' + t.files + ' files'
        + '</span>';
    }).join('');
  }


  function card(titleText, bodyHtml){
    var c = document.createElement('div');
    c.style.cssText = 'background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.14);border-radius:12px;padding:8px 10px;';
    c.innerHTML = '<div style="display:flex;align-items:center;gap:8px;"><b>'+titleText+'</b><span style="margin-left:auto;opacity:.6">'+(new Date().toLocaleTimeString())+'</span></div>'
      + '<div style="margin-top:6px;opacity:.92">'+bodyHtml+'</div>';
    return c;
  }

  function setStatus(msg){
    var s = document.getElementById('tron-status');
    if (s) s.textContent = msg;
  }

  function showModule(name, payload){
    var mods = document.getElementById('tron-mods');
    if (!mods) return;

    var target = (payload && payload.target) ? String(payload.target) : '';
    var kind = (payload && payload.kind) ? String(payload.kind) : '';
    var score = (payload && payload.score != null) ? Number(payload.score).toFixed(2) : '';

    var infoHtml = '';
    if (window.FS_TILES){
      if (target.indexOf('tile:') === 0){
        var parts = target.split(':');
        if (parts.length === 4){
          var face = parseInt(parts[1],10), i = parseInt(parts[2],10), j = parseInt(parts[3],10);
          var N = window.FS_TILES.N;
          var idx = i*N + j;
          var s = window.FS_TILES.tiles[face] && window.FS_TILES.tiles[face][idx];
          if (s){
            infoHtml += '<div><span style="opacity:.7">target</span> '+target+' • <span style="opacity:.7">used</span> '+s.usedKB+'KB • <span style="opacity:.7">files</span> '+s.files+'</div>';
            if (s.topFiles && s.topFiles.length){
              infoHtml += '<div style="margin-top:6px;opacity:.85"><span style="opacity:.7">top files</span><br>'
                + s.topFiles.map(function(tf){ return '• '+tf.p+' ('+tf.kb+'KB)'; }).join('<br>')
                + '</div>';
            }
          }
        }
      } else if (target.indexOf('file:') === 0){
        var t = window.FS_TILES.fileToTile && window.FS_TILES.fileToTile.get(target);
        if (t){
          infoHtml += '<div><span style="opacity:.7">file</span> '+target.slice(5)+'</div>';
          infoHtml += '<div style="opacity:.85"><span style="opacity:.7">tile</span> '+window.FS_TILES.tileId(t.face,t.i,t.j)+'</div>';
        } else {
          infoHtml += '<div><span style="opacity:.7">file</span> '+target.slice(5)+'</div>';
        }
      } else {
        infoHtml += '<div><span style="opacity:.7">target</span> '+target+'</div>';
      }
    } else {
      infoHtml += '<div><span style="opacity:.7">target</span> '+target+'</div>';
    }

    var header = String(name || 'module').toUpperCase() + (kind ? ' • '+kind.toUpperCase() : '') + (score ? ' • '+score : '');
    var c = card(header, infoHtml);
    mods.insertBefore(c, mods.firstChild);
    while (mods.children.length > 6) mods.removeChild(mods.lastChild);
  }

  (function(){
    var prev = window.activateModule;
    window.activateModule = function(moduleName, payload){
      try{ showModule(moduleName || 'module', payload || {}); }catch(e){}
      try{ if (typeof prev === 'function') prev(moduleName, payload); }catch(e){}
    };
  })();

  // Hook into ARC bus by monkey-patching console log panel subscription point:
  // arc_bind already listens to module.activate; we add our own listener by wrapping publish.
  function attachToArc(){
    if (!window.ARCJS) return;
    if (window.__TRON_ARC_ATTACHED) return;
    window.__TRON_ARC_ATTACHED = true;

    // If arc_bind created a bus internally, we can't reach it. Instead, we listen globally by overriding ARC_FEED usage targets.
    // We'll use a lightweight interception by hooking window.activateModule (if present) OR by polling ARC panel log element.
    // Best-effort: listen to a custom event we dispatch in arc_bind.
  }

  // We expect arc_bind to exist; we add a safe DOM event listener for module.activate we dispatch.
  window.addEventListener('arc_module_activate', function(ev){
    var payload = ev && ev.detail;
    if (!payload) return;
    // If target maps to a tile or file, highlight
    var target = payload.target || '';
    var t = null;
    if (target.indexOf('tile:') === 0){
      var parts = target.split(':');
      if (parts.length === 4){
        t = {face: parseInt(parts[1],10), i: parseInt(parts[2],10), j: parseInt(parts[3],10)};
      }
    } else if (target.indexOf('file:') === 0 && window.FS_TILES && window.FS_TILES.fileToTile){
      t = window.FS_TILES.fileToTile.get(target) || null;
    }
    if (t){
      state.highlight = {face:t.face, i:t.i, j:t.j, untilMs: Date.now()+1200};
    }
  });

  // Wire import button
  btn.addEventListener('click', function(ev){
    try{ var h=document.getElementById('tron-click-hint'); if(h) h.textContent='opening folder picker…'; }catch(_e){}
    try{
      if (ev && ev.preventDefault) ev.preventDefault();
      inp.value = '';
      inp.click();
    }catch(_e){
      try{
        var evt = document.createEvent('MouseEvents');
        evt.initMouseEvent('click', true, true, window);
        inp.dispatchEvent(evt);
      }catch(_ee){}
    }
  });
  inp.addEventListener('change', function(){
    try{ var h=document.getElementById('tron-click-hint'); if(h) h.textContent=''; }catch(_e){}
    var files = inp.files;
    var status = document.getElementById('tron-status');
    var metaEl = document.getElementById('tron-meta');
    status.textContent = 'importing…';
    metaEl.textContent = (files && files.length) ? (files.length + ' files') : '';
    if (window.FS_TILES_IMPORT) window.FS_TILES_IMPORT(files);
  });
  // Wire snapshot import (JSON)
  btnSnap.addEventListener('click', function(ev){
    try{ var h=document.getElementById('tron-click-hint'); if(h) h.textContent='opening snapshot picker…'; }catch(_e){}
    try{
      if (ev && ev.preventDefault) ev.preventDefault();
      inpSnap.value = '';
      inpSnap.click();
    }catch(e){
      try{
        var evt = document.createEvent('MouseEvents');
        evt.initMouseEvent('click', true, true, window);
        inpSnap.dispatchEvent(evt);
      }catch(_ee){}
      try{ setError(e); }catch(_e){}
    }
  });
  inpSnap.addEventListener('change', function(){
    try{
      var f = inpSnap.files && inpSnap.files[0];
      if(!f) return;
      var r = new FileReader();
      r.onload = function(){
        try{
          var snap = JSON.parse(String(r.result||'{}'));
          if (snap.type !== 'ARC_SYSTEM_SNAPSHOT') throw new Error('Not an ARC_SYSTEM_SNAPSHOT JSON');
          if (!window.FS_TILES || typeof window.FS_TILES.importSnapshot !== 'function') throw new Error('FS_TILES.importSnapshot missing');
          var res = window.FS_TILES.importSnapshot(snap);
          try{
            if (window.FS_BLUEPRINT && typeof window.FS_BLUEPRINT.buildFromFS === 'function'){
              var bp = window.FS_BLUEPRINT.buildFromFS(res.seed32||0);
              if (window.SYNTH && typeof window.SYNTH.loadBlueprint === 'function') window.SYNTH.loadBlueprint(bp);
            }
          }catch(e){}
          logLine('SNAPSHOT: imported files='+(res.count||0)+' seed32='+(res.seed32||0));
        }catch(e){ setError(e); }
      };
      r.readAsText(f);
    }catch(e){ setError(e); }
  });


  // Called by FS_TILES on completion
  function onAutoBlueprint(shellId, nTiles){
    setStatus('auto-blueprint');
    setMeta('mapped '+(nTiles||0)+' tiles → '+(shellId||''));
  }

  window.TRON_OVERLAY = {
    onFSImportDone: function(count){
      try{ setStatus('mapped'); }catch(e){}
      try{ window.__ARC_DEMO_DISABLED = true; }catch(e){}
      try{ if (window.FS_TILES_MONITOR) window.FS_TILES_MONITOR.start(); }catch(e){}
      try{
        if (window.FS_TILES && typeof window.ARC_FEED === 'function'){
          var top = window.FS_TILES.topTiles(10);
          for (var x=0;x<top.length;x++){
            var t = top[x];
            var N = window.FS_TILES.N;
            var i = (t.idx / N) | 0;
            var j = (t.idx % N);
            var id = window.FS_TILES.tileId(t.face,i,j);
            window.ARC_FEED(id,'fs-burst', Math.max(1, (t.usedKB/64)|0));
          }
        }
      }catch(e){}

      state.lastImportCount = count||0;
      state.lastImportAt = Date.now();
      document.getElementById('tron-status').textContent = 'mapped';
      document.getElementById('tron-meta').textContent = state.lastImportCount + ' files → tiles';
      renderTop();
      draw();
    }
  };

  // Toggle with G
  window.addEventListener('keydown', function(ev){
    if (ev.key === 'g' || ev.key === 'G'){
      state.visible = !state.visible;
      wrap.style.display = state.visible ? 'block' : 'none';
    }
  });

  // animate
  function loop(){
    if (state.visible) draw();
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
  draw();

})();
