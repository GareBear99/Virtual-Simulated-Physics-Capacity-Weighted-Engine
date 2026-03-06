
/* FS Tiles (No Server / file:// compatible)
   Uses <input webkitdirectory> to get folder file list (no permissions APIs needed).
   Maps files -> cube faces + (i,j) tiles via stable hash.
   Emits ARC_FEED signals for tiles + files.
*/
(function(){
  'use strict';

  function h32(str){
    // FNV-1a 32-bit
    var h = 0x811c9dc5;
    for (var i=0;i<str.length;i++){
      h ^= str.charCodeAt(i);
      h = (h + (h<<1) + (h<<4) + (h<<7) + (h<<8) + (h<<24)) >>> 0;
    }
    return h >>> 0;
  }

  function kb(bytes){ return Math.max(0, Math.round((bytes||0)/1024)); }

  function clamp(v,a,b){ return v<a?a:(v>b?b:v); }

  var N = 28; // per-face resolution (lightweight)
  var faces = 6;
  var tiles = new Array(faces);
  for (var f=0; f<faces; f++){
    var arr = new Array(N*N);
    for (var k=0;k<arr.length;k++) arr[k] = {usedKB:0, files:0, topFiles:[]};
    tiles[f] = arr;
  }

  var fileToTile = new Map(); // entity string -> {face,i,j,idx}
  var lastImportTs = 0;

  function tileId(face,i,j){ return 'tile:'+face+':'+i+':'+j; }

  function sigSeed(list){
    // list: [{p,kb}]
    // deterministic seed from folder signature (paths + kb), order-invariant
    list.sort(function(a,b){ return a.p < b.p ? -1 : (a.p>b.p?1:0); });
    var acc = '';
    // sample to avoid huge string
    var step = Math.max(1, Math.floor(list.length/800));
    for (var i=0;i<list.length;i+=step){
      acc += list[i].p + '|' + list[i].kb + ';';
    }
    return h32(acc);
  }


  function mapPathToTile(relPath){
    var h = h32(relPath);
    var face = h % 6;
    var hi = (h >>> 8) % N;
    var hj = (h >>> 16) % N;
    var idx = hi*N + hj;
    return {face:face, i:hi, j:hj, idx:idx};
  }

  function resetTiles(){
    for (var f=0; f<faces; f++){
      var arr = tiles[f];
      for (var k=0;k<arr.length;k++){
        arr[k].usedKB = 0;
        arr[k].files = 0;
        arr[k].topFiles.length = 0;
      }
    }
    fileToTile.clear();
  }

  function ingestFile(relPath, sizeBytes){
    var t = mapPathToTile(relPath);
    var tstate = tiles[t.face][t.idx];
    var k = kb(sizeBytes);
    tstate.usedKB += k;
    tstate.files += 1;
    // keep up to 6 largest files per tile
    if (k > 0){
      var tf = tstate.topFiles;
      tf.push({p: relPath, kb: k});
      tf.sort(function(a,b){ return b.kb - a.kb; });
      if (tf.length > 6) tf.length = 6;
    }

    var fileEntity = 'file:'+relPath;
    fileToTile.set(fileEntity, t);

    // Feed ARC: file entity + tile entity (small bounded signals)
    if (typeof window.ARC_FEED === 'function'){
      window.ARC_FEED(fileEntity, 'fs', k);
      window.ARC_FEED(tileId(t.face,t.i,t.j), 'fs', k);
    }
  }

  function topTiles(limit){
    limit = limit || 12;
    var out = [];
    for (var f=0; f<faces; f++){
      var arr = tiles[f];
      for (var idx=0; idx<arr.length; idx++){
        var s = arr[idx];
        if (s.usedKB <= 0) continue;
        out.push({face:f, idx:idx, usedKB:s.usedKB, files:s.files});
      }
    }
    out.sort(function(a,b){ return b.usedKB - a.usedKB; });
    return out.slice(0, limit);
  }

  // Public API for overlay renderer

  var __monitorTimer = null;
  function startMonitor(){
    if (__monitorTimer) return;
    __monitorTimer = setInterval(function(){
      if (typeof window.ARC_FEED !== 'function') return;
      var top = topTiles(8);
      for (var x=0;x<top.length;x++){
        var t = top[x];
        var N = window.FS_TILES.N;
        var i = (t.idx / N) | 0;
        var j = (t.idx % N);
        window.ARC_FEED(tileId(t.face,i,j), 'fs-heartbeat', 1);
      }
    }, 800);
  }
  function stopMonitor(){ if (__monitorTimer){ clearInterval(__monitorTimer); __monitorTimer=null; } }
  window.FS_TILES_MONITOR = { start: startMonitor, stop: stopMonitor };

  function getLastFileList(){ return __lastFileList ? __lastFileList.slice() : null; }
  
  function importSnapshot(snapshot){
    if(!snapshot || !Array.isArray(snapshot.files)) throw new Error('Bad snapshot JSON');
    var fileList = snapshot.files.map(function(f){
      return { relPath: String(f.path||''), size: (+f.size||0) };
    }).filter(function(x){ return x.relPath; });

    reset();
    var N = FS_TILES.N;
    for (var a=0;a<fileList.length;a++){
      var relPath = fileList[a].relPath;
      var size = fileList[a].size|0;
      var h = hash32(relPath);
      var face = (h >>> 24) % 6;
      var idx  = (h & 0x00FFFFFF) % (N*N);
      applyFileToTile(face, idx, relPath, size);
      fileToTile.set('file:'+relPath, {face:face, idx:idx, i:(idx/N)|0, j:(idx%N), kb:((size/1024)|0)});
    }
    try{ FS_TILES.lastSeed32 = (snapshot.seed32!=null) ? (snapshot.seed32|0) : 0; }catch(e){}
    if(window.TRON_OVERLAY && typeof window.TRON_OVERLAY.onFSImportDone==='function'){
      window.TRON_OVERLAY.onFSImportDone(fileList.length);
    }
    return {count:fileList.length, seed32: FS_TILES.lastSeed32||0};
  }

  function topTiles(maxCount){
    maxCount = Math.max(1, Math.min(128, maxCount|0 || 24));
    var arr = [];
    for (var face=0; face<6; face++){
      var tiles = faces[face].tiles;
      for (var idx=0; idx<tiles.length; idx++){
        var t = tiles[idx];
        if(!t) continue;
        var used = (t.usedKB|0) || 0;
        if (used <= 0) continue;
        arr.push({face:face, idx:idx, usedKB:used});
      }
    }
    arr.sort(function(a,b){ return (b.usedKB|0) - (a.usedKB|0); });
    if (arr.length > maxCount) arr.length = maxCount;
    return arr;
  }

window.FS_TILES = {
    N: N,
    tiles: tiles,
    reset: resetTiles,
    topTiles: topTiles,
    getLastFileList: getLastFileList,
    mapPathToTile: mapPathToTile,
    fileToTile: fileToTile,
    tileId: tileId
  };

  // UI panel (attached by tron overlay if present)
  window.FS_TILES_IMPORT = function(fileList){
    // fileList: FileList
    if (!fileList || !fileList.length) return;
    lastImportTs = Date.now();
    resetTiles();

    // Time-slice processing to stay responsive
    var i = 0;
    function step(){
      var start = performance.now();
      while (i < fileList.length && (performance.now() - start) < 12){
        var f = fileList[i++];
        // webkitRelativePath is stable for webkitdirectory
        var rel = f.webkitRelativePath || f.name || ('file_'+i);
        ingestFile(rel, f.size || 0);
      }
      if (i < fileList.length){
        requestAnimationFrame(step);
      } else {
        // done
        if (window.TRON_OVERLAY && window.TRON_OVERLAY.onFSImportDone){
          window.TRON_OVERLAY.onFSImportDone(fileList.length);
        }
        try{ window.__ARC_DEMO_DISABLED = true; }catch(e){}
        try{ if (window.FS_TILES_MONITOR) window.FS_TILES_MONITOR.start(); }catch(e){}
        try{
          var seed = sigSeed(fileList);
          window.FS_TILES.seed = seed;
          if (window.FS_BLUEPRINT && window.FS_BLUEPRINT.autoFromFS) window.FS_BLUEPRINT.autoFromFS(seed);
        }catch(e){}
      }
    }
    requestAnimationFrame(step);
  };

})();
