
(function(){
  'use strict';
  function safe(fn){ try{ fn(); } catch(e){ console.error('[ARCJS] bind error', e); } }

  function createPanel(){
    var panel = document.createElement('div');
    panel.id = 'arc-panel';
    panel.style.cssText = 'position:fixed;right:12px;top:12px;width:360px;max-width:calc(100vw - 24px);max-height:45vh;overflow:auto;z-index:999999;background:rgba(0,0,0,0.55);border:1px solid rgba(255,255,255,0.18);border-radius:14px;padding:10px;color:#e9e9f2;font:12px system-ui';
    panel.innerHTML = '<div style="display:flex;align-items:center;gap:8px;"><b>ARC</b><span id="arc-status" style="opacity:.7">booting…</span><span style="margin-left:auto;opacity:.6">H toggle</span></div><div id="arc-entities" style="margin-top:8px;display:flex;flex-wrap:wrap;gap:6px;"></div><pre id="arc-log" style="margin-top:8px;white-space:pre-wrap;word-break:break-word;max-height:22vh;overflow:auto;"></pre>';
    document.body.appendChild(panel);
    return panel;
  }

  function pill(text){
    return '<span style="display:inline-block;padding:2px 10px;border-radius:999px;border:1px solid rgba(255,255,255,0.18);">'+text+'</span>';
  }

  function boot(){
    if (!window.ARCJS) return;

    var panel = document.getElementById('arc-panel') || createPanel();
    var status = document.getElementById('arc-status');
    var entEl = document.getElementById('arc-entities');
    var logEl = document.getElementById('arc-log');

    var bus = new ARCJS.EventBus(400);
    var store = new ARCJS.SignalStore({maxPerEntity: 600});
    var engine = new ARCJS.SignalEngine(store);
    var trend = new ARCJS.TrendDetector(store);
    var bridge = new ARCJS.ARCModuleBridge(bus);

    window.ARC_FEED = function(entity, source, v){
      engine.ingest(entity, source||'ext', v==null?1:v);
    };

    function pushLog(obj){
      var line = JSON.stringify(obj, null, 2);
      logEl.textContent = (line + '\n\n' + logEl.textContent).slice(0, 14000);
    }

    bus.subscribe('module.activate', function(payload){
      pushLog({event:'module.activate', payload: payload});
      try{ window.dispatchEvent(new CustomEvent('arc_module_activate',{detail: payload})); }catch(e){}

      var fn = window.activateModule || (window.Iteration8 && window.Iteration8.activateModule);
      if (typeof fn === 'function'){
        try{ fn(payload.module, payload); } catch(e){}
      }

      var flash = document.createElement('div');
      flash.textContent = 'ARC ' + payload.kind.toUpperCase() + ' → ' + payload.module + ' : ' + payload.target;
      flash.style.cssText = 'position:fixed;left:12px;bottom:12px;padding:8px 12px;border-radius:12px;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.18);z-index:999999;color:#fff;font:12px system-ui';
      document.body.appendChild(flash);
      setTimeout(function(){ try{ flash.remove(); }catch(_){} }, 700);
    });

    function renderEntities(){
      var ents = store.entities().slice(0, 40);
      entEl.innerHTML = ents.map(function(e){
        var c = trend.classify(e);
        var badge = (c.kind === 'spike') ? 'SPIKE' : (c.kind === 'trend' ? 'TREND' : 'OK');
        return pill(e + ' ' + badge + ' ' + c.score.toFixed(2));
      }).join('');
    }

    var demo = ['rf_cluster_alpha','entity_beta','entity_gamma','rf_cluster_alpha','rf_cluster_alpha'];
    window.__ARC_DEMO_DISABLED = window.__ARC_DEMO_DISABLED || false;
    window.ARC_DEMO_ENABLE = function(on){ window.__ARC_DEMO_DISABLED = !on; };
    function tick(){
      if (!window.__ARC_DEMO_DISABLED){ engine.ingestEntities(demo, 'demo'); }
      var ents = store.entities();
      for (var i=0;i<ents.length;i++){
        var e = ents[i];
        var cls = trend.classify(e);
        if (cls.kind === 'spike') bridge.signalSpike(e, cls.score, {detector:'rate'});
        else if (cls.kind === 'trend') bridge.signalTrend(e, cls.score, {detector:'rate'});
      }
      renderEntities();
    }
    setInterval(tick, 650);
    tick();

    status.textContent = 'running';
  }

  window.addEventListener('keydown', function(ev){
    if (ev.key === 'h' || ev.key === 'H'){
      var p = document.getElementById('arc-panel');
      if (p) p.style.display = (p.style.display === 'none') ? 'block' : 'none';
    }
  });

  window.addEventListener('load', function(){
    setTimeout(function(){ safe(boot); }, 0);
  });
})();
