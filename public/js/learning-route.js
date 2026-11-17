// Existing public bookmarks now enter the classroom edition. Event operations remain
// available explicitly via ?legacy=1 and the existing administrator route.
(()=>{
  const params=new URLSearchParams(location.search);
  if(params.get('legacy')==='1'||location.hash.startsWith('#/admin')||location.hash==='#admin')return;
  const target=new URL('learn.html',location.href);
  target.search=location.search;target.hash=location.hash;
  location.replace(target.href);
})();
