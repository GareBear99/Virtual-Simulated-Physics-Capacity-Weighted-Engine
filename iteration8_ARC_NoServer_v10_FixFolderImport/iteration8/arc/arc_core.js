
(function(global){
  'use strict';
  function nowSec(){ return Math.floor(Date.now()/1000); }

  function EventBus(maxHistory){
    this.listeners = {};
    this.history = [];
    this.maxHistory = maxHistory || 300;
  }
  EventBus.prototype.subscribe = function(evt, fn){
    (this.listeners[evt] = this.listeners[evt] || []).push(fn);
  };
  EventBus.prototype.publish = function(evt, data){
    this.history.push({event: evt, data: data, ts: nowSec()});
    if (this.history.length > this.maxHistory) this.history.shift();
    var ls = this.listeners[evt] || [];
    for (var i=0;i<ls.length;i++){
      try{ ls[i](data); } catch(e){ console.error('[ARCJS] handler error', e); }
    }
  };

  function SignalStore(opts){
    opts = opts || {};
    this.maxPerEntity = opts.maxPerEntity || 500;
    this.entitySignals = {};
  }
  SignalStore.prototype.add = function(entity, source, v){
    if (!entity) return;
    entity = String(entity);
    var arr = this.entitySignals[entity] || (this.entitySignals[entity] = []);
    arr.push({ts: nowSec(), source: source || 'unknown', v: (v==null?1:v)});
    if (arr.length > this.maxPerEntity) arr.shift();
  };
  SignalStore.prototype.entities = function(){ return Object.keys(this.entitySignals); };
  SignalStore.prototype.series = function(entity){ return this.entitySignals[String(entity)] || []; };

  function SignalEngine(store){ this.store = store; }
  SignalEngine.prototype.ingestEntities = function(entities, source){
    if (!entities) return;
    for (var i=0;i<entities.length;i++) this.store.add(entities[i], source||'ingest', 1);
  };
  SignalEngine.prototype.ingest = function(entity, source, v){ this.store.add(entity, source||'ingest', v); };

  function TrendDetector(store){ this.store = store; }
  TrendDetector.prototype.score = function(entity){
    var s = this.store.series(entity);
    var t = nowSec();
    var recent=0, prior=0;
    for (var i=s.length-1;i>=0;i--){
      var age = t - s[i].ts;
      if (age <= 10) recent++;
      else if (age <= 70) prior++;
      else break;
    }
    var recentRate = recent / 10.0;
    var priorRate = prior / 60.0;
    if (priorRate <= 1e-6) return recentRate > 0 ? 10 : 0;
    return recentRate / priorRate;
  };
  TrendDetector.prototype.classify = function(entity){
    var r = this.score(entity);
    if (r >= 4.0) return {kind:'spike', score:r};
    if (r >= 1.7) return {kind:'trend', score:r};
    return {kind:'none', score:r};
  };

  function ARCModuleBridge(bus){
    this.bus = bus;
    this.cooldownSec = 1.0;
    this._last = {};
  }
  ARCModuleBridge.prototype._emit = function(kind, entity, score, meta){
    var key = kind + ':' + entity;
    var t = Date.now()/1000;
    if (this._last[key] && (t - this._last[key]) < this.cooldownSec) return;
    this._last[key] = t;
    this.bus.publish('module.activate', {
      command: 'activate',
      module: (kind === 'spike') ? 'scanner' : 'hud',
      target: String(entity),
      kind: kind,
      score: score,
      source: 'arc-js',
      meta: meta || {},
      ts: nowSec()
    });
  };
  ARCModuleBridge.prototype.signalSpike = function(entity, score, meta){ this._emit('spike', entity, score, meta); };
  ARCModuleBridge.prototype.signalTrend = function(entity, score, meta){ this._emit('trend', entity, score, meta); };

  global.ARCJS = {
    EventBus: EventBus,
    SignalStore: SignalStore,
    SignalEngine: SignalEngine,
    TrendDetector: TrendDetector,
    ARCModuleBridge: ARCModuleBridge
  };
})(window);
