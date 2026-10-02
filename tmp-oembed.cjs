const https = require("https");
function get(url){return new Promise((res,rej)=>{https.get(url,{headers:{"User-Agent":"Mozilla/5.0"}},r=>{let d="";r.on("data",c=>d+=c);r.on("end",()=>res(d));}).on("error",rej);});}
(async()=>{
  for (const id of ["dQw4w9WgXcQ","jNQXAC9IVRw","kJQP7kiw5Fk","M7lc1UVf-VE"]) {
    try {
      const t = await get(`https://noembed.com/embed?url=${encodeURIComponent("https://www.youtube.com/watch?v="+id)}`);
      const j = JSON.parse(t);
      console.log(id, "noembed w/h:", j.width, j.height, "ar=", (j.width/j.height).toFixed(3));
    } catch(e){ console.log(id,"ERR",e.message); }
  }
})();
