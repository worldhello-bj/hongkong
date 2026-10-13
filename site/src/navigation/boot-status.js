/** Keep startup failures visible even when the module entry cannot initialize. */
(function(){
  const show=(message,source)=>{
    window.__navigationError={message,source,at:new Date().toISOString()};
    const status=document.querySelector('[data-app="status"]');
    if(status){status.textContent='页面遇到错误：'+message+'。请重新加载资料。';return;}
    const host=document.querySelector('#navigation-app');
    if(host){host.textContent='导航页面加载失败：'+message+'。请刷新页面重试。';host.setAttribute('role','alert');}
  };
  window.addEventListener('error',event=>{
    if(event.target?.tagName==='SCRIPT')show('程序文件未能加载',event.target.src);
    else if(event.error)show(event.error.message,event.filename);
  },true);
  window.addEventListener('unhandledrejection',event=>{if(event.reason?.name!=='AbortError')show(event.reason?.message??String(event.reason),'promise')});
})();
