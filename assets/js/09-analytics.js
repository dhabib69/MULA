// Lightweight MULA usage analytics. No names, phone numbers, addresses, or order contents.
(function(){
  var analyticsReady=false;
  function surface(){return window.MulaPrinter?'android_cashier':'web';}
  window.mulaLogEvent=function(name,params){
    try{
      if(!analyticsReady||!window.firebase?.analytics)return;
      window.firebase.analytics().logEvent(name,Object.assign({surface:surface()},params||{}));
    }catch(e){console.debug('MULA analytics unavailable',e);}
  };
  function init(){
    try{
      if(!window.firebase?.analytics||!window.firebaseConfig?.measurementId)return;
      window.firebase.analytics();
      analyticsReady=true;
      window.mulaLogEvent('mula_visit',{entry_path:location.pathname||'/'});
    }catch(e){console.debug('MULA analytics init skipped',e);}
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();