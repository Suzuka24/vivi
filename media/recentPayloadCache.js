'use strict';
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.ViviRecentPayloadCache=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  function sameSource(left,right){
    return !!left&&!!right&&left.path===right.path&&left.size===right.size&&left.mtimeMs===right.mtimeMs&&left.ctimeMs===right.ctimeMs&&left.ino===right.ino;
  }
  class RecentPayloadCache {
    constructor(limit=3){this.limit=Math.max(1,Number(limit)||3);this.items=[];this.timer=null;this.serial=0;}
    clear(){if(this.timer)clearTimeout(this.timer);this.timer=null;this.items=[];}
    prune(){
      const now=Date.now();this.items=this.items.filter(item=>item.expires>now);
      if(this.timer)clearTimeout(this.timer);this.timer=null;
      if(this.items.length){const next=Math.min(...this.items.map(item=>item.expires));this.timer=setTimeout(()=>this.prune(),Math.max(1,next-now));this.timer?.unref?.();}
    }
    remember(identity,value,seconds,openedAt=Date.now()){
      this.prune();
      const ttl=Math.max(0,Number(seconds)||0)*1000;
      if(!identity||!value||!ttl)return false;
      const expires=Number(openedAt)+ttl;
      if(expires<=Date.now())return false;
      this.items=this.items.filter(item=>!sameSource(item.identity,identity));
      this.items.push({identity:{...identity},value,openedAt:Number(openedAt),expires,order:++this.serial});
      this.items.sort((left,right)=>right.openedAt-left.openedAt||right.order-left.order);this.items.length=Math.min(this.items.length,this.limit);this.prune();return true;
    }
    get(identity){this.prune();return this.items.find(item=>sameSource(item.identity,identity))?.value||null;}
    remainingSeconds(){this.prune();return this.items.length?Math.max(0,(Math.max(...this.items.map(item=>item.expires))-Date.now())/1000):0;}
    get size(){this.prune();return this.items.length;}
    remove(identity){this.items=this.items.filter(item=>!sameSource(item.identity,identity));this.prune();}
    update(identity,value){const item=this.items.find(candidate=>sameSource(candidate.identity,identity));if(!item)return false;item.value=value;return true;
    }
  }
  return {RecentPayloadCache,sameSource};
});
