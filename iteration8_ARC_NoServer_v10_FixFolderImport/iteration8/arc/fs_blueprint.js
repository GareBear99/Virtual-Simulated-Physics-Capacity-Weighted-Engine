/* FS Blueprint (No Server)
   Goal: deterministically map computer tiles <-> blueprint scan plan.
   - Builds blueprint from FS_TILES (usedKB>0 tiles) with a seed derived from folder signature.
   - Embeds fsMap so blueprint can reconstruct tiles without re-importing a folder.
   - Exposes:
       window.FS_BLUEPRINT.autoFromFS(seed)
       window.FS_BLUEPRINT.exportLast()
       window.FS_BLUEPRINT.apply(blueprintObject)
*/
(function(){
  'use strict';

  function h32(str){
    var h = 0x811c9dc5;
    for (var i=0;i<str.length;i++){ h ^= str.charCodeAt(i); h = (h + ((h<<1)+(h<<4)+(h<<7)+(h<<8)+(h<<24)))>>>0; }
    return h>>>0;
  }

  function tileId(face,i,j){ return 'tile:'+face+':'+i+':'+j; }

  function tilesExplicitFromFS(limit){
    var FS = window.FS_TILES;
    if (!FS || !FS.tiles) return [];
    var N = FS.N|0;
    var out = [];
    for (var face=0; face<6; face++){
      var arr = FS.tiles[face];
      if (!arr) continue;
      for (var idx=0; idx<arr.length; idx++){
        var s = arr[idx];
        if (!s) continue;
        if ((s.usedKB|0) > 0){
          var i = (idx / N) | 0;
          var j = (idx % N);
          out.push({face:face,i:i,j:j, usedKB:(s.usedKB|0), files:(s.files|0)});
        }
      }
    }
    // deterministic: sort by used desc, then tile id
    out.sort(function(a,b){
      var d = b.usedKB - a.usedKB;
      if (d) return d;
      var ta = tileId(a.face,a.i,a.j), tb = tileId(b.face,b.i,b.j);
      return ta < tb ? -1 : (ta>tb?1:0);
    });
    if (limit && out.length > limit) out.length = limit;
    return out.map(function(t){ return tileId(t.face,t.i,t.j); });
  }

  function buildFSMap(){
    var FS = window.FS_TILES;
    if (!FS) return null;
    var N = FS.N|0;
    var tiles = [];
    for (var face=0; face<6; face++){
      var arr = FS.tiles[face];
      if (!arr) continue;
      for (var idx=0; idx<arr.length; idx++){
        var s = arr[idx];
        if (!s) continue;
        if ((s.usedKB|0) || (s.files|0)){
          var i = (idx / N) | 0;
          var j = (idx % N);
          tiles.push({
            face: face, i: i, j: j,
            usedKB: (s.usedKB|0),
            files: (s.files|0),
            topFiles: (s.topFiles && s.topFiles.length) ? s.topFiles.slice(0,6) : []
          });
        }
      }
    }
    var fileIndex = [];
    try{
      if (FS.fileToTile){
        FS.fileToTile.forEach(function(t, key){
          // key is "file:relpath"
          fileIndex.push({file: String(key).slice(5), tile: tileId(t.face,t.i,t.j)});
        });
      }
    }catch(e){}
    fileIndex.sort(function(a,b){ return a.file < b.file ? -1 : (a.file>b.file?1:0); });

    return {
      version: 1,
      N: N,
      seed: FS.seed || 0,
      tiles: tiles,
      fileIndex: fileIndex
    };
  }

  function makeBlueprintFromFS(seed){
    var FS = window.FS_TILES;
    if (!FS) throw new Error('FS_TILES missing');
    var shellId = 'FS_SHELL_' + (seed>>>0).toString(16).toUpperCase();
    var tilesExplicit = tilesExplicitFromFS(600);

    // Minimal pivot/edge payload (keeps Synth happy). We will bypass route sampling via tilesExplicit.
    var bp = {
      shellId: shellId,
      origin: {x:0.1,y:0.02,z:0.994},
      pivots: [{id:0,u:0.14,v:0},{id:1,u:0,v:0.14},{id:2,u:-0.14,v:0}],
      edges: [{a:0,b:1},{a:1,b:2},{a:2,b:0}],
      tilesExplicit: tilesExplicit,
      fsMap: buildFSMap()
    };
    return bp;
  }

  function applyFSMap(fsMap){
    var FS = window.FS_TILES;
    if (!FS || !fsMap) return;
    if ((fsMap.N|0) !== (FS.N|0)){
      // If N mismatch, do nothing (avoids wrong mapping). Caller can rebuild with matching config.
      return;
    }
    // reset
    for (var face=0; face<6; face++){
      var arr = FS.tiles[face];
      if (!arr) continue;
      for (var i=0;i<arr.length;i++){
        arr[i].usedKB = 0; arr[i].files = 0;
        if (arr[i].topFiles) arr[i].topFiles.length = 0;
      }
    }
    // apply tiles
    for (var k=0;k<fsMap.tiles.length;k++){
      var t = fsMap.tiles[k];
      var idx = (t.i|0)*(FS.N|0) + (t.j|0);
      var s = FS.tiles[t.face|0] && FS.tiles[t.face|0][idx];
      if (!s) continue;
      s.usedKB = (t.usedKB|0);
      s.files  = (t.files|0);
      if (t.topFiles && s.topFiles){
        s.topFiles.length = 0;
        for (var x=0;x<Math.min(6,t.topFiles.length);x++) s.topFiles.push(t.topFiles[x]);
      }
    }
    // rebuild fileToTile
    try{
      FS.fileToTile = new Map();
      if (fsMap.fileIndex){
        for (var i=0;i<fsMap.fileIndex.length;i++){
          var it = fsMap.fileIndex[i];
          var parts = String(it.tile).split(':');
          if (parts.length !== 4) continue;
          FS.fileToTile.set('file:'+it.file, {face:parseInt(parts[1],10), i:parseInt(parts[2],10), j:parseInt(parts[3],10)});
        }
      }
    }catch(e){}
    try{ FS.seed = fsMap.seed || FS.seed; }catch(e){}
  }

  var __lastBlueprint = null;

  function autoFromFS(seed){
    try{
      __lastBlueprint = makeBlueprintFromFS(seed||0);
      // Apply to Synth immediately if exposed
      if (window.SYNTH && typeof window.SYNTH.loadBlueprint === 'function'){
        window.SYNTH.loadBlueprint(__lastBlueprint);
      }
      // persist
      try{ localStorage.setItem('arc_last_blueprint', JSON.stringify(__lastBlueprint)); }catch(e){}
      // notify overlay
      try{ if (window.TRON_OVERLAY && window.TRON_OVERLAY.onAutoBlueprint) window.TRON_OVERLAY.onAutoBlueprint(__lastBlueprint.shellId, (__lastBlueprint.tilesExplicit||[]).length); }catch(e){}
    }catch(e){}
  }

  function exportLast(){
    if (!__lastBlueprint){
      try{
        var s = localStorage.getItem('arc_last_blueprint');
        if (s) __lastBlueprint = JSON.parse(s);
      }catch(e){}
    }
    return __lastBlueprint;
  }

  function apply(bp){
    if (!bp) return;
    if (bp.fsMap) applyFSMap(bp.fsMap);
    __lastBlueprint = bp;
    try{ localStorage.setItem('arc_last_blueprint', JSON.stringify(bp)); }catch(e){}
    if (window.SYNTH && typeof window.SYNTH.loadBlueprint === 'function'){
      window.SYNTH.loadBlueprint(bp);
    }
  }

  window.FS_BLUEPRINT = { autoFromFS:autoFromFS, exportLast:exportLast, apply:apply, applyFSMap:applyFSMap };
})();

(function(){
  'use strict';
  function xorshift32(x){ x|=0; x ^= x<<13; x ^= x>>>17; x ^= x<<5; return x|0; }
  function rand01(st){ st.v = xorshift32(st.v); return ((st.v>>>0) / 4294967296); }
  function makeBlueprint(seed32){
    var st = {v: seed32|0};
    var th = rand01(st) * Math.PI * 2;
    var z  = rand01(st) * 0.9 + 0.1;
    var rr = Math.sqrt(Math.max(0,1 - z*z));
    var origin = {x: Math.cos(th)*rr, y: Math.sin(th)*rr, z: z};

    var pivots = [];
    var edges  = [];
    var maxP = 24;
    if (window.FS_TILES && typeof window.FS_TILES.topTiles === 'function'){
      var top = window.FS_TILES.topTiles(maxP);
      for (var i=0;i<top.length;i++){
        var t = top[i];
        var u = ((t.idx % window.FS_TILES.N) / (window.FS_TILES.N-1) - 0.5) * 0.7;
        var v = (((t.idx / window.FS_TILES.N)|0) / (window.FS_TILES.N-1) - 0.5) * 0.7;
        var w = Math.max(0.15, Math.min(1.0, (t.usedKB/8192)));
        pivots.push({u:u, v:v, w:w});
      }
    }
    while(pivots.length < 8){
      pivots.push({u:(rand01(st)-0.5)*0.7, v:(rand01(st)-0.5)*0.7, w:0.25});
    }
    for (var k=0;k<pivots.length;k++){
      edges.push({a:k, b:(k+1)%pivots.length});
      if (k%3===0) edges.push({a:k, b:(k+4)%pivots.length});
    }
    return { type:'SYNTH_BLUEPRINT', version:1, seed32:(seed32|0), origin:origin, pivots:pivots, edges:edges };
  }
  window.FS_BLUEPRINT = window.FS_BLUEPRINT || {};
  window.FS_BLUEPRINT.buildFromFS = function(seed32){ return makeBlueprint(seed32|0); };
})();
