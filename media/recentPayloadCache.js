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
    constructor(){this.item=null;this.timer=null;}
    clear(){if(this.timer)clearTimeout(this.timer);this.timer=null;this.item=null;}
    remember(identity,value,seconds){
      this.clear();
      const ttl=Math.max(0,Number(seconds)||0)*1000;
      if(!identity||!value||!ttl)return;
      this.item={identity:{...identity},value,expires:Date.now()+ttl};
      this.timer=setTimeout(()=>this.clear(),ttl);
    }
    take(identity){
      if(!this.item||this.item.expires<=Date.now()||!sameSource(this.item.identity,identity)){if(this.item?.expires<=Date.now())this.clear();return null;}
      const value=this.item.value;this.clear();return value;
    }
  }
  return {RecentPayloadCache,sameSource};
});
