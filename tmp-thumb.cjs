const https = require("https");
function dims(buf) {
  let i = 2;
  while (i < buf.length) {
    if (buf[i] !== 0xff) { i++; continue; }
    const marker = buf[i+1];
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      return { h: buf.readUInt16BE(i+5), w: buf.readUInt16BE(i+7) };
    }
    i += 2 + buf.readUInt16BE(i+2);
  }
  return null;
}
function get(url){return new Promise((res,rej)=>{https.get(url,r=>{const c=[];r.on("data",d=>c.push(d));r.on("end",()=>res(Buffer.concat(c)));}).on("error",rej);});}
(async()=>{
  for (const id of ["dQw4w9WgXcQ","jNQXAC9IVRw","kJQP7kiw5Fk"]) {
    for (const name of ["maxresdefault","hqdefault"]) {
      try { const b = await get(`https://i.ytimg.com/vi/${id}/${name}.jpg`); const d = dims(b);
        console.log(id, name, d ? `${d.w}x${d.h} ar=${(d.w/d.h).toFixed(3)}` : "n/a", b.length); }
      catch(e){ console.log(id,name,"ERR",e.message); }
    }
  }
})();
